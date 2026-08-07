package filebrowser

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/agent"
	"github.com/siyuan-note/siyuan/kernel/internal/testutil/symlinkfixture"
)

func TestListRootsIncludesWorkspaceAndAggregatesBindings(t *testing.T) {
	workspace := t.TempDir()
	bound := filepath.Join(workspace, "bound")
	if err := os.Mkdir(bound, 0755); err != nil {
		t.Fatal(err)
	}
	service := NewService(workspace, func() (map[string]*agent.TaskDirectoryBinding, error) {
		return map[string]*agent.TaskDirectoryBinding{
			"session-a": {Main: &agent.TaskDirectoryGrant{ID: "main", Path: bound, Name: "main", Permission: agent.TaskDirectoryPermissionReadOnly}},
			"session-b": {Directories: []*agent.TaskDirectoryGrant{{ID: "read", Path: bound, Name: "same", Permission: agent.TaskDirectoryPermissionCommand}}},
		}, nil
	})
	roots, err := service.ListRoots()
	if err != nil {
		t.Fatal(err)
	}
	if len(roots) != 2 || roots[0].ID != "workspace" {
		t.Fatalf("unexpected roots: %+v", roots)
	}
	if len(roots[1].Sources) != 2 || !roots[1].Capabilities.Browse || !roots[1].Capabilities.Command {
		t.Fatalf("binding sources were not aggregated: %+v", roots[1])
	}
}

func TestListPaginatesAndRejectsTraversal(t *testing.T) {
	workspace := t.TempDir()
	for _, name := range []string{"b.txt", "a.txt", "dir"} {
		path := filepath.Join(workspace, name)
		if name == "dir" {
			if err := os.Mkdir(path, 0755); err != nil {
				t.Fatal(err)
			}
		} else if err := os.WriteFile(path, []byte(name), 0600); err != nil {
			t.Fatal(err)
		}
	}
	service := NewService(workspace, func() (map[string]*agent.TaskDirectoryBinding, error) { return nil, nil })
	result, err := service.List(ListRequest{RootID: "workspace", Limit: 1})
	if err != nil {
		t.Fatal(err)
	}
	if result.Total != 3 || len(result.Entries) != 1 || result.Entries[0].Name != "dir" || !result.HasMore {
		t.Fatalf("unexpected page: %+v", result)
	}
	_, err = service.List(ListRequest{RootID: "workspace", Path: "../"})
	if !errors.Is(err, ErrPathTraversal) {
		t.Fatalf("expected traversal rejection, got %v", err)
	}
}

func TestListClassifiesFileSymbolicLinksWithoutFollowingExternalTargets(t *testing.T) {
	workspace := t.TempDir()
	outside := t.TempDir()
	insideTarget := filepath.Join(workspace, "inside.txt")
	outsideTarget := filepath.Join(outside, "outside.txt")
	if err := os.WriteFile(insideTarget, []byte("inside"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(outsideTarget, []byte("outside"), 0600); err != nil {
		t.Fatal(err)
	}
	symlinkfixture.Create(t, insideTarget, filepath.Join(workspace, "inside-link.txt"))
	symlinkfixture.Create(t, outsideTarget, filepath.Join(workspace, "outside-link.txt"))

	result, err := newWalkTestService(workspace).List(ListRequest{RootID: "workspace"})
	if err != nil {
		t.Fatal(err)
	}
	entries := map[string]Entry{}
	for _, entry := range result.Entries {
		entries[entry.Name] = entry
	}
	inside := entries["inside-link.txt"]
	if !inside.IsSymlink || inside.Restricted || inside.IsDir || inside.Size != int64(len("inside")) {
		t.Fatalf("root-internal file symbolic link metadata changed: %+v", inside)
	}
	external := entries["outside-link.txt"]
	if !external.IsSymlink || !external.Restricted || external.IsDir {
		t.Fatalf("external file symbolic link boundary changed: %+v", external)
	}
}

func TestFileBrowserResolvesWorkspaceRootSymbolicLink(t *testing.T) {
	container := t.TempDir()
	realRoot := filepath.Join(container, "real-workspace")
	if err := os.Mkdir(realRoot, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(realRoot, "root.txt"), []byte("root"), 0600); err != nil {
		t.Fatal(err)
	}
	linkedRoot := filepath.Join(container, "workspace-link")
	symlinkfixture.Create(t, realRoot, linkedRoot)
	service := newWalkTestService(linkedRoot)
	roots, err := service.ListRoots()
	if err != nil {
		t.Fatal(err)
	}
	if len(roots) != 1 || !roots[0].Exists || !strings.EqualFold(roots[0].Path, realRoot) {
		t.Fatalf("workspace symbolic-link root was not resolved: %+v", roots)
	}
	result, err := service.List(ListRequest{RootID: "workspace"})
	if err != nil || len(result.Entries) != 1 || result.Entries[0].Name != "root.txt" {
		t.Fatalf("resolved workspace symbolic-link root was not browsable: result=%+v err=%v", result, err)
	}
}

func TestListReportsImmediateCountsForTreeNodes(t *testing.T) {
	workspace := t.TempDir()
	photos := filepath.Join(workspace, "photos")
	if err := os.MkdirAll(filepath.Join(photos, "raw"), 0755); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"cover.jpg", "notes.txt"} {
		if err := os.WriteFile(filepath.Join(photos, name), []byte(name), 0600); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.WriteFile(filepath.Join(workspace, "root.txt"), []byte("root"), 0600); err != nil {
		t.Fatal(err)
	}
	service := NewService(workspace, func() (map[string]*agent.TaskDirectoryBinding, error) { return nil, nil })
	result, err := service.List(ListRequest{RootID: "workspace", IncludeChildCounts: true})
	if err != nil {
		t.Fatal(err)
	}
	if result.FileCount != 1 || result.DirectoryCount != 1 {
		t.Fatalf("unexpected root counts: files=%d directories=%d", result.FileCount, result.DirectoryCount)
	}
	var photosEntry *Entry
	for index := range result.Entries {
		if result.Entries[index].Name == "photos" {
			photosEntry = &result.Entries[index]
			break
		}
	}
	if photosEntry == nil || !photosEntry.ChildCountKnown || photosEntry.ChildFileCount != 2 ||
		photosEntry.ChildDirectoryCount != 1 {
		t.Fatalf("unexpected photos counts: %+v", photosEntry)
	}
}

func TestListRetainsMissingBoundRoot(t *testing.T) {
	workspace := t.TempDir()
	missing := filepath.Join(workspace, "removed")
	service := NewService(workspace, func() (map[string]*agent.TaskDirectoryBinding, error) {
		return map[string]*agent.TaskDirectoryBinding{
			"session-a": {Main: &agent.TaskDirectoryGrant{ID: "main", Path: missing, Name: "removed", Permission: agent.TaskDirectoryPermissionReadWrite}},
		}, nil
	})
	roots, err := service.ListRoots()
	if err != nil {
		t.Fatal(err)
	}
	if len(roots) != 2 || roots[1].Exists {
		t.Fatalf("missing binding was not retained: %+v", roots)
	}
	_, err = service.List(ListRequest{RootID: roots[1].ID})
	if !errors.Is(err, ErrRootUnavailable) {
		t.Fatalf("expected unavailable root, got %v", err)
	}
}

func TestStatAndPreviewUseValidatedRootRelativeFile(t *testing.T) {
	workspace := t.TempDir()
	directory := filepath.Join(workspace, "notes")
	if err := os.Mkdir(directory, 0755); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(directory, "hello world.md")
	if err := os.WriteFile(path, []byte("# hello\nsecond line\n"), 0600); err != nil {
		t.Fatal(err)
	}
	service := NewService(workspace, func() (map[string]*agent.TaskDirectoryBinding, error) { return nil, nil })
	stat, err := service.Stat(FileRequest{RootID: "workspace", Path: "notes/hello world.md"})
	if err != nil {
		t.Fatal(err)
	}
	if stat.PreviewKind != PreviewKindText || stat.Entry.Name != "hello world.md" || stat.Revision == "" {
		t.Fatalf("unexpected stat: %+v", stat)
	}
	if stat.ContentURL != "/api/s-forge/file-browser/content/workspace/notes/hello%20world.md" {
		t.Fatalf("unexpected content URL: %q", stat.ContentURL)
	}
	preview, err := service.Preview(PreviewRequest{RootID: "workspace", Path: stat.Entry.Path, MaxBytes: 7})
	if err != nil {
		t.Fatal(err)
	}
	if preview.Text != "# hello" || preview.Encoding != "utf-8" || !preview.Truncated {
		t.Fatalf("unexpected preview: %+v", preview)
	}
	_, err = service.Stat(FileRequest{RootID: "workspace", Path: "notes"})
	if !errors.Is(err, ErrNotFile) {
		t.Fatalf("directory must not resolve as file: %v", err)
	}
}

func TestPreviewRejectsBinaryFile(t *testing.T) {
	workspace := t.TempDir()
	if err := os.WriteFile(filepath.Join(workspace, "sample.bin"), []byte{0, 1, 2, 3}, 0600); err != nil {
		t.Fatal(err)
	}
	service := NewService(workspace, func() (map[string]*agent.TaskDirectoryBinding, error) { return nil, nil })
	_, err := service.Preview(PreviewRequest{RootID: "workspace", Path: "sample.bin"})
	if !errors.Is(err, ErrPreviewUnsupported) {
		t.Fatalf("binary preview must be rejected: %v", err)
	}
}
