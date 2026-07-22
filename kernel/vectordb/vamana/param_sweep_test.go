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
	"math/rand"
	"sort"
	"testing"
	"time"
)

// TestParamSweep 扫描 MaxBackedges × GraphSlackFactor 参数组合，
// 测量 Insert 吞吐量、Recall@10 和平均出度。
func TestParamSweep(t *testing.T) {
	if testing.Short() {
		t.Skip("Vamana parameter sweep")
	}
	const (
		numVectors = 20000
		dim        = 128
		numQueries = 100
		k          = 10
		efSearch   = 200
		baseR      = 32
		baseL      = 200
		baseAlpha  = 1.2
	)

	// 固定种子保证可复现
	rng := rand.New(rand.NewSource(42))

	// 生成数据集（所有组合共享）
	vectors := make([][]float32, numVectors)
	for i := range vectors {
		vectors[i] = make([]float32, dim)
		for j := range vectors[i] {
			vectors[i][j] = rng.Float32()
		}
	}

	// 生成查询向量
	queries := make([][]float32, numQueries)
	for i := range queries {
		queries[i] = make([]float32, dim)
		for j := range queries[i] {
			queries[i][j] = rng.Float32()
		}
	}

	// 暴力搜索 ground truth
	groundTruth := make([][]uint32, numQueries)
	for qi, q := range queries {
		type idDist struct {
			id   uint32
			dist float32
		}
		dists := make([]idDist, numVectors)
		for i, v := range vectors {
			var d float32
			for j := range v {
				diff := v[j] - q[j]
				d += diff * diff
			}
			dists[i] = idDist{id: uint32(i), dist: d}
		}
		sort.Slice(dists, func(a, b int) bool {
			return dists[a].dist < dists[b].dist
		})
		topK := make([]uint32, k)
		for i := 0; i < k; i++ {
			topK[i] = dists[i].id
		}
		groundTruth[qi] = topK
	}

	maxBackedges := []int{8, 16, 32}
	graphSlackFactors := []float32{1.3, 1.5, 2.0}

	t.Logf("%-14s %-18s %-18s %-12s %-12s",
		"MaxBackedges", "GraphSlackFactor", "Throughput(items/s)", "Recall@10(%)", "AvgOutDeg")
	t.Logf("%-14s %-18s %-18s %-12s %-12s",
		"-----------", "----------------", "------------------", "-----------", "---------")

	for _, mb := range maxBackedges {
		for _, gsf := range graphSlackFactors {
			cfg := DefaultConfig()
			cfg.R = baseR
			cfg.L = baseL
			cfg.Alpha = baseAlpha
			cfg.MaxBackedges = mb
			cfg.GraphSlackFactor = gsf

			idx := New(dim, cfg)

			// 插入并计时
			start := time.Now()
			for _, v := range vectors {
				if _, err := idx.Insert(v); err != nil {
					t.Fatalf("Insert failed (MB=%d, GSF=%.1f): %v", mb, gsf, err)
				}
			}
			elapsed := time.Since(start)
			throughput := float64(numVectors) / elapsed.Seconds()

			// 计算 Recall@10
			var totalRecall float64
			for qi, q := range queries {
				results, err := idx.Search(q, k, efSearch)
				if err != nil {
					t.Fatalf("Search failed: %v", err)
				}
				gtSet := make(map[uint32]struct{}, k)
				for _, id := range groundTruth[qi] {
					gtSet[id] = struct{}{}
				}
				hits := 0
				for _, r := range results {
					if _, ok := gtSet[uint32(r.ID)]; ok {
						hits++
					}
				}
				totalRecall += float64(hits) / float64(k)
			}
			recall := totalRecall / float64(numQueries) * 100.0

			// 计算平均出度
			var totalDeg uint64
			n := len(idx.neighbors)
			for i := 0; i < n; i++ {
				totalDeg += uint64(len(idx.neighbors[i]))
			}
			avgDeg := float64(totalDeg) / float64(n)

			t.Logf("%-14d %-18.1f %-18.0f %-12.2f %-12.2f",
				mb, gsf, throughput, recall, avgDeg)
		}
	}
}
