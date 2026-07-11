package vectordb

import (
	"context"
	"fmt"
	"testing"

	"s-forge.local/vectordb/vamana"
)

func BenchmarkDiskVamanaIncrementalWrite128(b *testing.B) {
	for _, durability := range []DurabilityMode{DurabilityMemory, DurabilitySync} {
		b.Run(string(durability), func(b *testing.B) {
			const dimension = 128
			points := make([]Point, 128)
			for id := range points {
				points[id] = Point{ID: fmt.Sprintf("seed-%d", id), Vector: benchmarkVector128(id)}
			}
			config := vamana.DefaultDiskBuildConfig()
			config.R = 16
			config.L = 50
			config.MaxBackedges = 16
			db, err := Open(b.TempDir())
			if err != nil {
				b.Fatal(err)
			}
			collection, err := db.CreateCollectionWithOptions("bench", CollectionOptions{
				Engine:          EngineDiskVamana,
				Points:          points,
				DistanceMetric:  "l2",
				DiskBuildConfig: &config,
			})
			if err != nil {
				b.Fatal(err)
			}
			b.Cleanup(func() { _ = db.Close() })

			b.ReportAllocs()
			b.ResetTimer()
			for id := 0; id < b.N; id++ {
				point := Point{ID: fmt.Sprintf("insert-%d", id), Vector: benchmarkVector128(id + len(points))}
				if _, err := collection.Write(context.Background(), WriteBatch{Operations: []WriteOperation{{Point: &point}}}, WriteOptions{Durability: durability}); err != nil {
					b.Fatal(err)
				}
			}
		})
	}
}

func benchmarkVector128(seed int) []float32 {
	vector := make([]float32, 128)
	for dimension := range vector {
		vector[dimension] = float32((seed*31+dimension*17)%997) / 997
	}
	return vector
}
