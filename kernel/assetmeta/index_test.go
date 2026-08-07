package assetmeta

import (
	"database/sql"
	"path/filepath"
	"testing"
)

func TestIndexPreservesRootIdentityAndCompleteMetadata(t *testing.T) {
	bindTestIndex(t)
	workspace := AssetMeta{
		Path: "assets/shared.png", Name: "workspace.png", Tags: []string{"red", "shared"}, Star: 4,
		Annotation: "workspace annotation", BoundBlockID: "20260807120000-block", Source: "local", SourceID: "source-1",
		Width: 320, Height: 200, FileSize: 1234,
		Palettes: []Palette{{Color: [3]int{250, 10, 10}, H: 0, S: 96, L: 51, Ratio: 0.8}},
	}
	agent := AssetMeta{
		RootID: "root-agent", Path: "assets/shared.png", Name: "agent.png", Tags: []string{"blue", "shared"},
		Annotation: "agent annotation", Source: "agent", Width: 640, Height: 480, FileSize: 4321,
		Palettes: []Palette{{Color: [3]int{10, 20, 245}, H: 238, S: 92, L: 50, Ratio: 0.7}},
	}
	if err := UpdateIndexAsset(workspace); err != nil {
		t.Fatal(err)
	}
	if err := UpdateIndexAsset(agent); err != nil {
		t.Fatal(err)
	}

	loaded, ok := GetIndexAsset(workspace.Path)
	if !ok {
		t.Fatal("workspace record was not indexed")
	}
	if loaded.RootID != LegacyDataRootID || loaded.Annotation != workspace.Annotation ||
		loaded.BoundBlockID != workspace.BoundBlockID || loaded.SourceID != workspace.SourceID || len(loaded.Palettes) != 1 {
		t.Fatalf("complete workspace projection changed: %+v", loaded)
	}
	agentLoaded, ok := GetIndexAssetAt(AssetAddress{RootID: agent.RootID, Path: agent.Path})
	if !ok || agentLoaded.Name != agent.Name || agentLoaded.Annotation != agent.Annotation {
		t.Fatalf("same path in another root collided: %+v ok=%v", agentLoaded, ok)
	}
}

func TestAdvancedSearchUsesTagAndPaletteIndicesAcrossExplicitRoots(t *testing.T) {
	bindTestIndex(t)
	assets := []AssetMeta{
		{Path: "assets/red.png", Name: "red.png", Tags: []string{"red", "shared"}, Annotation: "hero reference",
			ImportTime: 3, Palettes: []Palette{{Color: [3]int{250, 10, 10}, H: 0, S: 96, L: 51, Ratio: 0.8}}},
		{RootID: "root-agent", Path: "red.png", Name: "agent-red.png", Tags: []string{"red", "blue"}, ImportTime: 2,
			Palettes: []Palette{{Color: [3]int{245, 20, 15}, H: 359, S: 92, L: 51, Ratio: 0.6}}},
		{RootID: "root-agent", Path: "blue.png", Name: "agent-blue.png", Tags: []string{"blue"}, ImportTime: 1,
			Palettes: []Palette{{Color: [3]int{10, 20, 245}, H: 238, S: 92, L: 50, Ratio: 0.7}}},
	}
	if err := RebuildIndex(assets); err != nil {
		t.Fatal(err)
	}

	legacy, total, err := SearchAssetsAdvanced(SearchRequest{Limit: 20})
	if err != nil || total != 1 || len(legacy) != 1 || legacy[0].RootID != LegacyDataRootID {
		t.Fatalf("empty root filter no longer preserves data-root behavior: results=%+v total=%d err=%v", legacy, total, err)
	}
	agent, total, err := SearchAssetsAdvanced(SearchRequest{
		RootIDs: []string{"root-agent"}, Tags: []string{"red", "blue"}, MatchAllTags: true, Limit: 20,
	})
	if err != nil || total != 1 || len(agent) != 1 || agent[0].Path != "red.png" {
		t.Fatalf("all-tag query returned the wrong root records: results=%+v total=%d err=%v", agent, total, err)
	}
	color := [3]int{250, 0, 0}
	red, total, err := SearchAssetsAdvanced(SearchRequest{
		AllRoots: true, Palette: &PaletteSearch{Color: &color, Tolerance: 30, MinRatio: 0.5}, Limit: 20,
	})
	if err != nil || total != 2 || len(red) != 2 {
		t.Fatalf("RGB palette query did not use cross-root index records: results=%+v total=%d err=%v", red, total, err)
	}
	minH, maxH := 350, 10
	circular, total, err := SearchAssetsAdvanced(SearchRequest{
		AllRoots: true, Palette: &PaletteSearch{MinH: &minH, MaxH: &maxH}, Limit: 20,
	})
	if err != nil || total != 2 || len(circular) != 2 {
		t.Fatalf("circular hue query failed: results=%+v total=%d err=%v", circular, total, err)
	}
	keyword, total, err := SearchAssetsAdvanced(SearchRequest{Keyword: "hero", Limit: 20})
	if err != nil || total != 1 || len(keyword) != 1 || keyword[0].Annotation != "hero reference" {
		t.Fatalf("annotation keyword was not searchable: results=%+v total=%d err=%v", keyword, total, err)
	}
}

func TestAdvancedSearchPathScopeHonorsDirectAndSelectedChildDirectories(t *testing.T) {
	bindTestIndex(t)
	if err := RebuildIndex([]AssetMeta{
		{Path: "folder/direct.png", Name: "direct.png"},
		{Path: "folder/child/deep.png", Name: "deep.png"},
		{Path: "folder/other/asset.png", Name: "asset.png"},
		{Path: "outside.png", Name: "outside.png"},
	}); err != nil {
		t.Fatal(err)
	}
	direct := false
	items, total, err := SearchAssetsAdvanced(SearchRequest{
		PathPrefix: "folder", Recursive: &direct, Limit: 20,
	})
	if err != nil || total != 1 || len(items) != 1 || items[0].Path != "folder/direct.png" {
		t.Fatalf("direct directory scope returned unexpected results: %+v total=%d err=%v", items, total, err)
	}
	items, total, err = SearchAssetsAdvanced(SearchRequest{PathPrefix: "folder", Limit: 20})
	if err != nil || total != 3 || len(items) != 3 {
		t.Fatalf("recursive directory scope returned unexpected results: %+v total=%d err=%v", items, total, err)
	}
	items, total, err = SearchAssetsAdvanced(SearchRequest{
		PathPrefixes: []string{"folder/child", "folder/other"}, Limit: 20,
	})
	if err != nil || total != 2 || len(items) != 2 {
		t.Fatalf("selected child scopes returned unexpected results: %+v total=%d err=%v", items, total, err)
	}
}

func TestGetTagCountsScopesRootsAndOrdersCaseInsensitively(t *testing.T) {
	bindTestIndex(t)
	assets := []AssetMeta{
		{Path: "one.png", Tags: []string{"Zed", "shared"}},
		{Path: "two.png", Tags: []string{"alpha", "shared"}},
		{RootID: "root-agent", Path: "three.png", Tags: []string{"agent", "shared"}},
	}
	if err := RebuildIndex(assets); err != nil {
		t.Fatal(err)
	}
	workspace, err := GetTagCounts([]string{LegacyDataRootID})
	if err != nil {
		t.Fatal(err)
	}
	if len(workspace) != 3 || workspace[0].Name != "alpha" || workspace[0].Count != 1 ||
		workspace[1].Name != "shared" || workspace[1].Count != 2 || workspace[2].Name != "Zed" {
		t.Fatalf("unexpected workspace tag counts: %+v", workspace)
	}
	agent, err := GetTagCounts([]string{"root-agent"})
	if err != nil || len(agent) != 2 || agent[0].Name != "agent" || agent[1].Count != 1 {
		t.Fatalf("unexpected agent tag counts: %+v err=%v", agent, err)
	}
}

func TestInitTablesRebuildsLegacyTemporarySchema(t *testing.T) {
	databasePath := filepath.Join(t.TempDir(), "legacy.db")
	database, err := sql.Open("sqlite3_extended", databasePath)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = database.Exec("CREATE TABLE asset_meta (path TEXT PRIMARY KEY, name TEXT)"); err != nil {
		t.Fatal(err)
	}
	bindExistingTestIndex(t, database)
	initTables()
	columns := indexColumns(t, database)
	for _, required := range []string{"asset_key", "root_id", "annotation", "bound_block_id"} {
		if !columns[required] {
			t.Fatalf("rebuilt schema is missing %s: %+v", required, columns)
		}
	}
}

func bindTestIndex(t *testing.T) {
	t.Helper()
	database, err := sql.Open("sqlite3_extended", filepath.Join(t.TempDir(), "asset-meta.db"))
	if err != nil {
		t.Fatal(err)
	}
	bindExistingTestIndex(t, database)
	initTables()
}

func bindExistingTestIndex(t *testing.T, database *sql.DB) {
	t.Helper()
	previous := indexDB
	indexDB = database
	t.Cleanup(func() {
		_ = database.Close()
		indexDB = previous
	})
}

func indexColumns(t *testing.T, database *sql.DB) map[string]bool {
	t.Helper()
	rows, err := database.Query("PRAGMA table_info(asset_meta)")
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	columns := map[string]bool{}
	for rows.Next() {
		var cid int
		var name, columnType string
		var notNull, primaryKey int
		var defaultValue any
		if err = rows.Scan(&cid, &name, &columnType, &notNull, &defaultValue, &primaryKey); err != nil {
			t.Fatal(err)
		}
		columns[name] = true
	}
	return columns
}
