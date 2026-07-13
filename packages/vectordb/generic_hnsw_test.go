package vectordb

import (
	"encoding/json"
	"sync"
	"testing"

	"s-forge.local/vectordb/hnsw"
)

type genericStringDistancer struct {
	mu     sync.RWMutex
	values map[hnsw.DocID]string
}

func (d *genericStringDistancer) set(id hnsw.DocID, value string) {
	d.mu.Lock()
	d.values[id] = value
	d.mu.Unlock()
}

func (d *genericStringDistancer) ComputeDistance(a, b hnsw.DocID, _ string) float32 {
	d.mu.RLock()
	left, right := d.values[a], d.values[b]
	d.mu.RUnlock()
	return float32(editDistance(left, right))
}

type genericStringQuery struct {
	distancer *genericStringDistancer
	query     string
}

func (q genericStringQuery) DistanceTo(id hnsw.DocID) float32 {
	q.distancer.mu.RLock()
	value := q.distancer.values[id]
	q.distancer.mu.RUnlock()
	return float32(editDistance(q.query, value))
}

func editDistance(left, right string) int {
	previous := make([]int, len(right)+1)
	current := make([]int, len(right)+1)
	for index := range previous {
		previous[index] = index
	}
	for leftIndex, leftRune := range []rune(left) {
		current[0] = leftIndex + 1
		for rightIndex, rightRune := range []rune(right) {
			cost := 0
			if leftRune != rightRune {
				cost = 1
			}
			current[rightIndex+1] = minInt(current[rightIndex]+1, previous[rightIndex+1]+1, previous[rightIndex]+cost)
		}
		previous, current = current, previous
	}
	return previous[len(right)]
}

func minInt(values ...int) int {
	minimum := values[0]
	for _, value := range values[1:] {
		if value < minimum {
			minimum = value
		}
	}
	return minimum
}

func TestGenericHNSWCollectionSupportsNonVectorDistance(t *testing.T) {
	distancer := &genericStringDistancer{values: make(map[hnsw.DocID]string)}
	collection, err := NewGenericHNSWCollection("text", hnsw.Config{M: 4, EfConstruction: 32, EfSearch: 32}, distancer)
	if err != nil {
		t.Fatal(err)
	}
	points := []struct {
		id, value string
	}{
		{"go", "go"},
		{"rust", "rust"},
		{"database", "database"},
		{"vector-db", "vector database"},
		{"search", "semantic search"},
	}
	for index, point := range points {
		distancer.set(hnsw.DocID(index), point.value)
		if err := collection.Upsert(point.id, json.RawMessage(`{"kind":"text"}`)); err != nil {
			t.Fatal(err)
		}
	}
	results := collection.Search(genericStringQuery{distancer: distancer, query: "semantic search"}, 3, 32)
	if len(results) != 3 || results[0].ID != "search" {
		t.Fatalf("泛型 HNSW 未按编辑距离召回：%+v", results)
	}
	if len(results[0].Meta) == 0 || results[0].Score != -results[0].Distance {
		t.Fatalf("泛型结果未保留距离/meta 契约：%+v", results[0])
	}
	if err := collection.Delete("search"); err != nil {
		t.Fatal(err)
	}
	for _, id := range collection.ListIDs() {
		if id == "search" {
			t.Fatal("删除后的泛型 ID 仍被列出")
		}
	}
}
