package fswalk

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/internal/testutil/symlinkfixture"
)

func TestBoundTextReadWriteAndEmptyRemoval(t *testing.T) {
	root := t.TempDir()
	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	if err = walker.WriteTextFile(context.Background(), "folder/file.txt", "one\r\ntwo\n", 1024); err != nil {
		t.Fatal(err)
	}
	document, err := walker.ReadTextFile(context.Background(), "folder/file.txt", 1024)
	if err != nil || document.Text != "one\ntwo\n" || document.Path != "folder/file.txt" {
		t.Fatalf("unexpected text snapshot: %+v err=%v", document, err)
	}
	if err = walker.WriteTextFile(context.Background(), "folder/file.txt", string([]byte{'x', 0, 'y'}), 1024); !errors.Is(err, ErrBinaryText) {
		t.Fatalf("binary text was accepted: %v", err)
	}
	unchanged, readErr := os.ReadFile(filepath.Join(root, "folder", "file.txt"))
	if readErr != nil || string(unchanged) != "one\r\ntwo\n" {
		t.Fatalf("failed write changed existing file: %q err=%v", unchanged, readErr)
	}
	if err = walker.RemoveEmpty(context.Background(), "folder"); !errors.Is(err, ErrDirectoryNotEmpty) {
		t.Fatalf("non-empty directory was removed: %v", err)
	}
	if err = walker.RemoveEmpty(context.Background(), "folder/file.txt"); err != nil {
		t.Fatal(err)
	}
	if err = walker.RemoveEmpty(context.Background(), "folder"); err != nil {
		t.Fatal(err)
	}
	if _, statErr := os.Stat(filepath.Join(root, "folder")); !os.IsNotExist(statErr) {
		t.Fatalf("empty directory remained: %v", statErr)
	}
}

func TestBoundTextMutationRejectsEscapesLinksLimitsAndCancellation(t *testing.T) {
	root := t.TempDir()
	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	if err = walker.WriteTextFile(context.Background(), "../outside.txt", "outside", 1024); !errors.Is(err, ErrPathTraversal) {
		t.Fatalf("text write escape was accepted: %v", err)
	}
	if err = walker.WriteTextFile(context.Background(), "large.txt", "12345", 4); !errors.Is(err, ErrTextFileTooLarge) {
		t.Fatalf("large text write was accepted: %v", err)
	}
	canceled, cancel := context.WithCancel(context.Background())
	cancel()
	if err = walker.WriteTextFile(canceled, "canceled.txt", "x", 1024); !errors.Is(err, context.Canceled) {
		t.Fatalf("canceled text write returned %v", err)
	}
	outside := t.TempDir()
	writeTextSearchFixture(t, outside, "outside.txt", []byte("outside"))
	symlinkfixture.Create(t, filepath.Join(outside, "outside.txt"), filepath.Join(root, "linked.txt"))
	if err = walker.WriteTextFile(context.Background(), "linked.txt", "changed", 1024); !errors.Is(err, ErrPathTraversal) {
		t.Fatalf("linked text target was accepted: %v", err)
	}
	if err = walker.RemoveEmpty(context.Background(), "linked.txt"); !errors.Is(err, ErrPathTraversal) {
		t.Fatalf("linked remove target was accepted: %v", err)
	}
}
