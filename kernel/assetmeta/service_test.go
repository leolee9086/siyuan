package assetmeta

import (
	"context"
	"database/sql"
	"errors"
	"image"
	"image/png"
	"io/fs"
	"os"
	"path/filepath"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/fswalk"
)

func TestScanAssetsUsesBoundDiscoveryAndPreservesExistingMetadata(t *testing.T) {
	useTestAssetIndex(t)
	root := t.TempDir()
	walker, err := fswalk.New(root)
	if err != nil {
		t.Fatal(err)
	}
	manager := NewManager(walker, "meta")
	service := &AssetMetaService{files: walker, manager: manager, tagsCache: map[string]TagInfo{}}

	writeAssetPNG(t, root, "assets/new.png", 11, 7)
	writeAssetFixture(t, root, "assets/plain.txt", []byte("plain asset"))
	writeAssetPNG(t, root, "assets/recover.png", 5, 3)
	writeAssetPNG(t, root, "assets/bad.png", 4, 4)
	writeAssetPNG(t, root, "assets/indexed.png", 2, 2)

	recovered := AssetMeta{Path: "assets/recover.png", Name: "kept-name.png", Tags: []string{"kept"}, Source: "existing"}
	if err = manager.SaveAsset(recovered); err != nil {
		t.Fatal(err)
	}
	badMetadataPath := "meta/assets/assets/bad.png.json"
	badMetadata := []byte(`{"path":`)
	writeAssetFixture(t, root, badMetadataPath, badMetadata)
	indexed := AssetMeta{Path: "assets/indexed.png", Name: "indexed-name.png", Source: "existing-index"}
	if err = UpdateIndexAsset(indexed); err != nil {
		t.Fatal(err)
	}

	if err = service.scanAssets(context.Background()); err != nil {
		t.Fatal(err)
	}

	created, err := manager.LoadAsset("assets/new.png")
	if err != nil || created.Width != 11 || created.Height != 7 || created.FileSize <= 0 || created.Source != "scan" {
		t.Fatalf("new image metadata is incomplete: %+v err=%v", created, err)
	}
	if indexedCreated, ok := GetIndexAsset(created.Path); !ok || indexedCreated.Width != 11 || indexedCreated.FileSize <= 0 {
		t.Fatalf("new image was not indexed with physical metadata: %+v ok=%v", indexedCreated, ok)
	}
	plain, err := manager.LoadAsset("assets/plain.txt")
	if err != nil || plain.FileSize != int64(len("plain asset")) || plain.Width != 0 || plain.Height != 0 {
		t.Fatalf("non-image asset semantics changed: %+v err=%v", plain, err)
	}
	if restored, ok := GetIndexAsset(recovered.Path); !ok || restored.Name != recovered.Name || len(restored.Tags) != 1 {
		t.Fatalf("existing metadata was not restored into the index: %+v ok=%v", restored, ok)
	}
	if _, ok := GetIndexAsset("assets/bad.png"); ok {
		t.Fatal("malformed existing metadata was overwritten and indexed")
	}
	badAfter, err := os.ReadFile(filepath.Join(root, filepath.FromSlash(badMetadataPath)))
	if err != nil || string(badAfter) != string(badMetadata) {
		t.Fatalf("malformed metadata file changed: %q err=%v", badAfter, err)
	}
	if unchanged, ok := GetIndexAsset(indexed.Path); !ok || unchanged.Name != indexed.Name {
		t.Fatalf("already indexed asset changed: %+v ok=%v", unchanged, ok)
	}
	if _, err = manager.LoadAsset(indexed.Path); !errors.Is(err, fs.ErrNotExist) {
		t.Fatalf("already indexed asset was unnecessarily persisted: %v", err)
	}
}

func useTestAssetIndex(t *testing.T) {
	t.Helper()
	previous := indexDB
	database, err := sql.Open("sqlite3_extended", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	indexDB = database
	initTables()
	t.Cleanup(func() {
		database.Close()
		indexDB = previous
	})
}

func writeAssetPNG(t *testing.T, root, relative string, width, height int) {
	t.Helper()
	filePath := filepath.Join(root, filepath.FromSlash(relative))
	if err := os.MkdirAll(filepath.Dir(filePath), 0755); err != nil {
		t.Fatal(err)
	}
	file, err := os.Create(filePath)
	if err != nil {
		t.Fatal(err)
	}
	if err = png.Encode(file, image.NewRGBA(image.Rect(0, 0, width, height))); err != nil {
		file.Close()
		t.Fatal(err)
	}
	if err = file.Close(); err != nil {
		t.Fatal(err)
	}
}

func writeAssetFixture(t *testing.T, root, relative string, content []byte) {
	t.Helper()
	filePath := filepath.Join(root, filepath.FromSlash(relative))
	if err := os.MkdirAll(filepath.Dir(filePath), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filePath, content, 0600); err != nil {
		t.Fatal(err)
	}
}
