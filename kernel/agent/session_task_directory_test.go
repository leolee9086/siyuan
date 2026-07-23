package agent

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/88250/lute/ast"
	"github.com/siyuan-note/siyuan/kernel/util"
)

func TestListSessionsReturnsTaskDirectoryStoreError(t *testing.T) {
	originalHomeDir, originalWorkspaceDir, originalDataDir := util.HomeDir, util.WorkspaceDir, util.DataDir
	t.Cleanup(func() {
		util.HomeDir = originalHomeDir
		util.WorkspaceDir = originalWorkspaceDir
		util.DataDir = originalDataDir
	})

	baseDir := t.TempDir()
	util.HomeDir = filepath.Join(baseDir, "home")
	util.WorkspaceDir = filepath.Join(baseDir, "workspace")
	util.DataDir = filepath.Join(baseDir, "data")
	if err := os.MkdirAll(filepath.Dir(sessionsIndexPath()), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(sessionsIndexPath(), []byte(`{"session-1":{"id":"session-1","title":"test"}}`), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Dir(taskDirectoriesPath()), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(taskDirectoriesPath(), []byte(`{"version":1,"bindings":`), 0600); err != nil {
		t.Fatal(err)
	}

	result, err := ListSessions(1, 30, "", "", "native-agent")
	if err == nil || result != nil {
		t.Fatalf("malformed capability store must fail ListSessions: result=%+v err=%v", result, err)
	}
}

func TestNormalizeSessionTargetKind(t *testing.T) {
	if got := normalizeSessionTargetKind(""); got != "native-agent" {
		t.Fatalf("legacy session target = %q, want native-agent", got)
	}
	if got := normalizeSessionTargetKind("magi"); got != "magi" {
		t.Fatalf("magi session target = %q, want magi", got)
	}
	if got := normalizeSessionTargetKind("unknown"); got != "native-agent" {
		t.Fatalf("unknown session target = %q, want native-agent", got)
	}
}

func TestTaskDirectoryBindingIsWorkspaceOwnedAndSupportsMultiplePermissions(t *testing.T) {
	originalWorkspaceDir, originalDataDir := util.WorkspaceDir, util.DataDir
	t.Cleanup(func() {
		util.WorkspaceDir = originalWorkspaceDir
		util.DataDir = originalDataDir
	})

	baseDir := t.TempDir()
	util.WorkspaceDir = filepath.Join(baseDir, "workspace")
	util.DataDir = filepath.Join(util.WorkspaceDir, "data")
	if err := os.MkdirAll(filepath.Join(util.DataDir, "storage", "ai", "agent", "sessions"), 0700); err != nil {
		t.Fatal(err)
	}
	sessionID := ast.NewNodeID()
	if err := os.MkdirAll(filepath.Join(sessionsDir(), sessionID), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(sessionsDir(), sessionID, "session.json"), []byte(`{"id":"`+sessionID+`"}`), 0600); err != nil {
		t.Fatal(err)
	}
	mainDir := filepath.Join(baseDir, "main")
	readDir := filepath.Join(baseDir, "read")
	writeDir := filepath.Join(baseDir, "write")
	commandDir := filepath.Join(baseDir, "command")
	for _, dir := range []string{mainDir, readDir, writeDir, commandDir} {
		if err := os.MkdirAll(dir, 0700); err != nil {
			t.Fatal(err)
		}
	}

	binding, err := BindTaskDirectory(sessionID, mainDir, "owner-a")
	if err != nil {
		t.Fatal(err)
	}
	if binding.Main == nil || binding.Main.ID != "main" || binding.Main.Permission != TaskDirectoryPermissionReadWrite {
		t.Fatalf("unexpected main binding: %+v", binding.Main)
	}
	for _, item := range []struct {
		dir        string
		permission TaskDirectoryPermission
	}{
		{readDir, TaskDirectoryPermissionReadOnly},
		{writeDir, TaskDirectoryPermissionReadWrite},
		{commandDir, TaskDirectoryPermissionCommand},
	} {
		binding, err = AddTaskDirectory(sessionID, item.dir, item.permission, "owner-a")
		if err != nil {
			t.Fatal(err)
		}
	}
	if len(binding.Directories) != 3 {
		t.Fatalf("expected three additional directory grants, got %d", len(binding.Directories))
	}
	storePath := taskDirectoriesPath()
	if filepath.Dir(storePath) != filepath.Join(util.DataDir, ".siyuan") {
		t.Fatalf("capability store must be workspace-owned: %s", storePath)
	}
	if _, err := os.Stat(storePath); err != nil {
		t.Fatal(err)
	}
	deletedSessionID := ast.NewNodeID()
	if err := os.MkdirAll(filepath.Join(sessionsDir(), deletedSessionID), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(sessionsDir(), deletedSessionID, "session.json"), []byte(`{"id":"`+deletedSessionID+`"}`), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := BindTaskDirectory(deletedSessionID, mainDir, "owner-a"); err != nil {
		t.Fatal(err)
	}
	if _, err := AddTaskDirectory(deletedSessionID, readDir, TaskDirectoryPermissionReadOnly, "owner-a"); err != nil {
		t.Fatal(err)
	}
	if err := DeleteSession(deletedSessionID); err != nil {
		t.Fatal(err)
	}
	if deletedBinding, err := GetTaskDirectoryBinding(deletedSessionID); err != nil || deletedBinding != nil {
		t.Fatalf("deleting a session must clear all grants: binding=%+v err=%v", deletedBinding, err)
	}
	loaded, err := GetTaskDirectoryBinding(sessionID)
	if err != nil {
		t.Fatal(err)
	}
	if loaded.Main == nil || len(loaded.Directories) != 3 {
		t.Fatalf("loaded binding lost grants: %+v", loaded)
	}
	if _, err := ListSessions(1, 30, "", "owner-a", "native-agent"); err != nil {
		t.Fatal(err)
	}
	indexData, err := os.ReadFile(sessionsIndexPath())
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(indexData), "taskDirectory") || strings.Contains(string(indexData), "agent-task-directories") {
		t.Fatalf("session index must not contain task-directory capability metadata: %s", indexData)
	}
	if err := UnbindTaskDirectory(sessionID, loaded.Directories[0].ID); err != nil {
		t.Fatal(err)
	}
	loaded, err = GetTaskDirectoryBinding(sessionID)
	if err != nil || len(loaded.Directories) != 2 {
		t.Fatalf("unbind additional grant failed: binding=%+v err=%v", loaded, err)
	}
	workspaceCopyData := filepath.Join(baseDir, "workspace-copy", "data")
	if err := os.MkdirAll(filepath.Join(workspaceCopyData, ".siyuan"), 0700); err != nil {
		t.Fatal(err)
	}
	storeBytes, err := os.ReadFile(storePath)
	if err != nil {
		t.Fatal(err)
	}
	copyStorePath := filepath.Join(workspaceCopyData, ".siyuan", "agent-task-directories.json")
	if err := os.WriteFile(copyStorePath, storeBytes, 0600); err != nil {
		t.Fatal(err)
	}
	util.DataDir = workspaceCopyData
	if copied, err := GetTaskDirectoryBinding(sessionID); err != nil || copied == nil || copied.Main == nil {
		t.Fatalf("workspace copy must carry capability store: binding=%+v err=%v", copied, err)
	}
	if err := os.RemoveAll(mainDir); err != nil {
		t.Fatal(err)
	}
	if unavailable, err := GetTaskDirectoryBinding(sessionID); err == nil || unavailable != nil {
		t.Fatalf("missing task root must fail closed: binding=%+v err=%v", unavailable, err)
	}
}
