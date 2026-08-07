package filebrowser

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/agent"
	"github.com/siyuan-note/siyuan/kernel/internal/testutil/symlinkfixture"
)

func newWalkTestService(workspace string) *Service {
	return NewService(workspace, func() (map[string]*agent.TaskDirectoryBinding, error) { return nil, nil })
}

func writeWalkTestFile(t *testing.T, path string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(filepath.Base(path)), 0600); err != nil {
		t.Fatal(err)
	}
}

func walkEntryPaths(entries []WalkEntry) []string {
	paths := make([]string, len(entries))
	for index := range entries {
		paths[index] = entries[index].Path
	}
	return paths
}

func makeWalkTreeFixture(t *testing.T) string {
	t.Helper()
	workspace := t.TempDir()
	writeWalkTestFile(t, filepath.Join(workspace, "a", "a.txt"))
	writeWalkTestFile(t, filepath.Join(workspace, "a", "inner", "deep.txt"))
	writeWalkTestFile(t, filepath.Join(workspace, "b", "b.txt"))
	writeWalkTestFile(t, filepath.Join(workspace, "root.txt"))
	return workspace
}

func TestWalkTraversesRealDirectoryTreeDeterministically(t *testing.T) {
	workspace := makeWalkTreeFixture(t)
	service := newWalkTestService(workspace)
	want := []string{"a", "a/a.txt", "a/inner", "a/inner/deep.txt", "b", "b/b.txt", "root.txt"}
	for iteration := 0; iteration < 10; iteration++ {
		result, err := service.Walk(WalkRequest{RootID: "workspace", MaxDepth: 8, MaxEntries: 100})
		if err != nil {
			t.Fatal(err)
		}
		if result.Truncated || len(result.Errors) != 0 || !slices.Equal(walkEntryPaths(result.Entries), want) {
			t.Fatalf("unexpected walk result: %+v", result)
		}
		if result.FileCount != 4 || result.DirectoryCount != 3 || result.ScannedDirectoryCount != 4 {
			t.Fatalf("unexpected walk counts: %+v", result)
		}
	}
}

func TestWalkUsesRootRelativePathsBelowRequestedDirectory(t *testing.T) {
	workspace := makeWalkTreeFixture(t)
	result, err := newWalkTestService(workspace).Walk(WalkRequest{
		RootID: "workspace", Path: "a", MaxDepth: 8, MaxEntries: 100,
	})
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"a/a.txt", "a/inner", "a/inner/deep.txt"}
	if !slices.Equal(walkEntryPaths(result.Entries), want) || result.Entries[0].Depth != 1 || result.Entries[2].Depth != 2 {
		t.Fatalf("unexpected subtree result: %+v", result)
	}
}

func TestWalkReportsDepthAndEntryLimits(t *testing.T) {
	workspace := makeWalkTreeFixture(t)
	service := newWalkTestService(workspace)
	depthResult, err := service.Walk(WalkRequest{RootID: "workspace", MaxDepth: 1, MaxEntries: 100})
	if err != nil {
		t.Fatal(err)
	}
	if !depthResult.Truncated || !depthResult.DepthLimitReached || depthResult.EntryLimitReached ||
		depthResult.ScannedDirectoryCount != 1 {
		t.Fatalf("depth limit was not reported: %+v", depthResult)
	}
	entryResult, err := service.Walk(WalkRequest{RootID: "workspace", MaxDepth: 8, MaxEntries: 2})
	if err != nil {
		t.Fatal(err)
	}
	if !entryResult.Truncated || !entryResult.EntryLimitReached || len(entryResult.Entries) != 2 {
		t.Fatalf("entry limit was not reported: %+v", entryResult)
	}
}

func TestWalkLimitIsStableAcrossConcurrentDirectories(t *testing.T) {
	workspace := t.TempDir()
	for directoryIndex := 0; directoryIndex < 20; directoryIndex++ {
		directory := filepath.Join(workspace, "dir-"+benchmarkIndex(directoryIndex))
		fileCount := 1
		if directoryIndex == 0 {
			fileCount = 5
		}
		for fileIndex := 0; fileIndex < fileCount; fileIndex++ {
			writeWalkTestFile(t, filepath.Join(directory, "file-"+benchmarkIndex(fileIndex)+".txt"))
		}
	}
	service := newWalkTestService(workspace)
	var first []string
	for iteration := 0; iteration < 20; iteration++ {
		result, err := service.Walk(WalkRequest{RootID: "workspace", MaxDepth: 8, MaxEntries: 25})
		if err != nil {
			t.Fatal(err)
		}
		paths := walkEntryPaths(result.Entries)
		if !result.EntryLimitReached || len(paths) != 25 {
			t.Fatalf("walk did not stop at the requested limit: %+v", result)
		}
		if iteration == 0 {
			first = paths
		} else if !slices.Equal(paths, first) {
			t.Fatalf("completion order changed the truncated set: first=%v current=%v", first, paths)
		}
	}
}

func TestWalkDoesNotDescendIntoDirectorySymlinks(t *testing.T) {
	assertWalkDirectoryLinkContract(t, "symbolic link", func(target, link string) {
		symlinkfixture.Create(t, target, link)
	})
}

func assertWalkDirectoryLinkContract(t *testing.T, label string, create func(target, link string)) {
	t.Helper()
	workspace := t.TempDir()
	inside := filepath.Join(workspace, "inside")
	outside := t.TempDir()
	writeWalkTestFile(t, filepath.Join(inside, "inside.txt"))
	writeWalkTestFile(t, filepath.Join(outside, "outside.txt"))
	create(inside, filepath.Join(workspace, "inside-link"))
	outsideLinkPath := filepath.Join(workspace, "outside-link")
	create(outside, outsideLinkPath)
	service := newWalkTestService(workspace)
	result, err := service.Walk(WalkRequest{RootID: "workspace", MaxDepth: 8, MaxEntries: 100})
	if err != nil {
		t.Fatal(err)
	}
	for _, entry := range result.Entries {
		if strings.HasPrefix(entry.Path, "inside-link/") || strings.HasPrefix(entry.Path, "outside-link/") {
			t.Fatalf("walk followed a directory %s: %+v", label, entry)
		}
	}
	var insideLink, outsideLink *WalkEntry
	for index := range result.Entries {
		switch result.Entries[index].Path {
		case "inside-link":
			insideLink = &result.Entries[index]
		case "outside-link":
			outsideLink = &result.Entries[index]
		}
	}
	if insideLink == nil || !insideLink.IsSymlink || insideLink.Restricted || !insideLink.IsDir {
		t.Fatalf("root-internal %s metadata changed: %+v", label, insideLink)
	}
	if outsideLink == nil || !outsideLink.IsSymlink || !outsideLink.Restricted {
		t.Fatalf("outside link boundary was not retained: %+v", outsideLink)
	}
	_, err = service.List(ListRequest{RootID: "workspace", Path: "inside-link"})
	if !errors.Is(err, ErrPathTraversal) {
		t.Fatalf("manual internal %s expansion changed policy: %v", label, err)
	}
	_, err = service.List(ListRequest{RootID: "workspace", Path: "outside-link"})
	if !errors.Is(err, ErrPathTraversal) {
		t.Fatalf("manual external %s expansion crossed the root boundary: %v", label, err)
	}
}

func TestWalkContextHonorsCanceledRequest(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := newWalkTestService(t.TempDir()).WalkContext(ctx, WalkRequest{RootID: "workspace"})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context cancellation, got %v", err)
	}
}
