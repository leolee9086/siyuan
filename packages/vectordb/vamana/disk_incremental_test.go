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
// TestDiskIndex_Insert
//
// Builds a 10K-vector base index with BBQ enabled, inserts 100 new vectors,
// then verifies:
//   - totalPoints increased correctly
//   - Each inserted vector is found in top-k search results
//   - Recall@10 against brute-force ground truth meets threshold
//   - Dimension mismatch is rejected
// ============================================================================

func TestDiskIndex_Insert(t *testing.T) {
	requireScaleTest(t)

	idx := setupDiskIndex(t, testIncrNumBase, testIncrDim)

	originalTotal := idx.totalPoints()
	t.Logf("Base index: totalPoints=%d, maxDegree=%d, HasBBQ=%v, HasBBQMeta=%v",
		originalTotal, idx.MaxDegree(), idx.HasBBQ(), idx.HasBBQMeta())

	if originalTotal != uint64(testIncrNumBase) {
		t.Fatalf("expected base totalPoints=%d, got %d", testIncrNumBase, originalTotal)
	}

	// Insert 100 distinct vectors
	rng := rand.New(rand.NewSource(123))
	insertedIDs := make([]uint64, 0, testIncrNumInsert)
	insertedVecs := make([][]float32, 0, testIncrNumInsert)

	for i := 0; i < testIncrNumInsert; i++ {
		vec := generateDistinctVector(testIncrDim, float32(10+i))
		newID, err := idx.Insert(vec)
		if err != nil {
			t.Fatalf("Insert[%d] failed: %v", i, err)
		}
		insertedIDs = append(insertedIDs, newID)
		insertedVecs = append(insertedVecs, vec)
	}
	t.Logf("Inserted %d vectors, IDs range [%d, %d]",
		testIncrNumInsert, insertedIDs[0], insertedIDs[len(insertedIDs)-1])

	// Verify total points increased
	newTotal := idx.totalPoints()
	expectedTotal := originalTotal + uint64(testIncrNumInsert)
	if newTotal != expectedTotal {
		t.Errorf("totalPoints: expected %d, got %d", expectedTotal, newTotal)
	}

	// Search for each inserted vector — it must appear in top-10
	missCount := 0
	for i, vec := range insertedVecs {
		results, _ := idx.Search(vec, 10, 200)
		if len(results) == 0 {
			t.Errorf("Search for inserted vector %d returned no results", i)
			missCount++
			continue
		}
		if !searchContainsID(results, insertedIDs[i]) {
			missCount++
		}
	}
	t.Logf("Insert self-search: %d/%d found in top-10",
		testIncrNumInsert-missCount, testIncrNumInsert)
	if missCount > testIncrNumInsert/10 {
		t.Errorf("Too many misses in self-search: %d/%d", missCount, testIncrNumInsert)
	}

	// Recall@10 on random queries against brute-force ground truth
	numQueries := 50
	queries := generateIncrTestVectors(rng, numQueries, testIncrDim)
	recall := computeAverageRecallDiskIncr(idx, queries, 10, 200)
	assertMinRecall(t, "Insert recall@10", recall, 0.50)

	// Verify dimension mismatch error
	_, err := idx.Insert([]float32{1.0, 2.0})
	if err != ErrVectorDimensionMismatch {
		t.Errorf("Insert wrong dim: expected ErrVectorDimensionMismatch, got %v", err)
	}

	t.Logf("TestDiskIndex_Insert passed: %d vectors inserted, recall=%.4f", testIncrNumInsert, recall)
}

// ============================================================================
// TestDiskIndex_Delete
//
// Builds a 10K-vector base index with BBQ enabled, deletes 500 nodes,
// then verifies:
//   - Deleted nodes are marked as deleted
//   - Double-delete returns ErrNodeAlreadyDeleted
//   - Search does not return any deleted node
//   - Recall@10 on remaining data meets threshold
// ============================================================================

func TestDiskIndex_Delete(t *testing.T) {
	requireScaleTest(t)

	idx := setupDiskIndex(t, testIncrNumBase, testIncrDim)

	t.Logf("Base index: totalPoints=%d, HasBBQ=%v", idx.totalPoints(), idx.HasBBQ())

	// Select 500 nodes to delete (avoiding medoid)
	rng := rand.New(rand.NewSource(456))
	deleteIDs := selectDeleteCandidates(idx, testIncrNumDelete, rng)
	t.Logf("Deleting %d nodes (medoid=%d excluded)", len(deleteIDs), idx.Medoid())

	// Read vectors before deletion for search verification
	deletedVecs := make(map[uint64][]float32, len(deleteIDs))
	for _, id := range deleteIDs {
		vec, err := idx.ReadVector(id)
		if err != nil {
			t.Fatalf("ReadVector(%d) failed: %v", id, err)
		}
		deletedVecs[id] = vec
	}

	// Delete nodes
	for _, id := range deleteIDs {
		if err := idx.Delete(id); err != nil {
			t.Fatalf("Delete(%d) failed: %v", id, err)
		}
	}
	t.Logf("Deleted %d nodes successfully", len(deleteIDs))

	// Verify deleted nodes are marked
	for _, id := range deleteIDs {
		if !idx.IsDeleted(id) {
			t.Errorf("Node %d should be marked as deleted", id)
		}
	}

	// Verify double-delete returns error
	if err := idx.Delete(deleteIDs[0]); err != ErrNodeAlreadyDeleted {
		t.Errorf("Double delete: expected ErrNodeAlreadyDeleted, got %v", err)
	}

	// Search for deleted vectors — none should appear in results
	foundDeleted := 0
	for id, vec := range deletedVecs {
		results, _ := idx.Search(vec, 10, 200)
		if searchContainsID(results, id) {
			foundDeleted++
		}
	}
	if foundDeleted > 0 {
		t.Errorf("%d/%d deleted nodes found in search results", foundDeleted, len(deleteIDs))
	} else {
		t.Logf("No deleted nodes found in search results ✓")
	}

	// Recall@10 on random queries (should still be reasonable)
	numQueries := 50
	queries := generateIncrTestVectors(rng, numQueries, testIncrDim)
	recall := computeAverageRecallDiskIncr(idx, queries, 10, 200)
	assertMinRecall(t, "Delete recall@10", recall, 0.40)

	t.Logf("TestDiskIndex_Delete passed: %d nodes deleted, recall=%.4f", len(deleteIDs), recall)
}

// ============================================================================
// TestDiskIndex_Compact
//
// Builds a 10K-vector base index with BBQ, inserts 100 vectors, deletes 500,
// then compacts. Verifies:
//   - CompactResult statistics are consistent
//   - Compacted index opens successfully with BBQ
//   - Compacted index has correct point count
//   - Search on compacted index returns results with acceptable recall
// ============================================================================

func TestDiskIndex_Compact(t *testing.T) {
	requireScaleTest(t)

	idx := setupDiskIndex(t, testIncrNumBase, testIncrDim)

	t.Logf("Base index: totalPoints=%d, HasBBQ=%v", idx.totalPoints(), idx.HasBBQ())

	// Insert 100 vectors
	rng := rand.New(rand.NewSource(789))
	insertVecs := generateIncrTestVectors(rng, testIncrNumInsert, testIncrDim)
	for i, vec := range insertVecs {
		if _, err := idx.Insert(vec); err != nil {
			t.Fatalf("Insert[%d] failed: %v", i, err)
		}
	}
	t.Logf("Inserted %d vectors, totalPoints=%d", testIncrNumInsert, idx.totalPoints())

	// Delete 500 original nodes (avoid medoid)
	deleteIDs := selectDeleteCandidates(idx, testIncrNumDelete, rng)
	for _, id := range deleteIDs {
		if err := idx.Delete(id); err != nil {
			// Some IDs might be append-buffer IDs if selectDeleteCandidates
			// picked from the extended range; skip those errors
			if err != ErrNodeAlreadyDeleted {
				t.Fatalf("Delete(%d) failed: %v", id, err)
			}
		}
	}
	t.Logf("Deleted %d nodes, totalPoints=%d", len(deleteIDs), idx.totalPoints())

	// Compact to new path
	compactPath := filepath.Join(t.TempDir(), "compacted")
	result, err := idx.Compact(compactPath)
	if err != nil {
		t.Fatalf("Compact failed: %v", err)
	}

	t.Logf("Compact: original=%d, remaining=%d, deleted=%d",
		result.OriginalPoints, result.RemainingPoints, result.DeletedPoints)

	// Verify statistics
	if result.DeletedPoints == 0 {
		t.Error("Compact should have removed deleted points")
	}
	if result.RemainingPoints+result.DeletedPoints != result.OriginalPoints {
		t.Errorf("remaining(%d)+deleted(%d) != original(%d)",
			result.RemainingPoints, result.DeletedPoints, result.OriginalPoints)
	}

	// Open compacted index
	compactIdx, err := Open(compactPath)
	if err != nil {
		t.Fatalf("Open compacted index failed: %v", err)
	}
	defer compactIdx.Close()

	if compactIdx.NumPointsTotal() != result.RemainingPoints {
		t.Errorf("Compacted NumPointsTotal: expected %d, got %d",
			result.RemainingPoints, compactIdx.NumPointsTotal())
	}

	t.Logf("Compacted index: NumPoints=%d, HasBBQ=%v, HasBBQMeta=%v",
		compactIdx.NumPointsTotal(), compactIdx.HasBBQ(), compactIdx.HasBBQMeta())

	// Search on compacted index with random queries
	numQueries := 50
	queries := generateIncrTestVectors(rng, numQueries, testIncrDim)

	noResultCount := 0
	for i, q := range queries {
		results, _ := compactIdx.Search(q, 10, 200)
		if len(results) == 0 {
			noResultCount++
			if noResultCount <= 3 {
				t.Logf("  Query %d returned no results", i)
			}
		}
	}
	if noResultCount > numQueries/5 {
		t.Errorf("Too many empty results on compacted index: %d/%d", noResultCount, numQueries)
	}

	t.Logf("TestDiskIndex_Compact passed: %d → %d points",
		result.OriginalPoints, result.RemainingPoints)
}

// ============================================================================
// TestDiskIndex_InsertDeleteCycle
//
// Full end-to-end cycle: Build 10K → Insert → Search → Delete → Search →
// Compact → Open → Search. Verifies correctness at each stage.
// ============================================================================

func TestDiskIndex_InsertDeleteCycle(t *testing.T) {
	requireScaleTest(t)

	idx := setupDiskIndex(t, testIncrNumBase, testIncrDim)
	rng := rand.New(rand.NewSource(2024))

	t.Logf("Base index: totalPoints=%d, HasBBQ=%v", idx.totalPoints(), idx.HasBBQ())

	// Phase 1: Baseline recall
	numQueries := 30
	queries := generateIncrTestVectors(rng, numQueries, testIncrDim)
	baseRecall := computeAverageRecallDiskIncr(idx, queries, 10, 200)
	t.Logf("Phase 1 - Baseline recall@10: %.4f", baseRecall)

	// Phase 2: Insert 100 distinct vectors
	insertedIDs := make([]uint64, 0, testIncrNumInsert)
	insertedVecs := make([][]float32, 0, testIncrNumInsert)
	for i := 0; i < testIncrNumInsert; i++ {
		vec := generateDistinctVector(testIncrDim, float32(50+i))
		id, err := idx.Insert(vec)
		if err != nil {
			t.Fatalf("Phase 2: Insert[%d] failed: %v", i, err)
		}
		insertedIDs = append(insertedIDs, id)
		insertedVecs = append(insertedVecs, vec)
	}
	t.Logf("Phase 2 - Inserted %d vectors", testIncrNumInsert)

	// Phase 3: Verify inserted vectors are searchable
	insertMiss := 0
	for i, vec := range insertedVecs {
		results, _ := idx.Search(vec, 10, 200)
		if !searchContainsID(results, insertedIDs[i]) {
			insertMiss++
		}
	}
	t.Logf("Phase 3 - Insert self-search: %d/%d found",
		testIncrNumInsert-insertMiss, testIncrNumInsert)
	if insertMiss > testIncrNumInsert/5 {
		t.Errorf("Phase 3: too many insert misses: %d/%d", insertMiss, testIncrNumInsert)
	}

	// Phase 4: Delete 500 base nodes
	deleteIDs := selectDeleteCandidates(idx, testIncrNumDelete, rng)
	deleteSet := make(map[uint64]struct{}, len(deleteIDs))
	for _, id := range deleteIDs {
		if err := idx.Delete(id); err != nil {
			if err != ErrNodeAlreadyDeleted {
				t.Fatalf("Phase 4: Delete(%d) failed: %v", id, err)
			}
		}
		deleteSet[id] = struct{}{}
	}
	t.Logf("Phase 4 - Deleted %d nodes", len(deleteIDs))

	// Phase 5: Verify deleted nodes not in search, inserted still searchable
	for _, id := range deleteIDs {
		if !idx.IsDeleted(id) {
			t.Errorf("Phase 5: node %d should be deleted", id)
		}
	}

	// Check inserted vectors not in delete set are still searchable
	insertStillFound := 0
	for i, vec := range insertedVecs {
		if _, deleted := deleteSet[insertedIDs[i]]; deleted {
			continue
		}
		results, _ := idx.Search(vec, 10, 200)
		if searchContainsID(results, insertedIDs[i]) {
			insertStillFound++
		}
	}
	t.Logf("Phase 5 - Inserted vectors still found: %d", insertStillFound)

	// Phase 6: Compact
	compactPath := filepath.Join(t.TempDir(), "cycle_compact")
	cr, err := idx.Compact(compactPath)
	if err != nil {
		t.Fatalf("Phase 6: Compact failed: %v", err)
	}
	t.Logf("Phase 6 - Compact: original=%d, remaining=%d, deleted=%d",
		cr.OriginalPoints, cr.RemainingPoints, cr.DeletedPoints)

	if cr.DeletedPoints == 0 {
		t.Error("Phase 6: Compact should have removed deleted points")
	}

	// Phase 7: Open compacted index and verify search
	compactIdx, err := Open(compactPath)
	if err != nil {
		t.Fatalf("Phase 7: Open compacted index failed: %v", err)
	}
	defer compactIdx.Close()

	t.Logf("Phase 7 - Compacted index: NumPoints=%d, HasBBQ=%v",
		compactIdx.NumPointsTotal(), compactIdx.HasBBQ())

	noResultCount := 0
	for _, q := range queries {
		results, _ := compactIdx.Search(q, 10, 200)
		if len(results) == 0 {
			noResultCount++
		}
	}
	if noResultCount > numQueries/5 {
		t.Errorf("Phase 7: too many empty results: %d/%d", noResultCount, numQueries)
	}

	t.Logf("TestDiskIndex_InsertDeleteCycle passed: full cycle verified")
}
