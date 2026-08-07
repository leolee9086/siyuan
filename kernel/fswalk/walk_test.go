package fswalk

import (
	"context"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"sort"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/internal/testutil/symlinkfixture"
)

func makeFixture(t *testing.T) string {
	t.Helper()
	root := t.TempDir()
	for _, name := range []string{"a/a.txt", "a/deep/b.txt", "root.txt"} {
		path := filepath.Join(root, filepath.FromSlash(name))
		if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte(name), 0600); err != nil {
			t.Fatal(err)
		}
	}
	return root
}

func TestWalkStableAndBounded(t *testing.T) {
	root := makeFixture(t)
	var got []string
	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	result, err := walker.Walk(context.Background(), "", WalkOptions{MaxDepth: 8, MaxEntries: 20,
		Workers: 4, SortEntries: true}, func(entry Metadata) error {
		got = append(got, entry.Path)
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"a", "root.txt", "a/a.txt", "a/deep", "a/deep/b.txt"}
	if !slices.Equal(got, want) || result.EntryCount != len(want) || result.ScannedDirectoryCount != 3 {
		t.Fatalf("unexpected traversal: got=%v result=%+v", got, result)
	}
	for iteration := 0; iteration < 5; iteration++ {
		var repeated []string
		if _, err := walker.Walk(context.Background(), "", WalkOptions{MaxDepth: 8, MaxEntries: 20,
			Workers: 4, SortEntries: true}, func(entry Metadata) error {
			repeated = append(repeated, entry.Path)
			return nil
		}); err != nil || !slices.Equal(repeated, want) {
			t.Fatalf("unstable traversal: got=%v err=%v", repeated, err)
		}
	}
}

func TestWalkSupportsPruneAndStop(t *testing.T) {
	root := makeFixture(t)
	var pruned []string
	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	result, err := walker.Walk(context.Background(), "", WalkOptions{SortEntries: true}, func(entry Metadata) error {
		pruned = append(pruned, entry.Path)
		if entry.Path == "a" {
			return fs.SkipDir
		}
		return nil
	})
	if err != nil || !slices.Equal(pruned, []string{"a", "root.txt"}) || result.EntryCount != 2 {
		t.Fatalf("prune failed: paths=%v result=%+v err=%v", pruned, result, err)
	}

	seen := 0
	result, err = walker.Walk(context.Background(), "", WalkOptions{}, func(Metadata) error {
		seen++
		return fs.SkipAll
	})
	if err != nil || seen != 1 || !result.Stopped {
		t.Fatalf("stop failed: seen=%d result=%+v err=%v", seen, result, err)
	}
}

func TestWalkLimitsAndCancellation(t *testing.T) {
	root := makeFixture(t)
	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	result, err := walker.Walk(context.Background(), "", WalkOptions{MaxEntries: 2, SortEntries: true}, nil)
	if err != nil || result.EntryCount != 2 || !result.EntryLimitReached || !result.Truncated {
		t.Fatalf("entry limit failed: %+v err=%v", result, err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err = walker.Walk(ctx, "", WalkOptions{}, nil)
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("cancellation failed: %v", err)
	}
}

func TestWalkRejectsRelativeEscapeAndKeepsErrorBound(t *testing.T) {
	root := makeFixture(t)
	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := walker.Walk(context.Background(), "../outside", WalkOptions{}, nil); !errors.Is(err, ErrPathTraversal) {
		t.Fatalf("relative escape accepted: %v", err)
	}

	for index := 0; index < 4; index++ {
		path := filepath.Join(root, "dir", string(rune('a'+index)), "file.txt")
		if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte("x"), 0600); err != nil {
			t.Fatal(err)
		}
	}
	result, err := walker.Walk(context.Background(), "", WalkOptions{MaxErrors: 2, SortEntries: true}, func(entry Metadata) error {
		if entry.IsDir && entry.Path == "dir" {
			return os.RemoveAll(filepath.Join(root, "dir"))
		}
		return nil
	})
	if err != nil || result.ErrorCount != 1 || len(result.Errors) != 1 {
		t.Fatalf("partial error handling failed: %+v err=%v", result, err)
	}
}

func TestReadDirectoryReturnsMetadata(t *testing.T) {
	root := makeFixture(t)
	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	entries, err := walker.ReadDirectory(context.Background(), "", false)
	if err != nil {
		t.Fatal(err)
	}
	var names []string
	for _, entry := range entries {
		names = append(names, entry.Name)
	}
	sort.Strings(names)
	if !slices.Equal(names, []string{"a", "root.txt"}) {
		t.Fatalf("unexpected entries: %v", names)
	}
}

func TestInspectReturnsBoundMetadataWithoutPhysicalPath(t *testing.T) {
	root := makeFixture(t)
	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	entry, err := walker.Inspect(context.Background(), "a/a.txt")
	if err != nil {
		t.Fatal(err)
	}
	if entry.Path != "a/a.txt" || entry.Name != "a.txt" || !entry.IsRegular || filepath.IsAbs(entry.Path) {
		t.Fatalf("unexpected inspected metadata: %+v", entry)
	}
	if _, err = walker.Inspect(context.Background(), "../outside"); !errors.Is(err, ErrPathTraversal) {
		t.Fatalf("inspect accepted a path escape: %v", err)
	}
}

func TestWalkRejectsIntermediateSymlinkEvenWhenItStaysInsideRoot(t *testing.T) {
	root := t.TempDir()
	writeTextSearchFixture(t, root, "real/file.txt", []byte("inside"))
	symlinkfixture.Create(t, filepath.Join(root, "real"), filepath.Join(root, "linked"))
	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = walker.Walk(context.Background(), "linked", WalkOptions{}, nil); !errors.Is(err, ErrPathTraversal) {
		t.Fatalf("intermediate directory symlink was accepted: %v", err)
	}
	if _, err = walker.SearchText(context.Background(), "linked/file.txt", TextSearchQuery{
		MatchLine: func(TextLine) bool { return true },
	}); !errors.Is(err, ErrPathTraversal) {
		t.Fatalf("file below an intermediate symlink was accepted: %v", err)
	}
}
