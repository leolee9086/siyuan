package vectordb

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func TestLoadDatabaseMatchesOpenAcrossEngines(t *testing.T) {
	path := t.TempDir()
	db, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.CreateCollectionWithOptions("hnsw", CollectionOptions{
		Engine:         EngineHNSW,
		Dimension:      2,
		DistanceMetric: "l2",
		Points:         []Point{{ID: "h", Vector: []float32{1, 2}}},
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := db.CreateCollectionWithOptions("disk", CollectionOptions{
		Engine:         EngineDiskVamana,
		DistanceMetric: "l2",
		Points: []Point{
			{ID: "d0", Vector: []float32{1, 0}},
			{ID: "d1", Vector: []float32{0, 1}},
			{ID: "d2", Vector: []float32{-1, 0}},
		},
	}); err != nil {
		t.Fatal(err)
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}

	loaded, err := LoadDatabase(path)
	if err != nil {
		t.Fatal(err)
	}
	defer loaded.Close()
	stats := loaded.ListCollectionStats()
	if len(stats) != 2 || stats[0].Name != "disk" || stats[0].Engine != EngineDiskVamana || stats[0].Count != 3 || stats[1].Name != "hnsw" || stats[1].Engine != EngineHNSW || stats[1].Count != 1 {
		t.Fatalf("LoadDatabase 与 Open 的集合视图不一致：%+v", stats)
	}
	disk, err := loaded.OpenCollection("disk")
	if err != nil {
		t.Fatal(err)
	}
	results, err := disk.Search([]float32{1, 0}, SearchOptions{TopK: 1, EfSearch: 16})
	if err != nil || len(results) != 1 || results[0].ID != "d0" {
		t.Fatalf("LoadDatabase 打开的 DiskVamana 不可查询：results=%+v，err=%v", results, err)
	}
	if _, err := disk.Write(context.Background(), WriteBatch{Operations: []WriteOperation{{Point: &Point{ID: "d3", Vector: []float32{2, 0}}}}}, WriteOptions{Durability: DurabilitySync}); err != nil {
		t.Fatalf("LoadDatabase 打开的 DiskVamana 不可写入：%v", err)
	}
}

func TestLoadDatabaseRejectsCorruptedCollection(t *testing.T) {
	path := t.TempDir()
	collectionPath := filepath.Join(path, "broken")
	if err := os.MkdirAll(collectionPath, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(collectionPath, SnapshotFileName), []byte("broken"), 0644); err != nil {
		t.Fatal(err)
	}
	if _, err := LoadDatabase(path); err == nil {
		t.Fatal("LoadDatabase 不得静默跳过损坏集合")
	}
	if err := os.RemoveAll(collectionPath); err != nil {
		t.Fatal(err)
	}
	db, err := Open(path)
	if err != nil {
		t.Fatalf("LoadDatabase 失败后数据库锁未释放：%v", err)
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}
}

func TestOpenFailureClosesPreviouslyOpenedDiskCollections(t *testing.T) {
	path := t.TempDir()
	db, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.CreateCollectionWithOptions("a-valid", CollectionOptions{
		Engine:         EngineDiskVamana,
		DistanceMetric: "l2",
		Points: []Point{
			{ID: "a", Vector: []float32{1, 0}},
			{ID: "b", Vector: []float32{0, 1}},
			{ID: "c", Vector: []float32{-1, 0}},
		},
	}); err != nil {
		t.Fatal(err)
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}
	brokenPath := filepath.Join(path, "z-broken")
	if err := os.MkdirAll(brokenPath, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(brokenPath, SnapshotFileName), []byte("broken"), 0644); err != nil {
		t.Fatal(err)
	}
	if _, err := Open(path); err == nil {
		t.Fatal("损坏集合应导致 Open 失败")
	}
	if err := os.RemoveAll(filepath.Join(path, "a-valid")); err != nil {
		t.Fatalf("Open 部分失败后 DiskVamana mmap 句柄未释放：%v", err)
	}
	if err := os.RemoveAll(brokenPath); err != nil {
		t.Fatal(err)
	}
	reopened, err := Open(path)
	if err != nil {
		t.Fatalf("Open 部分失败后数据库锁未释放：%v", err)
	}
	if err := reopened.Close(); err != nil {
		t.Fatal(err)
	}
}

const (
	databaseLockHelperModeEnv = "VECTORDB_LOCK_HELPER_MODE"
	databaseLockHelperPathEnv = "VECTORDB_LOCK_HELPER_PATH"
)

func TestDatabaseLockRejectsSecondOwnerAndReleasesOnClose(t *testing.T) {
	path := t.TempDir()
	db, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := Open(path); !errors.Is(err, ErrDatabaseLocked) {
		_ = db.Close()
		t.Fatalf("同一进程第二次打开应返回 ErrDatabaseLocked，实际为 %v", err)
	}
	runDatabaseLockHelper(t, path, "locked")
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}
	runDatabaseLockHelper(t, path, "available")
}

func TestDatabaseLockReleasedWhenOpenFails(t *testing.T) {
	path := t.TempDir()
	collectionPath := filepath.Join(path, "broken")
	if err := os.MkdirAll(collectionPath, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(collectionPath, SnapshotFileName), []byte("broken"), 0644); err != nil {
		t.Fatal(err)
	}
	if _, err := Open(path); err == nil {
		t.Fatal("损坏集合应导致 Open 失败")
	}
	if err := os.RemoveAll(collectionPath); err != nil {
		t.Fatal(err)
	}
	db, err := Open(path)
	if err != nil {
		t.Fatalf("Open 失败后数据库锁未释放：%v", err)
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}
}

func TestDatabaseLockHelperProcess(t *testing.T) {
	mode := os.Getenv(databaseLockHelperModeEnv)
	if mode == "" {
		return
	}
	path := os.Getenv(databaseLockHelperPathEnv)
	db, err := Open(path)
	switch mode {
	case "locked":
		if !errors.Is(err, ErrDatabaseLocked) {
			t.Fatalf("子进程应观察到 ErrDatabaseLocked，实际为 %v", err)
		}
	case "available":
		if err != nil {
			t.Fatalf("首个所有者关闭后子进程无法获取锁：%v", err)
		}
		if err := db.Close(); err != nil {
			t.Fatal(err)
		}
	default:
		t.Fatalf("未知 helper 模式 %q", mode)
	}
}

func runDatabaseLockHelper(t *testing.T, path, mode string) {
	t.Helper()
	command := exec.Command(os.Args[0], "-test.run=^TestDatabaseLockHelperProcess$", "-test.count=1")
	command.Env = append(os.Environ(), databaseLockHelperModeEnv+"="+mode, databaseLockHelperPathEnv+"="+path)
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("数据库锁子进程失败：%v\n%s", err, output)
	}
}
