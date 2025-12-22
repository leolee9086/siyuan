package vectordb

import (
	"fmt"
	"math/rand"
	"testing"
)

// BenchmarkHNSWInsert1024 tests insertion performance with 1024-dimensional vectors
func BenchmarkHNSWInsert1024(b *testing.B) {
	collection := NewCollection("bench-1024", 1024)
	modelName := "bench-model-1024"
	collection.InitLevelMap(modelName)
	
	// Pre-generate data
	items := make([]*Item, b.N)
	for i := 0; i < b.N; i++ {
		item := NewItem(fmt.Sprintf("item-%d", i))
		vec := make([]float32, 1024)
		for j := 0; j < 1024; j++ {
			vec[j] = rand.Float32()
		}
		item.SetVector(modelName, vec)
		items[i] = item
	}
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		collection.InsertItem(items[i], modelName)
	}
}

// BenchmarkHNSWSearch1024 tests search performance with 1024-dimensional vectors
func BenchmarkHNSWSearch1024(b *testing.B) {
	collection := NewCollection("bench-1024-search", 1024)
	modelName := "bench-model-1024"
	collection.InitLevelMap(modelName)
	
	// Insert 1000 items
	numItems := 1000
	for i := 0; i < numItems; i++ {
		item := NewItem(fmt.Sprintf("item-%d", i))
		vec := make([]float32, 1024)
		for j := 0; j < 1024; j++ {
			vec[j] = rand.Float32()
		}
		item.SetVector(modelName, vec)
		collection.InsertItem(item, modelName)
	}
	
	// Generate query vector
	queryVec := make([]float32, 1024)
	for j := 0; j < 1024; j++ {
		queryVec[j] = rand.Float32()
	}
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		collection.Search(queryVec, modelName, 10, 100)
	}
}
