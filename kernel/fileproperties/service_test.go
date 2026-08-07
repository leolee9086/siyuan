package fileproperties

import (
	"context"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/siyuan-note/siyuan/kernel/agent"
	"github.com/siyuan-note/siyuan/kernel/assetmeta"
	"github.com/siyuan-note/siyuan/kernel/filebrowser"
)

type memoryMetadataStore struct {
	items     map[string]assetmeta.AssetMeta
	loadError map[string]error
	writes    []assetmeta.AssetAddress
}

func (store *memoryMetadataStore) LoadAssetAt(address assetmeta.AssetAddress) (assetmeta.AssetMeta, error) {
	key := metadataTestKey(address)
	if err := store.loadError[key]; err != nil {
		return assetmeta.AssetMeta{}, err
	}
	meta, exists := store.items[key]
	if !exists {
		return assetmeta.AssetMeta{}, fs.ErrNotExist
	}
	return meta, nil
}

func (store *memoryMetadataStore) SetAssetAt(address assetmeta.AssetAddress, meta assetmeta.AssetMeta) error {
	store.items[metadataTestKey(address)] = meta
	store.writes = append(store.writes, address)
	return nil
}

func TestInspectCombinesLegacyWorkspaceAndExternalRootMetadata(t *testing.T) {
	workspace, external, files, externalID := newPropertyTestBrowser(t)
	if err := os.MkdirAll(filepath.Join(workspace, "data", "assets"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(workspace, "data", "assets", "one.txt"), []byte("one"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(external, "two.txt"), []byte("two"), 0600); err != nil {
		t.Fatal(err)
	}
	store := &memoryMetadataStore{items: map[string]assetmeta.AssetMeta{}, loadError: map[string]error{}}
	workspaceAddress := assetmeta.AssetAddress{RootID: assetmeta.LegacyDataRootID, Path: "assets/one.txt"}
	externalAddress := assetmeta.AssetAddress{RootID: externalID, Path: "two.txt"}
	store.items[metadataTestKey(workspaceAddress)] = assetmeta.AssetMeta{Annotation: "kept", Tags: []string{"workspace"}}
	store.items[metadataTestKey(externalAddress)] = assetmeta.AssetMeta{Tags: []string{"external"}}
	service := NewService(files, store)
	result, err := service.Inspect(context.Background(), filebrowser.BatchPropertiesRequest{Items: []filebrowser.FileRequest{
		{RootID: "workspace", Path: "data/assets/one.txt"},
		{RootID: externalID, Path: "two.txt"},
		{RootID: "workspace", Path: "data"},
	}})
	if err != nil {
		t.Fatal(err)
	}
	if result.SuccessCount != 3 || result.FailureCount != 0 || result.MetadataFailureCount != 0 {
		t.Fatalf("unexpected inspect summary: %+v", result)
	}
	workspaceMeta := result.Items[0].Metadata
	if workspaceMeta == nil || workspaceMeta.RootID != assetmeta.LegacyDataRootID || workspaceMeta.Path != "assets/one.txt" ||
		workspaceMeta.Annotation != "kept" || !result.Items[0].MetadataPersisted {
		t.Fatalf("workspace data compatibility identity changed: %+v", result.Items[0])
	}
	externalMeta := result.Items[1].Metadata
	if externalMeta == nil || externalMeta.RootID != externalID || externalMeta.Path != "two.txt" || !result.Items[1].Properties.ReadOnly {
		t.Fatalf("external metadata identity or capability changed: %+v", result.Items[1])
	}
	directoryMeta := result.Items[2].Metadata
	if directoryMeta == nil || directoryMeta.RootID != "workspace" || directoryMeta.Path != "data" || directoryMeta.Tags == nil ||
		result.Items[2].MetadataPersisted {
		t.Fatalf("unpersisted directory defaults changed: %+v", result.Items[2])
	}
}

func TestInspectKeepsPhysicalPropertiesWhenMetadataIsCorrupt(t *testing.T) {
	workspace := t.TempDir()
	if err := os.WriteFile(filepath.Join(workspace, "broken.txt"), []byte("physical"), 0600); err != nil {
		t.Fatal(err)
	}
	files := filebrowser.NewService(workspace, func() (map[string]*agent.TaskDirectoryBinding, error) { return nil, nil })
	address := assetmeta.AssetAddress{RootID: "workspace", Path: "broken.txt"}
	store := &memoryMetadataStore{items: map[string]assetmeta.AssetMeta{}, loadError: map[string]error{
		metadataTestKey(address): errors.New("corrupt metadata"),
	}}
	result, err := NewService(files, store).Inspect(context.Background(), filebrowser.BatchPropertiesRequest{Items: []filebrowser.FileRequest{{
		RootID: "workspace", Path: "broken.txt",
	}}})
	if err != nil {
		t.Fatal(err)
	}
	item := result.Items[0]
	if item.Properties == nil || item.Error != nil || item.Metadata != nil || item.MetadataError == nil ||
		item.MetadataError.Code != "metadata-read-failed" || result.MetadataFailureCount != 1 {
		t.Fatalf("metadata failure swallowed physical evidence: %+v", result)
	}
}

func TestUpdatePersistsPrivateMetadataForReadOnlyRootAndChecksRevision(t *testing.T) {
	_, external, files, externalID := newPropertyTestBrowser(t)
	if err := os.WriteFile(filepath.Join(external, "sample.txt"), []byte("sample"), 0600); err != nil {
		t.Fatal(err)
	}
	store := &memoryMetadataStore{items: map[string]assetmeta.AssetMeta{}, loadError: map[string]error{}}
	service := NewService(files, store)
	service.now = func() time.Time { return time.Unix(12345, 0) }
	inspected, err := service.Inspect(context.Background(), filebrowser.BatchPropertiesRequest{Items: []filebrowser.FileRequest{{
		RootID: externalID, Path: "sample.txt",
	}}})
	if err != nil {
		t.Fatal(err)
	}
	revision := inspected.Items[0].Properties.Revision
	tags := []string{" Blue ", "red", "blue", ""}
	star := 9
	annotation := "  useful note  "
	result, err := service.Update(context.Background(), BatchUpdateRequest{Items: []UpdateItem{
		{Request: filebrowser.FileRequest{RootID: externalID, Path: "sample.txt"}, Revision: revision,
			Patch: MetadataPatch{Tags: &tags, Star: &star, Annotation: &annotation}},
		{Request: filebrowser.FileRequest{RootID: externalID, Path: "sample.txt"}, Revision: "stale",
			Patch: MetadataPatch{Star: &star}},
		{Request: filebrowser.FileRequest{RootID: externalID, Path: "sample.txt"}, Revision: revision},
	}})
	if err != nil {
		t.Fatal(err)
	}
	if result.SuccessCount != 1 || result.FailureCount != 2 {
		t.Fatalf("unexpected update summary: %+v", result)
	}
	updated := result.Items[0]
	if updated.Metadata == nil || updated.Metadata.RootID != externalID || updated.Metadata.Star != 5 ||
		updated.Metadata.Annotation != "useful note" || len(updated.Metadata.Tags) != 2 ||
		updated.Metadata.Tags[0] != "Blue" || updated.Metadata.Tags[1] != "red" || updated.Metadata.ImportTime != 12345 {
		t.Fatalf("metadata patch was not normalized and persisted: %+v", updated)
	}
	if result.Items[1].Error == nil || result.Items[1].Error.Code != "revision-conflict" ||
		result.Items[2].Error == nil || result.Items[2].Error.Code != "invalid-patch" || len(store.writes) != 1 {
		t.Fatalf("revision/empty patch guards changed: result=%+v writes=%+v", result, store.writes)
	}
}

func newPropertyTestBrowser(t *testing.T) (string, string, *filebrowser.Service, string) {
	t.Helper()
	workspace := t.TempDir()
	external := t.TempDir()
	files := filebrowser.NewService(workspace, func() (map[string]*agent.TaskDirectoryBinding, error) {
		return map[string]*agent.TaskDirectoryBinding{
			"session": {Main: &agent.TaskDirectoryGrant{
				ID: "external", Path: external, Name: "external", Permission: agent.TaskDirectoryPermissionReadOnly,
			}},
		}, nil
	})
	roots, err := files.ListRoots()
	if err != nil || len(roots) != 2 {
		t.Fatalf("create test roots: roots=%+v err=%v", roots, err)
	}
	return workspace, external, files, roots[1].ID
}

func metadataTestKey(address assetmeta.AssetAddress) string {
	return address.RootID + "\x00" + address.Path
}
