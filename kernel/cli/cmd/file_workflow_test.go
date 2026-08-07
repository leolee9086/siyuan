package cmd

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/fswalk"
	"github.com/siyuan-note/siyuan/kernel/util"
)

func TestWriteWorkspaceFileFromSourcePreservesRawBytes(t *testing.T) {
	workspace := t.TempDir()
	originalWorkspace := util.WorkspaceDir
	util.WorkspaceDir = workspace
	defer func() { util.WorkspaceDir = originalWorkspace }()

	sourceRoot := t.TempDir()
	source := filepath.Join(sourceRoot, "raw.bin")
	raw := []byte{0xef, 0xbb, 0xbf, 'x', '\r', '\n', 0, 0xff}
	if err := os.WriteFile(source, raw, 0600); err != nil {
		t.Fatal(err)
	}
	destination, err := fswalk.New(workspace)
	if err != nil {
		t.Fatal(err)
	}
	if err = writeWorkspaceFileFromSource(context.Background(), destination, "nested/raw.bin", source); err != nil {
		t.Fatal(err)
	}
	written, err := os.ReadFile(filepath.Join(workspace, "nested", "raw.bin"))
	if err != nil || !bytes.Equal(written, raw) {
		t.Fatalf("source file write changed bytes: %v err=%v", written, err)
	}
	if _, relative, err := workspaceWalkerPath(context.Background(), "."); err != nil || relative != "" {
		t.Fatalf("workspace root path was not accepted: relative=%q err=%v", relative, err)
	}
}
