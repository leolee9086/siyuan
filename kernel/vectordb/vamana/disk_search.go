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
// This file implements the search functionality for DiskVamanaIndex,
// using a two-phase approach:
//   - Phase 1: BBQ-based coarse filtering using Hamming distance (if BBQ enabled)
//   - Phase 2: Disk-based reranking with original vectors
package vamana

import (
	"sort"
	"sync"

	"github.com/siyuan-note/siyuan/kernel/vectordb/bbq"
)

// ============================================================================
// Search Scratch Pool
// ============================================================================

// diskSearchScratchPool is a pool for reusing search scratch space
var diskSearchScratchPool = sync.Pool{
	New: func() interface{} {
		return NewSearchScratch(1024, 256)
	},
}

// getDiskSearchScratch gets a search scratch from the pool
func getDiskSearchScratch() *SearchScratch {
	return diskSearchScratchPool.Get().(*SearchScratch)
}

// putDiskSearchScratch returns a search scratch to the pool
func putDiskSearchScratch(s *SearchScratch) {
	diskSearchScratchPool.Put(s)
}

// ============================================================================
// Search Implementation
// ============================================================================

// Search performs approximate nearest neighbor search on the disk index.
//
// The search uses a two-phase approach:
//  1. Greedy graph traversal from medoid, using BBQ codes for fast distance estimation
//  2. Reranking top candidates using original vectors from disk
//
// Parameters:
//   - query: Query vector, must have same dimension as index
//   - topK: Number of nearest neighbors to return
//   - efSearch: Search list size (larger = more accurate but slower)
//
// Returns a slice of SearchResult sorted by distance (ascending).
// Returns nil if the index is empty or closed.
//
// Thread-safety: Safe for concurrent calls.
func (idx *DiskVamanaIndex) Search(query []float32, topK, efSearch int) []SearchResult {
	idx.mu.RLock()
	if idx.closed {
		idx.mu.RUnlock()
		return nil
	}

	numPoints := idx.metadata.NumPoints
	if numPoints == 0 {
		idx.mu.RUnlock()
		return nil
	}

	medoid := idx.metadata.Medoid
	dimension := int(idx.metadata.Dims)
	idx.mu.RUnlock()

	// Validate query dimension
	if len(query) != dimension {
		return nil
	}

	// Ensure efSearch >= topK
	if efSearch < topK {
		efSearch = topK
	}

	// Get search scratch from pool
	scratch := getDiskSearchScratch()
	defer putDiskSearchScratch(scratch)

	// Ensure scratch capacity
	scratch.Visited.EnsureCapacity(int(numPoints))
	scratch.Best.SetCapacity(efSearch)
	scratch.Reset()

	// Phase 1: Greedy search with BBQ (if available) or direct disk access
	var candidates []Neighbor
	if idx.HasBBQ() {
		candidates = idx.greedySearchBBQ(scratch, medoid, query, efSearch)
	} else {
		candidates = idx.greedySearchDisk(scratch, medoid, query, efSearch)
	}

	if len(candidates) == 0 {
		return nil
	}

	// Phase 2: Rerank with original vectors
	results := idx.rerankCandidates(candidates, query, topK)

	return results
}

// ============================================================================
// BBQ-based Greedy Search
// ============================================================================

// greedySearchBBQ performs greedy search using BBQ codes for distance estimation.
//
// If BBQ metadata is available (version 2), uses quantization-corrected distance
// for better accuracy. Otherwise, falls back to simple Hamming distance.
func (idx *DiskVamanaIndex) greedySearchBBQ(scratch *SearchScratch, medoid uint64, query []float32, L int) []Neighbor {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	if idx.closed {
		return nil
	}

	// 如果有量化元数据，使用校正距离计算
	if idx.bbqHasMeta {
		return idx.greedySearchBBQWithMeta(scratch, medoid, query, L)
	}

	// 否则使用简单的 Hamming 距离（向后兼容）
	return idx.greedySearchBBQHamming(scratch, medoid, query, L)
}

// greedySearchBBQWithMeta 使用量化校正的 BBQ 搜索
// 与内存索引的 bbqDistanceToQuery1Bit 保持一致
func (idx *DiskVamanaIndex) greedySearchBBQWithMeta(scratch *SearchScratch, medoid uint64, query []float32, L int) []Neighbor {
	dimension := int(idx.metadata.Dims)

	// 使用 BBQ 量化器量化查询向量
	// 注意：必须使用 CosineSimilarity 模式，与内存索引的 BBQ 量化保持一致
	quantizer := bbq.NewScalarQuantizer(bbq.CosineSimilarity)
	queryQuantized := make([]byte, dimension)
	queryCorr := quantizer.Quantize(query, queryQuantized, 1, idx.bbqCentroid)

	// 打包查询向量为 1-bit 格式
	queryPacked := bbq.PackBinary(queryQuantized)

	// 创建评分器（使用余弦相似度模式，与内存索引保持一致）
	scorer := bbq.NewQuantizedScorer(bbq.CosineSimilarity)

	// Initialize with medoid
	if !idx.deleted.IsDeleted(medoid) {
		scratch.Visited.Insert(uint32(medoid))
		dist := idx.bbqCorrectedDistance(queryPacked, queryCorr, uint32(medoid), scorer)
		scratch.Best.Insert(Neighbor{ID: uint32(medoid), Distance: dist})
	}

	// Greedy search loop
	for scratch.Best.HasUnvisited() {
		closest, ok := scratch.Best.PopClosestUnvisited()
		if !ok {
			break
		}

		// Get neighbors from disk on-demand
		neighbors := idx.GetNeighbors(uint64(closest.ID))

		for _, neighborID := range neighbors {
			// Skip deleted nodes
			if idx.deleted.IsDeleted(uint64(neighborID)) {
				continue
			}

			// Skip already visited
			if !scratch.Visited.Insert(neighborID) {
				continue
			}

			// Compute BBQ corrected distance
			dist := idx.bbqCorrectedDistance(queryPacked, queryCorr, neighborID, scorer)
			scratch.Best.Insert(Neighbor{ID: neighborID, Distance: dist})
		}
	}

	return scratch.Best.All()
}

// greedySearchBBQHamming 使用简单 Hamming 距离的 BBQ 搜索（向后兼容）
func (idx *DiskVamanaIndex) greedySearchBBQHamming(scratch *SearchScratch, medoid uint64, query []float32, L int) []Neighbor {
	dimension := int(idx.metadata.Dims)
	packedSize := (dimension + 7) / 8

	// Quantize query to BBQ code (simple sign-based)
	queryBBQ := quantizeQueryToBBQ(query)

	// Initialize with medoid
	if !idx.deleted.IsDeleted(medoid) {
		scratch.Visited.Insert(uint32(medoid))
		dist := idx.bbqHammingDistance(queryBBQ, medoid, packedSize)
		scratch.Best.Insert(Neighbor{ID: uint32(medoid), Distance: dist})
	}

	// Greedy search loop
	for scratch.Best.HasUnvisited() {
		closest, ok := scratch.Best.PopClosestUnvisited()
		if !ok {
			break
		}

		// Get neighbors from disk on-demand
		neighbors := idx.GetNeighbors(uint64(closest.ID))

		for _, neighborID := range neighbors {
			// Skip deleted nodes
			if idx.deleted.IsDeleted(uint64(neighborID)) {
				continue
			}

			// Skip already visited
			if !scratch.Visited.Insert(neighborID) {
				continue
			}

			// Compute BBQ Hamming distance
			dist := idx.bbqHammingDistance(queryBBQ, uint64(neighborID), packedSize)
			scratch.Best.Insert(Neighbor{ID: neighborID, Distance: dist})
		}
	}

	return scratch.Best.All()
}

// bbqHammingDistance computes Hamming distance between query BBQ code and node's BBQ code.
func (idx *DiskVamanaIndex) bbqHammingDistance(queryBBQ []byte, nodeID uint64, packedSize int) float32 {
	nodeBBQ := idx.GetBBQCode(nodeID)
	if nodeBBQ == nil {
		return float32(1e9) // Large distance for missing BBQ
	}

	dist := bbq.ComputePackedHammingDistance(queryBBQ, nodeBBQ)
	return float32(dist)
}

// bbqCorrectedDistance 计算带量化校正的 BBQ 距离
// 与内存索引的 bbqDistanceToQuery1Bit 保持一致
func (idx *DiskVamanaIndex) bbqCorrectedDistance(queryPacked []byte, queryCorr bbq.QuantizationResult, nodeID uint32, scorer *bbq.QuantizedScorer) float32 {
	nodeBBQ := idx.GetBBQCode(uint64(nodeID))
	if nodeBBQ == nil {
		return float32(1e9) // Large distance for missing BBQ
	}

	// 使用 POPCNT 计算点积
	dotProd := bbq.ComputePackedDotProduct(queryPacked, nodeBBQ)

	// 获取索引向量的量化元数据
	indexCorr := bbq.QuantizationResult{
		LowerBound:   idx.bbqLowerBounds[nodeID],
		UpperBound:   idx.bbqUpperBounds[nodeID],
		Correction:   idx.bbqCorrections[nodeID],
		QuantizedSum: idx.bbqQuantizedSums[nodeID],
	}

	// 使用 1-bit 评分模式计算距离
	dimension := int(idx.metadata.Dims)
	return scorer.ComputeQuantizedDistance(dotProd, queryCorr, indexCorr, dimension, 0, false)
}

// quantizeQueryToBBQ quantizes a query vector to BBQ code (1-bit per dimension).
//
// Simple sign-based quantization: positive values -> 1, non-positive -> 0
func quantizeQueryToBBQ(query []float32) []byte {
	dimension := len(query)
	packedSize := (dimension + 7) / 8
	result := make([]byte, packedSize)

	for i, v := range query {
		if v > 0 {
			byteIdx := i / 8
			bitIdx := uint(7 - (i % 8))
			result[byteIdx] |= 1 << bitIdx
		}
	}

	return result
}

// ============================================================================
// Disk-based Greedy Search (fallback when no BBQ)
// ============================================================================

// greedySearchDisk performs greedy search by reading vectors from disk.
//
// This is slower than BBQ-based search but works when BBQ is not available.
func (idx *DiskVamanaIndex) greedySearchDisk(scratch *SearchScratch, medoid uint64, query []float32, L int) []Neighbor {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	if idx.closed {
		return nil
	}

	// Precompute query norm for fast distance calculation
	queryNormSq := computeNormSquare(query)

	// Initialize with medoid
	if !idx.deleted.IsDeleted(medoid) {
		scratch.Visited.Insert(uint32(medoid))
		dist := idx.computeDistanceFromDisk(medoid, query, queryNormSq)
		scratch.Best.Insert(Neighbor{ID: uint32(medoid), Distance: dist})
	}

	// Greedy search loop
	for scratch.Best.HasUnvisited() {
		closest, ok := scratch.Best.PopClosestUnvisited()
		if !ok {
			break
		}

		// Get neighbors from disk on-demand
		neighbors := idx.GetNeighbors(uint64(closest.ID))

		for _, neighborID := range neighbors {
			// Skip deleted nodes
			if idx.deleted.IsDeleted(uint64(neighborID)) {
				continue
			}

			// Skip already visited
			if !scratch.Visited.Insert(neighborID) {
				continue
			}

			// Compute distance from disk
			dist := idx.computeDistanceFromDisk(uint64(neighborID), query, queryNormSq)
			scratch.Best.Insert(Neighbor{ID: neighborID, Distance: dist})
		}
	}

	return scratch.Best.All()
}

// computeDistanceFromDisk reads a vector from disk and computes distance to query.
func (idx *DiskVamanaIndex) computeDistanceFromDisk(nodeID uint64, query []float32, queryNormSq float32) float32 {
	vec, err := idx.ReadVector(nodeID)
	if err != nil {
		return float32(1e9) // Large distance on error
	}

	return euclideanDistanceWithNorm(vec, query, queryNormSq)
}

// euclideanDistanceWithNorm computes squared Euclidean distance using precomputed query norm.
// ||a - b||² = ||a||² + ||b||² - 2<a,b>
func euclideanDistanceWithNorm(vec, query []float32, queryNormSq float32) float32 {
	vecNormSq := computeNormSquare(vec)
	dot := dotProduct(vec, query)
	dist := vecNormSq + queryNormSq - 2*dot
	if dist < 0 {
		dist = 0
	}
	return dist
}

// ============================================================================
// Reranking
// ============================================================================

// rerankCandidates reranks candidates using original vectors from disk.
//
// Reads vectors from disk and computes exact distances, then returns top-K.
func (idx *DiskVamanaIndex) rerankCandidates(candidates []Neighbor, query []float32, topK int) []SearchResult {
	if len(candidates) == 0 {
		return nil
	}

	// Precompute query norm
	queryNormSq := computeNormSquare(query)

	// Recompute distances with original vectors
	results := make([]SearchResult, 0, len(candidates))

	idx.mu.RLock()
	defer idx.mu.RUnlock()

	if idx.closed {
		return nil
	}

	// Allocate buffer for reading vectors
	dimension := int(idx.metadata.Dims)
	vec := make([]float32, dimension)

	for _, cand := range candidates {
		// Skip deleted nodes (double check)
		if idx.deleted.IsDeleted(uint64(cand.ID)) {
			continue
		}

		// Read vector from disk into buffer
		if err := idx.reader.ReadVector(uint64(cand.ID), vec); err != nil {
			continue
		}

		// Compute exact distance
		dist := euclideanDistanceWithNorm(vec, query, queryNormSq)

		results = append(results, SearchResult{
			ID:       uint64(cand.ID),
			Distance: dist,
		})
	}

	// Sort by distance
	sort.Slice(results, func(i, j int) bool {
		return results[i].Distance < results[j].Distance
	})

	// Return top-K
	if len(results) > topK {
		results = results[:topK]
	}

	return results
}

// ============================================================================
// SearchResult Type
// ============================================================================

// SearchResult represents a search result with node ID and distance.
type SearchResult struct {
	ID       uint64  // Node ID
	Distance float32 // Distance to query (squared Euclidean)
}
