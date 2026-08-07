package filebrowser

import (
	"os"
	"path/filepath"
	"testing"
)

var directoryBenchmarkEntries int

func makeDirectoryBenchmarkFixture(b *testing.B) string {
	b.Helper()
	directory := b.TempDir()
	for index := 0; index < 3000; index++ {
		name := filepath.Join(directory, "file-"+benchmarkIndex(index)+".txt")
		if err := os.WriteFile(name, []byte("snapshot"), 0600); err != nil {
			b.Fatal(err)
		}
	}
	for index := 0; index < 200; index++ {
		if err := os.Mkdir(filepath.Join(directory, "dir-"+benchmarkIndex(index)), 0755); err != nil {
			b.Fatal(err)
		}
	}
	return directory
}

func benchmarkIndex(index int) string {
	const digits = "0123456789"
	buffer := [6]byte{'0', '0', '0', '0', '0', '0'}
	for position := len(buffer) - 1; position >= 0; position-- {
		buffer[position] = digits[index%10]
		index /= 10
	}
	return string(buffer[:])
}

func BenchmarkDirectorySnapshotNative(b *testing.B) {
	directory := makeDirectoryBenchmarkFixture(b)
	b.ResetTimer()
	for range b.N {
		entries, err := readDirectorySnapshot(directory)
		if err != nil {
			b.Fatal(err)
		}
		directoryBenchmarkEntries = len(entries)
	}
}

func BenchmarkDirectorySnapshotLegacyLstat(b *testing.B) {
	directory := makeDirectoryBenchmarkFixture(b)
	b.ResetTimer()
	for range b.N {
		items, err := os.ReadDir(directory)
		if err != nil {
			b.Fatal(err)
		}
		count := 0
		for _, item := range items {
			if _, err = os.Lstat(filepath.Join(directory, item.Name())); err == nil {
				count++
			}
		}
		directoryBenchmarkEntries = count
	}
}
