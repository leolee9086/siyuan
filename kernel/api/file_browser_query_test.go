package api

import (
	"reflect"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/siyuan/kernel/agent"
	"github.com/siyuan-note/siyuan/kernel/assetmeta"
	"github.com/siyuan-note/siyuan/kernel/filebrowser"
	"github.com/siyuan-note/siyuan/kernel/filequery"
)

func TestFileBrowserSearchUsesAuthorizedBrowserRootsAndMapsAddresses(t *testing.T) {
	gin.SetMode(gin.TestMode)
	workspace := t.TempDir()
	agentDirectory := t.TempDir()
	var received assetmeta.SearchRequest
	var agentRootID string
	originalFactory := newFileBrowserQueryService
	newFileBrowserQueryService = func() *filequery.Service {
		browser := filebrowser.NewService(workspace, func() (map[string]*agent.TaskDirectoryBinding, error) {
			return map[string]*agent.TaskDirectoryBinding{
				"session-a": {Directories: []*agent.TaskDirectoryGrant{{
					ID: "task", Path: agentDirectory, Name: "task", Permission: agent.TaskDirectoryPermissionReadOnly,
					OwnerIdentityID: "owner",
				}}},
			}, nil
		})
		roots, err := browser.ListRoots()
		if err != nil {
			t.Fatal(err)
		}
		for _, root := range roots {
			if root.Kind == filebrowser.RootKindAgent {
				agentRootID = root.ID
			}
		}
		return filequery.NewService(browser, func(request assetmeta.SearchRequest) ([]assetmeta.AssetMeta, int, error) {
			received = request
			return []assetmeta.AssetMeta{
				{RootID: assetmeta.LegacyDataRootID, Path: "assets/workspace.png"},
				{RootID: agentRootID, Path: "task/output.png"},
			}, 2, nil
		})
	}
	t.Cleanup(func() { newFileBrowserQueryService = originalFactory })

	remote := callFileBrowserHandler(t, searchSForgeFileBrowserAssets, "203.0.113.10:6806", `{}`)
	if remote.Code != 403 {
		t.Fatalf("remote search must be rejected: %+v", remote)
	}
	response := callFileBrowserHandler(t, searchSForgeFileBrowserAssets, "127.0.0.1:6806", `{"keyword":"hero","limit":2}`)
	if response.Code != 0 || !strings.Contains(string(response.Data), `"rootID":"workspace"`) ||
		!strings.Contains(string(response.Data), `"path":"data/assets/workspace.png"`) {
		t.Fatalf("unexpected scoped search response: %+v", response)
	}
	if !reflect.DeepEqual(received.RootIDs, []string{"data", "workspace"}) || received.AllRoots {
		t.Fatalf("default search escaped workspace scope: %+v", received)
	}

	all := callFileBrowserHandler(t, searchSForgeFileBrowserAssets, "127.0.0.1:6806", `{"allRoots":true}`)
	if all.Code != 0 || !strings.Contains(string(all.Data), `"rootID":"`+agentRootID+`"`) {
		t.Fatalf("all-root search did not expose Agent result: %+v", all)
	}
	if !received.AllRoots && !reflect.DeepEqual(received.RootIDs, []string{"data", agentRootID, "workspace"}) {
		t.Fatalf("all-root search was not normalized: %+v", received)
	}

	missing := callFileBrowserHandler(t, searchSForgeFileBrowserAssets, "127.0.0.1:6806", `{"rootIDs":["missing"]}`)
	if missing.Code != 404 {
		t.Fatalf("unavailable root must be rejected: %+v", missing)
	}
}
