package filequery

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/agent"
	"github.com/siyuan-note/siyuan/kernel/assetmeta"
	"github.com/siyuan-note/siyuan/kernel/filebrowser"
)

func TestSearchEnumeratesUnindexedFilesForEmptyExtensionFilter(t *testing.T) {
	workspace := t.TempDir()
	writeQueryFixture(t, workspace, filepath.Join("data", "assets", "hero.png"))
	writeQueryFixture(t, workspace, filepath.Join("data", "assets", "scratch.tmp"))
	writeQueryFixture(t, workspace, filepath.Join("data", "assets", "nested", "detail.jpg"))
	browser := filebrowser.NewService(workspace, nil)
	service := NewService(browser, nil, browser)

	result, err := service.Search(context.Background(), assetmeta.SearchRequest{Exts: []string{}, Limit: 50})
	if err != nil {
		t.Fatal(err)
	}
	if result.TotalCount != 3 || len(result.Assets) != 3 {
		t.Fatalf("empty extension filter did not enumerate all files: %+v", result)
	}
	paths := make(map[string]bool, len(result.Assets))
	for _, asset := range result.Assets {
		paths[asset.Path] = true
		if asset.FileSize <= 0 || asset.Name == "" || asset.Tags == nil {
			t.Fatalf("unindexed file did not receive physical projection: %+v", asset)
		}
	}
	for _, path := range []string{"data/assets/hero.png", "data/assets/scratch.tmp", "data/assets/nested/detail.jpg"} {
		if !paths[path] {
			t.Fatalf("missing enumerated file %q: %v", path, paths)
		}
	}

	png, err := service.Search(context.Background(), assetmeta.SearchRequest{Exts: []string{".png"}, Limit: 50})
	if err != nil {
		t.Fatal(err)
	}
	if png.TotalCount != 1 || len(png.Assets) != 1 || png.Assets[0].Path != "data/assets/hero.png" {
		t.Fatalf("extension filter changed empty-filter semantics: %+v", png)
	}
}

func TestSearchEnumeratesOnlyDirectFilesForNonRecursiveScope(t *testing.T) {
	workspace := t.TempDir()
	writeQueryFixture(t, workspace, filepath.Join("data", "assets", "direct.png"))
	writeQueryFixture(t, workspace, filepath.Join("data", "assets", "nested", "child.png"))
	browser := filebrowser.NewService(workspace, nil)
	service := NewService(browser, nil, browser)
	recursive := false

	result, err := service.Search(context.Background(), assetmeta.SearchRequest{
		PathPrefix: "data/assets", Recursive: &recursive, Limit: 50,
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.TotalCount != 1 || len(result.Assets) != 1 || result.Assets[0].Path != "data/assets/direct.png" {
		t.Fatalf("non-recursive scope included nested files: %+v", result)
	}
}

func TestSearchPreservesTraversalBoundaryAndCancellation(t *testing.T) {
	workspace := t.TempDir()
	writeQueryFixture(t, workspace, "data/assets/file.txt")
	browser := filebrowser.NewService(workspace, nil)
	service := NewService(browser, nil, browser)

	if _, err := service.Search(context.Background(), assetmeta.SearchRequest{PathPrefix: "../outside"}); !errors.Is(err, filebrowser.ErrPathTraversal) {
		t.Fatalf("path escape was not rejected by the shared walker: %v", err)
	}
	canceled, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := service.Search(canceled, assetmeta.SearchRequest{}); !errors.Is(err, context.Canceled) {
		t.Fatalf("canceled search was not stopped: %v", err)
	}
}

func TestSearchEnumeratesWorkspaceAndBoundAgentRoots(t *testing.T) {
	workspace := t.TempDir()
	agentDirectory := t.TempDir()
	writeQueryFixture(t, workspace, filepath.Join("workspace.txt"))
	writeQueryFixture(t, agentDirectory, filepath.Join("result.txt"))
	browser := filebrowser.NewService(workspace, func() (map[string]*agent.TaskDirectoryBinding, error) {
		return map[string]*agent.TaskDirectoryBinding{
			"session-a": {Directories: []*agent.TaskDirectoryGrant{{
				ID: "task", Path: agentDirectory, Name: "task", Permission: agent.TaskDirectoryPermissionReadOnly,
			}}},
		}, nil
	})
	service := NewService(browser, nil, browser)

	result, err := service.Search(context.Background(), assetmeta.SearchRequest{AllRoots: true, Limit: 50})
	if err != nil {
		t.Fatal(err)
	}
	if result.TotalCount != 2 {
		t.Fatalf("all-root enumeration missed a bound directory: %+v", result)
	}
	roots, listErr := browser.ListRoots()
	if listErr != nil {
		t.Fatal(listErr)
	}
	rootKinds := make(map[filebrowser.RootKind]bool)
	for _, asset := range result.Assets {
		for _, root := range roots {
			if root.ID == asset.RootID {
				rootKinds[root.Kind] = true
			}
		}
	}
	if !rootKinds[filebrowser.RootKindWorkspace] || !rootKinds[filebrowser.RootKindAgent] {
		t.Fatalf("all-root enumeration lost workspace or Agent root: %+v", result)
	}
}

func TestMetadataPredicatesRemainIndexOwnedWhenEnumerationIsAvailable(t *testing.T) {
	workspace := t.TempDir()
	writeQueryFixture(t, workspace, filepath.Join("data", "assets", "hero.png"))
	browser := filebrowser.NewService(workspace, nil)
	called := false
	service := NewService(browser, func(request assetmeta.SearchRequest) ([]assetmeta.AssetMeta, int, error) {
		called = true
		return []assetmeta.AssetMeta{{RootID: assetmeta.LegacyDataRootID, Path: "assets/indexed.png"}}, 1, nil
	}, browser)

	result, err := service.Search(context.Background(), assetmeta.SearchRequest{Tags: []string{"blue"}, Limit: 20})
	if err != nil {
		t.Fatal(err)
	}
	if !called || len(result.Assets) != 1 || result.Assets[0].Path != "data/assets/indexed.png" {
		t.Fatalf("metadata query bypassed the index: called=%v result=%+v", called, result)
	}
}

func writeQueryFixture(t *testing.T, root, relative string) {
	t.Helper()
	absolute := filepath.Join(root, filepath.FromSlash(relative))
	if err := os.MkdirAll(filepath.Dir(absolute), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(absolute, []byte("fixture"), 0o644); err != nil {
		t.Fatal(err)
	}
}
