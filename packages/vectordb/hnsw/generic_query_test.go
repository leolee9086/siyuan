// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

package hnsw

import "testing"

type stringDistancer struct {
	values []string
}

func (distancer *stringDistancer) ComputeDistance(a, b DocID, _ string) float32 {
	return float32(levenshtein(distancer.values[a], distancer.values[b]))
}

type stringQuery struct {
	values     []string
	query      string
	batchCalls int
}

func (query *stringQuery) DistanceTo(id DocID) float32 {
	return float32(levenshtein(query.query, query.values[id]))
}

func (query *stringQuery) DistancesTo(ids []DocID, dst []float32) []float32 {
	query.batchCalls++
	if cap(dst) < len(ids) {
		dst = make([]float32, len(ids))
	} else {
		dst = dst[:len(ids)]
	}
	for i, id := range ids {
		dst[i] = query.DistanceTo(id)
	}
	return dst
}

var _ NodeDistancer = (*stringDistancer)(nil)
var _ BatchQueryDistancer = (*stringQuery)(nil)

func TestHNSWNonVectorLevenshtein(t *testing.T) {
	values := []string{
		"vector", "vectors", "victor", "sector", "database", "databases", "disk", "index",
		"search", "research", "production", "productions", "productive", "reduction", "connection",
		"collection", "correction", "quantization", "asymmetric", "persistent", "consistency", "recovery",
	}
	config := DefaultConfig()
	config.M = 8
	config.EfConstruction = len(values)
	config.EfSearch = len(values)
	config.MetricType = "levenshtein"
	index := NewHNSWIndex(0, config, &stringDistancer{values: values})
	for id := range values {
		if !index.Insert(DocID(id)) {
			t.Fatalf("插入字符串节点 %d 失败", id)
		}
	}

	query := &stringQuery{values: values, query: "production"}
	results := index.SearchBy(query, 3, len(values))
	if len(results) != 3 {
		t.Fatalf("结果数量为 %d，期望 3", len(results))
	}
	if results[0].ID != 10 || results[0].Distance != 0 {
		t.Fatalf("最近邻为 %+v，期望 production", results[0])
	}
	if query.batchCalls == 0 {
		t.Fatal("非向量搜索未使用批量距离接口")
	}

	index.Delete(10)
	results = index.SearchBy(query, 3, len(values))
	if len(results) == 0 || results[0].ID == 10 {
		t.Fatalf("删除后仍返回已删除节点：%+v", results)
	}
	if results[0].ID != 11 {
		t.Fatalf("删除后最近邻为 %+v，期望 productions", results[0])
	}
}

func TestHNSWSearchByAcceptsScoreOrdering(t *testing.T) {
	values := []string{"graph database", "full text search", "vector search", "bm25 ranking"}
	index := NewHNSWIndex(0, DefaultConfig(), &stringDistancer{values: values})
	for id := range values {
		index.Insert(DocID(id))
	}

	query := queryDistanceFunc(func(id DocID) float32 {
		// BM25 等相似度必须转换成越小越优的顺序；取负值即可保留排序。
		scores := []float32{0.2, 1.4, 3.8, 2.1}
		return -scores[id]
	})
	results := index.SearchBy(query, 1, len(values))
	if len(results) != 1 || results[0].ID != 2 {
		t.Fatalf("相关性分数搜索结果错误：%+v", results)
	}
}

type queryDistanceFunc func(id DocID) float32

func (distance queryDistanceFunc) DistanceTo(id DocID) float32 {
	return distance(id)
}

func levenshtein(left, right string) int {
	previous := make([]int, len(right)+1)
	current := make([]int, len(right)+1)
	for i := range previous {
		previous[i] = i
	}
	for i := 1; i <= len(left); i++ {
		current[0] = i
		for j := 1; j <= len(right); j++ {
			cost := 0
			if left[i-1] != right[j-1] {
				cost = 1
			}
			current[j] = min(previous[j]+1, current[j-1]+1)
			current[j] = min(current[j], previous[j-1]+cost)
		}
		previous, current = current, previous
	}
	return previous[len(right)]
}
