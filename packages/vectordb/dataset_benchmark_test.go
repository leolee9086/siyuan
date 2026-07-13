package vectordb

import (
	"fmt"
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
	const (
		entityCount = 10000
		dimension   = 128
	)
	entities := make([]Entity, entityCount)
	for entityIndex := range entities {
		vector := make([]float32, dimension)
		for dimensionIndex := range vector {
			vector[dimensionIndex] = float32((entityIndex+1)*(dimensionIndex+3)%101) / 101
		}
		entities[entityIndex] = Entity{ID: fmt.Sprintf("entity-%05d", entityIndex), Embeddings: map[string][]float32{"vector": vector}}
	}
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
	const (
		entityCount = 10000
		dimension   = 128
	)
	entities := make([]Entity, entityCount)
	for entityIndex := range entities {
		vector := make([]float32, dimension)
		for dimensionIndex := range vector {
			vector[dimensionIndex] = float32((entityIndex+1)*(dimensionIndex+3)%101) / 101
		}
		entities[entityIndex] = Entity{ID: fmt.Sprintf("entity-%05d", entityIndex), Embeddings: map[string][]float32{"vector": vector}}
	}
	hnswConfig := DefaultConfig()
	hnswConfig.M = 8
	hnswConfig.EfConstruction = 64
	hnswConfig.MetricType = "l2"
	diskConfig := vamana.DefaultDiskBuildConfig()
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
