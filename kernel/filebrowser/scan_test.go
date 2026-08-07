package filebrowser

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"testing"
)

func TestScanContextStreamsRealDirectoryTree(t *testing.T) {
	workspace := makeWalkTreeFixture(t)
	service := newWalkTestService(workspace)
	paths := make([]string, 0, 7)
	result, err := service.ScanContext(context.Background(), ScanRequest{RootID: "workspace"},
		func(entry WalkEntry) error {
			paths = append(paths, entry.Path)
			return nil
		})
	if err != nil {
		t.Fatal(err)
	}
	sort.Strings(paths)
	want := []string{"a", "a/a.txt", "a/inner", "a/inner/deep.txt", "b", "b/b.txt", "root.txt"}
	if len(paths) != len(want) {
		t.Fatalf("unexpected streamed paths: %v", paths)
	}
	for index := range want {
		if paths[index] != want[index] {
			t.Fatalf("unexpected streamed paths: %v", paths)
		}
	}
	if result.EntryCount != 7 || result.FileCount != 4 || result.DirectoryCount != 3 ||
		result.ScannedDirectoryCount != 4 || result.Truncated || result.ErrorCount != 0 {
		t.Fatalf("unexpected scan result: %+v", result)
	}
}

func TestScanContextHandlesEmptyDirectoryAndExactEntryLimit(t *testing.T) {
	empty := t.TempDir()
	result, err := newWalkTestService(empty).ScanContext(context.Background(),
		ScanRequest{RootID: "workspace", MaxEntries: 1}, nil)
	if err != nil || result.EntryCount != 0 || result.Truncated {
		t.Fatalf("unexpected empty scan: result=%+v err=%v", result, err)
	}

	workspace := t.TempDir()
	writeWalkTestFile(t, filepath.Join(workspace, "a.txt"))
	writeWalkTestFile(t, filepath.Join(workspace, "b.txt"))
	service := newWalkTestService(workspace)
	exact, err := service.ScanContext(context.Background(), ScanRequest{RootID: "workspace", MaxEntries: 2}, nil)
	if err != nil || exact.EntryCount != 2 || exact.EntryLimitReached || exact.Truncated {
		t.Fatalf("exact limit must not report truncation: result=%+v err=%v", exact, err)
	}
	limited, err := service.ScanContext(context.Background(), ScanRequest{RootID: "workspace", MaxEntries: 1}, nil)
	if err != nil || limited.EntryCount != 1 || !limited.EntryLimitReached || !limited.Truncated {
		t.Fatalf("overflowing limit must report truncation: result=%+v err=%v", limited, err)
	}
}

func TestScanContextCancelsDuringRealEnumeration(t *testing.T) {
	workspace := makeWalkTreeFixture(t)
	ctx, cancel := context.WithCancel(context.Background())
	seen := 0
	result, err := newWalkTestService(workspace).ScanContext(ctx, ScanRequest{RootID: "workspace"},
		func(WalkEntry) error {
			seen++
			cancel()
			return nil
		})
	if !errors.Is(err, context.Canceled) || seen != 1 || result.EntryCount != 1 {
		t.Fatalf("scan did not stop after in-flight cancellation: seen=%d result=%+v err=%v", seen, result, err)
	}
}

func TestScanContextReportsDirectoryRemovedDuringEnumeration(t *testing.T) {
	workspace := t.TempDir()
	removed := filepath.Join(workspace, "remove-me")
	writeWalkTestFile(t, filepath.Join(removed, "lost.txt"))
	writeWalkTestFile(t, filepath.Join(workspace, "keep", "kept.txt"))
	result, err := newWalkTestService(workspace).ScanContext(context.Background(),
		ScanRequest{RootID: "workspace"}, func(entry WalkEntry) error {
			if entry.Path == "remove-me" {
				return os.RemoveAll(removed)
			}
			return nil
		})
	if err != nil {
		t.Fatal(err)
	}
	if result.ErrorCount != 1 || len(result.Errors) != 1 || result.Errors[0].Path != "remove-me" ||
		result.Errors[0].Code != "not-found" {
		t.Fatalf("removed directory was not reported as a partial error: %+v", result)
	}
}

func TestScanContextReportsDepthBoundary(t *testing.T) {
	workspace := makeWalkTreeFixture(t)
	result, err := newWalkTestService(workspace).ScanContext(context.Background(),
		ScanRequest{RootID: "workspace", MaxDepth: 1}, nil)
	if err != nil {
		t.Fatal(err)
	}
	if result.EntryCount != 3 || !result.DepthLimitReached || !result.Truncated ||
		result.ScannedDirectoryCount != 1 {
		t.Fatalf("depth boundary was not preserved: %+v", result)
	}
}

func TestScanContextRetainsBoundedErrorDetailsWithoutLosingCounts(t *testing.T) {
	workspace := t.TempDir()
	const directoryCount = maxRetainedScanErrors + 1
	for index := 0; index < directoryCount; index++ {
		directory := filepath.Join(workspace, fmt.Sprintf("removed-%04d", index))
		if err := os.Mkdir(directory, 0755); err != nil {
			t.Fatal(err)
		}
	}
	writeWalkTestFile(t, filepath.Join(workspace, "kept.txt"))

	result, err := newWalkTestService(workspace).ScanContext(context.Background(),
		ScanRequest{RootID: "workspace"}, func(entry WalkEntry) error {
			if entry.IsDir {
				return os.Remove(filepath.Join(workspace, filepath.FromSlash(entry.Path)))
			}
			return nil
		})
	if err != nil {
		t.Fatal(err)
	}
	if result.EntryCount != directoryCount+1 || result.DirectoryCount != directoryCount || result.FileCount != 1 {
		t.Fatalf("entry counts changed while retaining bounded errors: %+v", result)
	}
	if result.ErrorCount != directoryCount || len(result.Errors) != maxRetainedScanErrors ||
		!result.ErrorsTruncated {
		t.Fatalf("error detail bound did not preserve the total error count: %+v", result)
	}
	if result.ScannedDirectoryCount != directoryCount+1 || result.Truncated {
		t.Fatalf("directory scan count or truncation state is incorrect: %+v", result)
	}
}
