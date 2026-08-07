package tools

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/util"
)

func TestFileCopyUsesBoundCopyTreeWorkflow(t *testing.T) {
	workspace := t.TempDir()
	originalWorkspace := util.WorkspaceDir
	util.WorkspaceDir = workspace
	defer func() { util.WorkspaceDir = originalWorkspace }()

	writeWorkspaceCopyFixture(t, workspace, "source/nested/file.txt", "new payload")
	writeWorkspaceCopyFixture(t, workspace, "destination/nested/file.txt", "old payload")
	result, err := fileCopy(map[string]any{"src": "source", "dst": "destination"})
	if err != nil || result.IsError {
		t.Fatalf("MCP copy failed: result=%+v err=%v", result, err)
	}
	assertWorkspaceCopyContent(t, filepath.Join(workspace, "destination", "nested", "file.txt"), "new payload")
	if len(result.Content) != 1 || !strings.Contains(result.Content[0].Text, "copied: source -> destination") {
		t.Fatalf("MCP copy response changed: %+v", result)
	}

	escapeResult, err := fileCopy(map[string]any{"src": "../outside", "dst": "destination"})
	if err != nil || !escapeResult.IsError || len(escapeResult.Content) != 1 ||
		!strings.Contains(escapeResult.Content[0].Text, "escapes workspace") {
		t.Fatalf("MCP copy accepted a workspace escape: result=%+v err=%v", escapeResult, err)
	}
}

func writeWorkspaceCopyFixture(t *testing.T, workspace, relative, content string) {
	t.Helper()
	path := filepath.Join(workspace, filepath.FromSlash(relative))
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0600); err != nil {
		t.Fatal(err)
	}
}

func assertWorkspaceCopyContent(t *testing.T, path, expected string) {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil || string(data) != expected {
		t.Fatalf("unexpected copied content at %s: %q err=%v", path, data, err)
	}
}
