package assetmeta

import (
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/fswalk"
	"github.com/siyuan-note/siyuan/kernel/internal/testutil/symlinkfixture"
)

func TestManagerLoadAllUsesBoundJSONDocumentWorkflow(t *testing.T) {
	root := t.TempDir()
	writeAssetMetaFixture(t, root, "meta/assets/folder/one.png.json", `{"path":"assets/folder/one.png","name":"one.png","tags":["red"]}`)
	writeAssetMetaFixture(t, root, "meta/assets/folder/two.png.json", `{"name":"two.png"}`)
	writeAssetMetaFixture(t, root, "meta/assets/folder/bad.json", `{"path":`)
	writeAssetMetaFixture(t, root, "meta/assets/folder/readme.txt", `ignored`)

	manager := newTestManager(t, root, "meta")
	metas, err := manager.LoadAll()
	if err != nil {
		t.Fatal(err)
	}
	if len(metas) != 2 {
		t.Fatalf("expected two decoded metas, got %+v", metas)
	}
	byName := make(map[string]AssetMeta, len(metas))
	for _, meta := range metas {
		byName[meta.Name] = meta
	}
	if byName["one.png"].Path != "assets/folder/one.png" || len(byName["one.png"].Tags) != 1 {
		t.Fatalf("valid meta changed: %+v", byName["one.png"])
	}
	if byName["two.png"].Path != "folder/two.png" {
		t.Fatalf("missing path was not derived from the root-relative JSON path: %+v", byName["two.png"])
	}
}

func TestManagerLoadAllKeepsMissingRootSemantics(t *testing.T) {
	root := t.TempDir()
	manager := newTestManager(t, root, "missing")
	metas, err := manager.LoadAll()
	if err != nil || len(metas) != 0 {
		t.Fatalf("missing metadata root changed behavior: metas=%v err=%v", metas, err)
	}
}

func TestManagerUsesBoundStoreForAssetAndTagLifecycle(t *testing.T) {
	root := t.TempDir()
	manager := newTestManager(t, root, "meta")
	meta := AssetMeta{Path: "assets/folder/sample.png", Name: "sample.png", Tags: []string{"red"}, Width: 12}
	if err := manager.SaveAsset(meta); err != nil {
		t.Fatal(err)
	}
	loaded, err := manager.LoadAsset(meta.Path)
	if err != nil || loaded.Name != meta.Name || loaded.Width != meta.Width || len(loaded.Tags) != 1 {
		t.Fatalf("asset round trip changed: loaded=%+v err=%v", loaded, err)
	}
	if err = manager.SaveTags(map[string]TagInfo{"red": {Name: "Red", Color: "#ff0000"}}); err != nil {
		t.Fatal(err)
	}
	tags, err := manager.LoadTags()
	if err != nil || tags["red"].Color != "#ff0000" {
		t.Fatalf("tag round trip changed: tags=%+v err=%v", tags, err)
	}
	if err = manager.RemoveAsset(meta.Path); err != nil {
		t.Fatal(err)
	}
	if _, err = manager.LoadAsset(meta.Path); !errors.Is(err, fs.ErrNotExist) {
		t.Fatalf("removed asset remained readable: %v", err)
	}
}

func TestManagerKeepsRootAddressedMetadataInWorkspaceStore(t *testing.T) {
	root := t.TempDir()
	manager := newTestManager(t, root, "meta")
	first := AssetAddress{RootID: "root-first", Path: "nested/sample.png"}
	second := AssetAddress{RootID: "root-second", Path: "nested/sample.png"}
	if err := manager.SaveAssetAt(first, AssetMeta{Name: "first.png", Tags: []string{"red"}}); err != nil {
		t.Fatal(err)
	}
	if err := manager.SaveAssetAt(second, AssetMeta{Name: "second.png", Tags: []string{"blue"}}); err != nil {
		t.Fatal(err)
	}
	loaded, err := manager.LoadAssetAt(first)
	if err != nil {
		t.Fatal(err)
	}
	if loaded.RootID != first.RootID || loaded.Path != first.Path || loaded.Name != "first.png" {
		t.Fatalf("stable address changed during round trip: %+v", loaded)
	}
	other, err := manager.LoadAssetAt(second)
	if err != nil || other.Name != "second.png" {
		t.Fatalf("same relative path in another root collided: meta=%+v err=%v", other, err)
	}
	stored, err := filepath.Glob(filepath.Join(root, "meta", "assets", "roots", "*", "*.json"))
	if err != nil || len(stored) != 2 {
		t.Fatalf("expected two hashed workspace records, files=%v err=%v", stored, err)
	}
	if err = manager.RemoveAssetAt(first); err != nil {
		t.Fatal(err)
	}
	if _, err = manager.LoadAssetAt(first); !errors.Is(err, fs.ErrNotExist) {
		t.Fatalf("removed addressed metadata remained readable: %v", err)
	}
}

func TestManagerRejectsEscapesAndLinkedMetadataComponents(t *testing.T) {
	root := t.TempDir()
	manager := newTestManager(t, root, "meta")
	if err := manager.SaveAsset(AssetMeta{Path: "../outside", Name: "outside"}); !errors.Is(err, ErrPathTraversal) {
		t.Fatalf("asset key escape was accepted: %v", err)
	}
	outside := t.TempDir()
	linkedParent := filepath.Join(root, "meta", "assets")
	if err := os.MkdirAll(linkedParent, 0755); err != nil {
		t.Fatal(err)
	}
	symlinkfixture.Create(t, outside, filepath.Join(linkedParent, "linked"))
	if err := manager.SaveAsset(AssetMeta{Path: "linked/sample.png", Name: "sample.png"}); !errors.Is(err, ErrPathTraversal) {
		t.Fatalf("linked metadata component was accepted: %v", err)
	}
}

func newTestManager(t *testing.T, root, namespace string) *Manager {
	t.Helper()
	walker, err := fswalk.New(root)
	if err != nil {
		t.Fatal(err)
	}
	manager := NewManager(walker, namespace)
	if err = manager.available(); err != nil {
		t.Fatal(err)
	}
	return manager
}

func writeAssetMetaFixture(t *testing.T, root, relative, content string) {
	t.Helper()
	path := filepath.Join(root, filepath.FromSlash(relative))
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0600); err != nil {
		t.Fatal(err)
	}
}
