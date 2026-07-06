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
	"fmt"
	"path/filepath"
	"runtime"
	"sort"
	"testing"
	"time"

	"s-forge.local/vectordb/storage"
)

// TestDiskVamanaVsDiskANN aligns parameters with IP-DiskANN's SSD_index.md:
//   - SIFT 100K, 128-dim
//   - Build: R=32, L=50, Alpha=1.2
//   - Cache: 10000 nodes
//   - TopK=10, search_list sweep, L2 distance

func TestDiskVamanaVsDiskANN(t *testing.T) {
	requireScaleTest(t)

	dataPath := getSIFTDataPath()
	if dataPath == "" {
		t.Skip("SIFT dataset not found")
	}

	numVectors := 100000
	queryCnt := 100
	topK := 10
	cacheNodes := 10000
	searchLists := []int{10, 20, 30, 40, 50, 100, 200, 500}

	// Load SIFT
	t.Logf("Loading SIFT 100K...")
	baseVectors, dim, err := loadFvecsPartial(filepath.Join(dataPath, "sift_base.fvecs"), numVectors)
	if err != nil {
		t.Fatalf("load base: %v", err)
	}
	queryVectors, _, err := loadFvecs(filepath.Join(dataPath, "sift_query.fvecs"))
	if err != nil {
		t.Fatalf("load query: %v", err)
	}
	if len(queryVectors) < queryCnt {
		queryCnt = len(queryVectors)
	}
	queryVectors = queryVectors[:queryCnt]

	// Ground truth: L2 brute-force top-10 for our queries
	t.Logf("Computing ground truth (L2)...")
	trueTop10 := make([][]int, queryCnt)
	for q := 0; q < queryCnt; q++ {
		type scored struct {
			id   int
			dist float32
		}
		scores := make([]scored, numVectors)
		for i := 0; i < numVectors; i++ {
			var sum float32
			va, vb := baseVectors[i], queryVectors[q]
			for j := 0; j < dim; j++ {
				d := va[j] - vb[j]
				sum += d * d
			}
			scores[i] = scored{i, sum}
		}
		sort.Slice(scores, func(i, j int) bool { return scores[i].dist < scores[j].dist })
		top := make([]int, topK)
		for i := 0; i < topK; i++ {
			top[i] = scores[i].id
		}
		trueTop10[q] = top
	}

	// Build index (R=32, L=50, matching IP-DiskANN)
	dir := t.TempDir()
	basePath := filepath.Join(dir, "vs_diskann")

	cfg := DefaultDiskBuildConfig()
	cfg.R = 32
	cfg.L = 50

	t.Logf("Building index (R=32, L=50)...")
	buildT0 := time.Now()
	_, err = BuildFromVectors(basePath, baseVectors, cfg)
	if err != nil {
		t.Fatalf("BuildFromVectors: %v", err)
	}
	buildDur := time.Since(buildT0)
	t.Logf("Build: %v (%.0f vec/s)", buildDur.Round(time.Millisecond), float64(numVectors)/buildDur.Seconds())

	// Open
	originalFactory := OpenDiskIndexReader
	t.Cleanup(func() { OpenDiskIndexReader = originalFactory })
	OpenDiskIndexReader = func(path string, readOnly bool) (storage.DiskIndexReader, error) {
		return storage.OpenReader(path, readOnly)
	}

	idx, err := Open(basePath)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer idx.Close()

	// Warm up OS page cache
	for q := 0; q < 20; q++ {
		_, _ = idx.Search(queryVectors[q], topK, 100)
	}

	// Setup cache
	idx.SetCacheSize(200)
	cached := idx.WarmupCache(cacheNodes)
	t.Logf("Cache: %d nodes loaded", cached)

	// 4-bit query quantization (not default 1-bit)
	idx.SetBBQQueryBits(4)

	// Search sweep
	t.Logf("CPU: %d threads, Data: SIFT %d x %d-dim, 10K cache", runtime.NumCPU(), numVectors, dim)
	t.Logf("%-6s %-12s %-12s %-12s %-12s",
		"L", "Recall@10", "Mean Latency", "P99 Latency", "QPS")
	t.Logf("--------------------------------------------------")

	for _, L := range searchLists {
		var totalRecall int
		var totalLatency time.Duration
		latencies := make([]float64, queryCnt)

		for q := 0; q < queryCnt; q++ {
			t0 := time.Now()
			results, _ := idx.Search(queryVectors[q], topK, L)
			elapsed := time.Since(t0)
			totalLatency += elapsed
			latencies[q] = elapsed.Seconds() * 1000

			gt := make(map[int]bool, topK)
			for _, id := range trueTop10[q] {
				gt[id] = true
			}
			for _, r := range results {
				if gt[int(r.ID)] {
					totalRecall++
				}
			}
		}

		recall := float64(totalRecall) / float64(queryCnt*topK) * 100
		avgUs := float64(totalLatency.Microseconds()) / float64(queryCnt)
		qps := float64(queryCnt) / totalLatency.Seconds()

		// P99
		for i := 1; i < len(latencies); i++ {
			for j := i; j > 0 && latencies[j] < latencies[j-1]; j-- {
				latencies[j], latencies[j-1] = latencies[j-1], latencies[j]
			}
		}
		p99Idx := len(latencies) - 1
		if want := int(float64(len(latencies)) * 0.99); want < p99Idx {
			p99Idx = want
		}
		p99Ms := latencies[p99Idx]

		t.Logf("%-6d %-12.2f %-12s %-12s %-12.0f",
			L, recall,
			fmt.Sprintf("%.0f us", avgUs),
			fmt.Sprintf("%.1f ms", p99Ms),
			qps,
		)
	}
}
