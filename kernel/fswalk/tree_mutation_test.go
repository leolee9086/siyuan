package fswalk

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/internal/testutil/symlinkfixture"
)

func TestRemoveTreeDeletesRealTreeAndProtectsRoot(t *testing.T) {
	root := t.TempDir()
	writeTextSearchFixture(t, root, "tree/a.txt", []byte("a"))
	writeTextSearchFixture(t, root, "tree/nested/b.txt", []byte("b"))
	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	result, err := walker.RemoveTree(context.Background(), "tree")
	if err != nil {
		t.Fatal(err)
	}
	if result.RemovedFileCount != 2 || result.RemovedDirectoryCount != 2 {
		t.Fatalf("unexpected removal counts: %+v", result)
	}
	if _, statErr := os.Stat(filepath.Join(root, "tree")); !os.IsNotExist(statErr) {
		t.Fatalf("tree remained after removal: %v", statErr)
	}
	if _, err = walker.RemoveTree(context.Background(), "."); !errors.Is(err, ErrRootMutation) {
		t.Fatalf("walker root removal returned %v", err)
	}
}

func TestRemoveTreeRejectsLinksAndCancellation(t *testing.T) {
	root := t.TempDir()
	outside := t.TempDir()
	writeTextSearchFixture(t, outside, "outside.txt", []byte("outside"))
	if err := os.MkdirAll(filepath.Join(root, "tree"), 0755); err != nil {
		t.Fatal(err)
	}
	writeTextSearchFixture(t, root, "tree/a-before-link.txt", []byte("keep on preflight failure"))
	symlinkfixture.Create(t, filepath.Join(outside, "outside.txt"), filepath.Join(root, "tree", "link.txt"))
	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = walker.RemoveTree(context.Background(), "tree"); !errors.Is(err, ErrPathTraversal) {
		t.Fatalf("linked tree removal returned %v", err)
	}
	if _, statErr := os.Stat(filepath.Join(outside, "outside.txt")); statErr != nil {
		t.Fatalf("outside target was changed: %v", statErr)
	}
	if content, readErr := os.ReadFile(filepath.Join(root, "tree", "a-before-link.txt")); readErr != nil || string(content) != "keep on preflight failure" {
		t.Fatalf("preflight failure partially deleted the tree: %q err=%v", content, readErr)
	}
	canceled, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err = walker.RemoveTree(canceled, "tree"); !errors.Is(err, context.Canceled) {
		t.Fatalf("canceled removal returned %v", err)
	}
}

func TestMoveCreatesParentsAndRejectsOverlapEscapeAndLinks(t *testing.T) {
	root := t.TempDir()
	writeTextSearchFixture(t, root, "source/nested/file.txt", []byte("payload"))
	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	if err = walker.Move(context.Background(), "source", walker, "target/deep/source"); err != nil {
		t.Fatal(err)
	}
	content, readErr := os.ReadFile(filepath.Join(root, "target", "deep", "source", "nested", "file.txt"))
	if readErr != nil || string(content) != "payload" {
		t.Fatalf("moved content mismatch: %q err=%v", content, readErr)
	}
	if err = walker.Move(context.Background(), "target", walker, "target/deep/again"); !errors.Is(err, ErrMovePathOverlap) {
		t.Fatalf("overlapping move returned %v", err)
	}
	if err = walker.Move(context.Background(), "target", walker, "../outside"); !errors.Is(err, ErrPathTraversal) {
		t.Fatalf("escaping move returned %v", err)
	}
	outside := t.TempDir()
	symlinkfixture.Create(t, outside, filepath.Join(root, "destination-link"))
	if err = walker.Move(context.Background(), "target", walker, "destination-link/target"); !errors.Is(err, ErrPathTraversal) {
		t.Fatalf("linked destination returned %v", err)
	}
}
