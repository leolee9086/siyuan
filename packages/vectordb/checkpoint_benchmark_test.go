package vectordb

import (
	"context"
	"fmt"
	"path/filepath"
	"testing"

	"s-forge.local/vectordb/vamana"
)

func BenchmarkDiskVamanaCheckpoint(b *testing.B) {
	for _, benchmark := range []struct {
		name string
		run  func(*VamanaCollection, string) error
	}{
		{
			name: "native-generation",
			run: func(collection *VamanaCollection, _ string) error {
				_, err := collection.Checkpoint(context.Background())
				return err
			},
		},
		{
			name: "full-rebuild",
			run: func(collection *VamanaCollection, output string) error {
				return collection.FlushToDisk(output)
			},
		},
	} {
		b.Run(benchmark.name, func(b *testing.B) {
			for iteration := 0; iteration < b.N; iteration++ {
				b.StopTimer()
				collection, closeCollection := newCheckpointBenchmarkCollection(b)
				output := filepath.Join(b.TempDir(), "rebuild")
				b.StartTimer()
				if err := benchmark.run(collection, output); err != nil {
					b.Fatal(err)
				}
				b.StopTimer()
				closeCollection()
			}
		})
	}
}

func newCheckpointBenchmarkCollection(b *testing.B) (*VamanaCollection, func()) {
	b.Helper()
	const (
		count     = 512
		dimension = 32
	)
	points := make([]Point, count)
	for id := range points {
		points[id] = Point{ID: fmt.Sprintf("point-%d", id), Vector: checkpointBenchmarkVector(id, dimension)}
	}
	config := vamana.DefaultDiskBuildConfig()
	config.R = 16
	config.L = 50
	config.MaxBackedges = 16
	basePath := filepath.Join(b.TempDir(), "vamana")
	collection, err := BuildVamanaCollection("benchmark", points, basePath, config, CollectionMeta{})
	if err != nil {
		b.Fatal(err)
	}
	collection.RootPath = basePath
	collection.BasePath = basePath
	collection.Config = config
	for id := 0; id < 64; id++ {
		point := Point{ID: fmt.Sprintf("point-%d", id), Vector: checkpointBenchmarkVector(id+count, dimension)}
		if err := collection.InsertPoint(point); err != nil {
			_ = collection.Close()
			b.Fatal(err)
		}
	}
	if err := SaveVamanaCollectionState(collection, basePath); err != nil {
		_ = collection.Close()
		b.Fatal(err)
	}
	return collection, func() { _ = collection.Close() }
}

func checkpointBenchmarkVector(seed, dimension int) []float32 {
	vector := make([]float32, dimension)
	for index := range vector {
		vector[index] = float32((seed*31+index*17)%997) / 997
	}
	return vector
}
