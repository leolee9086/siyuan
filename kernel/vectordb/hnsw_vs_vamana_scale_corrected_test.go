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

// TestHNSWvsVamanaScaleCorrected directly compares raw engine latency
// (skip VamanaCollection wrapper overhead, skip ground truth).
//
// Uses BuildFromVectors for ALL vectors (no incremental insert),
// same as the SIFT end-to-end test pattern.
func TestHNSWvsVamanaScaleCorrected(t *testing.T) {
	if testing.Short() {
		t.Skip("multi-scale performance comparison")
	}
	scales := []int{5000, 10000, 25000, 50000, 100000, 200000, 500000}
	dim := 768 // production Ollama dimension
	queryCnt := 100
	topK := 10
	efSearch := 100

	maxTotal := scales[len(scales)-1]
	allVectors := make([][]float32, maxTotal)
	rng := rand.New(rand.NewSource(42))
	for i := 0; i < maxTotal; i++ {
		v := make([]float32, dim)
		for j := 0; j < dim; j++ {
			v[j] = rng.Float32()*2 - 1
		}
		NormalizeVector(v)
		allVectors[i] = v
	}

	queries := make([][]float32, queryCnt)
	for q := 0; q < queryCnt; q++ {
		query := make([]float32, dim)
		for j := 0; j < dim; j++ {
			query[j] = rng.Float32()*2 - 1
		}
		NormalizeVector(query)
		queries[q] = query
	}

	t.Logf("%-10s %-12s %-12s %-12s %-12s %-12s %-12s",
		"Total", "HNSW Build", "HNSW Q(us)", "Vam Build", "Vam Q(us)", "Vam/ HNSW", "HNSW Mem")
	for _, total := range scales {
		if total > 200000 {
			t.Logf("[%6d] building (may take minutes)...", total)
		}

		// ── HNSW ──
		var memBefore, memAfter runtime.MemStats
		runtime.GC()
		runtime.ReadMemStats(&memBefore)

		hnsw := NewCollection(fmt.Sprintf("h-%d", total), dim)
		hnswT0 := time.Now()
		for i := 0; i < total; i++ {
			hnsw.InsertPoint(Point{
				ID:     fmt.Sprintf("v-%d", i),
				Vector: allVectors[i],
			})
		}
		hnswBuild := time.Since(hnswT0)

		runtime.GC()
		runtime.ReadMemStats(&memAfter)
		hnswMem := float64(memAfter.HeapAlloc-memBefore.HeapAlloc) / (1024 * 1024)

		var hnswQueryTotal time.Duration
		for q := 0; q < queryCnt; q++ {
			t0 := time.Now()
			hnsw.Search(queries[q], topK, efSearch)
			hnswQueryTotal += time.Since(t0)
		}
		hnswQueryUs := float64(hnswQueryTotal.Microseconds()) / float64(queryCnt)

		// ── DiskVamana (BuildFromVectors only, no incremental) ──
		dir := t.TempDir()
		basePath := filepath.Join(dir, fmt.Sprintf("v-%d", total))
		cfg := vamana.DefaultDiskBuildConfig()
		cfg.R = 32
		cfg.L = 200

		vamT0 := time.Now()
		vecs := allVectors[:total]
		_, err := vamana.BuildFromVectors(basePath, vecs, cfg)
		if err != nil {
			t.Fatalf("[%6d] BuildFromVectors: %v", total, err)
		}
		vamBuild := time.Since(vamT0)

		idx, err := vamana.Open(basePath)
		if err != nil {
			t.Fatalf("[%6d] Open: %v", total, err)
		}

		var vamQueryTotal time.Duration
		for q := 0; q < queryCnt; q++ {
			t0 := time.Now()
			_, _ = idx.Search(queries[q], topK, efSearch)
			vamQueryTotal += time.Since(t0)
		}
		vamQueryUs := float64(vamQueryTotal.Microseconds()) / float64(queryCnt)

		idx.Close()

		ratio := "-"
		if hnswQueryUs > 0 {
			ratio = fmt.Sprintf("%.1fx", vamQueryUs/hnswQueryUs)
		}

		t.Logf("[%6d] %-12s %-12.0f %-12s %-12.0f %-12s %-8.0fMB",
			total,
			hnswBuild.Round(time.Millisecond).String(), hnswQueryUs,
			vamBuild.Round(time.Millisecond).String(), vamQueryUs,
			ratio, hnswMem,
		)
	}
}
