package fswalk

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/internal/testutil/symlinkfixture"
)

func TestCreateDirectoryCreatesOneBoundLevelAndRejectsConflicts(t *testing.T) {
	root := t.TempDir()
	if err := os.Mkdir(filepath.Join(root, "parent"), 0755); err != nil {
		t.Fatal(err)
	}
	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	if err = walker.CreateDirectory(context.Background(), "parent/新 folder"); err != nil {
		t.Fatal(err)
	}
	if info, statErr := os.Stat(filepath.Join(root, "parent", "新 folder")); statErr != nil || !info.IsDir() {
		t.Fatalf("created directory missing: info=%v err=%v", info, statErr)
	}
	if err = walker.CreateDirectory(context.Background(), "parent/新 folder"); !errors.Is(err, ErrPathExists) {
		t.Fatalf("existing directory returned %v", err)
	}
	if err = walker.CreateDirectory(context.Background(), "missing/child"); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("missing parent returned %v", err)
	}
	if err = walker.CreateDirectory(context.Background(), "."); !errors.Is(err, ErrRootMutation) {
		t.Fatalf("root creation returned %v", err)
	}
	if err = walker.CreateDirectory(context.Background(), "../outside"); !errors.Is(err, ErrPathTraversal) {
		t.Fatalf("escape returned %v", err)
	}
}

func TestCreateDirectoryRejectsLinkedParent(t *testing.T) {
	root := t.TempDir()
	outside := t.TempDir()
	symlinkfixture.Create(t, outside, filepath.Join(root, "linked"))
	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	if err = walker.CreateDirectory(context.Background(), "linked/child"); !errors.Is(err, ErrPathTraversal) {
		t.Fatalf("linked parent returned %v", err)
	}
	if _, statErr := os.Stat(filepath.Join(outside, "child")); !os.IsNotExist(statErr) {
		t.Fatalf("linked target was modified: %v", statErr)
	}
}

func TestRenameRejectsExistingTargetAndOverlappingDirectory(t *testing.T) {
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "source", "nested"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "source", "file.txt"), []byte("payload"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "target.txt"), []byte("keep"), 0600); err != nil {
		t.Fatal(err)
	}
	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	if err = walker.Rename(context.Background(), "source/file.txt", "source/renamed.txt"); err != nil {
		t.Fatal(err)
	}
	if _, statErr := os.Stat(filepath.Join(root, "source", "renamed.txt")); statErr != nil {
		t.Fatal(statErr)
	}
	if err = walker.Rename(context.Background(), "source/renamed.txt", "target.txt"); !errors.Is(err, ErrPathExists) {
		t.Fatalf("existing target returned %v", err)
	}
	if err = walker.Rename(context.Background(), "source", "source/nested/source"); !errors.Is(err, ErrMovePathOverlap) {
		t.Fatalf("overlapping directory returned %v", err)
	}
}

func TestRenameRejectsLinkedDestinationAndCancellation(t *testing.T) {
	root := t.TempDir()
	outside := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "file.txt"), []byte("payload"), 0600); err != nil {
		t.Fatal(err)
	}
	symlinkfixture.Create(t, outside, filepath.Join(root, "linked"))
	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	if err = walker.Rename(context.Background(), "file.txt", "linked/file.txt"); !errors.Is(err, ErrPathTraversal) {
		t.Fatalf("linked destination returned %v", err)
	}
	canceled, cancel := context.WithCancel(context.Background())
	cancel()
	if err = walker.Rename(canceled, "file.txt", "renamed.txt"); !errors.Is(err, context.Canceled) {
		t.Fatalf("canceled rename returned %v", err)
	}
}
