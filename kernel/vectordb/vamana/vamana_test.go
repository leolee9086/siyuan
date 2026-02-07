// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

package vamana

import (
	"math"
	"math/rand"
	"testing"
)

// generateRandomVectors 生成随机向量
func generateRandomVectors(n, dim int) [][]float32 {
	vectors := make([][]float32, n)
	for i := range vectors {
		vectors[i] = make([]float32, dim)
		for j := range vectors[i] {
			vectors[i][j] = rand.Float32()
		}
	}
	return vectors
}

// bruteForceKNN 暴力搜索K近邻 (用于验证)
func bruteForceKNN(vectors [][]float32, query []float32, k int) []Neighbor {
	neighbors := make([]Neighbor, len(vectors))
	for i, v := range vectors {
		var dist float32
		for j := range v {
			diff := v[j] - query[j]
			dist += diff * diff
		}
		neighbors[i] = Neighbor{ID: uint32(i), Distance: dist}
	}

	// 排序
	for i := 0; i < k && i < len(neighbors); i++ {
		minIdx := i
		for j := i + 1; j < len(neighbors); j++ {
			if neighbors[j].Distance < neighbors[minIdx].Distance {
				minIdx = j
			}
		}
		neighbors[i], neighbors[minIdx] = neighbors[minIdx], neighbors[i]
	}

	if k > len(neighbors) {
		k = len(neighbors)
	}
	return neighbors[:k]
}

// TestBasicInsertAndSearch 测试基本插入和搜索
func TestBasicInsertAndSearch(t *testing.T) {
	dim := 32
	config := DefaultConfig()
	idx := New(dim, config)

	// 插入一些向量
	vectors := generateRandomVectors(100, dim)
	for _, v := range vectors {
		_, err := idx.Insert(v)
		if err != nil {
			t.Fatalf("Insert failed: %v", err)
		}
	}

	if idx.NumPoints() != 100 {
		t.Errorf("Expected 100 points, got %d", idx.NumPoints())
	}

	// 搜索
	query := vectors[0]
	results, _ := idx.Search(query, 10, 50)

	if len(results) == 0 {
		t.Fatal("Search returned no results")
	}

	// 第一个结果应该是查询向量本身
	if results[0].ID != 0 {
		t.Logf("Warning: First result is not the query vector itself (ID=%d, dist=%f)", results[0].ID, results[0].Distance)
	}
}

// TestBatchBuild 测试批量构建
func TestBatchBuild(t *testing.T) {
	dim := 32
	n := 500
	config := DefaultConfig()
	idx := New(dim, config)

	vectors := generateRandomVectors(n, dim)
	err := idx.Build(vectors)
	if err != nil {
		t.Fatalf("Build failed: %v", err)
	}

	if idx.NumPoints() != uint64(n) {
		t.Errorf("Expected %d points, got %d", n, idx.NumPoints())
	}

	// 验证每个节点都有邻居
	for i := 0; i < n; i++ {
		neighbors := idx.GetNeighbors(uint32(i))
		if len(neighbors) == 0 {
			t.Errorf("Node %d has no neighbors", i)
		}
	}
}

// TestRecall 测试召回率
func TestRecall(t *testing.T) {
	dim := 32
	n := 1000
	k := 10
	numQueries := 50

	config := DefaultConfig()
	idx := New(dim, config)

	vectors := generateRandomVectors(n, dim)
	err := idx.Build(vectors)
	if err != nil {
		t.Fatalf("Build failed: %v", err)
	}

	// 生成查询向量
	queries := generateRandomVectors(numQueries, dim)

	var totalRecall float64
	for _, query := range queries {
		// Vamana搜索
		results, _ := idx.Search(query, k, 100)

		// 暴力搜索
		groundTruth := bruteForceKNN(vectors, query, k)

		// 计算召回率
		gtSet := make(map[uint64]bool)
		for _, n := range groundTruth {
			gtSet[uint64(n.ID)] = true
		}

		hits := 0
		for _, r := range results {
			if gtSet[r.ID] {
				hits++
			}
		}

		recall := float64(hits) / float64(k)
		totalRecall += recall
	}

	avgRecall := totalRecall / float64(numQueries)
	t.Logf("Average recall@%d: %.2f%%", k, avgRecall*100)

	// 召回率应该至少达到70%
	if avgRecall < 0.7 {
		t.Errorf("Recall too low: %.2f%%, expected at least 70%%", avgRecall*100)
	}
}

// TestEpochSet 测试EpochSet
func TestEpochSet(t *testing.T) {
	es := NewEpochSet(100)

	// 测试插入
	if !es.Insert(5) {
		t.Error("First insert should return true")
	}
	if es.Insert(5) {
		t.Error("Second insert of same ID should return false")
	}

	// 测试Contains
	if !es.Contains(5) {
		t.Error("Should contain 5")
	}
	if es.Contains(10) {
		t.Error("Should not contain 10")
	}

	// 测试Reset
	es.Reset()
	if es.Contains(5) {
		t.Error("After reset, should not contain 5")
	}

	// 测试扩容
	if !es.Insert(200) {
		t.Error("Insert beyond initial capacity should work")
	}
	if !es.Contains(200) {
		t.Error("Should contain 200 after expansion")
	}
}

// TestNeighborPriorityQueue 测试优先队列
func TestNeighborPriorityQueue(t *testing.T) {
	pq := NewNeighborPriorityQueue(5)

	// 插入一些邻居
	pq.Insert(Neighbor{ID: 1, Distance: 0.5})
	pq.Insert(Neighbor{ID: 2, Distance: 0.3})
	pq.Insert(Neighbor{ID: 3, Distance: 0.7})
	pq.Insert(Neighbor{ID: 4, Distance: 0.1})
	pq.Insert(Neighbor{ID: 5, Distance: 0.9})

	if pq.Len() != 5 {
		t.Errorf("Expected length 5, got %d", pq.Len())
	}

	// 插入一个更差的，应该被丢弃
	pq.Insert(Neighbor{ID: 6, Distance: 1.0})
	if pq.Len() != 5 {
		t.Errorf("Expected length 5 after overflow, got %d", pq.Len())
	}

	// 插入一个更好的，应该替换最差的
	pq.Insert(Neighbor{ID: 7, Distance: 0.2})
	if pq.Len() != 5 {
		t.Errorf("Expected length 5, got %d", pq.Len())
	}

	// 获取Top-3
	top3 := pq.TopK(3)
	if len(top3) != 3 {
		t.Errorf("Expected 3 results, got %d", len(top3))
	}

	// 验证顺序
	if top3[0].ID != 4 || top3[1].ID != 7 || top3[2].ID != 2 {
		t.Errorf("Unexpected order: %v", top3)
	}
}

// TestAdjacencyList 测试邻接表
func TestAdjacencyList(t *testing.T) {
	al := NewAdjacencyList()

	// 测试Push
	if !al.Push(1) {
		t.Error("First push should succeed")
	}
	if !al.Push(2) {
		t.Error("Second push should succeed")
	}
	if al.Push(1) {
		t.Error("Duplicate push should fail")
	}

	if al.Len() != 2 {
		t.Errorf("Expected length 2, got %d", al.Len())
	}

	// 测试Contains
	if !al.Contains(1) {
		t.Error("Should contain 1")
	}
	if al.Contains(3) {
		t.Error("Should not contain 3")
	}

	// 测试ToSlice
	slice := al.ToSlice()
	if len(slice) != 2 {
		t.Errorf("Expected slice length 2, got %d", len(slice))
	}

	// 测试Clear
	al.Clear()
	if al.Len() != 0 {
		t.Errorf("Expected length 0 after clear, got %d", al.Len())
	}
}

// TestEmptyIndex 测试空索引
func TestEmptyIndex(t *testing.T) {
	dim := 32
	config := DefaultConfig()
	idx := New(dim, config)

	if idx.NumPoints() != 0 {
		t.Errorf("Expected 0 points, got %d", idx.NumPoints())
	}

	query := make([]float32, dim)
	results, _ := idx.Search(query, 10, 50)
	if len(results) != 0 {
		t.Errorf("Expected 0 results from empty index, got %d", len(results))
	}
}

// TestSinglePoint 测试单点索引
func TestSinglePoint(t *testing.T) {
	dim := 32
	config := DefaultConfig()
	idx := New(dim, config)

	vector := make([]float32, dim)
	for i := range vector {
		vector[i] = float32(i)
	}

	_, err := idx.Insert(vector)
	if err != nil {
		t.Fatalf("Insert failed: %v", err)
	}

	results, _ := idx.Search(vector, 1, 10)
	if len(results) != 1 {
		t.Errorf("Expected 1 result, got %d", len(results))
	}
	if results[0].ID != 0 {
		t.Errorf("Expected ID 0, got %d", results[0].ID)
	}
	if results[0].Distance > 1e-6 {
		t.Errorf("Expected distance ~0, got %f", results[0].Distance)
	}
}

// TestDistanceCalculation 测试距离计算
func TestDistanceCalculation(t *testing.T) {
	a := []float32{1, 2, 3}
	b := []float32{4, 5, 6}

	// 欧氏距离平方 = (4-1)^2 + (5-2)^2 + (6-3)^2 = 9 + 9 + 9 = 27
	expected := float32(27)
	result := euclideanDistance(a, b)

	if math.Abs(float64(result-expected)) > 1e-6 {
		t.Errorf("Expected distance %f, got %f", expected, result)
	}
}
