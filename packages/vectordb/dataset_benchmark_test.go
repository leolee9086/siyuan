package vectordb

import (
	"fmt"
	"testing"
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
