package vamana

import (
	"fmt"
	"path/filepath"
	"testing"
)

func BenchmarkDiskBuildBBQReuse(b *testing.B) {
	const (
		vectorCount = 10000
		dimension   = 128
	)
	vectors := make([][]float32, vectorCount)
	for vectorIndex := range vectors {
		vector := make([]float32, dimension)
		for dimensionIndex := range vector {
			vector[dimensionIndex] = float32((vectorIndex+1)*(dimensionIndex+3)%101) / 101
		}
		vectors[vectorIndex] = vector
	}
	config := DefaultDiskBuildConfig()
	config.BuildSeed = 1
	b.ReportAllocs()
	b.ResetTimer()
	for iteration := 0; iteration < b.N; iteration++ {
		path := filepath.Join(b.TempDir(), fmt.Sprintf("index-%d", iteration))
		if _, err := BuildFromVectors(path, vectors, config); err != nil {
			b.Fatal(err)
		}
	}
}
