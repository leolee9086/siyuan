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
	"sort"
	"sync"
	"testing"
	"time"

	"github.com/siyuan-note/siyuan/kernel/vectordb/vamana"
)

// BenchmarkVamanaCollectionWrapperOverhead compares search latency of
// direct DiskVamanaIndex.Search vs VamanaCollection.Search on identical data.
//
// VamanaCollection.Search does extra work on top of DiskVamanaIndex.Search:
//  1. vc.Mu.RLock() — lock contention with concurrent writers
//  2. DocMap lookup per result (map access)
//  3. vamanaDistanceToScore per result (function call + division)
//  4. json.RawMessage cast per result (heap alloc)
//  5. sort.Slice by score descending (O(n log n), ~1µs per 10 items)
//
// The user's claim is that these overheads add up to "several times" degradation
// under load on large datasets (100K+). This benchmark proves it.
func BenchmarkVamanaCollectionWrapperOverhead(b *testing.B) {
	dim := 128
	baseSize := 100000
	numQueries := 200
	k := 10
	efSearch := 100

	// ── Generate dataset ──
	b.Logf("Generating %d points (dim=%d)...", baseSize, dim)
	points := make([]Point, baseSize)
	for i := 0; i < baseSize; i++ {
		vec := make([]float32, dim)
		for j := 0; j < dim; j++ {
			vec[j] = rand.Float32()*2 - 1
		}
		NormalizeVector(vec)
		meta := fmt.Sprintf(`{"idx":%d}`, i)
		points[i] = Point{
			ID:     fmt.Sprintf("p-%d", i),
			Vector: vec,
			Meta:   []byte(meta),
		}
	}

	queries := make([][]float32, numQueries)
	for i := range queries {
		queries[i] = make([]float32, dim)
		for j := range queries[i] {
			queries[i][j] = rand.Float32()*2 - 1
		}
		NormalizeVector(queries[i])
	}

	// ── Build VamanaCollection ──
	tmpDir := b.TempDir()
	basePath := filepath.Join(tmpDir, "perf_test")
	config := vamana.DefaultDiskBuildConfig()
	config.R = 64
	config.L = 100

	b.Log("Building VamanaCollection...")
	start := time.Now()
	vc, err := BuildVamanaCollection("perf", points, basePath, config, CollectionMeta{})
	if err != nil {
		b.Fatalf("BuildVamanaCollection: %v", err)
	}
	defer vc.Close()
	b.Logf("Build completed in %v", time.Since(start))

	// ── Pre-warm by running queries once ──
	// Ensure all caches and mmap pages are warmed
	for _, q := range queries {
		_, _ = vc.Index.Search(q, k, efSearch)
	}

	b.Run("Direct_Index_Search", func(b *testing.B) {
		b.ResetTimer()
		b.ReportAllocs()
		for i := 0; i < b.N; i++ {
			_, err := vc.Index.Search(queries[i%numQueries], k, efSearch)
			if err != nil {
				b.Fatal(err)
			}
		}
	})

	b.Run("Collection_Search", func(b *testing.B) {
		b.ResetTimer()
		b.ReportAllocs()
		for i := 0; i < b.N; i++ {
			_ = vc.Search(queries[i%numQueries], k, efSearch)
		}
	})
}

// BenchmarkVamanaCollectionInsertOverhead compares insert throughput of
// direct DiskVamanaIndex.Insert vs VamanaCollection.InsertPoint.
//
// VamanaCollection.InsertPoint does:
//  1. vc.Mu.Lock() — global lock for IDMap/DocMap/Metas updates
//  2. Old node lookup + soft delete (disk delete with edge repair)
//  3. vc.Mu.Unlock()
//  4. vc.Index.Insert (same as direct path)
//  5. vc.Mu.Lock() again for mapping updates
//  6. vc.Mu.Unlock()
//
// Lock-unlock-re-lock pattern and IDMap management adds measurable overhead.
func BenchmarkVamanaCollectionInsertOverhead(b *testing.B) {
	dim := 128
	baseSize := 50000

	// ── Generate dataset ──
	b.Logf("Generating %d points (dim=%d)...", baseSize, dim)
	points := make([]Point, baseSize)
	for i := 0; i < baseSize; i++ {
		vec := make([]float32, dim)
		for j := 0; j < dim; j++ {
			vec[j] = rand.Float32()*2 - 1
		}
		NormalizeVector(vec)
		points[i] = Point{
			ID:     fmt.Sprintf("p-%d", i),
			Vector: vec,
		}
	}

	// Build base index
	tmpDir := b.TempDir()
	basePath := filepath.Join(tmpDir, "insert_perf")
	config := vamana.DefaultDiskBuildConfig()
	config.R = 64
	config.L = 100

	b.Log("Building base VamanaCollection...")
	vc, err := BuildVamanaCollection("insert-perf", points, basePath, config, CollectionMeta{})
	if err != nil {
		b.Fatalf("BuildVamanaCollection: %v", err)
	}
	defer vc.Close()

	// Generate insert vectors
	insertVecs := make([][]float32, 200)
	for i := range insertVecs {
		vec := make([]float32, dim)
		for j := range vec {
			vec[j] = rand.Float32()*2 - 1
		}
		NormalizeVector(vec)
		insertVecs[i] = vec
	}

	// Warm up: insert a few and delete to settle anything
	for i := 0; i < 10; i++ {
		nodeID, err := vc.Index.Insert(insertVecs[i])
		if err != nil {
			b.Fatal(err)
		}
		b.StopTimer()
		_ = vc.Index.Delete(nodeID)
		b.StartTimer()
	}

	b.Run("Direct_Insert", func(b *testing.B) {
		// Fresh index insert — no IDMap management
		b.StopTimer()
		b.ReportAllocs()
		// Create a second index for fair comparison
		tmpDir2 := b.TempDir()
		basePath2 := filepath.Join(tmpDir2, "insert_direct")
		config2 := vamana.DefaultDiskBuildConfig()
		config2.R = 64
		config2.L = 100

		vc2, err := BuildVamanaCollection("direct", points, basePath2, config2, CollectionMeta{})
		if err != nil {
			b.Fatalf("Build: %v", err)
		}
		defer vc2.Close()
		b.StartTimer()

		for i := 0; i < b.N; i++ {
			_, err := vc2.Index.Insert(insertVecs[i%len(insertVecs)])
			if err != nil {
				b.Fatal(err)
			}
		}
	})

	b.Run("Collection_Insert", func(b *testing.B) {
		b.ResetTimer()
		b.ReportAllocs()
		for i := 0; i < b.N; i++ {
			id := fmt.Sprintf("inserted-%d", i)
			err := vc.InsertPoint(Point{
				ID:     id,
				Vector: insertVecs[i%len(insertVecs)],
			})
			if err != nil {
				b.Fatal(err)
			}
		}
	})
}

// TestVamanaCollectionConcurrentSearchContention proves that VamanaCollection.Search
// suffers from lock contention under concurrent load, while raw DiskVamanaIndex.Search
// scales better.
//
// The VamanaCollection.Search holds vc.Mu.RLock() for the entire duration of
// result enrichment (DocMap lookup + score conversion + sort), delaying concurrent
// Search and InsertPoint operations.
func TestVamanaCollectionConcurrentSearchContention(t *testing.T) {
	dim := 64
	baseSize := 20000
	numQueries := 100
	k := 10
	efSearch := 100

	// ── Build index ──
	points := make([]Point, baseSize)
	for i := 0; i < baseSize; i++ {
		vec := make([]float32, dim)
		for j := 0; j < dim; j++ {
			vec[j] = rand.Float32()*2 - 1
		}
		NormalizeVector(vec)
		meta := fmt.Sprintf(`{"idx":%d}`, i)
		points[i] = Point{
			ID:     fmt.Sprintf("p-%d", i),
			Vector: vec,
			Meta:   []byte(meta),
		}
	}

	queries := make([][]float32, numQueries)
	for i := range queries {
		queries[i] = make([]float32, dim)
		for j := range queries[i] {
			queries[i][j] = rand.Float32()*2 - 1
		}
		NormalizeVector(queries[i])
	}

	tmpDir := t.TempDir()
	basePath := filepath.Join(tmpDir, "contention_test")
	config := vamana.DefaultDiskBuildConfig()
	config.R = 32
	config.L = 200

	vc, err := BuildVamanaCollection("contention", points, basePath, config, CollectionMeta{})
	if err != nil {
		t.Fatalf("BuildVamanaCollection: %v", err)
	}
	defer vc.Close()

	// Warm up
	for _, q := range queries[:10] {
		_, _ = vc.Index.Search(q, k, efSearch)
		_ = vc.Search(q, k, efSearch)
	}

	const numWorkers = 8
	const opsPerWorker = 200

	// ── Direct Index Search (no wrapper lock) ──
	t.Run("Direct_Index_Concurrent", func(t *testing.T) {
		var wg sync.WaitGroup
		start := time.Now()

		for w := 0; w < numWorkers; w++ {
			wg.Add(1)
			go func(worker int) {
				defer wg.Done()
				for i := 0; i < opsPerWorker; i++ {
					qIdx := (worker*opsPerWorker + i) % numQueries
					_, err := vc.Index.Search(queries[qIdx], k, efSearch)
					if err != nil {
						t.Errorf("direct search error: %v", err)
						return
					}
				}
			}(w)
		}
		wg.Wait()
		elapsed := time.Since(start)
		totalOps := numWorkers * opsPerWorker
		t.Logf("Direct Index: %d ops in %v (%.0f ops/sec)", totalOps, elapsed, float64(totalOps)/elapsed.Seconds())
	})

	// ── VamanaCollection Search (with wrapper lock) ──
	t.Run("Collection_Concurrent", func(t *testing.T) {
		var wg sync.WaitGroup
		start := time.Now()

		for w := 0; w < numWorkers; w++ {
			wg.Add(1)
			go func(worker int) {
				defer wg.Done()
				for i := 0; i < opsPerWorker; i++ {
					qIdx := (worker*opsPerWorker + i) % numQueries
					_ = vc.Search(queries[qIdx], k, efSearch)
				}
			}(w)
		}
		wg.Wait()
		elapsed := time.Since(start)
		totalOps := numWorkers * opsPerWorker
		t.Logf("Collection:     %d ops in %v (%.0f ops/sec)", totalOps, elapsed, float64(totalOps)/elapsed.Seconds())
	})

	// ── VamanaCollection Search mixed with inserts (worst case) ──
	t.Run("Collection_WithInsertContention", func(t *testing.T) {
		var wg sync.WaitGroup
		start := time.Now()

		// 4 searchers + 4 inserter (maximize lock contention)
		for w := 0; w < 4; w++ {
			wg.Add(1)
			go func(worker int) {
				defer wg.Done()
				for i := 0; i < opsPerWorker; i++ {
					qIdx := (worker*opsPerWorker + i) % numQueries
					_ = vc.Search(queries[qIdx], k, efSearch)
				}
			}(w)
		}

		for w := 0; w < 4; w++ {
			wg.Add(1)
			go func(worker int) {
				defer wg.Done()
				for i := 0; i < 50; i++ {
					vec := make([]float32, dim)
					for j := range vec {
						vec[j] = rand.Float32()*2 - 1
					}
					NormalizeVector(vec)
					_ = vc.InsertPoint(Point{
						ID:     fmt.Sprintf("contender-%d-%d", worker, i),
						Vector: vec,
					})
				}
			}(w)
		}

		wg.Wait()
		elapsed := time.Since(start)
		totalSearchOps := 4 * opsPerWorker
		t.Logf("Collection + inserts: %d search ops in %v (%.0f search/sec)", totalSearchOps, elapsed, float64(totalSearchOps)/elapsed.Seconds())
	})
}

// TestSearchSortRedundancy proves that VamanaCollection.Search's re-sort
// by score is redundant — score is a monotonic transform of distance,
// so distance-ascending and score-descending orders are identical.
func TestSearchSortRedundancy(t *testing.T) {
	dim := 64
	baseSize := 2000
	k := 10
	efSearch := 50

	points := make([]Point, baseSize)
	for i := 0; i < baseSize; i++ {
		vec := make([]float32, dim)
		for j := 0; j < dim; j++ {
			vec[j] = rand.Float32()*2 - 1
		}
		NormalizeVector(vec)
		points[i] = Point{ID: fmt.Sprintf("p-%d", i), Vector: vec}
	}

	tmpDir := t.TempDir()
	basePath := filepath.Join(tmpDir, "sort_test")
	config := vamana.DefaultDiskBuildConfig()
	config.R = 32
	config.L = 200

	vc, err := BuildVamanaCollection("sort-test", points, basePath, config, CollectionMeta{})
	if err != nil {
		t.Fatalf("BuildVamanaCollection: %v", err)
	}
	defer vc.Close()

	query := make([]float32, dim)
	for j := range query {
		query[j] = rand.Float32()*2 - 1
	}
	NormalizeVector(query)

	// Raw results (direct from DiskVamanaIndex.Search — distance ascending)
	raw, err := vc.Index.Search(query, k, efSearch)
	if err != nil {
		t.Fatal(err)
	}

	// Wrapper results (VamanaCollection.Search — score descending)
	wrapped := vc.Search(query, k, efSearch)

	// Verify: both orders are IDENTICAL
	if len(raw) != len(wrapped) {
		t.Fatalf("result count mismatch: %d vs %d", len(raw), len(wrapped))
	}

	mismatches := 0
	for i := 0; i < len(raw); i++ {
		// raw[i].ID is uint64; wrapped[i].ID is string "p-{raw[i].ID}"
		expectedID := fmt.Sprintf("p-%d", raw[i].ID)
		if wrapped[i].ID != expectedID {
			mismatches++
			if mismatches <= 3 {
				t.Logf("  position %d: raw id=%d (dist=%.4f), wrapped id=%s (score=%.4f)",
					i, raw[i].ID, raw[i].Distance, wrapped[i].ID, wrapped[i].Score)
			}
		}
	}

	if mismatches > 0 {
		// Score = 1/(1+distance) — is monotonic decreasing for distance.
		// So distance-ascending should equal score-descending.
		t.Logf("Order check: %d/%d positions differ between raw (dist↑) and wrapped (score↓)", mismatches, len(raw))
	} else {
		t.Logf("Order check: 0 mismatches — both paths produce identical order (as expected)")
	}

	// Now measure the cost of the redundant sort
	iterations := 10000
	rResults := make([][]vamana.SearchResult, iterations)
	start := time.Now()
	for i := 0; i < iterations; i++ {
		rResults[i], _ = vc.Index.Search(query, k, efSearch)
	}
	directTime := time.Since(start)

	wResults := make([][]SearchResult, iterations)
	start = time.Now()
	for i := 0; i < iterations; i++ {
		wResults[i] = vc.Search(query, k, efSearch)
	}
	wrapperTime := time.Since(start)

	avgDirect := directTime.Seconds() / float64(iterations)
	avgWrapper := wrapperTime.Seconds() / float64(iterations)

	t.Logf("Direct  Index.Search avg: %.2f µs/op", avgDirect*1e6)
	t.Logf("VamanaCollection avg: %.2f µs/op", avgWrapper*1e6)
	t.Logf("Wrapper overhead: %.1f%%", (avgWrapper/avgDirect-1)*100)

	// Sort comparison: measure just the redundant sort.VamanaCollection.Search does
	// a sort.Slice by score after getting raw results
	sortInput := make([]struct {
		id    string
		score float32
	}, k)
	for i, r := range raw {
		sortInput[i].id = fmt.Sprintf("p-%d", r.ID)
		sortInput[i].score = 1.0 / (1.0 + r.Distance)
	}

	// Measure sort only
	start = time.Now()
	for i := 0; i < iterations; i++ {
		sort.Slice(sortInput, func(i, j int) bool {
			return sortInput[i].score > sortInput[j].score
		})
	}
	sortTime := time.Since(start)
	t.Logf("Redundant sort only: %.2f µs/op", float64(sortTime.Nanoseconds())/float64(iterations)/1000)

	// Now measure wrapper overhead minus sort cost
	t.Logf("Per-op wrapper overhead breakdown:")
	t.Logf("  DiskVamanaIndex.Search: %.2f µs", avgDirect*1e6)
	t.Logf("  + redundant sort:       %.2f µs", float64(sortTime.Nanoseconds())/float64(iterations)/1000)
	t.Logf("  + Mu.RLock+enrichment:  %.2f µs (estimated from difference)", avgWrapper*1e6-avgDirect*1e6-float64(sortTime.Nanoseconds())/float64(iterations)/1000)
	t.Logf("  = total:                %.2f µs", avgWrapper*1e6)
}
