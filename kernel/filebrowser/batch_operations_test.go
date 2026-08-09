package filebrowser

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/agent"
)

func TestDeleteBatchDeletesDescendantsBeforeParentsAndKeepsItemErrors(t *testing.T) {
	workspace := t.TempDir()
	if err := os.MkdirAll(filepath.Join(workspace, "tree", "nested"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(workspace, "tree", "nested", "child.txt"), []byte("child"), 0600); err != nil {
		t.Fatal(err)
	}
	service := NewService(workspace, func() (map[string]*agent.TaskDirectoryBinding, error) { return nil, nil })
	result, err := service.DeleteBatch(context.Background(), BatchDeleteRequest{Items: []FileRequest{
		{RootID: "workspace", Path: "tree"},
		{RootID: "workspace", Path: "tree/nested/child.txt"},
		{RootID: "workspace", Path: "missing.txt"},
	}})
	if err != nil {
		t.Fatal(err)
	}
	if result.SuccessCount != 2 || result.FailureCount != 1 || len(result.Items) != 3 {
		t.Fatalf("unexpected batch result: %+v", result)
	}
	if result.Items[0].Result == nil || result.Items[1].Result == nil || result.Items[2].Error == nil ||
		result.Items[2].Error.Code != "path-not-found" {
		t.Fatalf("unexpected per-item result: %+v", result.Items)
	}
	if _, err = os.Stat(filepath.Join(workspace, "tree")); !os.IsNotExist(err) {
		t.Fatalf("selected parent tree remained: %v", err)
	}
}

func TestDeleteBatchRejectsDuplicatesBeforeMutating(t *testing.T) {
	workspace := t.TempDir()
	path := filepath.Join(workspace, "entry.txt")
	if err := os.WriteFile(path, []byte("entry"), 0600); err != nil {
		t.Fatal(err)
	}
	service := NewService(workspace, func() (map[string]*agent.TaskDirectoryBinding, error) { return nil, nil })
	_, err := service.DeleteBatch(context.Background(), BatchDeleteRequest{Items: []FileRequest{
		{RootID: "workspace", Path: "entry.txt"},
		{RootID: "workspace", Path: "./entry.txt"},
	}})
	if !errors.Is(err, ErrBatchDuplicate) {
		t.Fatalf("expected duplicate rejection, got %v", err)
	}
	if _, err = os.Stat(path); err != nil {
		t.Fatalf("duplicate validation must not mutate entry: %v", err)
	}
}

func TestDeleteBatchEnforcesBounds(t *testing.T) {
	service := NewService(t.TempDir(), func() (map[string]*agent.TaskDirectoryBinding, error) { return nil, nil })
	if _, err := service.DeleteBatch(context.Background(), BatchDeleteRequest{}); !errors.Is(err, ErrBatchItemsEmpty) {
		t.Fatalf("empty batch error: %v", err)
	}
	items := make([]FileRequest, 101)
	if _, err := service.DeleteBatch(context.Background(), BatchDeleteRequest{Items: items}); !errors.Is(err, ErrBatchItemsTooLarge) {
		t.Fatalf("large batch error: %v", err)
	}
}
