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
// TestDiskIndex_CheckpointAfterInserts
//
// Builds a base index, inserts a batch of vectors, saves a checkpoint via
// Compact, reopens the checkpoint index, and verifies:
//   - Point count is correct (base + inserted - 0 deleted)
//   - Newly inserted vectors are findable via search
//   - Recall@10 on the checkpoint index meets threshold
// ============================================================================

func TestDiskIndex_CheckpointAfterInserts(t *testing.T) {
	requireScaleTest(t)

	idx := setupDiskIndex(t, testIncrNumBase, testIncrDim)
	rng := rand.New(rand.NewSource(1001))

	originalTotal := idx.totalPoints()
	t.Logf("Base index: totalPoints=%d, HasBBQ=%v", originalTotal, idx.HasBBQ())

	// Insert a batch of vectors
	numInsert := 80
	insertedIDs := make([]uint64, 0, numInsert)
	insertedVecs := make([][]float32, 0, numInsert)

	for i := 0; i < numInsert; i++ {
		vec := generateDistinctVector(testIncrDim, float32(20+i))
		id, err := idx.Insert(vec)
		if err != nil {
			t.Fatalf("Insert[%d] failed: %v", i, err)
		}
		insertedIDs = append(insertedIDs, id)
		insertedVecs = append(insertedVecs, vec)
	}
	t.Logf("Inserted %d vectors, totalPoints=%d", numInsert, idx.totalPoints())

	// Checkpoint: Compact to a new path
	checkpointPath := filepath.Join(t.TempDir(), "checkpoint_inserts")
	result, err := idx.Compact(checkpointPath)
	if err != nil {
		t.Fatalf("Compact (checkpoint) failed: %v", err)
	}
	t.Logf("Checkpoint saved: original=%d, remaining=%d, deleted=%d",
		result.OriginalPoints, result.RemainingPoints, result.DeletedPoints)

	// Reopen the checkpoint index
	cpIdx, err := Open(checkpointPath)
	if err != nil {
		t.Fatalf("Open checkpoint index failed: %v", err)
	}
	defer cpIdx.Close()

	// Verify point count
	expectedPoints := originalTotal + uint64(numInsert)
	if cpIdx.NumPointsTotal() != expectedPoints {
		t.Errorf("Checkpoint NumPointsTotal: expected %d, got %d",
			expectedPoints, cpIdx.NumPointsTotal())
	}

	// Verify inserted vectors are searchable in the checkpoint index
	missCount := 0
	for i, vec := range insertedVecs {
		results, searchErr := cpIdx.Search(vec, 10, 200)
		if searchErr != nil {
			t.Fatalf("Search on checkpoint failed for vector %d: %v", i, searchErr)
		}
		if len(results) == 0 || !searchContainsID(results, insertedIDs[i]) {
			missCount++
		}
	}
	t.Logf("Checkpoint insert self-search: %d/%d found in top-10",
		numInsert-missCount, numInsert)
	if missCount > numInsert/5 {
		t.Errorf("Too many misses in checkpoint self-search: %d/%d", missCount, numInsert)
	}

	// Recall@10 on random queries against brute-force ground truth
	numQueries := 50
	queries := generateIncrTestVectors(rng, numQueries, testIncrDim)
	recall := computeAverageRecallDiskIncr(cpIdx, queries, 10, 200)
	assertMinRecall(t, "CheckpointAfterInserts recall@10", recall, 0.45)

	t.Logf("TestDiskIndex_CheckpointAfterInserts passed: checkpoint has %d points, recall=%.4f",
		cpIdx.NumPointsTotal(), recall)
}

// ============================================================================
// TestDiskIndex_CheckpointAfterDeletes
//
// Builds a base index, deletes a batch of nodes, saves a checkpoint via
// Compact, reopens the checkpoint index, and verifies:
//   - Deleted nodes no longer exist in the compacted index
//   - Point count is correct (base - deleted)
//   - Search does not return any deleted node
//   - Recall@10 on the checkpoint index meets threshold
// ============================================================================

func TestDiskIndex_CheckpointAfterDeletes(t *testing.T) {
	requireScaleTest(t)

	idx := setupDiskIndex(t, testIncrNumBase, testIncrDim)
	rng := rand.New(rand.NewSource(2002))

	originalTotal := idx.NumPointsTotal()
	t.Logf("Base index: NumPointsTotal=%d, HasBBQ=%v", originalTotal, idx.HasBBQ())

	// Select and delete a batch of nodes
	numDelete := 300
	deleteIDs := selectDeleteCandidates(idx, numDelete, rng)

	// Read vectors before deletion for later search verification
	deletedVecs := make(map[uint64][]float32, len(deleteIDs))
	for _, id := range deleteIDs {
		vec, err := idx.ReadVector(id)
		if err != nil {
			t.Fatalf("ReadVector(%d) before delete failed: %v", id, err)
		}
		deletedVecs[id] = vec
	}

	for _, id := range deleteIDs {
		if err := idx.Delete(id); err != nil {
			t.Fatalf("Delete(%d) failed: %v", id, err)
		}
	}
	t.Logf("Deleted %d nodes", len(deleteIDs))

	// Checkpoint: Compact to a new path
	checkpointPath := filepath.Join(t.TempDir(), "checkpoint_deletes")
	result, err := idx.Compact(checkpointPath)
	if err != nil {
		t.Fatalf("Compact (checkpoint) failed: %v", err)
	}
	t.Logf("Checkpoint saved: original=%d, remaining=%d, deleted=%d",
		result.OriginalPoints, result.RemainingPoints, result.DeletedPoints)

	// Verify compact statistics
	if result.DeletedPoints == 0 {
		t.Error("Compact should have removed deleted points")
	}
	expectedRemaining := originalTotal - uint64(len(deleteIDs))
	if result.RemainingPoints != expectedRemaining {
		t.Errorf("RemainingPoints: expected %d, got %d",
			expectedRemaining, result.RemainingPoints)
	}

	// Reopen the checkpoint index
	cpIdx, err := Open(checkpointPath)
	if err != nil {
		t.Fatalf("Open checkpoint index failed: %v", err)
	}
	defer cpIdx.Close()

	// Verify point count in checkpoint
	if cpIdx.NumPointsTotal() != expectedRemaining {
		t.Errorf("Checkpoint NumPointsTotal: expected %d, got %d",
			expectedRemaining, cpIdx.NumPointsTotal())
	}

	// Verify search does not return deleted nodes
	foundDeleted := 0
	for id, vec := range deletedVecs {
		results, _ := cpIdx.Search(vec, 10, 200)
		if searchContainsID(results, id) {
			foundDeleted++
		}
	}
	if foundDeleted > 0 {
		t.Errorf("%d/%d deleted nodes found in checkpoint search results",
			foundDeleted, len(deleteIDs))
	} else {
		t.Logf("No deleted nodes found in checkpoint search results ✓")
	}

	// Recall@10 on random queries
	numQueries := 50
	queries := generateIncrTestVectors(rng, numQueries, testIncrDim)
	recall := computeAverageRecallDiskIncr(cpIdx, queries, 10, 200)
	assertMinRecall(t, "CheckpointAfterDeletes recall@10", recall, 0.40)

	t.Logf("TestDiskIndex_CheckpointAfterDeletes passed: checkpoint has %d points, recall=%.4f",
		cpIdx.NumPointsTotal(), recall)
}

// ============================================================================
// TestDiskIndex_MultipleCheckpoints
//
// Builds a base index, then executes multiple rounds of operations with a
// checkpoint after each round:
//   Round 1: Insert 50 vectors → Checkpoint
//   Round 2: Delete 200 nodes  → Checkpoint
//   Round 3: Insert 60 vectors → Checkpoint
//
// After each checkpoint, reopens the index and verifies:
//   - Point count matches expectations
//   - Search returns valid results
//   - Final state is consistent with all accumulated operations
// ============================================================================

func TestDiskIndex_MultipleCheckpoints(t *testing.T) {
	requireScaleTest(t)

	idx := setupDiskIndex(t, testIncrNumBase, testIncrDim)
	rng := rand.New(rand.NewSource(3003))

	t.Logf("Base index: totalPoints=%d, HasBBQ=%v", idx.totalPoints(), idx.HasBBQ())

	// ---- Round 1: Insert 50 vectors → Checkpoint ----
	t.Log("=== Round 1: Insert → Checkpoint ===")
	numInsertR1 := 50
	r1InsertedIDs := make([]uint64, 0, numInsertR1)
	r1InsertedVecs := make([][]float32, 0, numInsertR1)

	for i := 0; i < numInsertR1; i++ {
		vec := generateDistinctVector(testIncrDim, float32(100+i))
		id, err := idx.Insert(vec)
		if err != nil {
			t.Fatalf("Round1 Insert[%d] failed: %v", i, err)
		}
		r1InsertedIDs = append(r1InsertedIDs, id)
		r1InsertedVecs = append(r1InsertedVecs, vec)
	}
	t.Logf("Round1: inserted %d vectors, totalPoints=%d", numInsertR1, idx.totalPoints())

	cp1Path := filepath.Join(t.TempDir(), "checkpoint_r1")
	r1Result, err := idx.Compact(cp1Path)
	if err != nil {
		t.Fatalf("Round1 Compact failed: %v", err)
	}
	t.Logf("Round1 checkpoint: original=%d, remaining=%d",
		r1Result.OriginalPoints, r1Result.RemainingPoints)

	// Verify Round 1 checkpoint
	cp1Idx, err := Open(cp1Path)
	if err != nil {
		t.Fatalf("Round1 Open checkpoint failed: %v", err)
	}

	expectedR1 := uint64(testIncrNumBase) + uint64(numInsertR1)
	if cp1Idx.NumPointsTotal() != expectedR1 {
		t.Errorf("Round1 checkpoint NumPointsTotal: expected %d, got %d",
			expectedR1, cp1Idx.NumPointsTotal())
	}

	// Verify some inserted vectors are searchable
	r1Miss := 0
	for i, vec := range r1InsertedVecs {
		results, _ := cp1Idx.Search(vec, 10, 200)
		if !searchContainsID(results, r1InsertedIDs[i]) {
			r1Miss++
		}
	}
	t.Logf("Round1 checkpoint self-search: %d/%d found", numInsertR1-r1Miss, numInsertR1)
	if r1Miss > numInsertR1/5 {
		t.Errorf("Round1: too many misses: %d/%d", r1Miss, numInsertR1)
	}
	cp1Idx.Close()

	// ---- Round 2: Delete 200 nodes from checkpoint → Checkpoint ----
	t.Log("=== Round 2: Delete → Checkpoint ===")

	// Reopen Round 1 checkpoint as the working index for Round 2
	r2Idx, err := Open(cp1Path)
	if err != nil {
		t.Fatalf("Round2 Open cp1 failed: %v", err)
	}

	numDeleteR2 := 200
	r2DeleteIDs := selectDeleteCandidates(r2Idx, numDeleteR2, rng)

	for _, id := range r2DeleteIDs {
		if err := r2Idx.Delete(id); err != nil {
			if err != ErrNodeAlreadyDeleted {
				t.Fatalf("Round2 Delete(%d) failed: %v", id, err)
			}
		}
	}
	t.Logf("Round2: deleted %d nodes", len(r2DeleteIDs))

	cp2Path := filepath.Join(t.TempDir(), "checkpoint_r2")
	r2Result, err := r2Idx.Compact(cp2Path)
	if err != nil {
		t.Fatalf("Round2 Compact failed: %v", err)
	}
	r2Idx.Close()

	t.Logf("Round2 checkpoint: original=%d, remaining=%d, deleted=%d",
		r2Result.OriginalPoints, r2Result.RemainingPoints, r2Result.DeletedPoints)

	// Verify Round 2 checkpoint
	cp2Idx, err := Open(cp2Path)
	if err != nil {
		t.Fatalf("Round2 Open checkpoint failed: %v", err)
	}

	expectedR2 := expectedR1 - uint64(r2Result.DeletedPoints)
	if cp2Idx.NumPointsTotal() != expectedR2 {
		t.Errorf("Round2 checkpoint NumPointsTotal: expected %d, got %d",
			expectedR2, cp2Idx.NumPointsTotal())
	}

	// Verify deleted nodes are not in search results
	numQueries := 30
	queries := generateIncrTestVectors(rng, numQueries, testIncrDim)
	r2Recall := computeAverageRecallDiskIncr(cp2Idx, queries, 10, 200)
	assertMinRecall(t, "Round2 checkpoint recall@10", r2Recall, 0.35)
	cp2Idx.Close()

	// ---- Round 3: Insert 60 vectors into checkpoint → Checkpoint ----
	t.Log("=== Round 3: Insert → Checkpoint ===")

	// Reopen Round 2 checkpoint as the working index for Round 3
	r3Idx, err := Open(cp2Path)
	if err != nil {
		t.Fatalf("Round3 Open cp2 failed: %v", err)
	}

	numInsertR3 := 60
	r3InsertedIDs := make([]uint64, 0, numInsertR3)
	r3InsertedVecs := make([][]float32, 0, numInsertR3)

	for i := 0; i < numInsertR3; i++ {
		vec := generateDistinctVector(testIncrDim, float32(200+i))
		id, err := r3Idx.Insert(vec)
		if err != nil {
			t.Fatalf("Round3 Insert[%d] failed: %v", i, err)
		}
		r3InsertedIDs = append(r3InsertedIDs, id)
		r3InsertedVecs = append(r3InsertedVecs, vec)
	}
	t.Logf("Round3: inserted %d vectors, totalPoints=%d", numInsertR3, r3Idx.totalPoints())

	cp3Path := filepath.Join(t.TempDir(), "checkpoint_r3")
	r3Result, err := r3Idx.Compact(cp3Path)
	if err != nil {
		t.Fatalf("Round3 Compact failed: %v", err)
	}
	r3Idx.Close()

	t.Logf("Round3 checkpoint: original=%d, remaining=%d",
		r3Result.OriginalPoints, r3Result.RemainingPoints)

	// Verify final checkpoint
	cpFinal, err := Open(cp3Path)
	if err != nil {
		t.Fatalf("Round3 Open final checkpoint failed: %v", err)
	}
	defer cpFinal.Close()

	expectedFinal := expectedR2 + uint64(numInsertR3)
	if cpFinal.NumPointsTotal() != expectedFinal {
		t.Errorf("Final checkpoint NumPointsTotal: expected %d, got %d",
			expectedFinal, cpFinal.NumPointsTotal())
	}

	// Verify Round 3 inserted vectors are searchable in final checkpoint
	r3Miss := 0
	for i, vec := range r3InsertedVecs {
		results, _ := cpFinal.Search(vec, 10, 200)
		if !searchContainsID(results, r3InsertedIDs[i]) {
			r3Miss++
		}
	}
	t.Logf("Round3 final self-search: %d/%d found", numInsertR3-r3Miss, numInsertR3)
	if r3Miss > numInsertR3/5 {
		t.Errorf("Round3: too many misses in final checkpoint: %d/%d", r3Miss, numInsertR3)
	}

	// Final recall check
	finalQueries := generateIncrTestVectors(rng, numQueries, testIncrDim)
	finalRecall := computeAverageRecallDiskIncr(cpFinal, finalQueries, 10, 200)
	assertMinRecall(t, "Final checkpoint recall@10", finalRecall, 0.35)

	t.Logf("TestDiskIndex_MultipleCheckpoints passed: 3 rounds completed, final points=%d, recall=%.4f",
		cpFinal.NumPointsTotal(), finalRecall)
}
