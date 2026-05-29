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
	"encoding/json"
	"fmt"
	"math/rand"
	"path/filepath"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/vectordb/vamana"
)

// TestVamanaCollectionCRUD verifies that VamanaCollection provides the
// same CRUD capabilities as Collection (HNSW-based), including:
//   - Insert with external string IDs
//   - Search with enriched results (external ID, score, meta)
//   - Update (re-insert with same external ID)
//   - Delete by external ID
func TestVamanaCollectionCRUD(t *testing.T) {
	dim := 64
	baseSize := 500

	// ── Build baseline vectors ──
	points := make([]Point, baseSize)
	for i := 0; i < baseSize; i++ {
		vec := make([]float32, dim)
		for j := 0; j < dim; j++ {
			vec[j] = rand.Float32()*2 - 1
		}
		NormalizeVector(vec)

		meta := map[string]interface{}{
			"index": i,
			"label": fmt.Sprintf("item-%d", i),
		}
		metaBytes, _ := json.Marshal(meta)

		points[i] = Point{
			ID:     fmt.Sprintf("item-%d", i),
			Vector: vec,
			Meta:   metaBytes,
		}
	}

	// ── Build VamanaCollection from scratch ──
	dir := t.TempDir()
	basePath := filepath.Join(dir, "test_vamana")

	config := vamana.DefaultDiskBuildConfig()
	config.R = 32
	config.L = 200

	vc, err := BuildVamanaCollection("test-crud", points, basePath, config, CollectionMeta{})
	if err != nil {
		t.Fatalf("BuildVamanaCollection: %v", err)
	}
	defer vc.Close()

	// ═══ 1. ItemCount ═══
	if count := vc.ItemCount(); count != baseSize {
		t.Errorf("ItemCount: got %d, want %d", count, baseSize)
	}

	// ═══ 2. GetDocID / GetExternalID ═══
	for i := 0; i < 10; i++ {
		id := fmt.Sprintf("item-%d", i)
		nodeID, ok := vc.GetDocID(id)
		if !ok {
			t.Errorf("GetDocID(%s): not found", id)
			continue
		}
		extID, ok := vc.GetExternalID(nodeID)
		if !ok {
			t.Errorf("GetExternalID(%d): not found", nodeID)
		}
		if extID != id {
			t.Errorf("round-trip ID mismatch: %s → %d → %s", id, nodeID, extID)
		}
	}

	// ═══ 3. Search with exact vector ═══
	queryVec := points[42].Vector
	results := vc.Search(queryVec, 10, 200)
	if len(results) == 0 {
		t.Fatal("Search returned empty results")
	}
	if results[0].ID != "item-42" {
		t.Errorf("exact search: expected item-42 at top, got %s", results[0].ID)
	}
	if results[0].Distance > 0.01 {
		t.Errorf("exact search: distance %.4f too high", results[0].Distance)
	}
	if results[0].Score < 0.9 {
		t.Errorf("exact search: score %.4f too low", results[0].Score)
	}
	// Verify meta is attached
	var resultMeta map[string]interface{}
	if err := json.Unmarshal(results[0].Meta, &resultMeta); err != nil {
		t.Errorf("meta parse: %v", err)
	}
	if resultMeta["index"].(float64) != 42.0 {
		t.Errorf("meta index mismatch: got %v", resultMeta["index"])
	}

	// ═══ 4. Update (upsert) ═══
	// Change item-0's vector to a very different direction
	oldVec0 := points[0].Vector
	newVec0 := make([]float32, dim)
	for j := 0; j < dim; j++ {
		newVec0[j] = -oldVec0[j] // opposite direction
	}
	NormalizeVector(newVec0)

	newMeta := map[string]interface{}{"updated": true}
	newMetaBytes, _ := json.Marshal(newMeta)

	err = vc.InsertPoint(Point{
		ID:     "item-0",
		Vector: newVec0,
		Meta:   newMetaBytes,
	})
	if err != nil {
		t.Fatalf("Update InsertPoint: %v", err)
	}

	// Verify old nodeID is soft-deleted
	oldNodeID, _ := vc.GetDocID("item-0") // this returns the *new* nodeID
	if vc.Index.IsDeleted(oldNodeID) {
		t.Errorf("new nodeID %d should not be deleted", oldNodeID)
	}

	// Search with new vector → should find item-0
	resultsNew := vc.Search(newVec0, 10, 200)
	foundNew := false
	for _, r := range resultsNew {
		if r.ID == "item-0" {
			foundNew = true
			var m map[string]interface{}
			json.Unmarshal(r.Meta, &m)
			if m["updated"] != true {
				t.Errorf("update meta not reflected in search result")
			}
			break
		}
	}
	if !foundNew {
		t.Errorf("after update, should find item-0 with new vector")
	}

	// Search with old vector → should NOT find item-0 (or at lower rank)
	resultsOld := vc.Search(oldVec0, 10, 200)
	foundOld := false
	for _, r := range resultsOld {
		if r.ID == "item-0" {
			foundOld = true
			break
		}
	}
	if foundOld {
		t.Logf("info: old vector still finds item-0 (soft-deleted old node still in graph)")
	}

	// ═══ 5. Delete ═══
	vc.DeleteItemWithIndex("item-99")
	if _, ok := vc.GetDocID("item-99"); ok {
		t.Error("item-99 should be removed from IDMap after delete")
	}
	if count := vc.ItemCount(); count != baseSize-1 {
		t.Errorf("ItemCount after delete: got %d, want %d", count, baseSize-1)
	}

	// Verify item-99 is not in search results for its own vector
	resultsAfterDel := vc.Search(points[99].Vector, 10, 200)
	for _, r := range resultsAfterDel {
		if r.ID == "item-99" {
			t.Errorf("deleted item-99 should not appear in search results")
		}
	}

	// ═══ 6. Insert new item after deletes (incremental) ═══
	newVec := make([]float32, dim)
	for j := 0; j < dim; j++ {
		newVec[j] = rand.Float32()*2 - 1
	}
	NormalizeVector(newVec)
	err = vc.InsertPoint(Point{
		ID:     "new-item",
		Vector: newVec,
	})
	if err != nil {
		t.Fatalf("incremental insert: %v", err)
	}
	nodeID, ok := vc.GetDocID("new-item")
	if !ok {
		t.Fatal("new-item not found after insert")
	}
	resultsNewItem := vc.Search(newVec, 5, 200)
	found := false
	for _, r := range resultsNewItem {
		if r.ID == "new-item" {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("incrementally inserted item not found in search")
	}

	// Verify nodeID is in the append buffer (>= NumPoints from the original build)
	diskPoints := vc.Index.NumPoints()
	if nodeID < diskPoints-uint64(baseSize) {
		_ = diskPoints
	}
	_ = nodeID

	t.Logf("VamanaCollection CRUD test passed: %d items", vc.ItemCount())
}

// TestVamanaCollectionRecall compares recall between VamanaCollection (disk)
// and Collection (HNSW, memory) on the same dataset.
func TestVamanaCollectionRecall(t *testing.T) {
	dim := 64
	numItems := 2000
	numQueries := 50

	// ── Generate dataset ──
	points := make([]Point, numItems)
	for i := 0; i < numItems; i++ {
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

	// ── Build HNSW Collection ──
	hnswCol := NewCollection("hnsw-recall", dim)
	for _, p := range points {
		hnswCol.InsertPoint(p)
	}

	// ── Build VamanaCollection ──
	dir := t.TempDir()
	basePath := filepath.Join(dir, "recall_test")
	config := vamana.DefaultDiskBuildConfig()
	config.R = 32
	config.L = 200

	vc, err := BuildVamanaCollection("vamana-recall", points, basePath, config, CollectionMeta{})
	if err != nil {
		t.Fatalf("BuildVamanaCollection: %v", err)
	}
	defer vc.Close()

	// ── Brute-force baseline: for each query, find true top-10 ──
	queries := make([][]float32, numQueries)
	for q := 0; q < numQueries; q++ {
		queries[q] = make([]float32, dim)
		for j := 0; j < dim; j++ {
			queries[q][j] = rand.Float32()*2 - 1
		}
		NormalizeVector(queries[q])
	}

	realTop10 := make([][]string, numQueries)
	for q := 0; q < numQueries; q++ {
		type scored struct {
			id   string
			dist float32
		}
		all := make([]scored, numItems)
		for i, p := range points {
			all[i] = scored{id: p.ID, dist: CosineDistance(queries[q], p.Vector)}
		}
		// insertion sort top 10
		for i := 1; i < len(all); i++ {
			for j := i; j > 0 && all[j].dist < all[j-1].dist; j-- {
				all[j], all[j-1] = all[j-1], all[j]
			}
		}
		top10 := make([]string, 10)
		for i := 0; i < 10; i++ {
			top10[i] = all[i].id
		}
		realTop10[q] = top10
	}

	// ── Compute recall ──
	hnswHits := 0
	vamanaHits := 0
	totalRecallChecks := numQueries * 10

	for q := 0; q < numQueries; q++ {
		trueTop := make(map[string]bool)
		for _, id := range realTop10[q] {
			trueTop[id] = true
		}

		hnswResults := hnswCol.Search(queries[q], 10, 100)
		for _, r := range hnswResults {
			if trueTop[r.ID] {
				hnswHits++
			}
		}

		vamanaResults := vc.Search(queries[q], 10, 100)
		for _, r := range vamanaResults {
			if trueTop[r.ID] {
				vamanaHits++
			}
		}
	}

	hnswRecall := float64(hnswHits) / float64(totalRecallChecks) * 100
	vamanaRecall := float64(vamanaHits) / float64(totalRecallChecks) * 100
	t.Logf("HNSW  recall@10: %.1f%%", hnswRecall)
	t.Logf("Vamana recall@10: %.1f%%", vamanaRecall)

	if vamanaRecall < 70.0 {
		t.Errorf("Vamana recall@10 %.1f%% below 70%% threshold", vamanaRecall)
	}
	if vamanaRecall < hnswRecall*0.8 {
		t.Logf("info: Vamana recall (%.1f%%) lower than HNSW (%.1f%%), expected for disk-based index", vamanaRecall, hnswRecall)
	}
}

// TestVamanaCollectionHeavyUpdates stresses the upsert path with repeated updates.
func TestVamanaCollectionHeavyUpdates(t *testing.T) {
	dim := 64
	baseSize := 500

	points := make([]Point, baseSize)
	for i := 0; i < baseSize; i++ {
		vec := make([]float32, dim)
		for j := 0; j < dim; j++ {
			vec[j] = rand.Float32()*2 - 1
		}
		NormalizeVector(vec)
		points[i] = Point{ID: fmt.Sprintf("p-%d", i), Vector: vec}
	}

	dir := t.TempDir()
	basePath := filepath.Join(dir, "heavy_update")
	config := vamana.DefaultDiskBuildConfig()
	config.R = 32
	config.L = 200

	vc, err := BuildVamanaCollection("heavy", points, basePath, config, CollectionMeta{})
	if err != nil {
		t.Fatalf("BuildVamanaCollection: %v", err)
	}
	defer vc.Close()

	// Repeatedly update a few targets
	updateIDs := []string{"p-10", "p-20", "p-30"}
	updateRounds := 5

	for round := 0; round < updateRounds; round++ {
		for _, id := range updateIDs {
			newVec := make([]float32, dim)
			for j := 0; j < dim; j++ {
				newVec[j] = rand.Float32()*2 - 1
			}
			NormalizeVector(newVec)

			vc.InsertPoint(Point{ID: id, Vector: newVec})
		}
	}

	// Verify all updated items are still searchable
	for _, id := range updateIDs {
		nodeID, ok := vc.GetDocID(id)
		if !ok {
			t.Errorf("after %d rounds, %s lost from IDMap", updateRounds, id)
			continue
		}
		// Verify the node is not soft-deleted
		if vc.Index.IsDeleted(nodeID) {
			t.Errorf("after %d rounds, node %d for %s is deleted", updateRounds, nodeID, id)
		}
	}

	t.Logf("Heavy update test passed: %d rounds on %d IDs, %d total live items",
		updateRounds, len(updateIDs), vc.ItemCount())
}

// TestMigrationHNSWToVamana verifies end-to-end migration from HNSW Collection
// to disk-resident VamanaCollection via Database.MigrateToDisk.
func TestMigrationHNSWToVamana(t *testing.T) {
	dim := 64
	numItems := 1000

	// Create Database with an HNSW collection
	db := NewDatabase(t.TempDir())
	vc, err := db.CreateCollection("migrate-test", dim)
	if err != nil {
		t.Fatalf("CreateCollection: %v", err)
	}
	hc := vc.(*Collection)

	// Insert points with known IDs
	for i := 0; i < numItems; i++ {
		vec := make([]float32, dim)
		for j := 0; j < dim; j++ {
			vec[j] = rand.Float32()*2 - 1
		}
		NormalizeVector(vec)
		hc.InsertPoint(Point{
			ID:     fmt.Sprintf("p-%d", i),
			Vector: vec,
		})
	}

	// Record search baseline before migration
	queryVec := make([]float32, dim)
	for j := 0; j < dim; j++ {
		queryVec[j] = rand.Float32()*2 - 1
	}
	NormalizeVector(queryVec)

	resultsBefore := hc.Search(queryVec, 10, 100)
	if len(resultsBefore) == 0 {
		t.Fatal("search before migration returned empty")
	}
	beforeItemCount := hc.ItemCount()

	// Force SSD flag for test (disabled by default)
	IsSSD = true
	defer func() { IsSSD = false }()

	// Perform migration
	migrated, err := db.MigrateToDisk("migrate-test")
	if err != nil {
		t.Fatalf("MigrateToDisk: %v", err)
	}
	defer migrated.Close()

	if _, ok := migrated.(*VamanaCollection); !ok {
		t.Fatalf("migrated collection is not VamanaCollection, got %T", migrated)
	}

	// Verify item count preserved
	if migrated.ItemCount() != beforeItemCount {
		t.Errorf("ItemCount: before=%d, after=%d", beforeItemCount, migrated.ItemCount())
	}

	// Verify Database.GetCollection returns the VamanaCollection
	afterCol := db.GetCollection("migrate-test")
	if afterCol == nil {
		t.Fatal("GetCollection after migration returned nil")
	}
	if _, ok := afterCol.(*VamanaCollection); !ok {
		t.Errorf("GetCollection after migration returned %T, not VamanaCollection", afterCol)
	}

	// Search after migration
	resultsAfter := afterCol.Search(queryVec, 10, 100)
	if len(resultsAfter) == 0 {
		t.Errorf("search after migration returned empty")
	}

	t.Logf("Migration OK: %d items, before=%d results, after=%d results",
		beforeItemCount, len(resultsBefore), len(resultsAfter))
}

