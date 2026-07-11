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
	"fmt"
	"sort"
	"sync"

	"s-forge.local/vectordb/bbq"
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
func (idx *DiskVamanaIndex) Search(query []float32, topK, efSearch int) ([]SearchResult, error) {
	idx.mu.RLock()
	if idx.closed {
		idx.mu.RUnlock()
		return nil, ErrDiskIndexClosed
	}

	total := idx.totalPoints()
	if total == 0 {
		idx.mu.RUnlock()
		return nil, nil
	}

	medoid, hasEntryPoint := idx.liveEntryPointLocked()
	dimension := int(idx.metadata.Dims)
	idx.mu.RUnlock()
	if !hasEntryPoint {
		return nil, nil
	}

	// Validate query dimension
	if len(query) != dimension {
		return nil, fmt.Errorf("%w: expected %d, got %d", ErrVectorDimensionMismatch, dimension, len(query))
	}

	// Ensure efSearch >= topK
	if efSearch < topK {
		efSearch = topK
	}

	// BBQ 搜索路径使用扩大的 beam 宽度以补偿 1-bit 量化的分辨率损失。
	// internalL = efSearch * bbqOverSearchFactor，确保 internalL >= efSearch。
	// 非 BBQ 路径不受影响，直接使用 efSearch。
	useBBQ := idx.HasBBQ()
	beamWidth := efSearch
	if useBBQ {
		internalL := int(float64(efSearch) * idx.BBQOverSearchFactor())
		if internalL < efSearch {
			internalL = efSearch
		}
		beamWidth = internalL
	}

	// Get search scratch from pool
	scratch := getDiskSearchScratch()
	defer putDiskSearchScratch(scratch)

	// Ensure scratch capacity covers disk + append buffer nodes
	scratch.Visited.EnsureCapacity(int(total))
	scratch.Best.SetCapacity(beamWidth)
	scratch.Reset()

	// Phase 1: Greedy search with BBQ (if available) or direct disk access
	// All greedy search variants now use unified getNeighbors()/getVector()
	// to transparently handle disk nodes, modified neighbors, and append buffer.
	var candidates []Neighbor
	if useBBQ {
		candidates = idx.greedySearchBBQ(scratch, medoid, query, beamWidth)
	} else {
		candidates = idx.greedySearchDisk(scratch, medoid, query, efSearch)
	}

	if len(candidates) == 0 {
		return nil, nil
	}

	// Phase 2: Rerank with original vectors (unified via getVector)
	results := idx.rerankCandidates(candidates, query, topK)

	return results, nil
}

// ============================================================================
// BBQ-based Greedy Search
// ============================================================================

// greedySearchBBQ performs greedy search using BBQ codes for distance estimation.
//
// BBQ 文件只有一种格式（含量化元数据），始终使用量化校正距离路径。
func (idx *DiskVamanaIndex) greedySearchBBQ(scratch *SearchScratch, medoid uint64, query []float32, L int) []Neighbor {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	if idx.closed {
		return nil
	}

	return idx.greedySearchBBQWithMeta(scratch, medoid, query, L)
}

// greedySearchBBQWithMeta 使用量化校正的 BBQ 搜索（融合搜索版本）
//
// 同时搜索磁盘节点和 append buffer 中的节点。
// 磁盘节点使用预计算的 BBQ 元数据，append 节点使用内存中的 BBQ 元数据。
//
// 查询固定量化为 4-bit BitTranspose，数据固定保持 1-bit packed。
func (idx *DiskVamanaIndex) greedySearchBBQWithMeta(scratch *SearchScratch, medoid uint64, query []float32, L int) []Neighbor {
	dimension := int(idx.metadata.Dims)

	// 使用 BBQ 量化器量化查询向量
	// 使用配置中的距离度量，与图构建保持一致
	quantizer := bbq.NewScalarQuantizer(idx.distanceMetric)
	scorer := bbq.NewQuantizedScorer(idx.distanceMetric)

	// 预分配 append 节点量化用的临时缓冲区，在整个搜索过程中复用，
	// 避免每个 append 节点距离计算都分配新切片（规程 1.1: 禁止热循环内 make）
	appendScratch := make([]byte, dimension)

	query4Bit := make([]byte, dimension)
	queryTransposed, queryCorr := bbq.QuantizeAsymmetricQuery(quantizer, query, idx.bbqCentroid, query4Bit)
	distFn := func(nodeID uint32) float32 {
		return idx.fusedBBQDistance4Bit(queryTransposed, queryCorr, query, nodeID, scorer, quantizer, appendScratch)
	}

	// Initialize with medoid
	if !idx.deleted.IsDeleted(medoid) {
		scratch.Visited.Insert(uint32(medoid))
		dist := distFn(uint32(medoid))
		scratch.Best.Insert(Neighbor{ID: uint32(medoid), Distance: dist})
	}

	// Greedy search loop
	for scratch.Best.HasUnvisited() {
		closest, ok := scratch.Best.PopClosestUnvisited()
		if !ok {
			break
		}

		// 使用统一的 getNeighbors：自动处理 modifiedNeighbors、appendNeighbors、磁盘
		neighbors := idx.getNeighbors(uint64(closest.ID))

		for _, neighborID := range neighbors {
			if idx.deleted.IsDeleted(uint64(neighborID)) {
				continue
			}
			if !scratch.Visited.Insert(neighborID) {
				continue
			}

			// 融合 BBQ 距离：磁盘节点用磁盘 BBQ，append 节点用内存 BBQ
			dist := distFn(neighborID)
			scratch.Best.Insert(Neighbor{ID: neighborID, Distance: dist})
		}
	}

	return scratch.Best.All()
}

// bbqCorrectedDistance4Bit 计算带 4-bit BitTranspose 量化校正的 BBQ 距离（磁盘节点，4-bit）。
// 委托 bbqQueryDistance，与内存索引 bbqDistanceToQuery4Bit 共享同一实现。
//
// 查询向量已通过 PackBitTranspose4 转为 BitTranspose 布局，
// 索引向量使用 packed 1-bit（bbqCodes，每 8 维 1 字节）。
//
// 调用方必须已持有 idx.mu 的读锁。
func (idx *DiskVamanaIndex) bbqCorrectedDistance4Bit(
	queryTransposed []byte,
	queryCorr bbq.QuantizationResult,
	nodeID uint32,
	scorer *bbq.QuantizedScorer,
) float32 {
	return bbqQueryDistance(idx, scorer, nodeID, queryTransposed, queryCorr)
}

// ============================================================================
// Disk-based Greedy Search (fallback when no BBQ)
// ============================================================================

// greedySearchDisk performs greedy search by reading vectors (融合搜索版本).
//
// Uses unified getVector()/getNeighbors() to handle both disk and append buffer nodes.
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
		dist := idx.computeDistance(medoid, query, queryNormSq)
		scratch.Best.Insert(Neighbor{ID: uint32(medoid), Distance: dist})
	}

	// Greedy search loop
	for scratch.Best.HasUnvisited() {
		closest, ok := scratch.Best.PopClosestUnvisited()
		if !ok {
			break
		}

		// 使用统一的 getNeighbors
		neighbors := idx.getNeighbors(uint64(closest.ID))

		for _, neighborID := range neighbors {
			if idx.deleted.IsDeleted(uint64(neighborID)) {
				continue
			}
			if !scratch.Visited.Insert(neighborID) {
				continue
			}

			dist := idx.computeDistance(uint64(neighborID), query, queryNormSq)
			scratch.Best.Insert(Neighbor{ID: neighborID, Distance: dist})
		}
	}

	return scratch.Best.All()
}

// computeDistance 读取节点向量并计算与查询向量的精确欧氏距离平方。
// 统一处理磁盘节点和 append buffer 节点。
// 当向量无法获取时返回 LargeInvalidDistance 哨兵值。
func (idx *DiskVamanaIndex) computeDistance(nodeID uint64, query []float32, queryNormSq float32) float32 {
	vec := idx.getVector(nodeID)
	if vec == nil {
		return LargeInvalidDistance
	}
	return euclideanDistanceWithNorm(vec, query, queryNormSq)
}

// ============================================================================
// Reranking
// ============================================================================

// rerankCandidates reranks candidates using original vectors (融合搜索版本).
//
// Uses unified getVector() to read vectors from disk or append buffer,
// then computes exact distances and returns top-K.
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

	for _, cand := range candidates {
		// Skip deleted nodes (double check)
		if idx.deleted.IsDeleted(uint64(cand.ID)) {
			continue
		}

		// 使用统一的 getVector：磁盘节点走 mmap，append 节点走内存
		vec := idx.getVector(uint64(cand.ID))
		if vec == nil {
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
// Fused Distance Computation (disk + append buffer)
// ============================================================================

// fusedBBQDistance4Bit 计算融合 4-bit BitTranspose BBQ 校正距离。
//
// 磁盘节点：使用 bbqCodes（packed 1-bit）与 BitTranspose 查询做 POPCNT 加速点积。
// Append 节点：实时量化为 packed 1-bit 后与 BitTranspose 查询做 POPCNT 加速点积。
// 无 BBQ 元数据的 append 节点：回退到精确欧氏距离。
// quantizer 和 appendScratch 由调用方预分配并在搜索过程中复用，避免热路径堆分配。
func (idx *DiskVamanaIndex) fusedBBQDistance4Bit(
	queryTransposed []byte,
	queryCorr bbq.QuantizationResult,
	query []float32,
	nodeID uint32,
	scorer *bbq.QuantizedScorer,
	quantizer *bbq.ScalarQuantizer,
	appendScratch []byte,
) float32 {
	diskN := idx.metadata.NumPoints

	if uint64(nodeID) < diskN {
		// 磁盘节点：使用 BitTranspose 4-bit 距离
		return idx.bbqCorrectedDistance4Bit(queryTransposed, queryCorr, nodeID, scorer)
	}

	// Append 节点：使用内存中的 BBQ 元数据
	appendIdx := int(uint64(nodeID) - diskN)
	if appendIdx < len(idx.appendBBQLower) {
		return idx.appendBBQCorrectedDistance4Bit(
			queryTransposed, queryCorr, appendIdx, scorer, quantizer, appendScratch,
		)
	}

	// 无 BBQ 元数据的 append 节点：回退到精确欧氏距离
	vec := idx.getVector(uint64(nodeID))
	if vec == nil {
		return LargeInvalidDistance
	}
	return euclideanDistance(vec, query)
}

// appendBBQCorrectedDistance4Bit 计算 append 节点的 4-bit BitTranspose BBQ 校正距离。
//
// 实时将 append 向量量化为 1-bit（unpacked → packed），委托 bbqScoreWithCode
// 与 BitTranspose 查询做 POPCNT 加速点积与评分。
// quantizer 和 scratchBuf 由调用方预分配，在搜索过程中复用。
func (idx *DiskVamanaIndex) appendBBQCorrectedDistance4Bit(
	queryTransposed []byte,
	queryCorr bbq.QuantizationResult,
	appendIdx int,
	scorer *bbq.QuantizedScorer,
	quantizer *bbq.ScalarQuantizer,
	scratchBuf []byte,
) float32 {
	dimension := int(idx.metadata.Dims)

	// 实时量化 append 向量为 1-bit（unpacked 格式）
	// 复用调用方预分配的 scratchBuf，避免热路径堆分配
	vec := idx.appendVectors[appendIdx]
	// 清零 scratchBuf（Quantize 只写入量化值，需要先清零确保正确性）
	for i := range scratchBuf {
		scratchBuf[i] = 0
	}
	quantizer.Quantize(vec, scratchBuf, 1, idx.bbqCentroid)

	// 将 unpacked 1-bit 打包为 packed 格式，与 bbqCodes 格式一致
	nodePacked := bbq.PackBinary(scratchBuf)

	indexCorr := bbq.QuantizationResult{
		LowerBound:   idx.appendBBQLower[appendIdx],
		UpperBound:   idx.appendBBQUpper[appendIdx],
		Correction:   idx.appendBBQCorr[appendIdx],
		QuantizedSum: idx.appendBBQSumSq[appendIdx],
	}

	return bbqScoreWithCode(scorer, nodePacked, indexCorr, dimension, queryTransposed, queryCorr)
}
