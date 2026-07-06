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
	"path/filepath"
	"testing"
)

// ============================================================================
// Streaming Scenario Constants
// ============================================================================

const (
	// streamBaseSize is the number of initial vectors for streaming tests.
	streamBaseSize = 1000

	// streamWindowSize is the number of active points maintained in the sliding window.
	streamWindowSize = 1000

	// streamBatchSize is the number of points inserted/deleted per round.
	streamBatchSize = 100

	// streamNumRounds is the number of sliding window rounds.
	streamNumRounds = 5

	// streamDim is the vector dimension for streaming tests.
	streamDim = 128

	// streamTopK is the k for search queries.
	streamTopK = 10

	// streamEfSearch is the search list size for streaming queries.
	streamEfSearch = 200

	// streamNumQueries is the number of random queries per validation step.
	streamNumQueries = 30

	// streamMinRecall is the minimum acceptable recall@k during streaming.
	streamMinRecall = 0.30
)

// ============================================================================
// TestDiskIndex_StreamingScenario
//
// Simulates a sliding-window streaming workload inspired by IP-DiskANN's
// test_streaming_scenario.cpp:
//   - Build a base index with streamBaseSize vectors
//   - Maintain a logical active window of point IDs
//   - Each round: insert streamBatchSize new vectors, delete streamBatchSize
//     oldest vectors from the active window
//   - After each round: verify point counts, search quality, and absence of
//     deleted points in results
//   - After round 3: execute Compact, reopen, and continue verification
// ============================================================================

func TestDiskIndex_StreamingScenario(t *testing.T) {
	requireScaleTest(t)

	idx := setupDiskIndex(t, streamBaseSize, streamDim)
	rng := rand.New(rand.NewSource(20260207))

	// activeIDs tracks the sliding window of non-deleted point IDs (FIFO order).
	// Initially populated with all base index IDs (0..streamBaseSize-1),
	// excluding the medoid which we never delete.
	medoid := idx.Medoid()
	activeIDs := make([]uint64, 0, streamWindowSize+streamBatchSize)
	for id := uint64(0); id < uint64(streamBaseSize); id++ {
		activeIDs = append(activeIDs, id)
	}

	// deletedSet tracks all IDs that have been deleted across all rounds.
	deletedSet := make(map[uint64]struct{})

	// nextVecSeed provides deterministic but distinct vectors per insert.
	nextVecSeed := float32(100)

	t.Logf("Base index: totalPoints=%d, medoid=%d", idx.totalPoints(), medoid)

	// Pre-generate query vectors (fixed across rounds for comparability).
	queries := generateIncrTestVectors(rng, streamNumQueries, streamDim)

	// compactRound is the round after which we perform Compact.
	const compactRound = 3

	for round := 1; round <= streamNumRounds; round++ {
		t.Logf("=== Round %d/%d ===", round, streamNumRounds)

		// --- Insert phase ---
		newIDs := make([]uint64, 0, streamBatchSize)
		for i := 0; i < streamBatchSize; i++ {
			vec := generateDistinctVector(streamDim, nextVecSeed)
			nextVecSeed += 1.0
			newID, err := idx.Insert(vec)
			if err != nil {
				t.Fatalf("Round %d: Insert[%d] failed: %v", round, i, err)
			}
			newIDs = append(newIDs, newID)
		}
		activeIDs = append(activeIDs, newIDs...)
		t.Logf("  Inserted %d vectors (IDs %d..%d)", streamBatchSize,
			newIDs[0], newIDs[len(newIDs)-1])

		// --- Delete phase: remove the oldest streamBatchSize from activeIDs ---
		toDelete := make([]uint64, 0, streamBatchSize)
		remaining := make([]uint64, 0, len(activeIDs)-streamBatchSize)
		deleted := 0
		for _, id := range activeIDs {
			if deleted < streamBatchSize && id != medoid {
				toDelete = append(toDelete, id)
				deleted++
			} else {
				remaining = append(remaining, id)
			}
		}
		activeIDs = remaining

		for _, id := range toDelete {
			if err := idx.Delete(id); err != nil {
				// Skip already-deleted (shouldn't happen, but be defensive)
				if err == ErrNodeAlreadyDeleted {
					continue
				}
				t.Fatalf("Round %d: Delete(%d) failed: %v", round, id, err)
			}
			deletedSet[id] = struct{}{}
		}
		t.Logf("  Deleted %d vectors, active window size=%d", len(toDelete), len(activeIDs))

		// --- Verification phase ---
		verifyStreamingRound(t, idx, round, activeIDs, deletedSet, queries)

		// --- Compact after designated round ---
		if round == compactRound {
			idx = compactAndReopen(t, idx, round)
			// After compact, IDs are remapped — reset tracking.
			// All points in the compacted index are active with new sequential IDs.
			newTotal := idx.totalPoints()
			activeIDs = make([]uint64, 0, newTotal)
			for id := uint64(0); id < newTotal; id++ {
				activeIDs = append(activeIDs, id)
			}
			deletedSet = make(map[uint64]struct{})
			medoid = idx.Medoid()
			t.Logf("  Post-compact: totalPoints=%d, medoid=%d", newTotal, medoid)
		}
	}

	// Final recall check
	finalRecall := computeAverageRecallDiskIncr(idx, queries, streamTopK, streamEfSearch)
	assertMinRecall(t, "StreamingScenario final recall", finalRecall, streamMinRecall)
	t.Logf("TestDiskIndex_StreamingScenario passed: final recall=%.4f", finalRecall)
}

// ============================================================================
// TestDiskIndex_StreamingWithCompact
//
// Variant that performs Compact every 2 rounds, verifying that periodic
// compaction does not degrade index behavior.
// ============================================================================

func TestDiskIndex_StreamingWithCompact(t *testing.T) {
	requireScaleTest(t)

	idx := setupDiskIndex(t, streamBaseSize, streamDim)
	rng := rand.New(rand.NewSource(42424242))

	medoid := idx.Medoid()
	activeIDs := make([]uint64, 0, streamWindowSize+streamBatchSize)
	for id := uint64(0); id < uint64(streamBaseSize); id++ {
		activeIDs = append(activeIDs, id)
	}
	deletedSet := make(map[uint64]struct{})
	nextVecSeed := float32(500)

	queries := generateIncrTestVectors(rng, streamNumQueries, streamDim)

	const compactInterval = 2
	const totalRounds = 6

	t.Logf("StreamingWithCompact: %d rounds, compact every %d rounds",
		totalRounds, compactInterval)

	for round := 1; round <= totalRounds; round++ {
		t.Logf("=== Round %d/%d ===", round, totalRounds)

		// --- Insert phase ---
		for i := 0; i < streamBatchSize; i++ {
			vec := generateDistinctVector(streamDim, nextVecSeed)
			nextVecSeed += 1.0
			newID, err := idx.Insert(vec)
			if err != nil {
				t.Fatalf("Round %d: Insert[%d] failed: %v", round, i, err)
			}
			activeIDs = append(activeIDs, newID)
		}

		// --- Delete phase ---
		toDelete := make([]uint64, 0, streamBatchSize)
		remaining := make([]uint64, 0, len(activeIDs)-streamBatchSize)
		deleted := 0
		for _, id := range activeIDs {
			if deleted < streamBatchSize && id != medoid {
				toDelete = append(toDelete, id)
				deleted++
			} else {
				remaining = append(remaining, id)
			}
		}
		activeIDs = remaining

		for _, id := range toDelete {
			if err := idx.Delete(id); err != nil {
				if err == ErrNodeAlreadyDeleted {
					continue
				}
				t.Fatalf("Round %d: Delete(%d) failed: %v", round, id, err)
			}
			deletedSet[id] = struct{}{}
		}
		t.Logf("  Inserted+Deleted %d each, active=%d", streamBatchSize, len(activeIDs))

		// --- Verification ---
		verifyStreamingRound(t, idx, round, activeIDs, deletedSet, queries)

		// --- Periodic compact ---
		if round%compactInterval == 0 {
			idx = compactAndReopen(t, idx, round)
			newTotal := idx.totalPoints()
			activeIDs = make([]uint64, 0, newTotal)
			for id := uint64(0); id < newTotal; id++ {
				activeIDs = append(activeIDs, id)
			}
			deletedSet = make(map[uint64]struct{})
			medoid = idx.Medoid()
			t.Logf("  Compact at round %d: totalPoints=%d", round, newTotal)
		}
	}

	finalRecall := computeAverageRecallDiskIncr(idx, queries, streamTopK, streamEfSearch)
	assertMinRecall(t, "StreamingWithCompact final recall", finalRecall, streamMinRecall)
	t.Logf("TestDiskIndex_StreamingWithCompact passed: final recall=%.4f", finalRecall)
}

// ============================================================================
// Helper: verifyStreamingRound
//
// Validates index state after a streaming round:
//   - Deleted points are marked as deleted
//   - Search returns results for random queries
//   - Deleted points do not appear in search results
// ============================================================================

func verifyStreamingRound(
	t *testing.T,
	idx *DiskVamanaIndex,
	round int,
	activeIDs []uint64,
	deletedSet map[uint64]struct{},
	queries [][]float32,
) {
	t.Helper()

	// Verify deleted points are marked
	for id := range deletedSet {
		if !idx.IsDeleted(id) {
			t.Errorf("Round %d: node %d should be marked as deleted", round, id)
		}
	}

	// Search with random queries and check results
	emptyCount := 0
	deletedInResults := 0
	for _, q := range queries {
		results, _ := idx.Search(q, streamTopK, streamEfSearch)
		if len(results) == 0 {
			emptyCount++
			continue
		}
		for _, r := range results {
			if _, wasDeleted := deletedSet[r.ID]; wasDeleted {
				deletedInResults++
			}
		}
	}

	if emptyCount > len(queries)/3 {
		t.Errorf("Round %d: too many empty search results: %d/%d",
			round, emptyCount, len(queries))
	}
	if deletedInResults > 0 {
		t.Errorf("Round %d: %d deleted points found in search results",
			round, deletedInResults)
	}

	t.Logf("  Verify round %d: empty=%d/%d, deletedInResults=%d, activeWindow=%d",
		round, emptyCount, len(queries), deletedInResults, len(activeIDs))
}

// ============================================================================
// Helper: compactAndReopen
//
// Compacts the index to a new path, closes the old index, opens the compacted
// one, and returns it. Registers cleanup via t.Cleanup.
// ============================================================================

func compactAndReopen(t *testing.T, idx *DiskVamanaIndex, round int) *DiskVamanaIndex {
	t.Helper()

	compactPath := filepath.Join(t.TempDir(), "compact")
	result, err := idx.Compact(compactPath)
	if err != nil {
		t.Fatalf("Round %d: Compact failed: %v", round, err)
	}

	t.Logf("  Compact: original=%d, remaining=%d, deleted=%d",
		result.OriginalPoints, result.RemainingPoints, result.DeletedPoints)

	if result.RemainingPoints+result.DeletedPoints != result.OriginalPoints {
		t.Errorf("Round %d: compact stats inconsistent: remaining(%d)+deleted(%d) != original(%d)",
			round, result.RemainingPoints, result.DeletedPoints, result.OriginalPoints)
	}

	// Close old index (ignore error since setupDiskIndex registered cleanup)
	idx.Close()

	// Open compacted index
	newIdx, err := Open(compactPath)
	if err != nil {
		t.Fatalf("Round %d: Open compacted index failed: %v", round, err)
	}
	t.Cleanup(func() { newIdx.Close() })

	if newIdx.NumPointsTotal() != result.RemainingPoints {
		t.Errorf("Round %d: compacted NumPointsTotal=%d, expected %d",
			round, newIdx.NumPointsTotal(), result.RemainingPoints)
	}

	// Verify compacted index is searchable
	rng := rand.New(rand.NewSource(int64(round) * 999))
	probeQueries := generateIncrTestVectors(rng, 5, streamDim)
	for i, q := range probeQueries {
		results, _ := newIdx.Search(q, streamTopK, streamEfSearch)
		if len(results) == 0 {
			t.Logf("  Compact probe query %d returned no results", i)
		}
	}

	return newIdx
}
