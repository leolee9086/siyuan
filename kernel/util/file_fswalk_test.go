package util

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestSizeOfDirectoryUsesBoundWalkerMetadata(t *testing.T) {
	root := t.TempDir()
	writeUtilSizeFixture(t, root, "a/one.txt", "123")
	writeUtilSizeFixture(t, root, "a/two.bin", "1234")
	size, err := SizeOfDirectory(root)
	if err != nil {
		t.Fatal(err)
	}
	if size != 4096+4096+3+4 {
		t.Fatalf("unexpected directory size: %d", size)
	}
}

func TestDataSizeAtUsesBoundWalkerMetadata(t *testing.T) {
	root := t.TempDir()
	writeUtilSizeFixture(t, root, "assets/image.png", "12345")
	writeUtilSizeFixture(t, root, "notes/readme.md", "123")
	dataSize, assetsSize, err := dataSizeAt(context.Background(), root)
	if err != nil {
		t.Fatal(err)
	}
	if dataSize != 4096+4096+4096+5+3 || assetsSize != 5 {
		t.Fatalf("unexpected data sizes: data=%d assets=%d", dataSize, assetsSize)
	}
}

func writeUtilSizeFixture(t *testing.T, root, relative, content string) {
	t.Helper()
	filePath := filepath.Join(root, filepath.FromSlash(relative))
	if err := os.MkdirAll(filepath.Dir(filePath), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filePath, []byte(content), 0600); err != nil {
		t.Fatal(err)
	}
}
