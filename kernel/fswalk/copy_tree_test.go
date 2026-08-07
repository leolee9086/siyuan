package fswalk

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/internal/testutil/symlinkfixture"
)

func TestCopyTreePreservesFilteringAndOverwritesFiles(t *testing.T) {
	root := t.TempDir()
	writeCopyFixture(t, root, "src/keep.txt", "new content\n")
	writeCopyFixture(t, root, "src/sub/child.txt", "child\n")
	writeCopyFixture(t, root, "src/skip/hidden.txt", "secret\n")
	writeCopyFixture(t, root, "dst/keep.txt", "old content\n")

	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	result, err := walker.CopyTree(context.Background(), "src", walker, "dst", CopyTreeQuery{
		PruneDirectory: func(entry Metadata) bool { return entry.Path == "src/skip" },
		SelectFile:     func(entry Metadata) bool { return strings.HasSuffix(entry.Name, ".txt") },
	})
	if err != nil {
		t.Fatalf("copy failed: result=%+v err=%v", result, err)
	}
	if result.CopiedFileCount != 2 || result.SkippedDirectoryCount != 1 || result.CopiedDirectoryCount != 2 {
		t.Fatalf("unexpected copy result: %+v", result)
	}
	assertCopyFile(t, filepath.Join(root, "dst", "keep.txt"), "new content\n")
	assertCopyFile(t, filepath.Join(root, "dst", "sub", "child.txt"), "child\n")
	if _, err := os.Stat(filepath.Join(root, "dst", "skip")); !os.IsNotExist(err) {
		t.Fatalf("pruned directory was copied: %v", err)
	}
}

func TestCopyTreeCopiesDirectFileAndCreatesDestinationParents(t *testing.T) {
	root := t.TempDir()
	writeCopyFixture(t, root, "source/data.bin", "payload")
	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	result, err := walker.CopyTree(context.Background(), "source/data.bin", walker, "target/nested/data.bin", CopyTreeQuery{})
	if err != nil || result.CopiedFileCount != 1 || result.CopiedBytes != int64(len("payload")) {
		t.Fatalf("direct file copy failed: result=%+v err=%v", result, err)
	}
	assertCopyFile(t, filepath.Join(root, "target", "nested", "data.bin"), "payload")
}

func TestCopyTreeRejectsOverlapAndPathEscape(t *testing.T) {
	root := t.TempDir()
	writeCopyFixture(t, root, "src/file.txt", "payload")
	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = walker.CopyTree(context.Background(), "src", walker, "src/nested", CopyTreeQuery{}); !errors.Is(err, ErrCopyPathOverlap) {
		t.Fatalf("copy into source was accepted: %v", err)
	}
	if _, err = walker.CopyTree(context.Background(), "src", walker, "..\\outside", CopyTreeQuery{}); !errors.Is(err, ErrPathTraversal) {
		t.Fatalf("destination escape was accepted: %v", err)
	}
	if _, err = walker.CopyTree(context.Background(), "..\\outside", walker, "dst", CopyTreeQuery{}); !errors.Is(err, ErrPathTraversal) {
		t.Fatalf("source escape was accepted: %v", err)
	}
}

func TestCopyTreeRejectsSymlinkSourceAndDestinationEscape(t *testing.T) {
	root := t.TempDir()
	outside := t.TempDir()
	writeCopyFixture(t, outside, "outside.txt", "outside")
	writeCopyFixture(t, root, "src/regular.txt", "regular")
	symlinkfixture.Create(t, filepath.Join(outside, "outside.txt"), filepath.Join(root, "src", "link.txt"))
	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = walker.CopyTree(context.Background(), "src", walker, "dst", CopyTreeQuery{}); !errors.Is(err, ErrCopySymlink) {
		t.Fatalf("symlink source was followed: %v", err)
	}
	if err = os.Remove(filepath.Join(root, "src", "link.txt")); err != nil {
		t.Fatal(err)
	}
	symlinkfixture.Create(t, outside, filepath.Join(root, "destination-link"))
	if _, err = walker.CopyTree(context.Background(), "src/regular.txt", walker,
		"destination-link/copied.txt", CopyTreeQuery{}); !errors.Is(err, ErrPathTraversal) {
		t.Fatalf("destination symlink was followed: %v", err)
	}
	if _, err = os.Stat(filepath.Join(outside, "copied.txt")); !os.IsNotExist(err) {
		t.Fatalf("destination symlink target was modified: %v", err)
	}
	insideTarget := filepath.Join(root, "inside-target")
	if err = os.MkdirAll(insideTarget, 0755); err != nil {
		t.Fatal(err)
	}
	symlinkfixture.Create(t, insideTarget, filepath.Join(root, "inside-link"))
	if _, err = walker.CopyTree(context.Background(), "src/regular.txt", walker,
		"inside-link/copied.txt", CopyTreeQuery{}); !errors.Is(err, ErrPathTraversal) {
		t.Fatalf("root-internal destination symlink was followed: %v", err)
	}
}

func TestCopyTreeHonorsCancellation(t *testing.T) {
	root := t.TempDir()
	writeCopyFixture(t, root, "src/file.txt", "payload")
	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err = walker.CopyTree(ctx, "src", walker, "dst", CopyTreeQuery{})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("canceled copy returned %v", err)
	}
	if _, err = os.Stat(filepath.Join(root, "dst")); !os.IsNotExist(err) {
		t.Fatalf("canceled copy created destination: %v", err)
	}
}

func TestEnsureBoundDirectoryCountsConcurrentCreationOnce(t *testing.T) {
	root := t.TempDir()
	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	target := filepath.Join(root, "one", "two", "three")
	start := make(chan struct{})
	var wait sync.WaitGroup
	var total atomic.Int64
	errorsByWorker := make(chan error, 16)
	for range 16 {
		wait.Add(1)
		go func() {
			defer wait.Done()
			<-start
			created, createErr := walker.ensureBoundDirectory(context.Background(), target, 0755)
			total.Add(int64(created))
			errorsByWorker <- createErr
		}()
	}
	close(start)
	wait.Wait()
	close(errorsByWorker)
	for createErr := range errorsByWorker {
		if createErr != nil {
			t.Fatal(createErr)
		}
	}
	if total.Load() != 3 {
		t.Fatalf("concurrent directory creation counted %d components, expected 3", total.Load())
	}
}

func writeCopyFixture(t *testing.T, root, relative, content string) {
	t.Helper()
	path := filepath.Join(root, filepath.FromSlash(relative))
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0600); err != nil {
		t.Fatal(err)
	}
}

func assertCopyFile(t *testing.T, path, expected string) {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil || string(data) != expected {
		t.Fatalf("unexpected copied content at %s: %q err=%v", path, data, err)
	}
}
