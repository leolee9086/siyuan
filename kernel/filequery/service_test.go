package filequery

import (
	"context"
	"errors"
	"reflect"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/assetmeta"
	"github.com/siyuan-note/siyuan/kernel/filebrowser"
)

type rootStub struct {
	roots []filebrowser.Root
	err   error
}

func (s rootStub) ListRoots() ([]filebrowser.Root, error) {
	return s.roots, s.err
}

func testRoots() []filebrowser.Root {
	return []filebrowser.Root{
		{ID: "workspace", Kind: filebrowser.RootKindWorkspace, Exists: true, Capabilities: filebrowser.RootCapabilities{Browse: true}},
		{ID: "agent-a", Kind: filebrowser.RootKindAgent, Exists: true, Capabilities: filebrowser.RootCapabilities{Browse: true}},
		{ID: "missing", Kind: filebrowser.RootKindAgent, Exists: false, Capabilities: filebrowser.RootCapabilities{Browse: true}},
	}
}

func TestSearchScopesIndexToCurrentBrowserRootsAndMapsLegacyData(t *testing.T) {
	var received assetmeta.SearchRequest
	service := NewService(rootStub{roots: testRoots()}, func(request assetmeta.SearchRequest) ([]assetmeta.AssetMeta, int, error) {
		received = request
		return []assetmeta.AssetMeta{
			{RootID: assetmeta.LegacyDataRootID, Path: "assets/red.png"},
			{RootID: "workspace", Path: "notes/plan.md"},
			{RootID: "agent-a", Path: "task/output.png"},
		}, 3, nil
	})

	result, err := service.Search(context.Background(), assetmeta.SearchRequest{AllRoots: true, Limit: 2})
	if err != nil {
		t.Fatal(err)
	}
	if received.AllRoots || !reflect.DeepEqual(received.RootIDs, []string{"agent-a", "data", "workspace"}) {
		t.Fatalf("index scope escaped browser roots: %+v", received)
	}
	if result.TotalCount != 3 || result.PageCount != 2 || len(result.Assets) != 3 {
		t.Fatalf("unexpected page result: %+v", result)
	}
	if result.Assets[0].RootID != "workspace" || result.Assets[0].Path != "data/assets/red.png" {
		t.Fatalf("legacy data address was not mapped to browser root: %+v", result.Assets[0])
	}
	if result.Assets[2].RootID != "agent-a" || result.Assets[2].Path != "task/output.png" {
		t.Fatalf("agent address changed: %+v", result.Assets[2])
	}
}

func TestSearchDefaultsToWorkspaceAndRejectsUnavailableRoots(t *testing.T) {
	var received assetmeta.SearchRequest
	service := NewService(rootStub{roots: testRoots()}, func(request assetmeta.SearchRequest) ([]assetmeta.AssetMeta, int, error) {
		received = request
		return nil, 0, nil
	})
	if _, err := service.Search(context.Background(), assetmeta.SearchRequest{}); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(received.RootIDs, []string{"data", "workspace"}) {
		t.Fatalf("empty query must search the full workspace identity: %+v", received)
	}
	for _, rootID := range []string{"missing", "not-a-root"} {
		if _, err := service.Search(context.Background(), assetmeta.SearchRequest{RootIDs: []string{rootID}}); !errors.Is(err, filebrowser.ErrRootNotFound) {
			t.Fatalf("root %q was not rejected: %v", rootID, err)
		}
	}
}

func TestSearchTranslatesBrowserPathPrefixesPerRootIdentity(t *testing.T) {
	tests := []struct {
		name       string
		rootID     string
		prefix     string
		wantRoots  []string
		wantPrefix string
	}{
		{name: "workspace data subtree", rootID: "workspace", prefix: "data/assets/icons", wantRoots: []string{"data"}, wantPrefix: "assets/icons"},
		{name: "workspace ordinary directory", rootID: "workspace", prefix: "notes/plans", wantRoots: []string{"workspace"}, wantPrefix: "notes/plans"},
		{name: "agent directory", rootID: "agent-a", prefix: "task/output", wantRoots: []string{"agent-a"}, wantPrefix: "task/output"},
		{name: "escaped LIKE characters", rootID: "agent-a", prefix: `task/%_draft`, wantRoots: []string{"agent-a"}, wantPrefix: `task/%_draft`},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			var received assetmeta.SearchRequest
			service := NewService(rootStub{roots: testRoots()}, func(request assetmeta.SearchRequest) ([]assetmeta.AssetMeta, int, error) {
				received = request
				return nil, 0, nil
			})
			if _, err := service.Search(context.Background(), assetmeta.SearchRequest{
				RootIDs: []string{test.rootID}, PathPrefix: test.prefix,
			}); err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(received.RootIDs, test.wantRoots) || received.PathPrefix != test.wantPrefix {
				t.Fatalf("path scope changed: got roots=%v prefix=%q, want roots=%v prefix=%q",
					received.RootIDs, received.PathPrefix, test.wantRoots, test.wantPrefix)
			}
		})
	}
}

func TestSearchTranslatesSelectedWorkspaceChildPrefixes(t *testing.T) {
	var received assetmeta.SearchRequest
	service := NewService(rootStub{roots: testRoots()}, func(request assetmeta.SearchRequest) ([]assetmeta.AssetMeta, int, error) {
		received = request
		return nil, 0, nil
	})
	if _, err := service.Search(context.Background(), assetmeta.SearchRequest{
		RootIDs: []string{"workspace"}, PathPrefixes: []string{"data/assets/icons", "data/assets/photos"},
	}); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(received.RootIDs, []string{"data"}) ||
		!reflect.DeepEqual(received.PathPrefixes, []string{"assets/icons", "assets/photos"}) {
		t.Fatalf("selected child prefixes escaped the workspace data identity: %+v", received)
	}
	if _, err := service.Search(context.Background(), assetmeta.SearchRequest{
		RootIDs: []string{"workspace"}, PathPrefixes: []string{"data/assets/icons", "notes/plans"},
	}); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(received.RootIDs, []string{"data", "workspace"}) ||
		!reflect.DeepEqual(received.PathPrefixes, []string{"assets/icons", "notes/plans"}) {
		t.Fatalf("mixed workspace identities were not preserved: %+v", received)
	}
}

func TestTagCountsRejectsUnavailableRootsBeforeIndexAccess(t *testing.T) {
	service := NewService(rootStub{roots: testRoots()}, nil)
	if _, err := service.TagCounts(context.Background(), TagRequest{RootIDs: []string{"missing"}}); !errors.Is(err, filebrowser.ErrRootNotFound) {
		t.Fatalf("unavailable root was not rejected: %v", err)
	}
}
