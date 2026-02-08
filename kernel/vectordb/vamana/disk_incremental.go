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
	"sync"
	"unsafe"

	"github.com/siyuan-note/siyuan/kernel/vectordb/bbq"
	"github.com/siyuan-note/siyuan/kernel/vectordb/storage"
)

// ============================================================================
// Incremental Operation Errors
// ============================================================================

var (
	// ErrVectorDimensionMismatch indicates vector dimension does not match index
	ErrVectorDimensionMismatch = fmt.Errorf("vector dimension mismatch")

	// ErrNodeAlreadyDeleted indicates the node is already deleted
	ErrNodeAlreadyDeleted = fmt.Errorf("node already deleted")

	// ErrCompactionInProgress indicates a compaction is already in progress
	ErrCompactionInProgress = fmt.Errorf("compaction already in progress")
)

// ============================================================================
// CompactResult
// ============================================================================

// CompactResult contains statistics from the compaction process.
type CompactResult struct {
	OriginalPoints  uint64 // Points before compaction
	RemainingPoints uint64 // Points after compaction
	DeletedPoints   uint64 // Number of deleted points removed
	NewIndexPath    string // Path to the new compacted index
}

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

	// Zero-copy: ReadVectorRef returns unsafe.Slice into mmap region,
	// equivalent to C++ _data_store->get_vector() pointer arithmetic.
	// No allocation, no per-element copy.
	vec, err := idx.reader.ReadVectorRef(nodeID)
	if err != nil {
		return nil
	}
	return vec
}

// vectorCache is a per-operation cache for vectors read during a single Delete operation.
// It avoids redundant mmap reads and memory allocations when the same vector is accessed
// multiple times across deleteGreedySearch, repairInEdges, repairOutEdges, and pruneAffectedVertices.
type vectorCache map[uint64][]float32

// getCachedVector returns the vector for nodeID, using the cache to avoid repeated mmap reads.
// On cache miss, it delegates to getVector and stores the result (including nil) in the cache.
func (idx *DiskVamanaIndex) getCachedVector(nodeID uint64, cache vectorCache) []float32 {
	if vec, ok := cache[nodeID]; ok {
		return vec
	}
	vec := idx.getVector(nodeID)
	cache[nodeID] = vec
	return vec
}

// normSqCache is a per-operation cache for vector norm² values during a single Delete operation.
// CPU profile shows dotProduct() occupies 63-68% CPU; the root cause is that euclideanDistance(a, b)
// calls dotProduct 3 times (2× normSq + 1× dot), and robustPruneSimple's O(n²) occlude loop
// has no normSq caching. This cache reduces dotProduct calls from 3 to 1 per distance computation
// when both vectors' normSq are cached.
type normSqCache map[uint64]float32

// getCachedNormSq returns the cached norm² for nodeID. On cache miss, it computes normSq
// from the provided vector and stores it. The vec parameter must be the vector for nodeID
// (caller is responsible for providing the correct vector, typically from getCachedVector).
func getCachedNormSq(nodeID uint64, vec []float32, cache normSqCache) float32 {
	if ns, ok := cache[nodeID]; ok {
		return ns
	}
	ns := computeNormSquare(vec)
	cache[nodeID] = ns
	return ns
}

// getNeighbors returns the neighbor list for a node.
//
// Priority: modifiedNeighbors (sync.Map) → appendNeighbors → disk reader.
//
// Caller must hold idx.mu (at least read lock) to protect appendNeighbors access.
// modifiedNeighbors uses sync.Map for lock-free atomic Load, eliminating the
// RWMutex overhead that caused timeout under -race in the Delete path.
func (idx *DiskVamanaIndex) getNeighbors(nodeID uint64) []uint32 {
	// Check modified neighbors first (covers both disk and append nodes)
	if v, ok := idx.modifiedNeighbors.Load(nodeID); ok {
		return v.([]uint32)
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

// computeDistanceToQuery 计算存储节点与查询向量之间的距离。
// 内部委托给 computeDistance，自动计算 queryNormSq。
// 适用于无法预计算查询范数的场景（如增量操作中查询向量频繁变化）。
func (idx *DiskVamanaIndex) computeDistanceToQuery(nodeID uint64, query []float32) float32 {
	return idx.computeDistance(nodeID, query, computeNormSquare(query))
}

// storeNeighbors stores a modified neighbor list for a node.
// All mutations go through modifiedNeighbors (sync.Map), which provides
// internally-synchronized Store operations without explicit locking.
func (idx *DiskVamanaIndex) storeNeighbors(nodeID uint64, neighbors []uint32) {
	idx.modifiedNeighbors.Store(nodeID, neighbors)
}

// ============================================================================
// Insert Operation
// ============================================================================

// Insert adds a new vector to the index using a Lock-Snapshot-Unlock pattern.
//
// The operation is split into four phases to minimize global lock hold time:
//   - Phase 1 (write lock): Validate, allocate ID, append vector, expand nodeLocks
//   - Phase 2 (read lock):  Greedy search + robust pruning (no write lock held)
//   - Phase 3 (write lock): Write neighbors and BBQ metadata
//   - Phase 4 (write lock): Add back-edges (will be refined in Task 3)
//
// Parameters:
//   - vector: The vector to insert (must match index dimension)
//
// Returns the new node ID, or error if:
//   - Vector dimension doesn't match
//   - Index is closed
//
// Thread-safety: Safe for concurrent calls. Greedy search runs under read lock,
// allowing concurrent Search operations to proceed.
func (idx *DiskVamanaIndex) Insert(vector []float32) (uint64, error) {
	// ── Phase 1 (write lock): validate, allocate ID, append vector ──
	idx.mu.Lock()

	if idx.closed {
		idx.mu.Unlock()
		return 0, ErrDiskIndexClosed
	}

	dimension := int(idx.metadata.Dims)
	if len(vector) != dimension {
		idx.mu.Unlock()
		return 0, ErrVectorDimensionMismatch
	}

	// Calculate new node ID while holding write lock
	newID := idx.totalPoints()

	// Add vector to append buffer (must be under write lock because
	// getVector may concurrently read appendVectors)
	vectorCopy := make([]float32, len(vector))
	copy(vectorCopy, vector)
	idx.appendVectors = append(idx.appendVectors, vectorCopy)

	// Expand nodeLocks for the new node (write lock ensures no concurrent access)
	if int(newID) >= len(idx.nodeLocks) {
		newLocks := make([]sync.RWMutex, newID+1)
		copy(newLocks, idx.nodeLocks)
		idx.nodeLocks = newLocks
	}

	// Snapshot immutable values needed for Phase 2
	R := idx.maxDegree

	idx.mu.Unlock()

	// ── Phase 2 (read lock): greedy search + robust pruning ──
	// Read lock allows concurrent Search operations to proceed.
	// getVector/getNeighbors access appendVectors/appendNeighbors/modifiedNeighbors
	// which require at least a read lock for safe concurrent access.
	idx.mu.RLock()
	candidates := idx.findNeighborsForInsert(vector)
	prunedNeighbors := robustPruneSimple(candidates, R, DefaultInsertAlpha, idx.getVector)
	idx.mu.RUnlock()

	// ── Phase 3 (write lock): write neighbors + BBQ metadata ──
	idx.mu.Lock()

	// Write pruned neighbors for the new node into append buffer.
	// The slot at appendNeighbors[newID - diskN] was not yet allocated in Phase 1
	// (only appendVectors was extended), so we append it now.
	idx.appendNeighbors = append(idx.appendNeighbors, prunedNeighbors)

	// Compute and store BBQ metadata if enabled
	if idx.bbqHasMeta && idx.bbqCentroid != nil {
		idx.appendBBQForInsert(vector, dimension)
	}

	idx.mu.Unlock()

	// ── Phase 4 (no global lock): add back-edges with node-level locking ──
	// addBackEdgesForInsert uses per-node locks (nodeLocks) and sync.Map
	// internally, so no global write lock is needed here.
	idx.addBackEdgesForInsert(newID, prunedNeighbors, R)

	return newID, nil
}

// findNeighborsForInsert finds candidate neighbors for a new vector using greedy search.
// Caller must hold idx.mu (at least read lock) to protect appendVectors/appendNeighbors/modifiedNeighbors.
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

// robustPruneSimple applies robust pruning to select final neighbors.
//
// This is a package-level function used by DiskVamanaIndex incremental operations.
// It uses a getVec callback to retrieve vectors, making it independent of any
// specific index type.
//
// Algorithm:
//  1. Sort candidates by distance
//  2. Greedily select neighbors not "occluded" by already selected ones
//  3. A neighbor is occluded if alpha * dist(selected, candidate) <= dist(query, candidate)
//
// Parameters:
//   - candidates: neighbor candidates with precomputed distances to query
//   - R: maximum number of neighbors to select
//   - alpha: pruning threshold (typically DefaultInsertAlpha)
//   - getVec: function to retrieve vector by node ID (returns nil if unavailable)
func robustPruneSimple(
	candidates []Neighbor, R int, alpha float32,
	getVec func(uint64) []float32,
) []uint32 {
	if len(candidates) == 0 {
		return nil
	}

	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].Distance < candidates[j].Distance
	})

	result := make([]uint32, 0, R)
	occluded := make([]bool, len(candidates))

	for i := 0; i < len(candidates) && len(result) < R; i++ {
		if occluded[i] {
			continue
		}

		candidateID := candidates[i].ID
		result = append(result, candidateID)

		candidateVec := getVec(uint64(candidateID))
		if candidateVec == nil {
			continue
		}

		for j := i + 1; j < len(candidates); j++ {
			if occluded[j] {
				continue
			}
			otherVec := getVec(uint64(candidates[j].ID))
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

// robustPruneSimpleWithNorm is the normSq-cached variant of robustPruneSimple.
//
// The O(n²) occlude loop is the dominant CPU hotspot in Delete operations.
// Original euclideanDistance(a, b) calls dotProduct 3 times per pair (2× normSq + 1× dot).
// This variant uses getNormSq callback to retrieve cached normSq values, reducing
// each distance computation to a single dotProduct call via euclideanDistanceWithNorms.
//
// Parameters:
//   - candidates: neighbor candidates with precomputed distances to query
//   - R: maximum number of neighbors to select
//   - alpha: pruning threshold (typically DefaultInsertAlpha)
//   - getVec: function to retrieve vector by node ID (returns nil if unavailable)
//   - getNormSq: function to retrieve cached normSq for a node ID + vector pair
func robustPruneSimpleWithNorm(
	candidates []Neighbor, R int, alpha float32,
	getVec func(uint64) []float32,
	getNormSq func(uint64, []float32) float32,
) []uint32 {
	if len(candidates) == 0 {
		return nil
	}

	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].Distance < candidates[j].Distance
	})

	n := len(candidates)

	// Pre-fetch all vectors and normSq into local slices before the O(n²) loop.
	// This reduces map accesses (via getVec/getNormSq closures) from O(n²) to O(n),
	// which is critical under -race where each map operation has ~10x overhead.
	vecs := make([][]float32, n)
	norms := make([]float32, n)
	for i := 0; i < n; i++ {
		v := getVec(uint64(candidates[i].ID))
		vecs[i] = v
		if v != nil {
			norms[i] = getNormSq(uint64(candidates[i].ID), v)
		}
	}

	result := make([]uint32, 0, R)
	occluded := make([]bool, n)

	for i := 0; i < n && len(result) < R; i++ {
		if occluded[i] {
			continue
		}

		result = append(result, candidates[i].ID)

		candidateVec := vecs[i]
		if candidateVec == nil {
			continue
		}
		candidateNormSq := norms[i]

		for j := i + 1; j < n; j++ {
			if occluded[j] {
				continue
			}
			otherVec := vecs[j]
			if otherVec == nil {
				continue
			}
			distCandOther := euclideanDistanceWithNorms(candidateVec, otherVec, candidateNormSq, norms[j])
			if alpha*distCandOther <= candidates[j].Distance {
				occluded[j] = true
			}
		}
	}

	return result
}

// appendBBQForInsert computes and appends BBQ metadata for a newly inserted vector.
func (idx *DiskVamanaIndex) appendBBQForInsert(vector []float32, dimension int) {
	quantizer := bbq.NewScalarQuantizer(idx.distanceMetric)
	quantized := make([]byte, dimension)
	result := quantizer.Quantize(vector, quantized, 1, idx.bbqCentroid)

	idx.appendBBQLower = append(idx.appendBBQLower, result.LowerBound)
	idx.appendBBQUpper = append(idx.appendBBQUpper, result.UpperBound)
	idx.appendBBQCorr = append(idx.appendBBQCorr, result.Correction)
	idx.appendBBQSumSq = append(idx.appendBBQSumSq, result.QuantizedSum)
}

// addBackEdgesForInsert adds back-edges from neighbors to the new node.
//
// Uses per-node locking (nodeLocks) instead of global write lock.
// Lock order: idx.mu (RLock) → idx.nodeLocks[id] (Lock) → storeNeighbors (sync.Map.Store).
// This allows concurrent Insert operations to proceed on different neighbor nodes.
func (idx *DiskVamanaIndex) addBackEdgesForInsert(newID uint64, neighbors []uint32, R int) {
	newIDu32 := uint32(newID)

	for _, neighborID := range neighbors {
		idx.addBackEdgeForNode(uint64(neighborID), newIDu32, R)
	}
}

// addBackEdgeForNode adds a back-edge from neighborID to newIDu32, pruning if needed.
//
// Lock strategy: lock-copy-unlock-prune-lock-write (IP-DiskANN inter_insert pattern).
// Avoids holding nodeLocks and idx.mu simultaneously to prevent write-lock starvation
// when concurrent Insert() calls need idx.mu.Lock() in Phase 1/3.
//
//   - Phase 1 (nodeLocks + mu.RLock): quick check + copy neighbor list, then release both
//   - Phase 2 (mu.RLock only): distance computation + robustPrune (no nodeLocks held)
//   - Phase 3 (nodeLocks only): write pruned result via storeNeighbors
func (idx *DiskVamanaIndex) addBackEdgeForNode(neighborID uint64, newIDu32 uint32, R int) {
	// ── Phase 1 (mu.RLock → nodeLock → read → unlock both): quick check + copy ──
	// Must acquire mu.RLock first to safely access nodeLocks slice (Insert Phase 1
	// may reallocate nodeLocks under mu.Lock). Capture the lock pointer to ensure
	// Lock/Unlock operate on the same mutex instance.
	idx.mu.RLock()
	nodeLock := &idx.nodeLocks[neighborID]
	nodeLock.Lock()

	currentNeighbors := idx.getNeighbors(neighborID)

	if containsID(currentNeighbors, newIDu32) {
		nodeLock.Unlock()
		idx.mu.RUnlock()
		return
	}

	needsPrune := len(currentNeighbors) >= R

	if !needsPrune {
		// Fast path: under capacity, append directly
		newNeighbors := make([]uint32, len(currentNeighbors)+1)
		copy(newNeighbors, currentNeighbors)
		newNeighbors[len(currentNeighbors)] = newIDu32
		// storeNeighbors must be called under nodeLock for append nodes
		idx.storeNeighbors(neighborID, newNeighbors)
		nodeLock.Unlock()
		idx.mu.RUnlock()
		return
	}

	// Copy neighbor list for pruning outside locks
	copyOfNeighbors := make([]uint32, len(currentNeighbors)+1)
	copy(copyOfNeighbors, currentNeighbors)
	copyOfNeighbors[len(currentNeighbors)] = newIDu32

	nodeLock.Unlock()
	idx.mu.RUnlock()

	// ── Phase 2 (mu.RLock only): distance computation + prune ──
	idx.mu.RLock()
	neighborVec := idx.getVector(neighborID)
	var newNeighbors []uint32
	if neighborVec != nil {
		candidateNeighbors := make([]Neighbor, len(copyOfNeighbors))
		for i, nid := range copyOfNeighbors {
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
		newNeighbors = robustPruneSimple(
			candidateNeighbors, R, DefaultInsertAlpha, idx.getVector,
		)
	} else {
		newNeighbors = copyOfNeighbors[:R]
	}
	idx.mu.RUnlock()

	// ── Phase 3 (mu.RLock → nodeLock): write result ──
	// Re-acquire mu.RLock to safely access nodeLocks slice, then nodeLock for write.
	idx.mu.RLock()
	nodeLock = &idx.nodeLocks[neighborID]
	nodeLock.Lock()
	idx.storeNeighbors(neighborID, newNeighbors)
	nodeLock.Unlock()
	idx.mu.RUnlock()
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
//
// Performance: creates a per-operation vectorCache to avoid redundant mmap reads
// across the ~300万 getVector calls in a typical delete. The cache is scoped to
// this single delete and released when the method returns.
func (idx *DiskVamanaIndex) inplaceDelete(p uint64) {
	// Create per-operation vector cache (typical capacity: visited + candidates + neighbors)
	cache := make(vectorCache, DefaultDeleteSearchL*3)
	// Create per-operation normSq cache to eliminate redundant dotProduct calls.
	// In the original code, euclideanDistance(a, b) calls dotProduct 3 times per invocation.
	// With normSq caching, robustPruneSimple's O(n²) occlude loop drops to 1 dotProduct per pair.
	nsCache := make(normSqCache, DefaultDeleteSearchL*3)

	pVec := idx.getCachedVector(p, cache)
	pu32 := uint32(p)
	R := idx.maxDegree

	// Precompute query norm² once for the entire delete operation.
	// This avoids ~300万 redundant computeNormSquare(query) calls in
	// deleteGreedySearch → computeDistanceToQuery path.
	queryNormSq := computeNormSquare(pVec)
	nsCache[p] = queryNormSq

	// Step 1: GreedySearch with x_p as query → Visited + Candidates(top-k)
	visited, candidates := idx.deleteGreedySearch(pVec, queryNormSq, cache, nsCache)

	// Step 2: Find approximate in-neighbors N'_in(p)
	approxIn := idx.findApproxInNeighbors(p, visited)

	// Step 3: Repair in-edges
	idx.repairInEdges(p, pu32, approxIn, candidates, cache, nsCache)

	// Step 4: Repair out-edges
	outNeighbors := idx.getNeighbors(p)
	idx.repairOutEdges(p, pu32, outNeighbors, candidates, cache, nsCache)

	// Step 5: Mark deleted, clear neighbors
	idx.deleted.MarkDeleted(p)
	idx.storeNeighbors(p, nil)

	// Step 6: RobustPrune any vertex exceeding degree R
	idx.pruneAffectedVertices(pu32, approxIn, candidates, R, cache, nsCache)
}

// deleteGreedySearch runs GreedySearch with the deleted point's vector as query.
// Returns the visited node list and top-k candidates.
//
// Performance: uses precomputed queryNormSq to avoid redundant norm calculations,
// populates the vectorCache with vectors read during traversal for reuse in
// subsequent edge repair steps, and warms the normSqCache with normSq values
// computed during distance calculations (via computeDistance → euclideanDistanceWithNorm).
func (idx *DiskVamanaIndex) deleteGreedySearch(
	queryVec []float32, queryNormSq float32, cache vectorCache, nsCache normSqCache,
) ([]uint32, []Neighbor) {
	scratch := getDiskSearchScratch()
	defer putDiskSearchScratch(scratch)

	total := idx.totalPoints()
	scratch.Visited.EnsureCapacity(int(total))
	scratch.Best.SetCapacity(DefaultDeleteSearchL)
	scratch.Reset()

	// Track expanded nodes (nodes popped from Best and whose neighbors were explored).
	// This corresponds to C++ DiskANN's expanded_nodes/pool(), NOT all discovered nodes.
	// Only expanded nodes are used for findApproxInNeighbors, keeping the list bounded
	// by DefaultDeleteSearchL instead of growing to thousands of nodes.
	expanded := make([]uint32, 0, DefaultDeleteSearchL)

	medoid := idx.metadata.Medoid

	if !idx.deleted.IsDeletedUnsafe(medoid) {
		scratch.Visited.Insert(uint32(medoid))
		medoidVec := idx.getCachedVector(medoid, cache)
		if medoidVec != nil {
			medoidNormSq := getCachedNormSq(medoid, medoidVec, nsCache)
			dist := euclideanDistanceWithNorms(medoidVec, queryVec, medoidNormSq, queryNormSq)
			scratch.Best.Insert(Neighbor{ID: uint32(medoid), Distance: dist})
		}
	}

	for scratch.Best.HasUnvisited() {
		closest, ok := scratch.Best.PopClosestUnvisited()
		if !ok {
			break
		}
		// Record expanded node (popped from Best and about to explore neighbors)
		expanded = append(expanded, closest.ID)
		neighbors := idx.getNeighbors(uint64(closest.ID))
		for _, nid := range neighbors {
			if idx.deleted.IsDeletedUnsafe(uint64(nid)) {
				continue
			}
			if !scratch.Visited.Insert(nid) {
				continue
			}
			// Use getCachedVector to read the vector once, then compute distance directly.
			// This eliminates the double-read: computeDistance called getVector (alloc + mmap),
			// then getCachedVector read the same vector again.
			nVec := idx.getCachedVector(uint64(nid), cache)
			if nVec == nil {
				continue
			}
			nNormSq := getCachedNormSq(uint64(nid), nVec, nsCache)
			dist := euclideanDistanceWithNorms(nVec, queryVec, nNormSq, queryNormSq)
			scratch.Best.Insert(Neighbor{ID: nid, Distance: dist})
		}
	}

	// Collect top-k candidates (Best is already sorted by distance)
	allCandidates := scratch.Best.All()
	k := idx.deleteK
	if k > len(allCandidates) {
		k = len(allCandidates)
	}
	candidates := make([]Neighbor, k)
	copy(candidates, allCandidates[:k])

	return expanded, candidates
}

// findApproxInNeighbors finds approximate in-neighbors of p from the visited set.
// N'_in(p) = {z ∈ Visited : p ∈ N_out(z)}
func (idx *DiskVamanaIndex) findApproxInNeighbors(p uint64, visited []uint32) []uint32 {
	pu32 := uint32(p)
	result := make([]uint32, 0, 16)
	for _, z := range visited {
		if idx.deleted.IsDeletedUnsafe(uint64(z)) {
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
	cache vectorCache, nsCache normSqCache,
) {
	c := idx.deleteC

	for _, z := range approxIn {
		if idx.deleted.IsDeletedUnsafe(uint64(z)) {
			continue
		}
		zVec := idx.getCachedVector(uint64(z), cache)
		if zVec == nil {
			continue
		}

		// Find closest-c candidates to x_z (excluding p and z)
		cz := idx.closestCFromCandidates(zVec, z, pu32, candidates, c, cache, nsCache)

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
	cache vectorCache, nsCache normSqCache,
) {
	c := idx.deleteC

	for _, w := range outNeighbors {
		if idx.deleted.IsDeletedUnsafe(uint64(w)) {
			continue
		}
		wVec := idx.getCachedVector(uint64(w), cache)
		if wVec == nil {
			continue
		}

		// Find closest-c candidates to x_w
		cw := idx.closestCFromCandidates(wVec, w, pu32, candidates, c, cache, nsCache)

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
//
// Performance: precomputes refNormSq once outside the loop and uses
// euclideanDistanceWithNorms with cached candidate normSq values,
// reducing dotProduct calls from 3 to 1 per distance computation.
func (idx *DiskVamanaIndex) closestCFromCandidates(
	refVec []float32, selfID uint32, excludeP uint32,
	candidates []Neighbor, c int,
	cache vectorCache, nsCache normSqCache,
) []uint32 {
	type scored struct {
		id   uint32
		dist float32
	}
	scored_ := make([]scored, 0, len(candidates))

	// Precompute refVec normSq once for all candidate distance computations
	refNormSq := getCachedNormSq(uint64(selfID), refVec, nsCache)

	for _, cand := range candidates {
		if cand.ID == excludeP || cand.ID == selfID {
			continue
		}
		if idx.deleted.IsDeletedUnsafe(uint64(cand.ID)) {
			continue
		}
		candVec := idx.getCachedVector(uint64(cand.ID), cache)
		if candVec == nil {
			continue
		}
		candNormSq := getCachedNormSq(uint64(cand.ID), candVec, nsCache)
		d := euclideanDistanceWithNorms(refVec, candVec, refNormSq, candNormSq)
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

// pruneAffectedVertices implements Step 6: prune vertices exceeding degree threshold.
//
// Uses deletePruneSlackFactor to allow nodes to temporarily exceed R after delete repair.
// Only triggers pruning when degree > SlackFactor * R, and prunes back down to R.
// This matches the GraphSlackFactor strategy used during build (see config.go).
//
// Performance: uses normSq cache to avoid redundant dotProduct calls in both
// the distance computation loop and the robustPruneSimple occlude loop.
func (idx *DiskVamanaIndex) pruneAffectedVertices(
	pu32 uint32,
	approxIn []uint32, candidates []Neighbor, R int,
	cache vectorCache, nsCache normSqCache,
) {
	// 使用松弛因子计算剪枝触发阈值：仅当度数超过 slackR 时才触发剪枝，
	// 剪枝目标仍为 R。这允许删除修复后的节点临时保留额外边，
	// 避免过早剪枝抵消修复效果。
	slackR := int(idx.deletePruneSlackFactor * float32(R))

	// Collect unique affected vertices
	seen := make(map[uint32]struct{})
	for _, z := range approxIn {
		seen[z] = struct{}{}
	}
	for _, cand := range candidates {
		if cand.ID != pu32 && !idx.deleted.IsDeletedUnsafe(uint64(cand.ID)) {
			seen[cand.ID] = struct{}{}
		}
	}

	// Create cached closures for robustPruneSimple
	cachedGetVec := func(id uint64) []float32 {
		return idx.getCachedVector(id, cache)
	}
	cachedGetNormSq := func(id uint64, vec []float32) float32 {
		return getCachedNormSq(id, vec, nsCache)
	}

	for v := range seen {
		neighbors := idx.getNeighbors(uint64(v))
		if len(neighbors) <= slackR {
			continue
		}
		vVec := idx.getCachedVector(uint64(v), cache)
		if vVec == nil {
			continue
		}
		vNormSq := getCachedNormSq(uint64(v), vVec, nsCache)
		nCands := make([]Neighbor, 0, len(neighbors))
		for _, nid := range neighbors {
			if idx.deleted.IsDeletedUnsafe(uint64(nid)) {
				continue
			}
			nVec := idx.getCachedVector(uint64(nid), cache)
			d := float32(math.MaxFloat32)
			if nVec != nil {
				nNormSq := getCachedNormSq(uint64(nid), nVec, nsCache)
				d = euclideanDistanceWithNorms(vVec, nVec, vNormSq, nNormSq)
			}
			nCands = append(nCands, Neighbor{ID: nid, Distance: d})
		}
		pruned := robustPruneSimpleWithNorm(nCands, R, DefaultInsertAlpha, cachedGetVec, cachedGetNormSq)
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

// compactSentinel is the sentinel value in oldToNew slice indicating a deleted node.
const compactSentinel = math.MaxUint32

// doCompact performs the actual compaction work.
//
// Performance optimizations over the naive implementation:
//   - oldToNew uses []uint32 slice instead of map[uint64]uint32 for O(1) index lookup
//     (ID space is contiguous [0, totalPts), ~640K lookups benefit from cache-friendly access)
//   - writeCompactedBBQFile copies existing BBQ metadata instead of re-quantizing all vectors
//   - serializeNode uses unsafe bulk copy for the vector portion
func (idx *DiskVamanaIndex) doCompact(newPath string) (*CompactResult, error) {
	idx.mu.RLock()
	dimension := int(idx.metadata.Dims)
	totalPts := idx.totalPoints()
	idx.mu.RUnlock()

	// Step 1: Build oldID → newID mapping using slice (contiguous ID space [0, totalPts)).
	// Uses compactSentinel (math.MaxUint32) for deleted nodes.
	// This replaces map[uint64]uint32 to eliminate ~640K hash lookups during neighbor remapping.
	oldToNew := make([]uint32, totalPts)
	var newID uint32

	for oldID := uint64(0); oldID < totalPts; oldID++ {
		if idx.deleted.IsDeleted(oldID) {
			oldToNew[oldID] = compactSentinel
		} else {
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
		mappedID := oldToNew[oldID]
		if mappedID == compactSentinel {
			continue
		}

		vectors[mappedID] = idx.getVector(oldID)

		oldNeighbors := idx.getNeighbors(oldID)
		remapped := make([]uint32, 0, len(oldNeighbors))
		for _, oldNID := range oldNeighbors {
			if uint64(oldNID) < totalPts {
				if nMapped := oldToNew[oldNID]; nMapped != compactSentinel {
					remapped = append(remapped, nMapped)
				}
			}
		}
		neighbors[mappedID] = remapped
	}
	idx.mu.RUnlock()

	// Step 3: Determine new medoid
	oldMedoid := idx.metadata.Medoid
	var newMedoid uint32
	if oldMedoid < totalPts {
		if mapped := oldToNew[oldMedoid]; mapped != compactSentinel {
			newMedoid = mapped
		}
	}

	// Step 4: Write compacted index file
	if err := idx.writeCompactedIndexFile(
		newPath, vectors, neighbors, newMedoid, dimension,
	); err != nil {
		return nil, fmt.Errorf("failed to write compacted index: %w", err)
	}

	// Step 5: Write BBQ file if enabled.
	// Uses optimized path that copies existing BBQ metadata instead of re-quantizing.
	if idx.bbqHasMeta && idx.bbqCentroid != nil {
		if err := idx.writeCompactedBBQFile(
			newPath, oldToNew, totalPts, dimension,
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
//
// Performance: uses unsafe bulk copy for the vector portion ([]float32 → []byte)
// instead of per-element binary.LittleEndian.PutUint32, reducing overhead for
// high-dimensional vectors (e.g., 768-dim saves ~768 function calls per node).
//
// Safety: float32 and uint32 are both 4 bytes with identical little-endian layout
// on all supported platforms (amd64, arm64). The unsafe.Slice conversion is a
// zero-copy reinterpretation that the Go compiler can verify at build time.
func serializeNode(
	vector []float32,
	neighbors []uint32,
	buf []byte,
	maxDegree int,
) {
	// Bulk copy vector data: reinterpret []float32 as []byte (zero-copy on LE platforms)
	vecBytes := len(vector) * 4
	if len(vector) > 0 {
		src := unsafe.Slice((*byte)(unsafe.Pointer(&vector[0])), vecBytes)
		copy(buf[:vecBytes], src)
	}
	offset := vecBytes

	// Write neighbor count
	binary.LittleEndian.PutUint32(buf[offset:], uint32(len(neighbors)))
	offset += 4

	// Bulk copy neighbor IDs: reinterpret []uint32 as []byte
	if len(neighbors) > 0 {
		nBytes := len(neighbors) * 4
		src := unsafe.Slice((*byte)(unsafe.Pointer(&neighbors[0])), nBytes)
		copy(buf[offset:offset+nBytes], src)
		offset += nBytes
	}

	// Fill unused slots with sentinel (0xFFFFFFFF)
	unusedSlots := maxDegree - len(neighbors)
	if unusedSlots > 0 {
		sentinel := buf[offset : offset+unusedSlots*4]
		for i := range sentinel {
			sentinel[i] = 0xFF
		}
	}
}

// writeCompactedBBQFile writes the BBQ file for compacted data.
//
// Performance optimization: copies existing BBQ metadata (packed codes, lower/upper bounds,
// corrections, quantized sums) directly from memory instead of re-quantizing all vectors.
//
// Data sources by node type:
//   - Disk nodes (oldID < metadata.NumPoints): from idx.bbqCodes, idx.bbqLowerBounds, etc.
//   - Append buffer nodes (oldID >= metadata.NumPoints): from idx.appendBBQLower, etc.
//     If append BBQ data is missing, falls back to quantizing the vector via getVector.
//
// Parameters:
//   - path: base path for the new BBQ file (without extension)
//   - oldToNew: slice mapping old node IDs to new compacted IDs (compactSentinel = deleted)
//   - totalPts: total number of points before compaction
//   - dimension: vector dimension
func (idx *DiskVamanaIndex) writeCompactedBBQFile(
	path string,
	oldToNew []uint32,
	totalPts uint64,
	dimension int,
) error {
	bbqPath := path + diskBBQExt

	f, err := os.Create(bbqPath)
	if err != nil {
		return err
	}
	defer f.Close()

	w := bufio.NewWriterSize(f, DefaultWriteBufferSize)

	// Count remaining points from oldToNew
	var numPoints uint64
	for _, nid := range oldToNew {
		if nid != compactSentinel {
			numPoints++
		}
	}

	packedSize := (dimension + 7) / 8
	diskN := idx.metadata.NumPoints

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

	// Write centroid using bulk copy
	centroidBuf := make([]byte, dimension*4)
	if len(idx.bbqCentroid) > 0 {
		src := unsafe.Slice((*byte)(unsafe.Pointer(&idx.bbqCentroid[0])), dimension*4)
		copy(centroidBuf, src)
	}
	if _, err := w.Write(centroidBuf); err != nil {
		return err
	}

	// Pre-allocate metadata arrays for the compacted output
	lowerBounds := make([]float32, numPoints)
	upperBounds := make([]float32, numPoints)
	corrections := make([]float32, numPoints)
	quantizedSums := make([]float32, numPoints)

	// Lazy-initialized quantizer for append nodes without pre-existing BBQ data
	var quantizer *bbq.ScalarQuantizer
	var quantized []byte

	// Write packed codes and collect metadata by iterating old IDs in order
	for oldID := uint64(0); oldID < totalPts; oldID++ {
		newIdx := oldToNew[oldID]
		if newIdx == compactSentinel {
			continue
		}

		if oldID < diskN {
			// Disk node: copy existing BBQ data directly from memory
			codeStart := int(oldID) * packedSize
			codeEnd := codeStart + packedSize
			if codeEnd <= len(idx.bbqCodes) {
				if _, err := w.Write(idx.bbqCodes[codeStart:codeEnd]); err != nil {
					return err
				}
			}
			lowerBounds[newIdx] = idx.bbqLowerBounds[oldID]
			upperBounds[newIdx] = idx.bbqUpperBounds[oldID]
			corrections[newIdx] = idx.bbqCorrections[oldID]
			quantizedSums[newIdx] = idx.bbqQuantizedSums[oldID]
		} else {
			// Append buffer node: copy from append BBQ arrays if available
			appendIdx := int(oldID - diskN)
			if appendIdx < len(idx.appendBBQLower) {
				// Append node has pre-computed BBQ data; need to quantize for packed codes only
				if quantizer == nil {
					quantizer = bbq.NewScalarQuantizer(idx.distanceMetric)
					quantized = make([]byte, dimension)
				}
				idx.mu.RLock()
				vec := idx.getVector(oldID)
				idx.mu.RUnlock()
				if vec != nil {
					quantizer.Quantize(vec, quantized, 1, idx.bbqCentroid)
					packed := bbq.PackBinary(quantized)
					if _, err := w.Write(packed[:packedSize]); err != nil {
						return err
					}
				} else {
					// Vector unavailable; write zero-filled packed code
					zeroPacked := make([]byte, packedSize)
					if _, err := w.Write(zeroPacked); err != nil {
						return err
					}
				}
				lowerBounds[newIdx] = idx.appendBBQLower[appendIdx]
				upperBounds[newIdx] = idx.appendBBQUpper[appendIdx]
				corrections[newIdx] = idx.appendBBQCorr[appendIdx]
				quantizedSums[newIdx] = idx.appendBBQSumSq[appendIdx]
			} else {
				// No pre-existing BBQ data; full quantization required
				if quantizer == nil {
					quantizer = bbq.NewScalarQuantizer(idx.distanceMetric)
					quantized = make([]byte, dimension)
				}
				idx.mu.RLock()
				vec := idx.getVector(oldID)
				idx.mu.RUnlock()
				if vec != nil {
					result := quantizer.Quantize(vec, quantized, 1, idx.bbqCentroid)
					packed := bbq.PackBinary(quantized)
					if _, err := w.Write(packed[:packedSize]); err != nil {
						return err
					}
					lowerBounds[newIdx] = result.LowerBound
					upperBounds[newIdx] = result.UpperBound
					corrections[newIdx] = result.Correction
					quantizedSums[newIdx] = result.QuantizedSum
				} else {
					zeroPacked := make([]byte, packedSize)
					if _, err := w.Write(zeroPacked); err != nil {
						return err
					}
				}
			}
		}
	}

	// Write metadata arrays using bulk unsafe copy for float32 slices
	if err := writeFloat32ArrayBulk(w, lowerBounds); err != nil {
		return err
	}
	if err := writeFloat32ArrayBulk(w, upperBounds); err != nil {
		return err
	}
	if err := writeFloat32ArrayBulk(w, corrections); err != nil {
		return err
	}
	if err := writeFloat32ArrayBulk(w, quantizedSums); err != nil {
		return err
	}

	if err := w.Flush(); err != nil {
		return err
	}

	return f.Sync()
}

// writeFloat32ArrayBulk writes a []float32 slice to a buffered writer using
// unsafe bulk copy, avoiding per-element binary.LittleEndian.PutUint32 overhead.
func writeFloat32ArrayBulk(w *bufio.Writer, data []float32) error {
	if len(data) == 0 {
		return nil
	}
	byteLen := len(data) * 4
	src := unsafe.Slice((*byte)(unsafe.Pointer(&data[0])), byteLen)
	_, err := w.Write(src)
	return err
}
