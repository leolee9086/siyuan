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
// This file implements incremental operations for DiskVamanaIndex:
//   - Insert: Add new vectors to the index one at a time
//   - InplaceDelete: Soft delete with OneHop edge repair algorithm
//   - Compact: Reclaim space from soft-deleted nodes
//
// These operations enable hot updates without full index rebuild.
package vamana

import (
	"bufio"
	"encoding/binary"
	"fmt"
	"math"
	"os"
	"sort"
	"sync"

	"github.com/siyuan-note/siyuan/kernel/vectordb/bbq"
	"github.com/siyuan-note/siyuan/kernel/vectordb/storage"
)

// ============================================================================
// Constants
// ============================================================================

const (
	// DefaultCompactionThreshold is the default deletion ratio threshold for compaction
	DefaultCompactionThreshold = 0.3

	// DefaultInsertSearchL is the default search list size during insert
	DefaultInsertSearchL = 100

	// DefaultInsertAlpha is the default pruning threshold during insert
	DefaultInsertAlpha = 1.2
)

// ============================================================================
// Errors
// ============================================================================

var (
	// ErrIncrementalNotSupported indicates incremental operations are not supported
	ErrIncrementalNotSupported = fmt.Errorf("incremental operations require read-write mode")

	// ErrVectorDimensionMismatch indicates vector dimension does not match index
	ErrVectorDimensionMismatch = fmt.Errorf("vector dimension mismatch")

	// ErrNodeAlreadyDeleted indicates the node is already deleted
	ErrNodeAlreadyDeleted = fmt.Errorf("node already deleted")

	// ErrCompactionInProgress indicates a compaction is already in progress
	ErrCompactionInProgress = fmt.Errorf("compaction already in progress")
)

// ============================================================================
// IncrementalConfig
// ============================================================================

// IncrementalConfig defines configuration for incremental operations.
type IncrementalConfig struct {
	// Insert parameters
	SearchL int     // Search list size during insert (default: 100)
	Alpha   float32 // Pruning threshold (default: 1.2)
	R       int     // Maximum out-degree (default: from index metadata)

	// Compaction parameters
	CompactionThreshold float64 // Deletion ratio threshold for auto-compaction (default: 0.3)
}

// DefaultIncrementalConfig returns default incremental configuration.
func DefaultIncrementalConfig() IncrementalConfig {
	return IncrementalConfig{
		SearchL:             DefaultInsertSearchL,
		Alpha:               DefaultInsertAlpha,
		R:                   0, // Will use index's maxDegree
		CompactionThreshold: DefaultCompactionThreshold,
	}
}

// ============================================================================
// IncrementalIndex wraps DiskVamanaIndex with incremental operation support
// ============================================================================

// IncrementalIndex provides incremental operations on top of DiskVamanaIndex.
//
// It maintains additional in-memory structures for efficient updates:
//   - Append buffer for new vectors
//   - Modified neighbor lists
//   - BBQ codes for new vectors
//
// Thread-safety:
//   - All operations are thread-safe
//   - Concurrent reads are allowed during writes
//   - Only one write operation at a time
type IncrementalIndex struct {
	// Base disk index (read-only access to original data)
	base *DiskVamanaIndex

	// Configuration
	config IncrementalConfig

	// Append buffer for new vectors (in-memory)
	appendVectors   [][]float32 // New vectors not yet on disk
	appendNeighbors [][]uint32  // Neighbor lists for new vectors
	appendBBQCodes  []byte      // BBQ codes for new vectors (packed)

	// Modified neighbor lists (for existing nodes)
	// Key: original node ID, Value: updated neighbor list
	modifiedNeighbors map[uint64][]uint32

	// BBQ quantizer for new vectors
	bbqQuantizer *bbq.ScalarQuantizer
	bbqCentroid  []float32 // Centroid for BBQ quantization

	// State
	compacting bool         // Whether compaction is in progress
	mu         sync.RWMutex // Protects all mutable state
}

// ============================================================================
// Constructor
// ============================================================================

// NewIncrementalIndex creates an IncrementalIndex wrapping a DiskVamanaIndex.
//
// Parameters:
//   - base: The underlying disk index (must be opened)
//   - config: Incremental operation configuration
//
// Returns error if base index is nil or closed.
func NewIncrementalIndex(base *DiskVamanaIndex, config IncrementalConfig) (*IncrementalIndex, error) {
	if base == nil {
		return nil, fmt.Errorf("base index cannot be nil")
	}

	base.mu.RLock()
	if base.closed {
		base.mu.RUnlock()
		return nil, ErrDiskIndexClosed
	}
	dimension := int(base.metadata.Dims)
	base.mu.RUnlock()

	// Fill default config values
	if config.SearchL <= 0 {
		config.SearchL = DefaultInsertSearchL
	}
	if config.Alpha <= 0 {
		config.Alpha = DefaultInsertAlpha
	}
	if config.R <= 0 {
		config.R = base.MaxDegree()
	}
	if config.CompactionThreshold <= 0 {
		config.CompactionThreshold = DefaultCompactionThreshold
	}

	idx := &IncrementalIndex{
		base:              base,
		config:            config,
		appendVectors:     make([][]float32, 0),
		appendNeighbors:   make([][]uint32, 0),
		appendBBQCodes:    make([]byte, 0),
		modifiedNeighbors: make(map[uint64][]uint32),
		compacting:        false,
	}

	// Initialize BBQ quantizer if base has BBQ
	if base.HasBBQ() {
		idx.bbqQuantizer = bbq.NewScalarQuantizer(bbq.CosineSimilarity)
		// Copy centroid from base index
		base.mu.RLock()
		if base.bbqCentroid != nil {
			idx.bbqCentroid = make([]float32, len(base.bbqCentroid))
			copy(idx.bbqCentroid, base.bbqCentroid)
		} else {
			// Create zero centroid if not available
			idx.bbqCentroid = make([]float32, dimension)
		}
		base.mu.RUnlock()
	}

	return idx, nil
}

// ============================================================================
// Accessor Methods
// ============================================================================

// NumPoints returns the total number of active points (base + appended - deleted).
func (idx *IncrementalIndex) NumPoints() uint64 {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	basePoints := idx.base.NumPoints()
	appendedPoints := uint64(len(idx.appendVectors))
	return basePoints + appendedPoints
}

// NumAppended returns the number of appended vectors not yet persisted.
func (idx *IncrementalIndex) NumAppended() int {
	idx.mu.RLock()
	defer idx.mu.RUnlock()
	return len(idx.appendVectors)
}

// NumModified returns the number of nodes with modified neighbor lists.
func (idx *IncrementalIndex) NumModified() int {
	idx.mu.RLock()
	defer idx.mu.RUnlock()
	return len(idx.modifiedNeighbors)
}

// NeedsCompaction returns true if deletion ratio exceeds threshold.
func (idx *IncrementalIndex) NeedsCompaction() bool {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	totalPoints := idx.base.NumPointsTotal() + uint64(len(idx.appendVectors))
	if totalPoints == 0 {
		return false
	}

	deletedCount := idx.base.deleted.CountDeleted()
	ratio := float64(deletedCount) / float64(totalPoints)
	return ratio >= idx.config.CompactionThreshold
}

// Dimension returns the vector dimension.
func (idx *IncrementalIndex) Dimension() int {
	return idx.base.Dimension()
}

// ============================================================================
// Insert Operation
// ============================================================================

// Insert adds a new vector to the index.
//
// The vector is added to an in-memory append buffer and connected to the graph
// using greedy search + robust pruning. The new node's neighbors are also
// updated to include back-edges.
//
// Parameters:
//   - vector: The vector to insert (must match index dimension)
//
// Returns the new node ID, or error if:
//   - Vector dimension doesn't match
//   - Index is closed
//
// Thread-safety: Safe for concurrent calls, but inserts are serialized.
func (idx *IncrementalIndex) Insert(vector []float32) (uint64, error) {
	idx.mu.Lock()
	defer idx.mu.Unlock()

	// Validate dimension
	dimension := idx.base.Dimension()
	if len(vector) != dimension {
		return 0, ErrVectorDimensionMismatch
	}

	// Check if base is closed
	idx.base.mu.RLock()
	if idx.base.closed {
		idx.base.mu.RUnlock()
		return 0, ErrDiskIndexClosed
	}
	idx.base.mu.RUnlock()

	// Calculate new node ID
	baseTotal := idx.base.NumPointsTotal()
	newID := baseTotal + uint64(len(idx.appendVectors))

	// Step 1: Find neighbors using greedy search
	neighbors := idx.findNeighborsForInsert(vector)

	// Step 2: Prune neighbors using robust pruning
	prunedNeighbors := idx.robustPrune(vector, neighbors)

	// Step 3: Add vector to append buffer
	vectorCopy := make([]float32, len(vector))
	copy(vectorCopy, vector)
	idx.appendVectors = append(idx.appendVectors, vectorCopy)
	idx.appendNeighbors = append(idx.appendNeighbors, prunedNeighbors)

	// Step 4: Compute and store BBQ code if enabled
	if idx.bbqQuantizer != nil {
		packedSize := (dimension + 7) / 8
		quantized := make([]byte, dimension)
		idx.bbqQuantizer.Quantize(vector, quantized, 1, idx.bbqCentroid)
		packed := bbq.PackBinary(quantized)
		idx.appendBBQCodes = append(idx.appendBBQCodes, packed[:packedSize]...)
	}

	// Step 5: Add back-edges to neighbors
	idx.addBackEdges(newID, prunedNeighbors)

	return newID, nil
}

// findNeighborsForInsert finds candidate neighbors for a new vector using greedy search.
func (idx *IncrementalIndex) findNeighborsForInsert(vector []float32) []Neighbor {
	// Get search scratch
	scratch := getDiskSearchScratch()
	defer putDiskSearchScratch(scratch)

	// Get total points for visited set capacity
	totalPoints := idx.base.NumPointsTotal() + uint64(len(idx.appendVectors))
	scratch.Visited.EnsureCapacity(int(totalPoints))
	scratch.Best.SetCapacity(idx.config.SearchL)
	scratch.Reset()

	// Start from medoid
	medoid := idx.base.Medoid()

	// Initialize with medoid
	if !idx.isDeleted(medoid) {
		scratch.Visited.Insert(uint32(medoid))
		dist := idx.computeDistance(medoid, vector)
		scratch.Best.Insert(Neighbor{ID: uint32(medoid), Distance: dist})
	}

	// Greedy search
	for scratch.Best.HasUnvisited() {
		closest, ok := scratch.Best.PopClosestUnvisited()
		if !ok {
			break
		}

		// Get neighbors
		neighbors := idx.getNeighbors(uint64(closest.ID))

		for _, neighborID := range neighbors {
			// Skip deleted
			if idx.isDeleted(uint64(neighborID)) {
				continue
			}

			// Skip visited
			if !scratch.Visited.Insert(neighborID) {
				continue
			}

			// Compute distance
			dist := idx.computeDistance(uint64(neighborID), vector)
			scratch.Best.Insert(Neighbor{ID: neighborID, Distance: dist})
		}
	}

	return scratch.Best.All()
}

// robustPrune applies robust pruning to select final neighbors.
//
// This implements the Vamana pruning algorithm:
// 1. Sort candidates by distance
// 2. Greedily select neighbors that are not "occluded" by already selected neighbors
// 3. A neighbor is occluded if alpha * dist(selected, candidate) <= dist(query, candidate)
func (idx *IncrementalIndex) robustPrune(vector []float32, candidates []Neighbor) []uint32 {
	if len(candidates) == 0 {
		return nil
	}

	// Sort by distance
	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].Distance < candidates[j].Distance
	})

	R := idx.config.R
	alpha := idx.config.Alpha

	result := make([]uint32, 0, R)
	occluded := make([]bool, len(candidates))

	for i := 0; i < len(candidates) && len(result) < R; i++ {
		if occluded[i] {
			continue
		}

		candidateID := candidates[i].ID
		result = append(result, candidateID)

		// Mark occluded candidates
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

			// Check occlusion: alpha * dist(candidate, other) <= dist(query, other)
			distCandOther := euclideanDistance(candidateVec, otherVec)
			distQueryOther := candidates[j].Distance

			if alpha*distCandOther <= distQueryOther {
				occluded[j] = true
			}
		}
	}

	return result
}

// addBackEdges adds back-edges from neighbors to the new node.
func (idx *IncrementalIndex) addBackEdges(newID uint64, neighbors []uint32) {
	R := idx.config.R
	newIDu32 := uint32(newID)

	for _, neighborID := range neighbors {
		// Get current neighbors of this node
		currentNeighbors := idx.getNeighbors(uint64(neighborID))

		// Check if already connected
		if containsID(currentNeighbors, newIDu32) {
			continue
		}

		// Add back-edge
		newNeighbors := make([]uint32, len(currentNeighbors), len(currentNeighbors)+1)
		copy(newNeighbors, currentNeighbors)
		newNeighbors = append(newNeighbors, newIDu32)

		// If exceeds R, prune
		if len(newNeighbors) > R {
			neighborVec := idx.getVector(uint64(neighborID))
			if neighborVec != nil {
				// Convert to Neighbor slice for pruning
				candidateNeighbors := make([]Neighbor, len(newNeighbors))
				for i, nid := range newNeighbors {
					nVec := idx.getVector(uint64(nid))
					if nVec != nil {
						candidateNeighbors[i] = Neighbor{
							ID:       nid,
							Distance: euclideanDistance(neighborVec, nVec),
						}
					} else {
						candidateNeighbors[i] = Neighbor{ID: nid, Distance: math.MaxFloat32}
					}
				}
				newNeighbors = idx.robustPrune(neighborVec, candidateNeighbors)
			} else {
				// Fallback: just truncate
				newNeighbors = newNeighbors[:R]
			}
		}

		// Store modified neighbors
		idx.storeModifiedNeighbors(uint64(neighborID), newNeighbors)
	}
}

// storeModifiedNeighbors stores modified neighbor list for a node.
func (idx *IncrementalIndex) storeModifiedNeighbors(nodeID uint64, neighbors []uint32) {
	baseTotal := idx.base.NumPointsTotal()
	if nodeID < baseTotal {
		// Original node - store in modifiedNeighbors map
		idx.modifiedNeighbors[nodeID] = neighbors
	} else {
		// Appended node - update appendNeighbors
		appendIdx := int(nodeID - baseTotal)
		if appendIdx < len(idx.appendNeighbors) {
			idx.appendNeighbors[appendIdx] = neighbors
		}
	}
}

// ============================================================================
// Helper Methods for Insert
// ============================================================================

// isDeleted checks if a node is deleted.
func (idx *IncrementalIndex) isDeleted(nodeID uint64) bool {
	return idx.base.IsDeleted(nodeID)
}

// getNeighbors returns neighbors for a node (from modified, appended, or base).
func (idx *IncrementalIndex) getNeighbors(nodeID uint64) []uint32 {
	baseTotal := idx.base.NumPointsTotal()

	if nodeID >= baseTotal {
		// Appended node
		appendIdx := int(nodeID - baseTotal)
		if appendIdx < len(idx.appendNeighbors) {
			return idx.appendNeighbors[appendIdx]
		}
		return nil
	}

	// Check modified neighbors first
	if modified, ok := idx.modifiedNeighbors[nodeID]; ok {
		return modified
	}

	// Fall back to base index
	return idx.base.GetNeighbors(nodeID)
}

// getVector returns vector for a node (from appended or base).
func (idx *IncrementalIndex) getVector(nodeID uint64) []float32 {
	baseTotal := idx.base.NumPointsTotal()

	if nodeID >= baseTotal {
		// Appended node
		appendIdx := int(nodeID - baseTotal)
		if appendIdx < len(idx.appendVectors) {
			return idx.appendVectors[appendIdx]
		}
		return nil
	}

	// Read from base index
	vec, err := idx.base.ReadVector(nodeID)
	if err != nil {
		return nil
	}
	return vec
}

// computeDistance computes distance between a node and a query vector.
func (idx *IncrementalIndex) computeDistance(nodeID uint64, query []float32) float32 {
	vec := idx.getVector(nodeID)
	if vec == nil {
		return math.MaxFloat32
	}
	return euclideanDistance(vec, query)
}

// ============================================================================
// Delete Operation (InplaceDelete with OneHop Edge Repair)
// ============================================================================

// Delete performs soft deletion with OneHop edge repair.
//
// The OneHop algorithm repairs the graph by connecting the deleted node's
// neighbors to each other, maintaining graph connectivity.
//
// Algorithm:
//  1. Mark node as deleted in bitmap
//  2. For each neighbor of deleted node:
//     - Find other neighbors of deleted node that should be connected
//     - Add edges to maintain connectivity
//     - Apply robust pruning if degree exceeds R
//
// Parameters:
//   - nodeID: The node ID to delete
//
// Returns error if:
//   - Node doesn't exist
//   - Node is already deleted
//   - Index is closed
//
// Thread-safety: Safe for concurrent calls, but deletes are serialized.
func (idx *IncrementalIndex) Delete(nodeID uint64) error {
	idx.mu.Lock()
	defer idx.mu.Unlock()

	// Check bounds
	totalPoints := idx.base.NumPointsTotal() + uint64(len(idx.appendVectors))
	if nodeID >= totalPoints {
		return storage.ErrNodeNotFound
	}

	// Check if already deleted
	if idx.isDeleted(nodeID) {
		return ErrNodeAlreadyDeleted
	}

	// Get neighbors before marking as deleted
	neighbors := idx.getNeighbors(nodeID)

	// Mark as deleted
	idx.base.deleted.MarkDeleted(nodeID)

	// OneHop edge repair: connect neighbors to each other
	idx.oneHopRepair(nodeID, neighbors)

	return nil
}

// oneHopRepair repairs edges after deletion using the OneHop algorithm.
//
// For each neighbor of the deleted node, we add edges to other neighbors
// that are not already connected, maintaining graph connectivity.
func (idx *IncrementalIndex) oneHopRepair(deletedID uint64, deletedNeighbors []uint32) {
	if len(deletedNeighbors) == 0 {
		return
	}

	R := idx.config.R
	deletedIDu32 := uint32(deletedID)

	// For each neighbor of the deleted node
	for _, neighborID := range deletedNeighbors {
		// Skip if this neighbor is also deleted
		if idx.isDeleted(uint64(neighborID)) {
			continue
		}

		// Get current neighbors of this node
		currentNeighbors := idx.getNeighbors(uint64(neighborID))

		// Remove the deleted node from neighbors
		newNeighbors := make([]uint32, 0, len(currentNeighbors))
		for _, n := range currentNeighbors {
			if n != deletedIDu32 && !idx.isDeleted(uint64(n)) {
				newNeighbors = append(newNeighbors, n)
			}
		}

		// Add edges to other neighbors of deleted node (OneHop repair)
		for _, otherNeighbor := range deletedNeighbors {
			if otherNeighbor == neighborID {
				continue
			}
			if idx.isDeleted(uint64(otherNeighbor)) {
				continue
			}
			if containsID(newNeighbors, otherNeighbor) {
				continue
			}
			newNeighbors = append(newNeighbors, otherNeighbor)
		}

		// Prune if exceeds R
		if len(newNeighbors) > R {
			neighborVec := idx.getVector(uint64(neighborID))
			if neighborVec != nil {
				// Convert to Neighbor slice for pruning
				candidates := make([]Neighbor, len(newNeighbors))
				for i, nid := range newNeighbors {
					nVec := idx.getVector(uint64(nid))
					if nVec != nil {
						candidates[i] = Neighbor{
							ID:       nid,
							Distance: euclideanDistance(neighborVec, nVec),
						}
					} else {
						candidates[i] = Neighbor{ID: nid, Distance: math.MaxFloat32}
					}
				}
				newNeighbors = idx.robustPrune(neighborVec, candidates)
			} else {
				// Fallback: truncate
				newNeighbors = newNeighbors[:R]
			}
		}

		// Store modified neighbors
		idx.storeModifiedNeighbors(uint64(neighborID), newNeighbors)
	}
}

// ============================================================================
// Compact Operation
// ============================================================================

// CompactResult contains statistics from the compaction process.
type CompactResult struct {
	OriginalPoints  uint64 // Points before compaction
	RemainingPoints uint64 // Points after compaction
	DeletedPoints   uint64 // Number of deleted points removed
	NewIndexPath    string // Path to the new compacted index
}

// Compact creates a new index file without deleted nodes.
//
// This operation:
//  1. Creates a new index file with only active nodes
//  2. Remaps all node IDs to be contiguous
//  3. Updates all neighbor references
//  4. Writes new BBQ codes if enabled
//
// The original index files are not modified. After successful compaction,
// the caller should close the old index and open the new one.
//
// Parameters:
//   - newPath: Base path for the new compacted index (without extension)
//
// Returns CompactResult with statistics, or error if:
//   - Compaction is already in progress
//   - File creation fails
//   - Write fails
//
// Thread-safety: Only one compaction can run at a time.
func (idx *IncrementalIndex) Compact(newPath string) (*CompactResult, error) {
	idx.mu.Lock()
	if idx.compacting {
		idx.mu.Unlock()
		return nil, ErrCompactionInProgress
	}
	idx.compacting = true
	idx.mu.Unlock()

	defer func() {
		idx.mu.Lock()
		idx.compacting = false
		idx.mu.Unlock()
	}()

	return idx.doCompact(newPath)
}

// doCompact performs the actual compaction work.
func (idx *IncrementalIndex) doCompact(newPath string) (*CompactResult, error) {
	idx.mu.RLock()
	dimension := idx.base.Dimension()
	baseTotal := idx.base.NumPointsTotal()
	appendedCount := uint64(len(idx.appendVectors))
	totalPoints := baseTotal + appendedCount
	idx.mu.RUnlock()

	// Build ID mapping: old ID -> new ID
	// Only include non-deleted nodes
	oldToNew := make(map[uint64]uint32)
	var newID uint32 = 0

	for oldID := uint64(0); oldID < totalPoints; oldID++ {
		if !idx.isDeleted(oldID) {
			oldToNew[oldID] = newID
			newID++
		}
	}

	remainingPoints := uint64(newID)
	deletedPoints := totalPoints - remainingPoints

	if remainingPoints == 0 {
		return &CompactResult{
			OriginalPoints:  totalPoints,
			RemainingPoints: 0,
			DeletedPoints:   deletedPoints,
			NewIndexPath:    newPath,
		}, nil
	}

	// Collect vectors and neighbors for compaction
	vectors := make([][]float32, remainingPoints)
	neighbors := make([][]uint32, remainingPoints)

	idx.mu.RLock()
	for oldID := uint64(0); oldID < totalPoints; oldID++ {
		if idx.isDeleted(oldID) {
			continue
		}
		newIdx := oldToNew[oldID]

		// Get vector
		vectors[newIdx] = idx.getVector(oldID)

		// Get and remap neighbors
		oldNeighbors := idx.getNeighbors(oldID)
		newNeighbors := make([]uint32, 0, len(oldNeighbors))
		for _, oldNeighborID := range oldNeighbors {
			if newNeighborID, ok := oldToNew[uint64(oldNeighborID)]; ok {
				newNeighbors = append(newNeighbors, newNeighborID)
			}
		}
		neighbors[newIdx] = newNeighbors
	}
	idx.mu.RUnlock()

	// Find new medoid (closest to old medoid's position)
	oldMedoid := idx.base.Medoid()
	var newMedoid uint32 = 0
	if newMedoidID, ok := oldToNew[oldMedoid]; ok {
		newMedoid = newMedoidID
	}

	// Write compacted index
	if err := idx.writeCompactedIndex(newPath, vectors, neighbors, newMedoid, dimension); err != nil {
		return nil, fmt.Errorf("failed to write compacted index: %w", err)
	}

	return &CompactResult{
		OriginalPoints:  totalPoints,
		RemainingPoints: remainingPoints,
		DeletedPoints:   deletedPoints,
		NewIndexPath:    newPath,
	}, nil
}

// writeCompactedIndex writes the compacted index to disk.
func (idx *IncrementalIndex) writeCompactedIndex(
	path string,
	vectors [][]float32,
	neighbors [][]uint32,
	medoid uint32,
	dimension int,
) error {
	numPoints := uint64(len(vectors))
	if numPoints == 0 {
		return nil
	}

	// Calculate max degree from neighbors
	maxDegree := idx.config.R
	for _, n := range neighbors {
		if len(n) > maxDegree {
			maxDegree = len(n)
		}
	}

	// Write main index file
	if err := idx.writeCompactedIndexFile(path, vectors, neighbors, medoid, dimension, maxDegree); err != nil {
		return err
	}

	// Write BBQ file if enabled
	if idx.bbqQuantizer != nil {
		if err := idx.writeCompactedBBQFile(path, vectors, dimension); err != nil {
			return err
		}
	}

	return nil
}

// writeCompactedIndexFile writes the main index file for compacted data.
func (idx *IncrementalIndex) writeCompactedIndexFile(
	path string,
	vectors [][]float32,
	neighbors [][]uint32,
	medoid uint32,
	dimension int,
	maxDegree int,
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
	actualMaxDegree := uint64(maxDegree)

	// Calculate node length
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

	// Pad header block
	headerWritten := 4 + 80 + 8 + 8
	padding := make([]byte, blockSize-uint64(headerWritten))
	if _, err := w.Write(padding); err != nil {
		return err
	}

	// Write node data
	nodeData := make([]byte, nodeLen)
	for i := uint64(0); i < numPoints; i++ {
		idx.serializeCompactedNode(vectors[i], neighbors[i], nodeData, maxDegree)
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

// serializeCompactedNode serializes a node to the buffer.
func (idx *IncrementalIndex) serializeCompactedNode(
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
func (idx *IncrementalIndex) writeCompactedBBQFile(
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
	header := make([]byte, 24)
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
		binary.LittleEndian.PutUint32(centroidBuf[i*4:], math.Float32bits(v))
	}
	if _, err := w.Write(centroidBuf); err != nil {
		return err
	}

	// Compute and write BBQ codes
	quantized := make([]byte, dimension)
	lowerBounds := make([]float32, numPoints)
	upperBounds := make([]float32, numPoints)
	corrections := make([]float32, numPoints)
	quantizedSums := make([]float32, numPoints)

	for i, vec := range vectors {
		result := idx.bbqQuantizer.Quantize(vec, quantized, 1, idx.bbqCentroid)
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
