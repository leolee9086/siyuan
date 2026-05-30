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
	"testing"
	"time"

	"github.com/siyuan-note/siyuan/kernel/vectordb/vamana"
)

// TestDiskVamanaEfSearchSweep sweeps efSearch and BBQOverSearchFactor to find
// the optimal balance between recall and query latency.
//
// Phase 1 (BBQ coarse search) returns L = efSearch * bbqOverSearchFactor
// candidates. Phase 2 (rerank) reads L actual vectors from disk. So the
// disk I/O cost is directly proportional to L.
//
// This test sweeps efSearch ∈ {10, 20, 40, 80, 160, 320} and
// bbqOverSearchFactor ∈ {1, 2, 3, 5(default), 8} to find the sweet spot.
func TestDiskVamanaEfSearchSweep(t *testing.T) {
	total := 50000
	dim := 768
	queryCnt := 50
	topK := 10

	// ── Generate dataset ──
	allVectors := make([][]float32, total)
	allPoints := make([]Point, total)
	rng := rand.New(rand.NewSource(42))
	for i := 0; i < total; i++ {
		v := make([]float32, dim)
		for j := 0; j < dim; j++ {
			v[j] = rng.Float32()*2 - 1
		}
		NormalizeVector(v)
		allVectors[i] = v
		allPoints[i] = Point{ID: fmt.Sprintf("v-%d", i), Vector: v}
	}

	// ── Generate queries ──
	queries := make([][]float32, queryCnt)
	for q := 0; q < queryCnt; q++ {
		query := make([]float32, dim)
		for j := 0; j < dim; j++ {
			query[j] = rng.Float32()*2 - 1
		}
		NormalizeVector(query)
		queries[q] = query
	}

	// ── Brute-force ground truth ──
	type scored struct {
		id       string
		distance float32
	}
	trueTopK := make([][]string, queryCnt)
	for q := 0; q < queryCnt; q++ {
		scores := make([]scored, total)
		for i := 0; i < total; i++ {
			scores[i] = scored{allPoints[i].ID, CosineDistance(queries[q], allVectors[i])}
		}
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

	// ── Build DiskVamana index once ──
	dir := t.TempDir()
	basePath := filepath.Join(dir, "efsweep")
	cfg := vamana.DefaultDiskBuildConfig()
	cfg.R = 32
	cfg.L = 200

	_, err := vamana.BuildFromVectors(basePath, allVectors, cfg)
	if err != nil {
		t.Fatalf("BuildFromVectors: %v", err)
	}

	idx, err := vamana.Open(basePath)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer idx.Close()

	// ── Sweep efSearch × bbqOverSearchFactor ──
	efSearches := []int{10, 20, 40, 80, 160, 320}
	bbqFactors := []int{1, 2, 3, 5, 8}

	t.Logf("Data: %d vectors × %d dim, %d queries, topK=%d", total, dim, queryCnt, topK)
	t.Logf("%-12s %-6s %-12s %-12s %-12s %-12s",
		"efSearch", "BBQx", "Recall@10", "Avg Lat", "P99 Lat", "Disk Reads")

	for _, ef := range efSearches {
		for _, bx := range bbqFactors {
			// Skip redundant: BBQ× has meaning at default efSearch values
			idx.SetBBQOverSearchFactor(float64(bx))

			var totalHits int
			var totalMs float64
			var maxMs float64
			latencies := make([]float64, 0, queryCnt)

			for q := 0; q < queryCnt; q++ {
				t0 := time.Now()
				results, _ := idx.Search(queries[q], topK, ef)
				elapsed := time.Since(t0).Seconds() * 1000 // ms

				latencies = append(latencies, elapsed)
				totalMs += elapsed
				if elapsed > maxMs {
					maxMs = elapsed
				}

				trueSet := make(map[string]bool, topK)
				for _, id := range trueTopK[q] {
					trueSet[id] = true
				}
				// Vamana returns uint64 IDs, map to string for ground truth
				// (IDs are sequential 0..total-1)
				for _, r := range results {
					if uint64(r.ID) < uint64(total) {
						if trueSet[fmt.Sprintf("v-%d", r.ID)] {
							totalHits++
						}
					}
				}
			}

			recall := float64(totalHits) / float64(queryCnt*topK) * 100
			avgMs := totalMs / float64(queryCnt)

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
			p99 := latencies[p99Idx]

			// Estimated disk reads: efSearch × bbqOverSearchFactor
			// Phase 1 returns this many candidates, Phase 2 reads each from disk
			diskReads := ef * bx

			t.Logf("%-12d %-6d %-12.1f %-12.3f %-12.3f %-12d",
				ef, bx, recall, avgMs, p99, diskReads)
		}
	}

	// Reset to default
	idx.SetBBQOverSearchFactor(5.0)
}
