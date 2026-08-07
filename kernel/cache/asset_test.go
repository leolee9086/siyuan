package cache

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/internal/testutil/symlinkfixture"
)

func TestLoadAssetsFromRootSkipsSymbolicLinksAndHiddenFiles(t *testing.T) {
	root := t.TempDir()
	writeCacheAssetFixture(t, root, "visible.png")
	writeCacheAssetFixture(t, root, "nested/child.jpg")
	writeCacheAssetFixture(t, root, ".hidden/secret.png")
	writeCacheAssetFixture(t, root, ".hidden-file.png")
	writeCacheAssetFixture(t, root, "ignored.sya")
	writeCacheAssetFixture(t, root, "~$office.png")
	outside := t.TempDir()
	writeCacheAssetFixture(t, outside, "outside.png")
	linked := filepath.Join(root, "linked.png")
	symlinkfixture.Create(t, filepath.Join(outside, "outside.png"), linked)

	assets, err := loadAssetsFromRoot(context.Background(), root)
	if err != nil {
		t.Fatal(err)
	}
	if len(assets) != 2 {
		t.Fatalf("unexpected asset cache: %+v", assets)
	}
	if assets["assets/visible.png"] == nil || assets["assets/nested/child.jpg"] == nil {
		t.Fatalf("visible assets were not indexed: %+v", assets)
	}
	if assets["assets/linked.png"] != nil {
		t.Fatalf("linked asset was indexed: %+v", assets["assets/linked.png"])
	}
	for key, asset := range assets {
		if filepath.IsAbs(key) || asset.Updated == 0 {
			t.Fatalf("cache exposed physical path or lost metadata: key=%q asset=%+v", key, asset)
		}
	}
}

func writeCacheAssetFixture(t *testing.T, root, relative string) {
	t.Helper()
	filePath := filepath.Join(root, filepath.FromSlash(relative))
	if err := os.MkdirAll(filepath.Dir(filePath), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filePath, []byte(relative), 0600); err != nil {
		t.Fatal(err)
	}
}
