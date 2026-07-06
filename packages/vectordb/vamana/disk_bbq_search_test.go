// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org
//
// 本程序为自由软件；依据 AGPL-3.0 或更高版本授权。
//
// 非规模门控的磁盘 BBQ 搜索距离路径回归测试。
// 覆盖 Search → greedySearchBBQ → greedySearchBBQWithMeta 的两条量化路径：
//   - 查询 1-bit（对称：1-bit 查询 × 1-bit 索引）→ bbqCorrectedDistance
//   - 查询 4-bit（非对称：4-bit 查询 × 1-bit 索引）→ bbqCorrectedDistance4Bit
// 非对称量化是 SOTA 高精度路径（参考 toread/rust-bbq：index_bits=1, query_bits=4），
// 确保后续去重重构对两条路径均不发生回归。

package vamana

import (
	"path/filepath"
	"sort"
	"testing"

	"s-forge.local/vectordb/storage"
)

// TestDiskBBQSearch_CorrectedDistancePath 验证磁盘 BBQ v2 校正距离搜索两条量化路径的功能正确性。
// 该路径在基线 go test 中此前无任何非 scale 测试覆盖，是 S3 去重重构的回归网。
func TestDiskBBQSearch_CorrectedDistancePath(t *testing.T) {
	const numVectors = 10000
	const dim = 128 // >= BBQEnableThreshold，确保 BBQ 自动启用

	originalFactory := OpenDiskIndexReader
	t.Cleanup(func() { OpenDiskIndexReader = originalFactory })
	OpenDiskIndexReader = func(path string, readOnly bool) (storage.DiskIndexReader, error) {
		return storage.OpenReader(path, readOnly)
	}

	tmpDir := t.TempDir()
	basePath := filepath.Join(tmpDir, "test_disk_bbq_search")

	vectors := generateRandomVectors(numVectors, dim)

	config := DefaultDiskBuildConfig()
	config.R = 32
	config.L = 64
	config.Alpha = 1.2
	config.EnableBBQ = true

	if _, err := BuildFromVectors(basePath, vectors, config); err != nil {
		t.Fatalf("BuildFromVectors failed: %v", err)
	}

	idx, err := Open(basePath)
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	t.Cleanup(func() { idx.Close() })

	// 确认走的是 v2 校正距离路径而非 v1 Hamming 回退
	if !idx.HasBBQ() {
		t.Fatalf("BBQ should be enabled for dim=%d", dim)
	}
	if !idx.bbqHasMeta {
		t.Fatalf("bbqHasMeta must be true to exercise bbqCorrectedDistance path")
	}

	// 两条查询量化路径均需覆盖：1-bit 对称与 4-bit 非对称
	// 参考 toread/rust-bbq/quantized_index.rs：index_bits=1, query_bits∈{1,4}
	for _, queryBits := range []int{1, 4} {
		t.Run(queryBitsName(queryBits), func(t *testing.T) {
			idx.SetBBQQueryBits(queryBits)
			if got := idx.BBQQueryBits(); got != queryBits {
				t.Fatalf("SetBBQQueryBits(%d) failed: got %d", queryBits, got)
			}

			// 1) 精确匹配查询：用已索引向量作为查询，top-1 必须是该向量自身
			for _, qid := range []int{0, 1, numVectors / 2, numVectors - 1} {
				results, err := idx.Search(vectors[qid], 10, 64)
				if err != nil {
					t.Fatalf("Search(exact qid=%d) failed: %v", qid, err)
				}
				if len(results) == 0 {
					t.Fatalf("Search(exact qid=%d) returned no results", qid)
				}
				if results[0].ID != uint64(qid) {
					t.Errorf("exact-match query qid=%d: expected top-1 ID=%d, got %d (dist=%v)",
						qid, qid, results[0].ID, results[0].Distance)
				}
			}

			// 2) 随机查询：与暴力 L2 近邻对比，Recall@10 不得低于阈值
			// 4-bit 非对称量化精度高于 1-bit，阈值相应更高。
			const k = 10
			const numQueries = 20
			threshold := 0.80
			if queryBits == 4 {
				threshold = 0.85
			}
			queries := generateRandomVectors(numQueries, dim)

			totalRecall := 0.0
			for qi := 0; qi < numQueries; qi++ {
				results, err := idx.Search(queries[qi], k, 64)
				if err != nil {
					t.Fatalf("Search(random qi=%d) failed: %v", qi, err)
				}
				gt := bruteForceTopK(vectors, queries[qi], k)
				got := make(map[uint64]struct{}, len(results))
				for _, r := range results {
					got[r.ID] = struct{}{}
				}
				hits := 0
				for _, id := range gt {
					if _, ok := got[uint64(id)]; ok {
						hits++
					}
				}
				totalRecall += float64(hits) / float64(len(gt))
			}
			avgRecall := totalRecall / float64(numQueries)
			if avgRecall < threshold {
				t.Errorf("queryBits=%d disk BBQ search Recall@10 = %.4f, below threshold %.2f",
					queryBits, avgRecall, threshold)
			}
			t.Logf("queryBits=%d: Recall@10=%.4f (threshold=%.2f, vectors=%d, dim=%d)",
				queryBits, avgRecall, threshold, numVectors, dim)
		})
	}
}

// queryBitsName 返回查询位宽的子测试名。
func queryBitsName(bits int) string {
	if bits == 4 {
		return "QueryBits4_Asymmetric"
	}
	return "QueryBits1_Symmetric"
}

// bruteForceTopK 返回 query 在 vectors 中 L2 距离平方最近的 k 个向量索引（升序）。
// 完整排序确保 ground truth 顺序确定无歧义。
func bruteForceTopK(vectors [][]float32, query []float32, k int) []int {
	n := len(vectors)
	if k > n {
		k = n
	}
	type pair struct {
		idx  int
		dist float32
	}
	pairs := make([]pair, n)
	for i, vec := range vectors {
		var sum float32
		for j := 0; j < len(query); j++ {
			d := vec[j] - query[j]
			sum += d * d
		}
		pairs[i] = pair{idx: i, dist: sum}
	}
	sort.Slice(pairs, func(i, j int) bool {
		return pairs[i].dist < pairs[j].dist
	})
	result := make([]int, k)
	for i := 0; i < k; i++ {
		result[i] = pairs[i].idx
	}
	return result
}
