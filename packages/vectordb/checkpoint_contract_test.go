package vectordb

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/vmihailenco/msgpack/v5"
	"s-forge.local/vectordb/storage"
	"s-forge.local/vectordb/vamana"
)

func TestDiskVamanaCheckpointPublishesCompleteGeneration(t *testing.T) {
	path := t.TempDir()
	db, collection := newCheckpointCollection(t, path, "checkpoint", 20)

	updated := Point{ID: "point-0", Vector: []float32{100, 101, 102, 103}, Meta: []byte(`{"version":2}`)}
	createdX := Point{ID: "created-x", Vector: []float32{200, 201, 202, 203}, Meta: []byte(`{"kind":"x"}`)}
	createdY := Point{ID: "created-y", Vector: []float32{300, 301, 302, 303}}
	writeResult, err := collection.Write(context.Background(), WriteBatch{Operations: []WriteOperation{
		{Point: &updated},
		{DeleteID: "point-1"},
		{DeleteID: "point-2"},
		{Point: &createdX},
		{Point: &createdY},
	}}, WriteOptions{Durability: DurabilitySync})
	if err != nil {
		t.Fatal(err)
	}
	handle := collection.(*CollectionHandle)
	before := handle.col.(*VamanaCollection)
	if before.Index.NumPointsTotal() != 23 || before.Index.NumPoints() != 20 {
		t.Fatalf("checkpoint 前图计数不符合测试前提：total=%d，live=%d", before.Index.NumPointsTotal(), before.Index.NumPoints())
	}
	oldBasePath := before.BasePath
	walBytes := fileSizeOrZero(oldBasePath + VamanaWALFileExt)
	if walBytes == 0 {
		t.Fatal("checkpoint 前 WAL 不应为空")
	}
	statsBefore := collection.Stats()
	if statsBefore.TotalCount != 23 || statsBefore.DeletedCount != 3 || statsBefore.PendingCount != 3 || statsBefore.WALBytes != walBytes || statsBefore.CheckpointRecommended {
		t.Fatalf("checkpoint 前维护统计错误：%+v", statsBefore)
	}
	beforeSearch, err := collection.Search(createdX.Vector, SearchOptions{TopK: 1, EfSearch: 32})
	if err != nil || len(beforeSearch) != 1 || beforeSearch[0].ID != createdX.ID {
		t.Fatalf("checkpoint 前增量点不可搜索：%+v，%v", beforeSearch, err)
	}

	result, err := collection.Checkpoint(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if result.OriginalPoints != 23 || result.RemainingPoints != 20 || result.ReclaimedPoints != 3 || result.WALBytesBefore != walBytes {
		t.Fatalf("checkpoint 统计错误：%+v", result)
	}
	after := handle.col.(*VamanaCollection)
	if after.RootPath == "" || after.BasePath == oldBasePath || !strings.Contains(filepath.Base(after.BasePath), ".gen-") {
		t.Fatalf("checkpoint 未切换到 generation：root=%q，base=%q", after.RootPath, after.BasePath)
	}
	if after.Index.NumPointsTotal() != 20 || after.Index.NumPoints() != 20 || len(after.PendingVectors) != 0 {
		t.Fatalf("checkpoint 后增量区或墓碑未合并：total=%d，live=%d，pending=%d", after.Index.NumPointsTotal(), after.Index.NumPoints(), len(after.PendingVectors))
	}
	if got := fileSizeOrZero(after.BasePath + VamanaWALFileExt); got != 0 {
		t.Fatalf("新 generation 不应继承 WAL，实际大小 %d", got)
	}
	statsAfter := collection.Stats()
	if statsAfter.TotalCount != 20 || statsAfter.DeletedCount != 0 || statsAfter.PendingCount != 0 || statsAfter.WALBytes != 0 || statsAfter.CheckpointRecommended {
		t.Fatalf("checkpoint 后维护统计错误：%+v", statsAfter)
	}
	afterSearch, err := collection.Search(createdX.Vector, SearchOptions{TopK: 1, EfSearch: 32})
	if err != nil || len(afterSearch) != 1 || afterSearch[0].ID != createdX.ID {
		t.Fatalf("checkpoint 后搜索语义退化：%+v，%v", afterSearch, err)
	}
	assertCheckpointPoints(t, collection)

	if err := db.Close(); err != nil {
		t.Fatal(err)
	}
	reopened, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	reopenedCollection, err := reopened.OpenCollection("checkpoint")
	if err != nil {
		t.Fatal(err)
	}
	assertCheckpointPoints(t, reopenedCollection)
	next := Point{ID: "after-checkpoint", Vector: []float32{400, 401, 402, 403}}
	nextResult, err := reopenedCollection.Write(context.Background(), WriteBatch{Operations: []WriteOperation{{Point: &next}}}, WriteOptions{Durability: DurabilitySync})
	if err != nil {
		t.Fatal(err)
	}
	if nextResult.CommitSequence != writeResult.CommitSequence+1 {
		t.Fatalf("checkpoint 后提交序号不连续：之前 %+v，之后 %+v", writeResult, nextResult)
	}
}

func TestHNSWCheckpointTruncatesWAL(t *testing.T) {
	path := t.TempDir()
	db, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	collection, err := db.CreateCollectionWithOptions("hnsw-checkpoint", CollectionOptions{Engine: EngineHNSW, Dimension: 2})
	if err != nil {
		t.Fatal(err)
	}
	point := Point{ID: "point", Vector: []float32{1, 2}}
	writeResult, err := collection.Write(context.Background(), WriteBatch{Operations: []WriteOperation{{Point: &point}}}, WriteOptions{Durability: DurabilitySync})
	if err != nil {
		t.Fatal(err)
	}
	walPath := filepath.Join(path, "hnsw-checkpoint", WALFileName)
	if fileSizeOrZero(walPath) == 0 {
		t.Fatal("HNSW checkpoint 前 WAL 不应为空")
	}
	result, err := collection.Checkpoint(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if result.Engine != EngineHNSW || result.CommitSequence != writeResult.CommitSequence || result.WALBytesBefore == 0 {
		t.Fatalf("HNSW checkpoint 结果错误：%+v", result)
	}
	if _, err := os.Stat(walPath); !os.IsNotExist(err) {
		t.Fatalf("HNSW checkpoint 后 WAL 应删除，实际为 %v", err)
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}
	reopened, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	reopenedCollection, err := reopened.OpenCollection("hnsw-checkpoint")
	if err != nil {
		t.Fatal(err)
	}
	points, err := reopenedCollection.FetchPoints([]string{point.ID})
	if err != nil || len(points) != 1 {
		t.Fatalf("HNSW checkpoint 重开后丢失数据：%+v，%v", points, err)
	}
}

func TestHNSWCheckpointReportsWALRemovalFailure(t *testing.T) {
	path := t.TempDir()
	db, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	collection, err := db.CreateCollectionWithOptions("hnsw-checkpoint-remove-failure", CollectionOptions{
		Engine:         EngineHNSW,
		Dimension:      2,
		DistanceMetric: "l2",
	})
	if err != nil {
		t.Fatal(err)
	}
	point := Point{ID: "point", Vector: []float32{1, 2}}
	if _, err := collection.Write(context.Background(), WriteBatch{Operations: []WriteOperation{{Point: &point}}}, WriteOptions{Durability: DurabilitySync}); err != nil {
		t.Fatal(err)
	}
	walPath := filepath.Join(path, "hnsw-checkpoint-remove-failure", WALFileName)
	if err := os.Remove(walPath); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(walPath, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(walPath, "blocker"), []byte("block removal"), 0644); err != nil {
		t.Fatal(err)
	}

	if _, err := collection.Checkpoint(context.Background()); !errors.Is(err, ErrPersistenceFailed) {
		t.Fatalf("WAL 删除失败不得报告 checkpoint 成功：%v", err)
	}
}

func TestHNSWCheckpointDirectorySyncFailureKeepsWAL(t *testing.T) {
	path := t.TempDir()
	db, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	collection, err := db.CreateCollectionWithOptions("hnsw-checkpoint-sync-failure", CollectionOptions{
		Engine:         EngineHNSW,
		Dimension:      2,
		DistanceMetric: "l2",
	})
	if err != nil {
		t.Fatal(err)
	}
	point := Point{ID: "point", Vector: []float32{1, 2}}
	if _, err := collection.Write(context.Background(), WriteBatch{Operations: []WriteOperation{{Point: &point}}}, WriteOptions{Durability: DurabilitySync}); err != nil {
		t.Fatal(err)
	}
	walPath := filepath.Join(path, "hnsw-checkpoint-sync-failure", WALFileName)
	originalSyncDirectory := syncParentDirectory
	syncParentDirectory = func(string) error { return errors.New("injected directory sync failure") }
	_, checkpointErr := collection.Checkpoint(context.Background())
	syncParentDirectory = originalSyncDirectory
	if !errors.Is(checkpointErr, ErrPersistenceFailed) {
		t.Fatalf("快照目录同步失败应返回 ErrPersistenceFailed：%v", checkpointErr)
	}
	if fileSizeOrZero(walPath) == 0 {
		t.Fatal("快照未完成持久化时不得删除 WAL")
	}
	if _, err := collection.Checkpoint(context.Background()); err != nil {
		t.Fatalf("目录同步恢复后 checkpoint 应可重试：%v", err)
	}
}

func TestDiskVamanaCheckpointManifestFailureKeepsOldGeneration(t *testing.T) {
	path := t.TempDir()
	db, collection := newCheckpointCollection(t, path, "checkpoint-failure", 12)
	defer db.Close()
	point := Point{ID: "new", Vector: []float32{50, 51, 52, 53}}
	if _, err := collection.Write(context.Background(), WriteBatch{Operations: []WriteOperation{{Point: &point}}}, WriteOptions{Durability: DurabilitySync}); err != nil {
		t.Fatal(err)
	}
	vc := collection.(*CollectionHandle).col.(*VamanaCollection)
	oldBasePath := vc.BasePath
	oldTotal := vc.Index.NumPointsTotal()
	originalPublish := publishVamanaGenerationFile
	publishVamanaGenerationFile = func(string, string, uint64) error { return errors.New("injected manifest failure") }
	_, err := collection.Checkpoint(context.Background())
	publishVamanaGenerationFile = originalPublish
	if !errors.Is(err, ErrPersistenceFailed) {
		t.Fatalf("manifest 发布失败应返回 ErrPersistenceFailed，实际为 %v", err)
	}
	if vc.BasePath != oldBasePath || vc.Index.NumPointsTotal() != oldTotal {
		t.Fatalf("manifest 失败后当前 generation 被切换：base=%q，total=%d", vc.BasePath, vc.Index.NumPointsTotal())
	}
	points, fetchErr := collection.FetchPoints([]string{point.ID})
	if fetchErr != nil || len(points) != 1 {
		t.Fatalf("manifest 失败后旧 generation 不可用：%+v，%v", points, fetchErr)
	}
	if matches, globErr := filepath.Glob(vc.RootPath + ".gen-*.index"); globErr != nil || len(matches) != 0 {
		t.Fatalf("manifest 失败后遗留未发布 generation：%v，%v", matches, globErr)
	}
}

func TestDiskVamanaFlushCheckpointsWhenRecommended(t *testing.T) {
	path := t.TempDir()
	db, collection := newCheckpointCollection(t, path, "flush-checkpoint", 10)
	defer db.Close()
	point := Point{ID: "new", Vector: []float32{50, 51, 52, 53}}
	if _, err := collection.Write(context.Background(), WriteBatch{Operations: []WriteOperation{{Point: &point}}}, WriteOptions{Durability: DurabilitySync}); err != nil {
		t.Fatal(err)
	}
	if err := collection.Delete([]string{"point-0", "point-1", "point-2", "point-3"}); err != nil {
		t.Fatal(err)
	}
	if !collection.Stats().CheckpointRecommended {
		t.Fatal("测试阈值下写入后应建议 checkpoint")
	}
	if err := collection.Flush(); err != nil {
		t.Fatal(err)
	}
	stats := collection.Stats()
	if stats.CheckpointRecommended || stats.WALBytes != 0 || stats.PendingCount != 0 || !strings.Contains(stats.ActiveGeneration, ".gen-") {
		t.Fatalf("Flush 未执行推荐的 checkpoint：%+v", stats)
	}
}

func TestDiskVamanaAutomaticallyCheckpointsWALThreshold(t *testing.T) {
	path := t.TempDir()
	db, collection := newCheckpointCollectionWithThreshold(t, path, "auto-checkpoint", 10, 1)
	defer db.Close()
	oldGeneration := collection.Stats().ActiveGeneration
	point := Point{ID: "new", Vector: []float32{50, 51, 52, 53}}
	if _, err := collection.Write(context.Background(), WriteBatch{Operations: []WriteOperation{{Point: &point}}}, WriteOptions{Durability: DurabilitySync}); err != nil {
		t.Fatal(err)
	}
	waitForCheckpointCondition(t, func(stats CollectionStats) bool {
		return stats.ActiveGeneration != oldGeneration && stats.WALBytes == 0 && stats.PendingCount == 0 && stats.MaintenanceError == ""
	}, collection)
	points, err := collection.FetchPoints([]string{point.ID})
	if err != nil || len(points) != 1 {
		t.Fatalf("自动 checkpoint 后写入点不可见：%+v，%v", points, err)
	}
}

func TestDiskVamanaAutoCheckpointFailureIsObservableAndRetried(t *testing.T) {
	path := t.TempDir()
	db, collection := newCheckpointCollectionWithThreshold(t, path, "auto-checkpoint-retry", 10, 1)
	defer db.Close()
	handle := collection.(*CollectionHandle)
	oldGeneration := handle.col.(*VamanaCollection).BasePath
	originalPublish := publishVamanaGenerationFile
	publishVamanaGenerationFile = func(string, string, uint64) error { return errors.New("injected automatic checkpoint failure") }
	defer func() { publishVamanaGenerationFile = originalPublish }()

	first := Point{ID: "first", Vector: []float32{50, 51, 52, 53}}
	if _, err := collection.Write(context.Background(), WriteBatch{Operations: []WriteOperation{{Point: &first}}}, WriteOptions{Durability: DurabilitySync}); err != nil {
		t.Fatal(err)
	}
	waitForCheckpointCondition(t, func(stats CollectionStats) bool { return stats.MaintenanceError != "" }, collection)
	if handle.col.(*VamanaCollection).BasePath != oldGeneration {
		t.Fatal("自动 checkpoint 发布失败后不应切换 generation")
	}
	if points, err := collection.FetchPoints([]string{first.ID}); err != nil || len(points) != 1 {
		t.Fatalf("自动 checkpoint 失败后旧 generation 不可服务：%+v，%v", points, err)
	}

	publishVamanaGenerationFile = originalPublish
	second := Point{ID: "second", Vector: []float32{60, 61, 62, 63}}
	if _, err := collection.Write(context.Background(), WriteBatch{Operations: []WriteOperation{{Point: &second}}}, WriteOptions{Durability: DurabilitySync}); err != nil {
		t.Fatal(err)
	}
	waitForCheckpointCondition(t, func(stats CollectionStats) bool {
		return stats.MaintenanceError == "" && stats.WALBytes == 0 && strings.Contains(stats.ActiveGeneration, ".gen-")
	}, collection)
}

func TestDiskVamanaCloseWaitsForAutomaticCheckpoint(t *testing.T) {
	path := t.TempDir()
	db, collection := newCheckpointCollectionWithThreshold(t, path, "auto-checkpoint-close", 10, 1)
	originalPublish := publishVamanaGenerationFile
	started := make(chan struct{})
	release := make(chan struct{})
	var once sync.Once
	publishVamanaGenerationFile = func(rootPath, generationPath string, sequence uint64) error {
		once.Do(func() { close(started) })
		<-release
		return originalPublish(rootPath, generationPath, sequence)
	}
	defer func() { publishVamanaGenerationFile = originalPublish }()

	point := Point{ID: "new", Vector: []float32{50, 51, 52, 53}}
	if _, err := collection.Write(context.Background(), WriteBatch{Operations: []WriteOperation{{Point: &point}}}, WriteOptions{Durability: DurabilitySync}); err != nil {
		t.Fatal(err)
	}
	select {
	case <-started:
	case <-time.After(5 * time.Second):
		t.Fatal("自动 checkpoint 未进入发布阶段")
	}
	closed := make(chan error, 1)
	go func() { closed <- db.Close() }()
	close(release)
	select {
	case err := <-closed:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("Close 与自动 checkpoint 并发时死锁")
	}
}

func TestDiskVamanaCheckpointEmptyCollectionStopsWALReplay(t *testing.T) {
	path := t.TempDir()
	db, collection := newCheckpointCollection(t, path, "checkpoint-empty", 8)
	ids := make([]string, 8)
	for i := range ids {
		ids[i] = fmt.Sprintf("point-%d", i)
	}
	if err := collection.Delete(ids); err != nil {
		t.Fatal(err)
	}
	result, err := collection.Checkpoint(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if result.RemainingPoints != 0 || result.WALBytesBefore == 0 || collection.Stats().Count != 0 {
		t.Fatalf("空集合 checkpoint 结果错误：%+v，stats=%+v", result, collection.Stats())
	}
	stats := collection.Stats()
	if stats.TotalCount != 0 || stats.DeletedCount != 0 || stats.PendingCount != 0 || stats.WALBytes != 0 || stats.CheckpointRecommended || !strings.Contains(stats.ActiveGeneration, ".gen-") {
		t.Fatalf("空集合 checkpoint 未发布已回收 generation：%+v", stats)
	}
	search, err := collection.Search(make([]float32, 4), SearchOptions{TopK: 10, EfSearch: 32})
	if err != nil || len(search) != 0 {
		t.Fatalf("空 generation 搜索错误：%+v，%v", search, err)
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}
	reopened, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	reopenedCollection, err := reopened.OpenCollection("checkpoint-empty")
	if err != nil {
		t.Fatal(err)
	}
	if reopenedCollection.Stats().Count != 0 {
		t.Fatalf("空集合重开后出现已删除 ID：%+v", reopenedCollection.Stats())
	}
	point := Point{ID: "reborn", Vector: []float32{1, 2, 3, 4}}
	if err := reopenedCollection.Upsert([]Point{point}); err != nil {
		t.Fatal(err)
	}
	points, err := reopenedCollection.FetchPoints([]string{point.ID})
	if err != nil || len(points) != 1 {
		t.Fatalf("空 checkpoint 后无法继续写入：%+v，%v", points, err)
	}
}

func newCheckpointCollection(t *testing.T, path, name string, count int) (*Database, CollectionAPI) {
	return newCheckpointCollectionWithThreshold(t, path, name, count, DefaultVamanaCheckpointWALBytes)
}

func newCheckpointCollectionWithThreshold(t *testing.T, path, name string, count int, threshold int64) (*Database, CollectionAPI) {
	t.Helper()
	db, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	points := make([]Point, count)
	for i := range points {
		points[i] = Point{
			ID:     fmt.Sprintf("point-%d", i),
			Vector: []float32{float32(i), float32(i + 1), float32(i + 2), float32(i + 3)},
			Meta:   []byte(fmt.Sprintf(`{"index":%d}`, i)),
		}
	}
	config := vamana.DefaultDiskBuildConfig()
	config.R = 8
	config.L = 20
	config.MaxBackedges = 8
	collection, err := db.CreateCollectionWithOptions(name, CollectionOptions{
		Engine:             EngineDiskVamana,
		Points:             points,
		DistanceMetric:     "l2",
		DiskBuildConfig:    &config,
		WALCheckpointBytes: threshold,
	})
	if err != nil {
		_ = db.Close()
		t.Fatal(err)
	}
	return db, collection
}

func waitForCheckpointCondition(t *testing.T, condition func(CollectionStats) bool, collection CollectionAPI) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		stats := collection.Stats()
		if condition(stats) {
			return
		}
		time.Sleep(time.Millisecond)
	}
	t.Fatalf("等待 checkpoint 状态超时：%+v", collection.Stats())
}

func assertCheckpointPoints(t *testing.T, collection CollectionAPI) {
	t.Helper()
	points, err := collection.FetchPoints([]string{"point-0", "point-1", "point-2", "created-x", "created-y"})
	if err != nil {
		t.Fatal(err)
	}
	if len(points) != 3 || points[0].ID != "point-0" || points[0].Vector[0] != 100 || string(points[0].Meta) != `{"version":2}` || points[1].ID != "created-x" || points[2].ID != "created-y" {
		t.Fatalf("checkpoint 后点或元数据错误：%+v", points)
	}
}

func TestVamanaManifestRejectsPathTraversal(t *testing.T) {
	rootPath := filepath.Join(t.TempDir(), "vamana")
	data, err := msgpack.Marshal(&vamanaGenerationManifest{Version: vamanaManifestVersion, Generation: "../escape"})
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(rootPath+vamanaManifestFileExt, data, 0644); err != nil {
		t.Fatal(err)
	}
	if _, err := resolveVamanaGeneration(rootPath); !errors.Is(err, storage.ErrCorruptedFile) {
		t.Fatalf("manifest 路径穿越应被拒绝，实际为 %v", err)
	}
}

func TestVamanaManifestRejectsSequenceMismatch(t *testing.T) {
	path := t.TempDir()
	db, collection := newCheckpointCollection(t, path, "manifest-sequence", 6)
	point := Point{ID: "new", Vector: []float32{9, 10, 11, 12}}
	if err := collection.Upsert([]Point{point}); err != nil {
		t.Fatal(err)
	}
	if _, err := collection.Checkpoint(context.Background()); err != nil {
		t.Fatal(err)
	}
	rootPath := collection.(*CollectionHandle).col.(*VamanaCollection).RootPath
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}
	manifest, err := readVamanaGenerationManifest(rootPath)
	if err != nil {
		t.Fatal(err)
	}
	manifest.CommitSequence++
	data, err := msgpack.Marshal(&manifest)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(rootPath+vamanaManifestFileExt, data, 0644); err != nil {
		t.Fatal(err)
	}
	if _, err := Open(path); !errors.Is(err, ErrStorageCorrupted) {
		t.Fatalf("manifest 与 state 序号不一致应拒绝打开，实际为 %v", err)
	}
}
