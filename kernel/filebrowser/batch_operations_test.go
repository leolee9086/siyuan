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

func TestCopyBatchCopiesIntoExistingDirectoryAndKeepsPerItemFailures(t *testing.T) {
	workspace := t.TempDir()
	if err := os.MkdirAll(filepath.Join(workspace, "source", "nested"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(filepath.Join(workspace, "out"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(workspace, "source", "one.txt"), []byte("one"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(workspace, "source", "nested", "two.txt"), []byte("two"), 0600); err != nil {
		t.Fatal(err)
	}
	service := NewService(workspace, func() (map[string]*agent.TaskDirectoryBinding, error) { return nil, nil })
	result, err := service.CopyBatch(context.Background(), BatchCopyRequest{
		Items: []FileRequest{
			{RootID: "workspace", Path: "source/one.txt"},
			{RootID: "workspace", Path: "source/nested"},
			{RootID: "workspace", Path: "missing.txt"},
		},
		DestinationRootID: "workspace", DestinationPath: "out",
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.SuccessCount != 2 || result.FailureCount != 1 || len(result.Items) != 3 ||
		result.Items[2].Error == nil || result.Items[2].Error.Code != "path-not-found" {
		t.Fatalf("unexpected copy batch result: %+v", result)
	}
	for path, expected := range map[string]string{
		filepath.Join(workspace, "out", "one.txt"):           "one",
		filepath.Join(workspace, "out", "nested", "two.txt"): "two",
	} {
		data, readErr := os.ReadFile(path)
		if readErr != nil || string(data) != expected {
			t.Fatalf("copied batch file %s: %q err=%v", path, data, readErr)
		}
	}
}

func TestMoveBatchMovesSelectedEntriesIntoExistingDirectory(t *testing.T) {
	workspace := t.TempDir()
	if err := os.MkdirAll(filepath.Join(workspace, "source", "nested"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(filepath.Join(workspace, "out"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(workspace, "source", "one.txt"), []byte("one"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(workspace, "source", "nested", "two.txt"), []byte("two"), 0600); err != nil {
		t.Fatal(err)
	}
	service := NewService(workspace, func() (map[string]*agent.TaskDirectoryBinding, error) { return nil, nil })
	result, err := service.MoveBatch(context.Background(), BatchMoveRequest{
		Items: []FileRequest{
			{RootID: "workspace", Path: "source/one.txt"},
			{RootID: "workspace", Path: "source/nested"},
		},
		DestinationRootID: "workspace", DestinationPath: "out",
	})
	if err != nil || result.SuccessCount != 2 || result.FailureCount != 0 {
		t.Fatalf("unexpected move batch result: %+v err=%v", result, err)
	}
	if _, statErr := os.Stat(filepath.Join(workspace, "source", "one.txt")); !os.IsNotExist(statErr) {
		t.Fatalf("source file remained after batch move: %v", statErr)
	}
	if _, statErr := os.Stat(filepath.Join(workspace, "source", "nested")); !os.IsNotExist(statErr) {
		t.Fatalf("source directory remained after batch move: %v", statErr)
	}
	if data, readErr := os.ReadFile(filepath.Join(workspace, "out", "nested", "two.txt")); readErr != nil || string(data) != "two" {
		t.Fatalf("moved batch file mismatch: %q err=%v", data, readErr)
	}
}

func TestBatchTransferRejectsInvalidDestinationBeforeMutating(t *testing.T) {
	workspace := t.TempDir()
	if err := os.WriteFile(filepath.Join(workspace, "source.txt"), []byte("source"), 0600); err != nil {
		t.Fatal(err)
	}
	service := NewService(workspace, func() (map[string]*agent.TaskDirectoryBinding, error) { return nil, nil })
	_, err := service.CopyBatch(context.Background(), BatchCopyRequest{
		Items:             []FileRequest{{RootID: "workspace", Path: "source.txt"}},
		DestinationRootID: "workspace", DestinationPath: "missing",
	})
	if !errors.Is(err, ErrPathNotFound) {
		t.Fatalf("invalid destination returned %v", err)
	}
	if _, statErr := os.Stat(filepath.Join(workspace, "source.txt")); statErr != nil {
		t.Fatalf("invalid destination must not mutate source: %v", statErr)
	}
}
