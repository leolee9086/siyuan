package cmd

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/util"
)

func TestCopyWorkspacePathUsesBoundCopyTreeWorkflow(t *testing.T) {
	workspace := t.TempDir()
	originalWorkspace := util.WorkspaceDir
	util.WorkspaceDir = workspace
	defer func() { util.WorkspaceDir = originalWorkspace }()

	source := filepath.Join(workspace, "source", "nested", "file.txt")
	if err := os.MkdirAll(filepath.Dir(source), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(source, []byte("payload"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := copyWorkspacePath(context.Background(), "source", "destination"); err != nil {
		t.Fatalf("CLI copy failed: %v", err)
	}
	destination := filepath.Join(workspace, "destination", "nested", "file.txt")
	data, err := os.ReadFile(destination)
	if err != nil || string(data) != "payload" {
		t.Fatalf("CLI copy produced %q at %s: %v", data, destination, err)
	}
	if err = copyWorkspacePath(context.Background(), "../outside", "destination"); err == nil {
		t.Fatal("CLI copy accepted a workspace escape")
	}
}
