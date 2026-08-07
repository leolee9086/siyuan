//go:build windows

package filebrowser

import (
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
)

var recursiveBenchmarkEntries int

const recursiveBenchmarkExpectedEntries = 96 + 96*2 + 96*2*32

func makeRecursiveWalkBenchmarkFixture(b *testing.B) string {
	b.Helper()
	root := b.TempDir()
	for directoryIndex := 0; directoryIndex < 96; directoryIndex++ {
		parent := filepath.Join(root, "dir-"+benchmarkIndex(directoryIndex))
		for branchIndex := 0; branchIndex < 2; branchIndex++ {
			directory := filepath.Join(parent, "branch-"+benchmarkIndex(branchIndex))
			if err := os.MkdirAll(directory, 0755); err != nil {
				b.Fatal(err)
			}
			for fileIndex := 0; fileIndex < 32; fileIndex++ {
				path := filepath.Join(directory, "file-"+benchmarkIndex(fileIndex)+".txt")
				if err := os.WriteFile(path, []byte("recursive snapshot"), 0600); err != nil {
					b.Fatal(err)
				}
			}
		}
	}
	return root
}

func legacyRecursiveWalk(root string) ([]Entry, error) {
	entries := make([]Entry, 0, 6400)
	err := filepath.Walk(root, func(path string, info os.FileInfo, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if path == root {
			return nil
		}
		relative, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		entry := Entry{Name: info.Name(), Path: filepath.ToSlash(relative), IsDir: info.IsDir(),
			Size: info.Size(), Updated: info.ModTime().Unix(), Hidden: strings.HasPrefix(info.Name(), ".")}
		if !entry.IsDir {
			entry.Extension = strings.ToLower(filepath.Ext(info.Name()))
		}
		entries = append(entries, entry)
		return nil
	})
	sort.SliceStable(entries, func(left, right int) bool { return entries[left].Path < entries[right].Path })
	return entries, err
}

func BenchmarkRecursiveWalk(b *testing.B) {
	root := makeRecursiveWalkBenchmarkFixture(b)
	service := newWalkTestService(root)
	b.Run("NativeParallel", func(b *testing.B) {
		b.ReportAllocs()
		for range b.N {
			result, err := service.Walk(WalkRequest{RootID: "workspace", MaxDepth: 8, MaxEntries: 20_000})
			if err != nil || result.Truncated || len(result.Errors) != 0 ||
				len(result.Entries) != recursiveBenchmarkExpectedEntries {
				b.Fatalf("native walk failed: result=%+v err=%v", result, err)
			}
			recursiveBenchmarkEntries = len(result.Entries)
		}
	})
	b.Run("LegacyFilepathWalk", func(b *testing.B) {
		b.ReportAllocs()
		for range b.N {
			entries, err := legacyRecursiveWalk(root)
			if err != nil || len(entries) != recursiveBenchmarkExpectedEntries {
				b.Fatalf("legacy walk failed: entries=%d err=%v", len(entries), err)
			}
			recursiveBenchmarkEntries = len(entries)
		}
	})
}
