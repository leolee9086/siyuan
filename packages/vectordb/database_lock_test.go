package vectordb

import (
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

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
