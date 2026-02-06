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

// Package vamana implements the Vamana graph index algorithm for approximate nearest neighbor search.
//
// This file implements incremental operations (Insert, Delete) directly on DiskVamanaIndex.
// New vectors are stored in an in-memory append buffer and connected to the existing
// disk-resident graph via greedy search + robust pruning. Deletions use soft-delete
// with OneHop edge repair to maintain graph connectivity.
package vamana

import (
	"bufio"
	"encoding/binary"
	"fmt"
	"math"
	"os"
	"sort"

	"github.com/siyuan-note/siyuan/kernel/vectordb/bbq"
	"github.com/siyuan-note/siyuan/kernel/vectordb/storage"
)

// ============================================================================
// Delete Algorithm Constants (IP-DiskANN inplace_delete parameters)
// ============================================================================

const (
	// DefaultDeleteSearchL is the GreedySearch depth during delete (l_d)
	DefaultDeleteSearchL = 128

	// DefaultDeleteK is the number of closest candidates to retain (k)
	DefaultDeleteK = 50

	// DefaultDeleteC is the number of replacement edges per neighbor (c)
	DefaultDeleteC = 3
)

// ============================================================================
// Unified Accessor Helpers (internal, no lock — caller must hold mu)
// ============================================================================

// getVector returns the vector for a node, from append buffer or disk.
//
// For append nodes (nodeID >= metadata.NumPoints), reads from appendVectors.
// For disk nodes, reads via the mmap reader.
// Returns nil if the node does not exist or read fails.
func (idx *DiskVamanaIndex) getVector(nodeID uint64) []float32 {
	diskN := idx.metadata.NumPoints
	if nodeID >= diskN {
		appendIdx := int(nodeID - diskN)
		if appendIdx < len(idx.appendVectors) {
			return idx.appendVectors[appendIdx]
		}
		return nil
	}

	vec := make([]float32, idx.metadata.Dims)
	if err := idx.reader.ReadVector(nodeID, vec); err != nil {
		return nil
	}
	return vec
}

// getNeighbors returns the neighbor list for a node.
//
// Priority: modifiedNeighbors → appendNeighbors → disk reader.
func (idx *DiskVamanaIndex) getNeighbors(nodeID uint64) []uint32 {
	// Check modified neighbors first (covers both disk and append nodes)
	if idx.modifiedNeighbors != nil {
		if modified, ok := idx.modifiedNeighbors[nodeID]; ok {
			return modified
		}
	}

	diskN := idx.metadata.NumPoints
	if nodeID >= diskN {
		appendIdx := int(nodeID - diskN)
		if appendIdx < len(idx.appendNeighbors) {
			return idx.appendNeighbors[appendIdx]
		}
		return nil
	}

	neighbors, err := idx.reader.ReadNeighbors(nodeID)
	if err != nil {
		return nil
	}
	return neighbors
}

// totalPoints returns the total number of points (disk + append).
func (idx *DiskVamanaIndex) totalPoints() uint64 {
	return idx.metadata.NumPoints + uint64(len(idx.appendVectors))
}

// isAppendNode returns true if nodeID belongs to the append buffer.
func (idx *DiskVamanaIndex) isAppendNode(nodeID uint64) bool {
	return nodeID >= idx.metadata.NumPoints
}

// computeDistanceToQuery computes distance between a stored node and a query vector.
func (idx *DiskVamanaIndex) computeDistanceToQuery(nodeID uint64, query []float32) float32 {
	vec := idx.getVector(nodeID)
	if vec == nil {
		return math.MaxFloat32
	}
	return euclideanDistance(vec, query)
}

// storeNeighbors stores a modified neighbor list for a node.
// Disk nodes go to modifiedNeighbors map; append nodes update appendNeighbors directly.
func (idx *DiskVamanaIndex) storeNeighbors(nodeID uint64, neighbors []uint32) {
	diskN := idx.metadata.NumPoints
	if nodeID >= diskN {
		appendIdx := int(nodeID - diskN)
		if appendIdx < len(idx.appendNeighbors) {
			idx.appendNeighbors[appendIdx] = neighbors
		}
		return
	}

	if idx.modifiedNeighbors == nil {
		idx.modifiedNeighbors = make(map[uint64][]uint32)
	}
	idx.modifiedNeighbors[nodeID] = neighbors
}

// ============================================================================
// Insert Operation
// ============================================================================

// Insert adds a new vector to the index.
//
// The vector is added to an in-memory append buffer and connected to the graph
// using greedy search + robust pruning. Back-edges are added to maintain
// bidirectional connectivity.
//
// Parameters:
//   - vector: The vector to insert (must match index dimension)
//
// Returns the new node ID, or error if:
//   - Vector dimension doesn't match
//   - Index is closed
//
// Thread-safety: Safe for concurrent calls, but inserts are serialized via write lock.
func (idx *DiskVamanaIndex) Insert(vector []float32) (uint64, error) {
	idx.mu.Lock()
	defer idx.mu.Unlock()

	if idx.closed {
		return 0, ErrDiskIndexClosed
	}

	dimension := int(idx.metadata.Dims)
	if len(vector) != dimension {
		return 0, ErrVectorDimensionMismatch
	}

	// Calculate new node ID
	newID := idx.totalPoints()

	// Step 1: Find neighbors using greedy search
	candidates := idx.findNeighborsForInsert(vector)

	// Step 2: Prune neighbors using robust pruning
	R := idx.maxDegree
	prunedNeighbors := idx.robustPruneForInsert(vector, candidates, R)

	// Step 3: Add vector to append buffer
	vectorCopy := make([]float32, len(vector))
	copy(vectorCopy, vector)
	idx.appendVectors = append(idx.appendVectors, vectorCopy)
	idx.appendNeighbors = append(idx.appendNeighbors, prunedNeighbors)

	// Step 4: Compute and store BBQ metadata if enabled
	if idx.bbqHasMeta && idx.bbqCentroid != nil {
		idx.appendBBQForInsert(vector, dimension)
	}

	// Step 5: Add back-edges to neighbors
	idx.addBackEdgesForInsert(newID, prunedNeighbors, R)

	return newID, nil
}

// findNeighborsForInsert finds candidate neighbors for a new vector using greedy search.
func (idx *DiskVamanaIndex) findNeighborsForInsert(vector []float32) []Neighbor {
	scratch := getDiskSearchScratch()
	defer putDiskSearchScratch(scratch)

	total := idx.totalPoints()
	scratch.Visited.EnsureCapacity(int(total))
	scratch.Best.SetCapacity(DefaultInsertSearchL)
	scratch.Reset()

	medoid := idx.metadata.Medoid

	// Initialize with medoid
	if !idx.deleted.IsDeleted(medoid) {
		scratch.Visited.Insert(uint32(medoid))
		dist := idx.computeDistanceToQuery(medoid, vector)
		scratch.Best.Insert(Neighbor{ID: uint32(medoid), Distance: dist})
	}

	// Greedy search
	for scratch.Best.HasUnvisited() {
		closest, ok := scratch.Best.PopClosestUnvisited()
		if !ok {
			break
		}

		neighbors := idx.getNeighbors(uint64(closest.ID))
		for _, neighborID := range neighbors {
			if idx.deleted.IsDeleted(uint64(neighborID)) {
				continue
			}
			if !scratch.Visited.Insert(neighborID) {
				continue
			}
			dist := idx.computeDistanceToQuery(uint64(neighborID), vector)
			scratch.Best.Insert(Neighbor{ID: neighborID, Distance: dist})
		}
	}

	return scratch.Best.All()
}

// robustPruneForInsert applies robust pruning to select final neighbors.
//
// Algorithm:
//  1. Sort candidates by distance
//  2. Greedily select neighbors not "occluded" by already selected ones
//  3. A neighbor is occluded if alpha * dist(selected, candidate) <= dist(query, candidate)
func (idx *DiskVamanaIndex) robustPruneForInsert(
	vector []float32, candidates []Neighbor, R int,
) []uint32 {
	if len(candidates) == 0 {
		return nil
	}

	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].Distance < candidates[j].Distance
	})

	alpha := float32(DefaultInsertAlpha)
	result := make([]uint32, 0, R)
	occluded := make([]bool, len(candidates))

	for i := 0; i < len(candidates) && len(result) < R; i++ {
		if occluded[i] {
			continue
		}

		candidateID := candidates[i].ID
		result = append(result, candidateID)

		candidateVec := idx.getVector(uint64(candidateID))
		if candidateVec == nil {
			continue
		}

		for j := i + 1; j < len(candidates); j++ {
			if occluded[j] {
				continue
			}
			otherVec := idx.getVector(uint64(candidates[j].ID))
			if otherVec == nil {
				continue
			}
			distCandOther := euclideanDistance(candidateVec, otherVec)
			distQueryOther := candidates[j].Distance
			if alpha*distCandOther <= distQueryOther {
				occluded[j] = true
			}
		}
	}

	return result
}

// appendBBQForInsert computes and appends BBQ metadata for a newly inserted vector.
func (idx *DiskVamanaIndex) appendBBQForInsert(vector []float32, dimension int) {
	quantizer := bbq.NewScalarQuantizer(bbq.CosineSimilarity)
	quantized := make([]byte, dimension)
	result := quantizer.Quantize(vector, quantized, 1, idx.bbqCentroid)

	idx.appendBBQLower = append(idx.appendBBQLower, result.LowerBound)
	idx.appendBBQUpper = append(idx.appendBBQUpper, result.UpperBound)
	idx.appendBBQCorr = append(idx.appendBBQCorr, result.Correction)
	idx.appendBBQSumSq = append(idx.appendBBQSumSq, result.QuantizedSum)
}

// addBackEdgesForInsert adds back-edges from neighbors to the new node.
func (idx *DiskVamanaIndex) addBackEdgesForInsert(newID uint64, neighbors []uint32, R int) {
	newIDu32 := uint32(newID)

	for _, neighborID := range neighbors {
		currentNeighbors := idx.getNeighbors(uint64(neighborID))

		if containsID(currentNeighbors, newIDu32) {
			continue
		}

		newNeighbors := make([]uint32, len(currentNeighbors), len(currentNeighbors)+1)
		copy(newNeighbors, currentNeighbors)
		newNeighbors = append(newNeighbors, newIDu32)

		// If exceeds R, prune
		if len(newNeighbors) > R {
			neighborVec := idx.getVector(uint64(neighborID))
			if neighborVec != nil {
				candidateNeighbors := make([]Neighbor, len(newNeighbors))
				for i, nid := range newNeighbors {
					nVec := idx.getVector(uint64(nid))
					if nVec != nil {
						candidateNeighbors[i] = Neighbor{
							ID:       nid,
							Distance: euclideanDistance(neighborVec, nVec),
						}
					} else {
						candidateNeighbors[i] = Neighbor{
							ID:       nid,
							Distance: math.MaxFloat32,
						}
					}
				}
				newNeighbors = idx.robustPruneForInsert(
					neighborVec, candidateNeighbors, R,
				)
			} else {
				newNeighbors = newNeighbors[:R]
			}
		}

		idx.storeNeighbors(uint64(neighborID), newNeighbors)
	}
}

// ============================================================================
// Delete Operation (IP-DiskANN inplace_delete algorithm)
// ============================================================================

// Delete performs soft deletion with full IP-DiskANN inplace_delete edge repair.
//
// Algorithm (6 steps, per IP-DiskANN src/index.cpp L3130-3303):
//  1. GreedySearch with x_p as query → Visited set + Candidates (top-k)
//  2. Find approximate in-neighbors: N'_in(p) = {z ∈ Visited : p ∈ N_out(z)}
//  3. Repair in-edges: for each z ∈ N'_in(p), replace p with closest-c from Candidates
//  4. Repair out-edges: for each w ∈ N_out(p), add reverse edges y→w from Candidates
//  5. Mark deleted, clear neighbors
//  6. RobustPrune any vertex exceeding degree R
//
// Parameters:
//   - nodeID: The node ID to delete
//
// Returns error if:
//   - Node doesn't exist
//   - Node is already deleted
//   - Index is closed
//
// Thread-safety: Safe for concurrent calls, but deletes are serialized via write lock.
func (idx *DiskVamanaIndex) Delete(nodeID uint64) error {
	idx.mu.Lock()
	defer idx.mu.Unlock()

	if idx.closed {
		return ErrDiskIndexClosed
	}

	total := idx.totalPoints()
	if nodeID >= total {
		return storage.ErrNodeNotFound
	}

	if idx.deleted.IsDeleted(nodeID) {
		return ErrNodeAlreadyDeleted
	}

	idx.inplaceDelete(nodeID)
	return nil
}

// inplaceDelete implements the full IP-DiskANN inplace_delete algorithm.
//
// Reference: toread/IP-DiskANN/src/index.cpp L3130-3303
// Caller must hold idx.mu write lock.
func (idx *DiskVamanaIndex) inplaceDelete(p uint64) {
	pVec := idx.getVector(p)
	pu32 := uint32(p)
	R := idx.maxDegree

	// Step 1: GreedySearch with x_p as query → Visited + Candidates(top-k)
	visited, candidates := idx.deleteGreedySearch(pVec)

	// Step 2: Find approximate in-neighbors N'_in(p)
	approxIn := idx.findApproxInNeighbors(p, visited)

	// Step 3: Repair in-edges
	idx.repairInEdges(p, pu32, approxIn, candidates)

	// Step 4: Repair out-edges
	outNeighbors := idx.getNeighbors(p)
	idx.repairOutEdges(p, pu32, outNeighbors, candidates)

	// Step 5: Mark deleted, clear neighbors
	idx.deleted.MarkDeleted(p)
	idx.storeNeighbors(p, nil)

	// Step 6: RobustPrune any vertex exceeding degree R
	idx.pruneAffectedVertices(pu32, approxIn, candidates, R)
}

// deleteGreedySearch runs GreedySearch with the deleted point's vector as query.
// Returns the visited node list and top-k candidates.
func (idx *DiskVamanaIndex) deleteGreedySearch(queryVec []float32) ([]uint32, []Neighbor) {
	scratch := getDiskSearchScratch()
	defer putDiskSearchScratch(scratch)

	total := idx.totalPoints()
	scratch.Visited.EnsureCapacity(int(total))
	scratch.Best.SetCapacity(DefaultDeleteSearchL)
	scratch.Reset()

	// Track visited nodes explicitly (EpochSet has no enumeration method)
	visited := make([]uint32, 0, DefaultDeleteSearchL*2)

	medoid := idx.metadata.Medoid

	if !idx.deleted.IsDeleted(medoid) {
		scratch.Visited.Insert(uint32(medoid))
		visited = append(visited, uint32(medoid))
		dist := idx.computeDistanceToQuery(medoid, queryVec)
		scratch.Best.Insert(Neighbor{ID: uint32(medoid), Distance: dist})
	}

	for scratch.Best.HasUnvisited() {
		closest, ok := scratch.Best.PopClosestUnvisited()
		if !ok {
			break
		}
		neighbors := idx.getNeighbors(uint64(closest.ID))
		for _, nid := range neighbors {
			if idx.deleted.IsDeleted(uint64(nid)) {
				continue
			}
			if !scratch.Visited.Insert(nid) {
				continue
			}
			visited = append(visited, nid)
			dist := idx.computeDistanceToQuery(uint64(nid), queryVec)
			scratch.Best.Insert(Neighbor{ID: nid, Distance: dist})
		}
	}

	// Collect top-k candidates (Best is already sorted by distance)
	allCandidates := scratch.Best.All()
	k := DefaultDeleteK
	if k > len(allCandidates) {
		k = len(allCandidates)
	}
	candidates := make([]Neighbor, k)
	copy(candidates, allCandidates[:k])

	return visited, candidates
}

// findApproxInNeighbors finds approximate in-neighbors of p from the visited set.
// N'_in(p) = {z ∈ Visited : p ∈ N_out(z)}
func (idx *DiskVamanaIndex) findApproxInNeighbors(p uint64, visited []uint32) []uint32 {
	pu32 := uint32(p)
	result := make([]uint32, 0, 16)
	for _, z := range visited {
		if idx.deleted.IsDeleted(uint64(z)) {
			continue
		}
		zNeighbors := idx.getNeighbors(uint64(z))
		if containsID(zNeighbors, pu32) {
			result = append(result, z)
		}
	}
	return result
}

// repairInEdges implements Step 3: repair in-edges for each z ∈ N'_in(p).
// For each z, find closest-c candidates to x_z, then update z's neighbors.
func (idx *DiskVamanaIndex) repairInEdges(
	p uint64, pu32 uint32,
	approxIn []uint32, candidates []Neighbor,
) {
	c := DefaultDeleteC

	for _, z := range approxIn {
		if idx.deleted.IsDeleted(uint64(z)) {
			continue
		}
		zVec := idx.getVector(uint64(z))
		if zVec == nil {
			continue
		}

		// Find closest-c candidates to x_z (excluding p and z)
		cz := idx.closestCFromCandidates(zVec, z, pu32, candidates, c)

		// Update z's neighbors: remove p, add C_z
		current := idx.getNeighbors(uint64(z))
		updated := make([]uint32, 0, len(current)+c)
		for _, n := range current {
			if n != pu32 {
				updated = append(updated, n)
			}
		}
		for _, cand := range cz {
			if !containsID(updated, cand) {
				updated = append(updated, cand)
			}
		}
		idx.storeNeighbors(uint64(z), updated)
	}
}

// repairOutEdges implements Step 4: for each w ∈ N_out(p), add reverse edges.
func (idx *DiskVamanaIndex) repairOutEdges(
	p uint64, pu32 uint32,
	outNeighbors []uint32, candidates []Neighbor,
) {
	c := DefaultDeleteC

	for _, w := range outNeighbors {
		if idx.deleted.IsDeleted(uint64(w)) {
			continue
		}
		wVec := idx.getVector(uint64(w))
		if wVec == nil {
			continue
		}

		// Find closest-c candidates to x_w
		cw := idx.closestCFromCandidates(wVec, w, pu32, candidates, c)

		// For each y ∈ C_w: add edge y → w
		for _, y := range cw {
			yNeighbors := idx.getNeighbors(uint64(y))
			if !containsID(yNeighbors, w) {
				updated := make([]uint32, len(yNeighbors)+1)
				copy(updated, yNeighbors)
				updated[len(yNeighbors)] = w
				idx.storeNeighbors(uint64(y), updated)
			}
		}
	}
}

// closestCFromCandidates returns the closest c candidate IDs to refVec,
// excluding excludeP and excludeSelf from the candidate set.
func (idx *DiskVamanaIndex) closestCFromCandidates(
	refVec []float32, selfID uint32, excludeP uint32,
	candidates []Neighbor, c int,
) []uint32 {
	type scored struct {
		id   uint32
		dist float32
	}
	scored_ := make([]scored, 0, len(candidates))

	for _, cand := range candidates {
		if cand.ID == excludeP || cand.ID == selfID {
			continue
		}
		if idx.deleted.IsDeleted(uint64(cand.ID)) {
			continue
		}
		candVec := idx.getVector(uint64(cand.ID))
		if candVec == nil {
			continue
		}
		d := euclideanDistance(refVec, candVec)
		scored_ = append(scored_, scored{id: cand.ID, dist: d})
	}

	sort.Slice(scored_, func(i, j int) bool {
		return scored_[i].dist < scored_[j].dist
	})

	if c > len(scored_) {
		c = len(scored_)
	}
	result := make([]uint32, c)
	for i := 0; i < c; i++ {
		result[i] = scored_[i].id
	}
	return result
}

// pruneAffectedVertices implements Step 6: prune vertices exceeding degree R.
func (idx *DiskVamanaIndex) pruneAffectedVertices(
	pu32 uint32,
	approxIn []uint32, candidates []Neighbor, R int,
) {
	// Collect unique affected vertices
	seen := make(map[uint32]struct{})
	for _, z := range approxIn {
		seen[z] = struct{}{}
	}
	for _, cand := range candidates {
		if cand.ID != pu32 && !idx.deleted.IsDeleted(uint64(cand.ID)) {
			seen[cand.ID] = struct{}{}
		}
	}

	for v := range seen {
		neighbors := idx.getNeighbors(uint64(v))
		if len(neighbors) <= R {
			continue
		}
		vVec := idx.getVector(uint64(v))
		if vVec == nil {
			continue
		}
		nCands := make([]Neighbor, 0, len(neighbors))
		for _, nid := range neighbors {
			if idx.deleted.IsDeleted(uint64(nid)) {
				continue
			}
			nVec := idx.getVector(uint64(nid))
			d := float32(math.MaxFloat32)
			if nVec != nil {
				d = euclideanDistance(vVec, nVec)
			}
			nCands = append(nCands, Neighbor{ID: nid, Distance: d})
		}
		pruned := idx.robustPruneForInsert(vVec, nCands, R)
		idx.storeNeighbors(uint64(v), pruned)
	}
}

// ============================================================================
// Compact Operation
// ============================================================================

// Compact creates a new compacted index at newPath, merging disk data and
// append buffer while removing soft-deleted nodes.
//
// The compaction process:
//  1. Builds oldID → newID mapping (skipping deleted nodes)
//  2. Collects vectors and remapped neighbors for all active nodes
//  3. Writes a new .index file and optional .bbq file to newPath
//
// The current index is NOT modified. The caller should close this index
// and open the new one after successful compaction.
//
// Parameters:
//   - newPath: Base path for the new compacted index (without extension)
//
// Returns error if:
//   - Index is closed
//   - File creation or write fails
//
// Thread-safety: Safe for concurrent calls with Search, but only one
// Compact should run at a time.
func (idx *DiskVamanaIndex) Compact(newPath string) (*CompactResult, error) {
	idx.mu.RLock()
	if idx.closed {
		idx.mu.RUnlock()
		return nil, ErrDiskIndexClosed
	}
	idx.mu.RUnlock()

	return idx.doCompact(newPath)
}

// doCompact performs the actual compaction work.
func (idx *DiskVamanaIndex) doCompact(newPath string) (*CompactResult, error) {
	idx.mu.RLock()
	dimension := int(idx.metadata.Dims)
	totalPts := idx.totalPoints()
	idx.mu.RUnlock()

	// Step 1: Build oldID → newID mapping, skipping deleted nodes
	oldToNew := make(map[uint64]uint32)
	var newID uint32

	for oldID := uint64(0); oldID < totalPts; oldID++ {
		if !idx.deleted.IsDeleted(oldID) {
			oldToNew[oldID] = newID
			newID++
		}
	}

	remainingPoints := uint64(newID)
	deletedPoints := totalPts - remainingPoints

	if remainingPoints == 0 {
		return &CompactResult{
			OriginalPoints:  totalPts,
			RemainingPoints: 0,
			DeletedPoints:   deletedPoints,
			NewIndexPath:    newPath,
		}, nil
	}

	// Step 2: Collect vectors and remapped neighbors
	vectors := make([][]float32, remainingPoints)
	neighbors := make([][]uint32, remainingPoints)

	idx.mu.RLock()
	for oldID := uint64(0); oldID < totalPts; oldID++ {
		if idx.deleted.IsDeleted(oldID) {
			continue
		}
		newIdx := oldToNew[oldID]

		vectors[newIdx] = idx.getVector(oldID)

		oldNeighbors := idx.getNeighbors(oldID)
		remapped := make([]uint32, 0, len(oldNeighbors))
		for _, oldNID := range oldNeighbors {
			if mappedID, ok := oldToNew[uint64(oldNID)]; ok {
				remapped = append(remapped, mappedID)
			}
		}
		neighbors[newIdx] = remapped
	}
	idx.mu.RUnlock()

	// Step 3: Determine new medoid
	oldMedoid := idx.metadata.Medoid
	var newMedoid uint32
	if mapped, ok := oldToNew[oldMedoid]; ok {
		newMedoid = mapped
	}

	// Step 4: Write compacted index file
	if err := idx.writeCompactedIndexFile(
		newPath, vectors, neighbors, newMedoid, dimension,
	); err != nil {
		return nil, fmt.Errorf("failed to write compacted index: %w", err)
	}

	// Step 5: Write BBQ file if enabled
	if idx.bbqHasMeta && idx.bbqCentroid != nil {
		if err := idx.writeCompactedBBQFile(
			newPath, vectors, dimension,
		); err != nil {
			return nil, fmt.Errorf("failed to write compacted BBQ: %w", err)
		}
	}

	return &CompactResult{
		OriginalPoints:  totalPts,
		RemainingPoints: remainingPoints,
		DeletedPoints:   deletedPoints,
		NewIndexPath:    newPath,
	}, nil
}

// writeCompactedIndexFile writes the main index file for compacted data.
func (idx *DiskVamanaIndex) writeCompactedIndexFile(
	path string,
	vectors [][]float32,
	neighbors [][]uint32,
	medoid uint32,
	dimension int,
) error {
	indexPath := path + diskIndexExt

	f, err := os.Create(indexPath)
	if err != nil {
		return err
	}
	defer f.Close()

	w := bufio.NewWriterSize(f, DefaultWriteBufferSize)

	numPoints := uint64(len(vectors))
	dims := uint64(dimension)

	// Calculate max degree from neighbors
	maxDegree := idx.maxDegree
	for _, n := range neighbors {
		if len(n) > maxDegree {
			maxDegree = len(n)
		}
	}

	actualMaxDegree := uint64(maxDegree)

	// Calculate node length: vector(dims*4) + neighborCount(4) + neighbors(maxDegree*4)
	nodeLen := dims*4 + 4 + actualMaxDegree*4
	blockSize := uint64(SectorSize)
	nodesPerBlock := blockSize / nodeLen
	if nodesPerBlock == 0 {
		nodesPerBlock = 1
	}

	// Calculate total file size
	numBlocks := (numPoints + nodesPerBlock - 1) / nodesPerBlock
	dataSize := numBlocks * nodesPerBlock * nodeLen
	totalSize := blockSize + dataSize

	// Build header
	header := &storage.GraphHeader{
		Meta: storage.GraphMetadata{
			NumPoints:       numPoints,
			Dims:            dims,
			Medoid:          uint64(medoid),
			NodeLen:         nodeLen,
			NodesPerBlock:   nodesPerBlock,
			FrozenNum:       0,
			FrozenLoc:       0,
			Reserved:        0,
			IndexFileSize:   totalSize,
			AssocDataLength: 0,
		},
		BlockSize: blockSize,
		Version: storage.LayoutVersion{
			Major: storage.CurrentMajorVersion,
			Minor: storage.CurrentMinorVersion,
		},
	}

	// Write header
	if err := storage.WriteGraphHeader(w, header); err != nil {
		return err
	}

	// Pad header block to blockSize
	headerWritten := 4 + 80 + 8 + 8 // magic + metadata + blockSize + version
	padding := make([]byte, blockSize-uint64(headerWritten))
	if _, err := w.Write(padding); err != nil {
		return err
	}

	// Write node data
	nodeData := make([]byte, nodeLen)
	for i := uint64(0); i < numPoints; i++ {
		serializeNode(vectors[i], neighbors[i], nodeData, maxDegree)
		if _, err := w.Write(nodeData); err != nil {
			return err
		}
	}

	// Pad last block
	remainder := numPoints % nodesPerBlock
	if remainder != 0 {
		paddingNodes := nodesPerBlock - remainder
		emptyNode := make([]byte, nodeLen)
		for i := uint64(0); i < paddingNodes; i++ {
			if _, err := w.Write(emptyNode); err != nil {
				return err
			}
		}
	}

	if err := w.Flush(); err != nil {
		return err
	}

	return f.Sync()
}

// serializeNode serializes a single node (vector + neighbors) into buf.
func serializeNode(
	vector []float32,
	neighbors []uint32,
	buf []byte,
	maxDegree int,
) {
	offset := 0

	// Write vector
	for _, v := range vector {
		binary.LittleEndian.PutUint32(buf[offset:], math.Float32bits(v))
		offset += 4
	}

	// Write neighbor count
	binary.LittleEndian.PutUint32(buf[offset:], uint32(len(neighbors)))
	offset += 4

	// Write neighbor IDs
	for _, n := range neighbors {
		binary.LittleEndian.PutUint32(buf[offset:], n)
		offset += 4
	}

	// Fill unused slots with sentinel
	for i := len(neighbors); i < maxDegree; i++ {
		binary.LittleEndian.PutUint32(buf[offset:], 0xFFFFFFFF)
		offset += 4
	}
}

// writeCompactedBBQFile writes the BBQ file for compacted data.
//
// Re-quantizes all vectors using the existing centroid and writes
// a version 2 BBQ file with full metadata.
func (idx *DiskVamanaIndex) writeCompactedBBQFile(
	path string,
	vectors [][]float32,
	dimension int,
) error {
	bbqPath := path + diskBBQExt

	f, err := os.Create(bbqPath)
	if err != nil {
		return err
	}
	defer f.Close()

	w := bufio.NewWriter(f)

	numPoints := uint64(len(vectors))
	packedSize := (dimension + 7) / 8

	// Write header (24 bytes for version 2)
	header := make([]byte, bbqHeaderSizeV2)
	binary.LittleEndian.PutUint32(header[0:], bbqMagic)
	binary.LittleEndian.PutUint32(header[4:], bbqVersionWithMeta)
	binary.LittleEndian.PutUint64(header[8:], numPoints)
	binary.LittleEndian.PutUint32(header[16:], uint32(dimension))
	binary.LittleEndian.PutUint32(header[20:], 0) // Reserved

	if _, err := w.Write(header); err != nil {
		return err
	}

	// Write centroid
	centroidBuf := make([]byte, dimension*4)
	for i, v := range idx.bbqCentroid {
		binary.LittleEndian.PutUint32(
			centroidBuf[i*4:], math.Float32bits(v),
		)
	}
	if _, err := w.Write(centroidBuf); err != nil {
		return err
	}

	// Quantize all vectors and write packed codes
	quantizer := bbq.NewScalarQuantizer(bbq.CosineSimilarity)
	quantized := make([]byte, dimension)
	lowerBounds := make([]float32, numPoints)
	upperBounds := make([]float32, numPoints)
	corrections := make([]float32, numPoints)
	quantizedSums := make([]float32, numPoints)

	for i, vec := range vectors {
		result := quantizer.Quantize(
			vec, quantized, 1, idx.bbqCentroid,
		)
		packed := bbq.PackBinary(quantized)

		if _, err := w.Write(packed[:packedSize]); err != nil {
			return err
		}

		lowerBounds[i] = result.LowerBound
		upperBounds[i] = result.UpperBound
		corrections[i] = result.Correction
		quantizedSums[i] = result.QuantizedSum
	}

	// Write metadata arrays
	metaBuf := make([]byte, 4)

	for _, v := range lowerBounds {
		binary.LittleEndian.PutUint32(metaBuf, math.Float32bits(v))
		if _, err := w.Write(metaBuf); err != nil {
			return err
		}
	}

	for _, v := range upperBounds {
		binary.LittleEndian.PutUint32(metaBuf, math.Float32bits(v))
		if _, err := w.Write(metaBuf); err != nil {
			return err
		}
	}

	for _, v := range corrections {
		binary.LittleEndian.PutUint32(metaBuf, math.Float32bits(v))
		if _, err := w.Write(metaBuf); err != nil {
			return err
		}
	}

	for _, v := range quantizedSums {
		binary.LittleEndian.PutUint32(metaBuf, math.Float32bits(v))
		if _, err := w.Write(metaBuf); err != nil {
			return err
		}
	}

	if err := w.Flush(); err != nil {
		return err
	}

	return f.Sync()
}
