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

package vectordb

import (
	"fmt"
	"math/rand"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/siyuan-note/siyuan/kernel/vectordb/vamana"
)

// ============================================================================
// HNSW vs DiskVamana 小中规模性能对比测试
// ============================================================================

// scaleBenchConfig holds parameters for a single scale point.
type scaleBenchConfig struct {
	total    int // total vectors to insert
	dim      int // vector dimension
	queryCnt int // number of queries for latency measurement
	topK     int // search top-K
	efSearch int // search ef
	seedSize int // DiskVamana seed index size (BuildFromVectors)
}

// scaleResult holds metrics for a single scale run on one engine.
type scaleResult struct {
	engine      string
	total       int
	buildDur    time.Duration
	buildRate   float64 // items/s
	queryAvgUs  float64 // average query latency in microseconds
	queryP99Us  float64 // P99 query latency
	queryQPS    float64 // queries per second
	recallRate  float64 // fraction of top-K
	insertAvgUs float64 // incremental insert latency (after build)
	heapAllocMB float64 // heap allocation after build
}

// TestHNSWvsVamanaSmallScale compares HNSW (Collection) and DiskVamana
// (VamanaCollection) across scales from 1K to 100K vectors.
//
// Uses 768-dimensional vectors to match production Ollama embeddings.
// Each scale point reports: build throughput, query latency (avg/P99/QPS),
// incremental insert cost, recall rate, and heap memory.
//
// Run with: go test -run TestHNSWvsVamanaSmallScale -v -timeout 30m
func TestHNSWvsVamanaSmallScale(t *testing.T) {
	if testing.Short() {
		t.Skip("multi-scale performance comparison")
	}
	scales := []int{1000, 5000, 10000, 25000, 50000, 100000}
	dim := 768
	queryCnt := 200
	topK := 10
	efSearch := 100

	// DiskVamana seed size — build a base index with this many vectors,
	// then measure incremental insert on the rest to match real usage.
	seedSize := func(total int) int {
		if total <= 2000 {
			return total
		}
		return total / 2
	}

	// ── Generate fixed-seed dataset (shared by all scales and both engines) ──
	maxTotal := scales[len(scales)-1]
	allVectors := make([][]float32, maxTotal)
	allPoints := make([]Point, maxTotal)
	rng := rand.New(rand.NewSource(42))
	for i := 0; i < maxTotal; i++ {
		v := make([]float32, dim)
		for j := 0; j < dim; j++ {
			v[j] = rng.Float32()*2 - 1
		}
		NormalizeVector(v)
		allVectors[i] = v
		allPoints[i] = Point{
			ID:     fmt.Sprintf("v-%d", i),
			Vector: v,
		}
	}

	// ── Generate queries (same across all scales for fair comparison) ──
	queries := make([][]float32, queryCnt)
	for q := 0; q < queryCnt; q++ {
		query := make([]float32, dim)
		for j := 0; j < dim; j++ {
			query[j] = rng.Float32()*2 - 1
		}
		NormalizeVector(query)
		queries[q] = query
	}

	// ── Compute brute-force ground truth for recall ──
	// Precompute topK for all queries against all vectors (expensive but needed).
	trueTopK := make([][]string, queryCnt)
	if testing.Verbose() {
		t.Log("precomputing ground truth...")
	}
	for q := 0; q < queryCnt; q++ {
		type scored struct {
			id       string
			distance float32
		}
		scores := make([]scored, maxTotal)
		for i := 0; i < maxTotal; i++ {
			scores[i] = scored{
				id:       allPoints[i].ID,
				distance: CosineDistance(queries[q], allVectors[i]),
			}
		}
		// partial insertion sort for topK
		for i := 1; i < len(scores); i++ {
			for j := i; j > 0 && scores[j].distance < scores[j-1].distance; j-- {
				scores[j], scores[j-1] = scores[j-1], scores[j]
			}
		}
		top := make([]string, topK)
		for i := 0; i < topK; i++ {
			top[i] = scores[i].id
		}
		trueTopK[q] = top
	}

	// ── Results table ──
	var hResults, vResults []scaleResult

	for _, total := range scales {
		prefix := fmt.Sprintf("[%6d]", total)

		// ═══ HNSW ═══
		{
			t.Logf("%s HNSW: building...", prefix)
			var memBefore, memAfter runtime.MemStats
			runtime.GC()
			runtime.ReadMemStats(&memBefore)

			col := NewCollection(fmt.Sprintf("hnsw-%d", total), dim)
			t0 := time.Now()
			for i := 0; i < total; i++ {
				col.InsertPoint(allPoints[i])
			}
			buildDur := time.Since(t0)

			runtime.GC()
			runtime.ReadMemStats(&memAfter)

			recall, avgUs, p99Us, qps := measureSearch(t, col, queries, trueTopK, topK, efSearch, queryCnt)
			insertAvgUs := measureIncrementalInsert(t, col, allPoints, total, dim)

			r := scaleResult{
				engine: "HNSW", total: total,
				buildDur: buildDur, buildRate: float64(total) / buildDur.Seconds(),
				queryAvgUs: avgUs, queryP99Us: p99Us, queryQPS: qps, recallRate: recall,
				insertAvgUs: insertAvgUs,
				heapAllocMB: float64(memAfter.HeapAlloc-memBefore.HeapAlloc) / (1024 * 1024),
			}
			hResults = append(hResults, r)
			t.Logf("%s HNSW: build=%v (%.0f/s), query=%.0fus(p99=%.0fus, QPS=%.0f), recall=%.1f%%, insert=%.0fus, heap=%.1fMB",
				prefix, buildDur.Round(time.Millisecond), r.buildRate,
				avgUs, p99Us, qps, recall*100, insertAvgUs, r.heapAllocMB)
		}

		// ═══ DiskVamana ═══
		{
			dir := t.TempDir()
			basePath := filepath.Join(dir, fmt.Sprintf("vamana-%d", total))
			ss := seedSize(total)

			cfg := vamana.DefaultDiskBuildConfig()
			cfg.R = 32
			cfg.L = 200

			var memBefore, memAfter runtime.MemStats
			runtime.GC()
			runtime.ReadMemStats(&memBefore)

			t0 := time.Now()

			seedPoints := allPoints[:ss]
			vc, err := BuildVamanaCollection(
				fmt.Sprintf("vamana-%d", total), seedPoints, basePath, cfg, CollectionMeta{},
			)
			if err != nil {
				t.Fatalf("%s DiskVamana BuildFromVectors(seed=%d): %v", prefix, ss, err)
			}

			// Incremental insert remaining vectors (simulates real incremental usage)
			for i := ss; i < total; i++ {
				if err := vc.InsertPoint(allPoints[i]); err != nil {
					t.Fatalf("%s DiskVamana Insert(%d): %v", prefix, i, err)
				}
			}
			buildDur := time.Since(t0)

			runtime.GC()
			runtime.ReadMemStats(&memAfter)

			recall, avgUs, p99Us, qps := measureSearch(t, vc, queries, trueTopK, topK, efSearch, queryCnt)
			insertAvgUs := measureIncrementalInsert(t, vc, allPoints, total, dim)

			r := scaleResult{
				engine: "DiskVamana", total: total,
				buildDur: buildDur, buildRate: float64(total) / buildDur.Seconds(),
				queryAvgUs: avgUs, queryP99Us: p99Us, queryQPS: qps, recallRate: recall,
				insertAvgUs: insertAvgUs,
				heapAllocMB: float64(memAfter.HeapAlloc-memBefore.HeapAlloc) / (1024 * 1024),
			}
			vResults = append(vResults, r)
			t.Logf("%s DiskVamana: build=%v (%.0f/s), query=%.0fus(p99=%.0fus, QPS=%.0f), recall=%.1f%%, insert=%.0fus, heap=%.1fMB",
				prefix, buildDur.Round(time.Millisecond), r.buildRate,
				avgUs, p99Us, qps, recall*100, insertAvgUs, r.heapAllocMB)

			vc.Close()
		}
	}

	// ── Print comparison table ──
	t.Log("")
	t.Log("┌────────┬──────────────┬──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐")
	t.Log("│  Total │  Build (/s)  │ Query (avg)  │ Query (P99)  │    Recall    │ Insert (avg) │ Heap (MB)    │")
	t.Log("│        │ HNSW / Vam   │ HNSW / Vam   │ HNSW / Vam   │ HNSW / Vam   │ HNSW / Vam   │ HNSW / Vam   │")
	t.Log("├────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤")
	for i := range hResults {
		h := hResults[i]
		v := vResults[i]
		t.Logf("│ %6d │ %6.0f %6.0f │ %5.0f %6.0f │ %5.0f %6.0f │ %4.1f%% %4.1f%% │ %5.0f %6.0f │ %4.0f %6.0f │",
			h.total,
			h.buildRate, v.buildRate,
			h.queryAvgUs, v.queryAvgUs,
			h.queryP99Us, v.queryP99Us,
			h.recallRate*100, v.recallRate*100,
			h.insertAvgUs, v.insertAvgUs,
			h.heapAllocMB, v.heapAllocMB,
		)
	}
	t.Log("└────────┴──────────────┴──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘")
}

// measureSearch runs queryCnt queries and returns recall rate, average latency,
// P99 latency, and queries per second.
func measureSearch(
	t *testing.T, col VectorCollection,
	queries [][]float32, trueTopK [][]string,
	topK, efSearch, queryCnt int,
) (recall float64, avgUs float64, p99Us float64, qps float64) {
	t.Helper()

	var totalHits int
	var totalUs float64
	var maxUs float64
	latencies := make([]float64, 0, queryCnt)

	for q := 0; q < queryCnt; q++ {
		t0 := time.Now()
		results := col.Search(queries[q], topK, efSearch)
		elapsed := time.Since(t0).Microseconds()

		latencies = append(latencies, float64(elapsed))
		totalUs += float64(elapsed)
		if float64(elapsed) > maxUs {
			maxUs = float64(elapsed)
		}

		trueSet := make(map[string]bool, topK)
		for _, id := range trueTopK[q] {
			trueSet[id] = true
		}
		for _, r := range results {
			if trueSet[r.ID] {
				totalHits++
			}
		}
	}

	recall = float64(totalHits) / float64(queryCnt*topK)
	avgUs = totalUs / float64(queryCnt)

	// Compute P99 from sorted latencies
	for i := 1; i < len(latencies); i++ {
		for j := i; j > 0 && latencies[j] < latencies[j-1]; j-- {
			latencies[j], latencies[j-1] = latencies[j-1], latencies[j]
		}
	}
	p99Idx := int(float64(len(latencies)) * 0.99)
	if p99Idx >= len(latencies) {
		p99Idx = len(latencies) - 1
	}
	p99Us = latencies[p99Idx]

	qps = 1e6 / avgUs // queries per second from average microsecond latency
	return
}

// measureIncrementalInsert inserts one extra vector (after build is complete)
// and returns the average latency in microseconds.
func measureIncrementalInsert(
	t *testing.T, col VectorCollection,
	allPoints []Point, total, dim int,
) float64 {
	t.Helper()

	// Insert 20 extra vectors and measure average.
	const extraCnt = 20
	rng := rand.New(rand.NewSource(12345))
	var totalUs int64

	for i := 0; i < extraCnt; i++ {
		v := make([]float32, dim)
		for j := 0; j < dim; j++ {
			v[j] = rng.Float32()*2 - 1
		}
		NormalizeVector(v)
		p := Point{
			ID:     fmt.Sprintf("extra-%d-%d", total, i),
			Vector: v,
		}
		t0 := time.Now()
		if err := col.InsertPoint(p); err != nil {
			t.Fatalf("incremental insert failed: %v", err)
		}
		totalUs += time.Since(t0).Microseconds()
	}

	return float64(totalUs) / float64(extraCnt)
}
