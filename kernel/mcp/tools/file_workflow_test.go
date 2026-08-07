package tools

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/util"
)

func TestFileWorkflowsUseBoundDeepModuleWithoutChangingRawReadWrite(t *testing.T) {
	workspace := t.TempDir()
	originalWorkspace := util.WorkspaceDir
	util.WorkspaceDir = workspace
	defer func() { util.WorkspaceDir = originalWorkspace }()

	raw := []byte{'o', 'n', 'e', '\r', '\n', 't', 'w', 'o', 0, '\n', 0xff}
	if err := os.WriteFile(filepath.Join(workspace, "raw.bin"), raw, 0600); err != nil {
		t.Fatal(err)
	}
	read, err := fileRead(map[string]any{
		"path": "raw.bin", "offset": float64(2), "limit": float64(1),
	})
	if err != nil || read.IsError || len(read.Content) != 1 ||
		!bytes.Equal([]byte(read.Content[0].Text), []byte{'t', 'w', 'o', 0}) {
		t.Fatalf("raw line read changed: result=%+v bytes=%v err=%v", read, []byte(read.Content[0].Text), err)
	}

	written := string([]byte{0xef, 0xbb, 0xbf, 'x', '\r', '\n', 0, 0xff})
	write, err := fileWrite(map[string]any{"path": "nested/output.bin", "data": written})
	if err != nil || write.IsError {
		t.Fatalf("raw write failed: result=%+v err=%v", write, err)
	}
	actual, err := os.ReadFile(filepath.Join(workspace, "nested", "output.bin"))
	if err != nil || !bytes.Equal(actual, []byte(written)) {
		t.Fatalf("raw write changed bytes: %v err=%v", actual, err)
	}
	if empty, emptyErr := fileWrite(map[string]any{"path": "empty.txt", "data": ""}); emptyErr != nil || empty.IsError {
		t.Fatalf("empty file write failed: result=%+v err=%v", empty, emptyErr)
	}
}

func TestFileListStatMoveDeleteAndRootProtection(t *testing.T) {
	workspace := t.TempDir()
	originalWorkspace := util.WorkspaceDir
	util.WorkspaceDir = workspace
	defer func() { util.WorkspaceDir = originalWorkspace }()

	if err := os.MkdirAll(filepath.Join(workspace, "source", "nested"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(workspace, "source", "nested", "file.txt"), []byte("payload"), 0600); err != nil {
		t.Fatal(err)
	}
	listed, err := fileList(map[string]any{"path": ".", "limit": float64(20)})
	if err != nil || listed.IsError || !strings.Contains(listed.Content[0].Text, "source [DIR]") {
		t.Fatalf("workspace root listing failed: result=%+v err=%v", listed, err)
	}
	stat, err := fileStat(map[string]any{"path": "source/nested/file.txt"})
	if err != nil || stat.IsError || !strings.Contains(stat.Content[0].Text, "Size: 7") ||
		!strings.Contains(stat.Content[0].Text, "IsDir: false") {
		t.Fatalf("bound stat failed: result=%+v err=%v", stat, err)
	}
	moved, err := fileRename(map[string]any{"old": "source", "new": "moved/deep/source"})
	if err != nil || moved.IsError {
		t.Fatalf("bound move failed: result=%+v err=%v", moved, err)
	}
	if data, readErr := os.ReadFile(filepath.Join(workspace, "moved", "deep", "source", "nested", "file.txt")); readErr != nil || string(data) != "payload" {
		t.Fatalf("moved content mismatch: %q err=%v", data, readErr)
	}
	deleted, err := fileDelete(map[string]any{"path": "moved"})
	if err != nil || deleted.IsError {
		t.Fatalf("recursive delete failed: result=%+v err=%v", deleted, err)
	}
	if _, statErr := os.Stat(filepath.Join(workspace, "moved")); !os.IsNotExist(statErr) {
		t.Fatalf("recursive delete left the tree: %v", statErr)
	}
	rootDelete, err := fileDelete(map[string]any{"path": "."})
	if err != nil || !rootDelete.IsError || !strings.Contains(rootDelete.Content[0].Text, "root cannot be mutated") {
		t.Fatalf("workspace root deletion was not rejected: result=%+v err=%v", rootDelete, err)
	}
}
