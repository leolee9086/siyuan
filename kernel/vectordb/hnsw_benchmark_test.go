package vectordb

import (
	"fmt"
	"math/rand"
	"testing"
)

// =========================================
// 基准测试 (Benchmark)
// =========================================

// BenchmarkHNSWInsert tests insertion performance with 128-dimensional vectors
func BenchmarkHNSWInsert(b *testing.B) {
	collection := NewCollection("bench", 128)

	points := make([]Point, b.N)
	for i := 0; i < b.N; i++ {
		vec := make([]float32, 128)
		for j := 0; j < 128; j++ {
			vec[j] = rand.Float32()
		}
		points[i] = Point{
			ID:     fmt.Sprintf("item-%d", i),
			Vector: vec,
		}
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		collection.InsertPoint(points[i])
	}
}

// BenchmarkHNSWSearch tests search performance with 128-dimensional vectors
func BenchmarkHNSWSearch(b *testing.B) {
	collection := NewCollection("bench", 128)

	for i := 0; i < 1000; i++ {
		vec := make([]float32, 128)
		for j := 0; j < 128; j++ {
			vec[j] = rand.Float32()
		}
		collection.InsertPoint(Point{
			ID:     fmt.Sprintf("item-%d", i),
			Vector: vec,
		})
	}

	queryVec := make([]float32, 128)
	for j := 0; j < 128; j++ {
		queryVec[j] = rand.Float32()
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		collection.Search(queryVec, 10, 100)
	}
}

// BenchmarkHNSWInsert1024 tests insertion performance with 1024-dimensional vectors
func BenchmarkHNSWInsert1024(b *testing.B) {
	collection := NewCollection("bench-1024", 1024)

	points := make([]Point, b.N)
	for i := 0; i < b.N; i++ {
		vec := make([]float32, 1024)
		for j := 0; j < 1024; j++ {
			vec[j] = rand.Float32()
		}
		points[i] = Point{
			ID:     fmt.Sprintf("item-%d", i),
			Vector: vec,
		}
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		collection.InsertPoint(points[i])
	}
}

// BenchmarkHNSWSearch1024 tests search performance with 1024-dimensional vectors
func BenchmarkHNSWSearch1024(b *testing.B) {
	collection := NewCollection("bench-1024-search", 1024)

	numItems := 1000
	for i := 0; i < numItems; i++ {
		vec := make([]float32, 1024)
		for j := 0; j < 1024; j++ {
			vec[j] = rand.Float32()
		}
		collection.InsertPoint(Point{
			ID:     fmt.Sprintf("item-%d", i),
			Vector: vec,
		})
	}

	queryVec := make([]float32, 1024)
	for j := 0; j < 1024; j++ {
		queryVec[j] = rand.Float32()
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		collection.Search(queryVec, 10, 100)
	}
}
