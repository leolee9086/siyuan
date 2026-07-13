package vectordb

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"testing"

	"s-forge.local/vectordb/vamana"
)

func BenchmarkDatasetFetchEntities(b *testing.B) {
	const entityCount = 2048
	entities := make([]Entity, entityCount)
	ids := make([]string, entityCount)
	for index := range entities {
		id := fmt.Sprintf("entity-%05d", index)
		ids[index] = id
		entities[index] = Entity{
			ID: id,
			Embeddings: map[string][]float32{
				"title": {float32(index), 1, 2, 3},
				"body":  {float32(index), 4, 5, 6},
			},
		}
	}
	db, err := Open(b.TempDir())
	if err != nil {
		b.Fatal(err)
	}
	b.Cleanup(func() { _ = db.Close() })
	dataset, err := db.CreateDataset("benchmark", DatasetOptions{
		Embeddings: map[string]EmbeddingSchema{
			"title": {Dimension: 4, DistanceMetric: "l2"},
			"body":  {Dimension: 4, DistanceMetric: "l2"},
		},
		Indexes: map[string]IndexViewOptions{
			"title-main": {Embedding: "title", Engine: EngineHNSW},
			"body-main":  {Embedding: "body", Engine: EngineHNSW},
		},
		Entities: entities,
	})
	if err != nil {
		b.Fatal(err)
	}

	b.ReportAllocs()
	b.ResetTimer()
	for iteration := 0; iteration < b.N; iteration++ {
		fetched, err := dataset.FetchEntities(ids)
		if err != nil || len(fetched) != entityCount {
			b.Fatalf("批量读取失败：count=%d，err=%v", len(fetched), err)
		}
	}
}

func BenchmarkDatasetAddHNSWIndex(b *testing.B) {
	for _, entityCount := range datasetIndexBenchmarkScales(b) {
		entityCount := entityCount
		b.Run(formatDatasetBenchmarkScale(entityCount), func(b *testing.B) {
			benchmarkDatasetAddHNSWIndex(b, entityCount)
		})
	}
}

func benchmarkDatasetAddHNSWIndex(b *testing.B, entityCount int) {
	const dimension = 128
	entities := datasetBenchmarkEntities(entityCount, dimension)
	config := DefaultConfig()
	config.M = 8
	config.EfConstruction = 64
	config.MetricType = "l2"
	for iteration := 0; iteration < b.N; iteration++ {
		b.StopTimer()
		db, err := Open(b.TempDir())
		if err != nil {
			b.Fatal(err)
		}
		dataset, err := db.CreateDataset("benchmark", DatasetOptions{
			Embeddings: map[string]EmbeddingSchema{"vector": {Dimension: dimension, DistanceMetric: "l2"}},
			Indexes:    map[string]IndexViewOptions{"base": {Embedding: "vector", Engine: EngineHNSW, HNSWConfig: &config}},
			Entities:   entities,
		})
		if err != nil {
			_ = db.Close()
			b.Fatal(err)
		}
		b.StartTimer()
		err = dataset.AddIndex("second", IndexViewOptions{Embedding: "vector", Engine: EngineHNSW, HNSWConfig: &config})
		b.StopTimer()
		if err != nil {
			_ = db.Close()
			b.Fatal(err)
		}
		if err := db.Close(); err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkDatasetAddDiskVamanaIndex(b *testing.B) {
	for _, entityCount := range datasetIndexBenchmarkScales(b) {
		entityCount := entityCount
		b.Run(formatDatasetBenchmarkScale(entityCount), func(b *testing.B) {
			benchmarkDatasetAddDiskVamanaIndex(b, entityCount)
		})
	}
}

func benchmarkDatasetAddDiskVamanaIndex(b *testing.B, entityCount int) {
	const dimension = 128
	entities := datasetBenchmarkEntities(entityCount, dimension)
	hnswConfig := DefaultConfig()
	hnswConfig.M = 8
	hnswConfig.EfConstruction = 64
	hnswConfig.MetricType = "l2"
	diskConfig := vamana.DefaultDiskBuildConfig()
	diskConfig.BuildSeed = 1
	for iteration := 0; iteration < b.N; iteration++ {
		b.StopTimer()
		db, err := Open(b.TempDir())
		if err != nil {
			b.Fatal(err)
		}
		dataset, err := db.CreateDataset("benchmark", DatasetOptions{
			Embeddings: map[string]EmbeddingSchema{"vector": {Dimension: dimension, DistanceMetric: "l2"}},
			Indexes:    map[string]IndexViewOptions{"base": {Embedding: "vector", Engine: EngineHNSW, HNSWConfig: &hnswConfig}},
			Entities:   entities,
		})
		if err != nil {
			_ = db.Close()
			b.Fatal(err)
		}
		b.StartTimer()
		err = dataset.AddIndex("disk", IndexViewOptions{Embedding: "vector", Engine: EngineDiskVamana, DiskBuildConfig: &diskConfig})
		b.StopTimer()
		if err != nil {
			_ = db.Close()
			b.Fatal(err)
		}
		if err := db.Close(); err != nil {
			b.Fatal(err)
		}
	}
}

func datasetBenchmarkEntities(entityCount, dimension int) []Entity {
	entities := make([]Entity, entityCount)
	for entityIndex := range entities {
		vector := make([]float32, dimension)
		for dimensionIndex := range vector {
			vector[dimensionIndex] = float32((entityIndex+1)*(dimensionIndex+3)%101) / 101
		}
		entities[entityIndex] = Entity{ID: fmt.Sprintf("entity-%07d", entityIndex), Embeddings: map[string][]float32{"vector": vector}}
	}
	return entities
}

func datasetIndexBenchmarkScales(b *testing.B) []int {
	b.Helper()
	if raw := os.Getenv("VECTORDB_DATASET_BENCH_SCALES"); raw != "" {
		parts := strings.Split(raw, ",")
		scales := make([]int, 0, len(parts))
		for _, part := range parts {
			scale, err := strconv.Atoi(strings.TrimSpace(part))
			if err != nil || scale < 1 {
				b.Fatalf("VECTORDB_DATASET_BENCH_SCALES 包含非法规模 %q", part)
			}
			scales = append(scales, scale)
		}
		return scales
	}
	scales := []int{10_000, 30_000, 100_000}
	if os.Getenv("VECTORDB_SCALE_TEST") == "1" {
		scales = append(scales, 300_000, 1_000_000)
	}
	return scales
}

func formatDatasetBenchmarkScale(scale int) string {
	if scale%1_000_000 == 0 {
		return fmt.Sprintf("%dM", scale/1_000_000)
	}
	if scale%1_000 == 0 {
		return fmt.Sprintf("%dK", scale/1_000)
	}
	return strconv.Itoa(scale)
}
