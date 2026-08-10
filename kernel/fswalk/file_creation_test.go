package fswalk

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestCreateFileCreatesOnlyOneBoundLevel(t *testing.T) {
	root := t.TempDir()
	if err := os.Mkdir(filepath.Join(root, "notes"), 0755); err != nil {
		t.Fatal(err)
	}
	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	if err = walker.CreateFile(context.Background(), "notes/new.txt"); err != nil {
		t.Fatal(err)
	}
	info, err := os.Stat(filepath.Join(root, "notes", "new.txt"))
	if err != nil {
		t.Fatal(err)
	}
	if !info.Mode().IsRegular() || info.Size() != 0 {
		t.Fatalf("unexpected created file: %+v", info)
	}
	if err = walker.CreateFile(context.Background(), "notes/new.txt"); !errors.Is(err, ErrPathExists) {
		t.Fatalf("existing file returned %v", err)
	}
	if err = walker.CreateFile(context.Background(), "missing/new.txt"); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("missing parent returned %v", err)
	}
	if err = walker.CreateFile(context.Background(), "."); !errors.Is(err, ErrRootMutation) {
		t.Fatalf("root target returned %v", err)
	}
}

func TestCreateFileHonorsCancellation(t *testing.T) {
	walker, err := New(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err = walker.CreateFile(ctx, "canceled.txt"); !errors.Is(err, context.Canceled) {
		t.Fatalf("canceled create returned %v", err)
	}
}
