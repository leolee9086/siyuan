package filebrowser

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/agent"
	"github.com/siyuan-note/siyuan/kernel/internal/testutil/symlinkfixture"
)

func TestCreateDirectoryAndRenameUseRootRelativeContracts(t *testing.T) {
	workspace := t.TempDir()
	if err := os.Mkdir(filepath.Join(workspace, "notes"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(workspace, "notes", "old name.txt"), []byte("payload"), 0600); err != nil {
		t.Fatal(err)
	}
	service := NewService(workspace, func() (map[string]*agent.TaskDirectoryBinding, error) { return nil, nil })

	created, err := service.CreateDirectory(context.Background(), CreateDirectoryRequest{
		RootID: "workspace", Path: "notes/中文 folder",
	})
	if err != nil || created.Operation != "create-directory" || created.Path != "notes/中文 folder" {
		t.Fatalf("unexpected create result: %+v err=%v", created, err)
	}
	rename, err := service.Rename(context.Background(), RenameRequest{
		RootID: "workspace", Path: "notes/old name.txt", NewName: "new name.txt",
	})
	if err != nil || rename.Path != "notes/new name.txt" {
		t.Fatalf("unexpected rename result: %+v err=%v", rename, err)
	}
	if _, err = os.Stat(filepath.Join(workspace, "notes", "new name.txt")); err != nil {
		t.Fatal(err)
	}
	if err = os.WriteFile(filepath.Join(workspace, "notes", "conflict.txt"), []byte("keep"), 0600); err != nil {
		t.Fatal(err)
	}
	_, err = service.Rename(context.Background(), RenameRequest{
		RootID: "workspace", Path: "notes/new name.txt", NewName: "conflict.txt",
	})
	if !errors.Is(err, ErrPathExists) {
		t.Fatalf("rename conflict returned %v", err)
	}
	_, err = service.Rename(context.Background(), RenameRequest{
		RootID: "workspace", Path: "notes/new name.txt", NewName: "nested/name.txt",
	})
	if !errors.Is(err, ErrInvalidName) {
		t.Fatalf("multi-component name returned %v", err)
	}
}

func TestFileOperationsHonorReadOnlyChildMount(t *testing.T) {
	workspace := t.TempDir()
	child := filepath.Join(workspace, "agent-task")
	if err := os.Mkdir(child, 0755); err != nil {
		t.Fatal(err)
	}
	service := NewService(workspace, func() (map[string]*agent.TaskDirectoryBinding, error) {
		return map[string]*agent.TaskDirectoryBinding{
			"session": {Directories: []*agent.TaskDirectoryGrant{{
				ID: "child", Path: child, Name: "agent-task",
				Permission: agent.TaskDirectoryPermissionReadOnly,
			}}},
		}, nil
	})
	_, err := service.CreateDirectory(context.Background(), CreateDirectoryRequest{
		RootID: "workspace", Path: "agent-task/new",
	})
	if !errors.Is(err, ErrWriteDenied) {
		t.Fatalf("read-only child mount returned %v", err)
	}
	if _, statErr := os.Stat(filepath.Join(child, "new")); !os.IsNotExist(statErr) {
		t.Fatalf("read-only mount was modified: %v", statErr)
	}
}

func TestCopySupportsCrossRootAtomicWorkflowAndRejectsLinks(t *testing.T) {
	workspace := t.TempDir()
	external := t.TempDir()
	if err := os.MkdirAll(filepath.Join(workspace, "source"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(workspace, "source", "中文 file.txt"), []byte("payload"), 0600); err != nil {
		t.Fatal(err)
	}
	service := NewService(workspace, func() (map[string]*agent.TaskDirectoryBinding, error) {
		return map[string]*agent.TaskDirectoryBinding{
			"session": {Directories: []*agent.TaskDirectoryGrant{{
				ID: "external", Path: external, Name: "external",
				Permission: agent.TaskDirectoryPermissionReadWrite,
			}}},
		}, nil
	})
	roots, err := service.ListRoots()
	if err != nil {
		t.Fatal(err)
	}
	externalID := ""
	for _, root := range roots {
		if filepath.Clean(root.Path) == filepath.Clean(external) {
			externalID = root.ID
		}
	}
	if externalID == "" {
		t.Fatalf("external root not listed: %+v", roots)
	}
	result, err := service.Copy(context.Background(), CopyRequest{
		SourceRootID: "workspace", SourcePath: "source/中文 file.txt",
		DestinationRootID: externalID, DestinationPath: "copied/中文 file.txt",
	})
	if err != nil || result.CopiedFileCount != 1 || result.CopiedBytes != int64(len("payload")) {
		t.Fatalf("unexpected copy result: %+v err=%v", result, err)
	}
	if data, readErr := os.ReadFile(filepath.Join(external, "copied", "中文 file.txt")); readErr != nil || string(data) != "payload" {
		t.Fatalf("copied content mismatch: %q err=%v", data, readErr)
	}
	if _, err = service.Copy(context.Background(), CopyRequest{
		SourceRootID: "workspace", SourcePath: "source",
		DestinationRootID: "workspace", DestinationPath: "source/nested",
	}); !errors.Is(err, ErrPathOverlap) {
		t.Fatalf("copy overlap returned %v", err)
	}
	outside := t.TempDir()
	symlinkfixture.Create(t, outside, filepath.Join(workspace, "source", "external-link"))
	_, err = service.Copy(context.Background(), CopyRequest{
		SourceRootID: "workspace", SourcePath: "source",
		DestinationRootID: externalID, DestinationPath: "linked-copy",
	})
	if !errors.Is(err, ErrSymlinkRestricted) {
		t.Fatalf("linked copy returned %v", err)
	}
}

func TestMoveSupportsCrossRootWorkflowAndRejectsBoundaries(t *testing.T) {
	workspace := t.TempDir()
	external := t.TempDir()
	if err := os.MkdirAll(filepath.Join(workspace, "source", "nested"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(workspace, "source", "nested", "中文 file.txt"), []byte("payload"), 0600); err != nil {
		t.Fatal(err)
	}
	service := NewService(workspace, func() (map[string]*agent.TaskDirectoryBinding, error) {
		return map[string]*agent.TaskDirectoryBinding{
			"session": {Directories: []*agent.TaskDirectoryGrant{{
				ID: "external", Path: external, Name: "external",
				Permission: agent.TaskDirectoryPermissionReadWrite,
			}}},
		}, nil
	})
	roots, err := service.ListRoots()
	if err != nil {
		t.Fatal(err)
	}
	externalID := ""
	for _, root := range roots {
		if filepath.Clean(root.Path) == filepath.Clean(external) {
			externalID = root.ID
		}
	}
	if externalID == "" {
		t.Fatalf("external root not listed: %+v", roots)
	}
	result, err := service.Move(context.Background(), MoveRequest{
		SourceRootID: "workspace", SourcePath: "source",
		DestinationRootID: externalID, DestinationPath: "moved/source",
	})
	if err != nil || result.Operation != "move" || result.DestinationPath != "moved/source" {
		t.Fatalf("unexpected move result: %+v err=%v", result, err)
	}
	if data, readErr := os.ReadFile(filepath.Join(external, "moved", "source", "nested", "中文 file.txt")); readErr != nil || string(data) != "payload" {
		t.Fatalf("moved content mismatch: %q err=%v", data, readErr)
	}
	if _, statErr := os.Stat(filepath.Join(workspace, "source")); !os.IsNotExist(statErr) {
		t.Fatalf("source remained after move: %v", statErr)
	}
	if _, err = service.Move(context.Background(), MoveRequest{
		SourceRootID: externalID, SourcePath: "moved/source",
		DestinationRootID: externalID, DestinationPath: "moved/source/nested/again",
	}); !errors.Is(err, ErrPathOverlap) {
		t.Fatalf("overlapping move returned %v", err)
	}
	_, err = service.Move(context.Background(), MoveRequest{
		SourceRootID: "workspace", SourcePath: "missing",
		DestinationRootID: externalID, DestinationPath: "missing",
	})
	if !errors.Is(err, ErrPathNotFound) {
		t.Fatalf("missing source returned %v", err)
	}
}

func TestDeleteRemovesFilesAndDirectoriesWithoutCrossingLinks(t *testing.T) {
	workspace := t.TempDir()
	if err := os.MkdirAll(filepath.Join(workspace, "tree", "nested"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(workspace, "tree", "nested", "a.txt"), []byte("payload"), 0600); err != nil {
		t.Fatal(err)
	}
	service := NewService(workspace, func() (map[string]*agent.TaskDirectoryBinding, error) { return nil, nil })
	result, err := service.Delete(context.Background(), DeleteRequest{RootID: "workspace", Path: "tree"})
	if err != nil || result.Operation != "delete" || result.RemovedFileCount != 1 || result.RemovedDirectoryCount != 2 {
		t.Fatalf("unexpected delete result: %+v err=%v", result, err)
	}
	if _, statErr := os.Stat(filepath.Join(workspace, "tree")); !os.IsNotExist(statErr) {
		t.Fatalf("deleted tree remained: %v", statErr)
	}
	if _, err = service.Delete(context.Background(), DeleteRequest{RootID: "workspace", Path: "."}); !errors.Is(err, ErrRootMutation) {
		t.Fatalf("root deletion returned %v", err)
	}

	if err := os.Mkdir(filepath.Join(workspace, "linked-tree"), 0755); err != nil {
		t.Fatal(err)
	}
	outside := t.TempDir()
	if err := os.WriteFile(filepath.Join(outside, "outside.txt"), []byte("outside"), 0600); err != nil {
		t.Fatal(err)
	}
	symlinkfixture.Create(t, filepath.Join(outside, "outside.txt"), filepath.Join(workspace, "linked-tree", "outside-link.txt"))
	if _, err = service.Delete(context.Background(), DeleteRequest{RootID: "workspace", Path: "linked-tree"}); !errors.Is(err, ErrPathTraversal) {
		t.Fatalf("linked deletion returned %v", err)
	}
	if _, statErr := os.Stat(filepath.Join(outside, "outside.txt")); statErr != nil {
		t.Fatalf("outside target changed: %v", statErr)
	}
}

func TestFileOperationsHonorCancellation(t *testing.T) {
	workspace := t.TempDir()
	service := NewService(workspace, func() (map[string]*agent.TaskDirectoryBinding, error) { return nil, nil })
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := service.CreateDirectory(ctx, CreateDirectoryRequest{RootID: "workspace", Path: "new"})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("canceled create returned %v", err)
	}
}
