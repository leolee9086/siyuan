package filebrowser

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/agent"
	"github.com/siyuan-note/siyuan/kernel/fswalk"
	"github.com/siyuan-note/siyuan/kernel/internal/testutil/symlinkfixture"
)

func TestEditorReadWriteReturnsBoundedDocumentAndRevision(t *testing.T) {
	workspace := t.TempDir()
	path := filepath.Join(workspace, "notes", "guide.md")
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte("# guide\n"), 0600); err != nil {
		t.Fatal(err)
	}
	service := NewService(workspace, func() (map[string]*agent.TaskDirectoryBinding, error) { return nil, nil })

	document, err := service.ReadEditorFile(context.Background(), EditorReadRequest{RootID: "workspace", Path: "notes/guide.md"})
	if err != nil {
		t.Fatal(err)
	}
	if document.Text != "# guide\n" || document.Encoding != string(fswalk.TextEncodingUTF8) ||
		document.Language != "markdown" || document.ReadOnly || document.Revision == "" ||
		document.ContentURL != "/api/s-forge/file-browser/content/workspace/notes/guide.md" {
		t.Fatalf("unexpected editor document: %+v", document)
	}

	written, err := service.WriteEditorFile(context.Background(), EditorWriteRequest{
		RootID: "workspace", Path: "notes/guide.md", Text: "# changed\n", Encoding: fswalk.TextEncodingUTF8,
		ExpectedRevision: document.Revision,
	})
	if err != nil || written.Revision == document.Revision || written.Language != "markdown" {
		t.Fatalf("unexpected editor write: %+v err=%v", written, err)
	}
	if content, readErr := os.ReadFile(path); readErr != nil || string(content) != "# changed\n" {
		t.Fatalf("saved editor content mismatch: %q err=%v", content, readErr)
	}
	if _, err = service.WriteEditorFile(context.Background(), EditorWriteRequest{
		RootID: "workspace", Path: "notes/guide.md", Text: "stale", Encoding: fswalk.TextEncodingUTF8,
		ExpectedRevision: document.Revision,
	}); !errors.Is(err, ErrEditorConflict) {
		t.Fatalf("stale editor write returned %v", err)
	}
}

func TestEditorRejectsReadOnlyMountAndInvalidDocuments(t *testing.T) {
	workspace := t.TempDir()
	child := filepath.Join(workspace, "agent-task")
	if err := os.Mkdir(child, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(child, "note.txt"), []byte("read only\n"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(workspace, "binary.bin"), []byte{'a', 0, 'b'}, 0600); err != nil {
		t.Fatal(err)
	}
	service := NewService(workspace, func() (map[string]*agent.TaskDirectoryBinding, error) {
		return map[string]*agent.TaskDirectoryBinding{
			"session": &agent.TaskDirectoryBinding{Directories: []*agent.TaskDirectoryGrant{{
				ID: "child", Path: child, Name: "agent-task", Permission: agent.TaskDirectoryPermissionReadOnly,
			}}},
		}, nil
	})

	document, err := service.ReadEditorFile(context.Background(), EditorReadRequest{RootID: "workspace", Path: "agent-task/note.txt"})
	if err != nil || !document.ReadOnly || document.Language != "plaintext" {
		t.Fatalf("read-only editor document mismatch: %+v err=%v", document, err)
	}
	_, err = service.WriteEditorFile(context.Background(), EditorWriteRequest{
		RootID: "workspace", Path: "agent-task/note.txt", Text: "changed", Encoding: fswalk.TextEncodingUTF8,
		ExpectedRevision: document.Revision,
	})
	if !errors.Is(err, ErrWriteDenied) {
		t.Fatalf("read-only editor write returned %v", err)
	}
	if _, err = service.ReadEditorFile(context.Background(), EditorReadRequest{RootID: "workspace", Path: "binary.bin"}); !errors.Is(err, ErrEditorBinary) {
		t.Fatalf("binary editor read returned %v", err)
	}
	if _, err = service.ReadEditorFile(context.Background(), EditorReadRequest{RootID: "workspace", Path: "../outside.txt"}); !errors.Is(err, ErrPathTraversal) {
		t.Fatalf("traversal editor read returned %v", err)
	}
	outside := filepath.Join(t.TempDir(), "outside.txt")
	if err = os.WriteFile(outside, []byte("outside"), 0600); err != nil {
		t.Fatal(err)
	}
	symlinkfixture.Create(t, outside, filepath.Join(workspace, "linked.txt"))
	if _, err = service.ReadEditorFile(context.Background(), EditorReadRequest{RootID: "workspace", Path: "linked.txt"}); !errors.Is(err, ErrPathTraversal) {
		t.Fatalf("linked editor read returned %v", err)
	}
}
