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
	"math"
	"math/rand"
	"path/filepath"
	"sort"
	"testing"

	"s-forge.local/vectordb/storage"
)

// ============================================================================
// Shared Test Helpers for DiskVamanaIndex Incremental Operations
// ============================================================================

const (
	testIncrDim       = 128
	testIncrNumBase   = 10000
	testIncrNumInsert = 100
	testIncrNumDelete = 500
)

// setupDiskIndex builds a disk index with BBQ enabled and opens it for testing.
// Registers cleanup via t.Cleanup so the caller does not need defer.
func setupDiskIndex(t *testing.T, numVectors, dim int) *DiskVamanaIndex {
	t.Helper()

	// Set up reader factory
	originalFactory := OpenDiskIndexReader
	t.Cleanup(func() { OpenDiskIndexReader = originalFactory })

	OpenDiskIndexReader = func(path string, readOnly bool) (storage.DiskIndexReader, error) {
		return storage.OpenReader(path, readOnly)
	}

	tmpDir := t.TempDir()
	basePath := filepath.Join(tmpDir, "test_incr")

	// Generate random vectors
	rng := rand.New(rand.NewSource(42))
	vectors := generateIncrTestVectors(rng, numVectors, dim)

	// Build disk index with BBQ enabled
	config := DefaultDiskBuildConfig()
	config.R = 64
	config.L = 100
	config.Alpha = 1.2
	config.EnableBBQ = true

	_, err := BuildFromVectors(basePath, vectors, config)
	if err != nil {
		t.Fatalf("BuildFromVectors failed: %v", err)
	}

	// Open the index
	idx, err := Open(basePath)
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	t.Cleanup(func() { idx.Close() })

	// Verify BBQ is loaded
	if !idx.HasBBQ() {
		t.Fatalf("BBQ should be enabled for dim=%d", dim)
	}

	return idx
}

// generateIncrTestVectors generates n random float32 vectors of given dimension.
func generateIncrTestVectors(rng *rand.Rand, n, dim int) [][]float32 {
	vectors := make([][]float32, n)
	for i := range vectors {
		vec := make([]float32, dim)
		for j := range vec {
			vec[j] = rng.Float32()*2 - 1 // [-1, 1]
		}
		vectors[i] = vec
	}
	return vectors
}

// generateDistinctVector generates a vector with large magnitude in a specific
// direction so it is easily distinguishable from random [-1,1] vectors.
func generateDistinctVector(dim int, seed float32) []float32 {
	vec := make([]float32, dim)
	for j := range vec {
		vec[j] = seed + float32(j)*0.001
	}
	return vec
}

// searchContainsID checks whether the search results contain the given node ID.
func searchContainsID(results []SearchResult, id uint64) bool {
	for _, r := range results {
		if r.ID == id {
			return true
		}
	}
	return false
}

// bruteForceSearchDiskIndex performs brute-force k-NN search over all non-deleted
// vectors in the disk index (including append buffer), returning sorted node IDs.
// Uses the internal getVector method to access both disk and append buffer nodes.
// This is used as ground truth for recall computation.
func bruteForceSearchDiskIndex(idx *DiskVamanaIndex, query []float32, k int) []uint64 {
	type distPair struct {
		id   uint64
		dist float32
	}

	idx.mu.RLock()
	total := idx.totalPoints()
	pairs := make([]distPair, 0, total)

	for id := uint64(0); id < total; id++ {
		if idx.deleted.IsDeleted(id) {
			continue
		}
		vec := idx.getVector(id)
		if vec == nil {
			continue
		}
		dist := euclideanDistance(vec, query)
		pairs = append(pairs, distPair{id: id, dist: dist})
	}
	idx.mu.RUnlock()

	sort.Slice(pairs, func(i, j int) bool {
		return pairs[i].dist < pairs[j].dist
	})

	if k > len(pairs) {
		k = len(pairs)
	}
	result := make([]uint64, k)
	for i := 0; i < k; i++ {
		result[i] = pairs[i].id
	}
	return result
}

// computeRecallAgainstBruteForce computes recall@k of search results against
// brute-force ground truth IDs.
func computeRecallAgainstBruteForce(results []SearchResult, groundTruth []uint64, k int) float64 {
	if k > len(groundTruth) {
		k = len(groundTruth)
	}
	if k == 0 {
		return 0.0
	}

	gtSet := make(map[uint64]struct{}, k)
	for i := 0; i < k; i++ {
		gtSet[groundTruth[i]] = struct{}{}
	}

	hits := 0
	for i := 0; i < len(results) && i < k; i++ {
		if _, ok := gtSet[results[i].ID]; ok {
			hits++
		}
	}
	return float64(hits) / float64(k)
}

// computeAverageRecallDiskIncr computes average recall@k over multiple queries
// using brute-force ground truth from the disk index.
func computeAverageRecallDiskIncr(
	idx *DiskVamanaIndex,
	queries [][]float32,
	k, efSearch int,
) float64 {
	totalRecall := 0.0
	for _, query := range queries {
		gt := bruteForceSearchDiskIndex(idx, query, k)
		results, _ := idx.Search(query, k, efSearch)
		totalRecall += computeRecallAgainstBruteForce(results, gt, k)
	}
	return totalRecall / float64(len(queries))
}

// selectDeleteCandidates selects numDelete node IDs to delete, avoiding the medoid.
func selectDeleteCandidates(idx *DiskVamanaIndex, numDelete int, rng *rand.Rand) []uint64 {
	medoid := idx.Medoid()
	total := idx.NumPointsTotal()

	// Build candidate pool (all non-medoid IDs)
	candidates := make([]uint64, 0, total-1)
	for id := uint64(0); id < total; id++ {
		if id != medoid {
			candidates = append(candidates, id)
		}
	}

	// Shuffle and take first numDelete
	rng.Shuffle(len(candidates), func(i, j int) {
		candidates[i], candidates[j] = candidates[j], candidates[i]
	})

	if numDelete > len(candidates) {
		numDelete = len(candidates)
	}
	return candidates[:numDelete]
}

// assertMinRecall fails the test if average recall is below the threshold.
func assertMinRecall(t *testing.T, label string, recall, minRecall float64) {
	t.Helper()
	if math.IsNaN(recall) {
		t.Errorf("%s: recall is NaN", label)
		return
	}
	if recall < minRecall {
		t.Errorf("%s: recall %.4f < minimum %.4f", label, recall, minRecall)
	} else {
		t.Logf("%s: recall %.4f (min=%.4f) ✓", label, recall, minRecall)
	}
}

// ============================================================================
// Verbose Compare Helpers — improved diagnostics for large-scale comparisons
// ============================================================================

// verboseCompareFloat32WithTolerance compares two float32 values within a given
// tolerance. Returns true if they are close enough, false otherwise. On mismatch
// it reports the label, expected, actual, difference and tolerance via t.Errorf.
func verboseCompareFloat32WithTolerance(t *testing.T, label string, expected, actual, tolerance float32) bool {
	t.Helper()
	diff := expected - actual
	if diff < 0 {
		diff = -diff
	}
	if diff > tolerance {
		t.Errorf("%s: value mismatch — expected %v, actual %v (diff %v exceeds tolerance %v)",
			label, expected, actual, diff, tolerance)
		return false
	}
	return true
}

// verboseCompareVectors compares two float32 vectors element-by-element and
// reports the first mismatched dimension with index, expected and actual values.
// Uses exact equality; callers needing tolerance should use
// verboseCompareFloat32WithTolerance per-element instead.
func verboseCompareVectors(t *testing.T, label string, expected, actual []float32) {
	t.Helper()
	if len(expected) != len(actual) {
		t.Errorf("%s: length mismatch — expected %d dimensions, actual %d dimensions",
			label, len(expected), len(actual))
		return
	}
	for i := range expected {
		if expected[i] != actual[i] {
			t.Errorf("%s: first mismatch at dimension [%d] — expected %v, actual %v",
				label, i, expected[i], actual[i])
			return
		}
	}
}

// verboseCompareSearchResults compares two SearchResult slices and reports the
// first difference found. It checks length first, then iterates element-by-element
// comparing ID and Distance fields.
func verboseCompareSearchResults(t *testing.T, label string, expected, actual []SearchResult) {
	t.Helper()
	if len(expected) != len(actual) {
		t.Errorf("%s: length mismatch — expected %d results, actual %d results",
			label, len(expected), len(actual))
		return
	}
	for i := range expected {
		prefix := fmt.Sprintf("%s[%d]", label, i)
		if expected[i].ID != actual[i].ID {
			t.Errorf("%s: ID mismatch — expected %d, actual %d",
				prefix, expected[i].ID, actual[i].ID)
			return
		}
		if expected[i].Distance != actual[i].Distance {
			t.Errorf("%s: Distance mismatch — expected %v, actual %v",
				prefix, expected[i].Distance, actual[i].Distance)
			return
		}
	}
}

// verboseCompareNeighborLists compares two uint32 neighbor lists and reports the
// first difference. Checks length first, then element-by-element.
func verboseCompareNeighborLists(t *testing.T, label string, expected, actual []uint32) {
	t.Helper()
	if len(expected) != len(actual) {
		t.Errorf("%s: length mismatch — expected %d neighbors, actual %d neighbors",
			label, len(expected), len(actual))
		return
	}
	for i := range expected {
		if expected[i] != actual[i] {
			t.Errorf("%s: first mismatch at index [%d] — expected %d, actual %d",
				label, i, expected[i], actual[i])
			return
		}
	}
}
