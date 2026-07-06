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

import "math"

// ============================================================================
// 搜索算法相关函数
// ============================================================================

// findMedoid 找到质心最近的点作为入口点
func (idx *VamanaIndex) findMedoid() uint32 {
	n := len(idx.vectors)
	if n == 0 {
		return math.MaxUint32
	}
	if n == 1 {
		return 0
	}

	// 计算质心
	dim := idx.dimension
	centroid := make([]float32, dim)
	for _, v := range idx.vectors {
		for i := range v {
			centroid[i] += v[i]
		}
	}
	invN := 1.0 / float32(n)
	for i := range centroid {
		centroid[i] *= invN
	}

	// 找到离质心最近的点
	var minDist float32 = math.MaxFloat32
	var medoid uint32 = 0
	for i, v := range idx.vectors {
		dist := euclideanDistance(v, centroid)
		if dist < minDist {
			minDist = dist
			medoid = uint32(i)
		}
	}

	return medoid
}

// greedySearch 贪婪搜索算法 (内部使用)
// 返回最近的L个候选节点
// 优化: 整个搜索期间持有读锁，避免每次循环加解锁的开销
func (idx *VamanaIndex) greedySearch(scratch *SearchScratch, startIDs []uint32, query []float32, L int) []Neighbor {
	// 计算查询范数，委托给快速版本
	queryNormSq := computeNormSquare(query)
	return idx.greedySearchFast(scratch, startIDs, query, queryNormSq, L)
}

// greedySearchFast 使用预计算范数的快速贪婪搜索
// queryNormSq: 预计算的查询向量范数平方
// 使用有序数组 + flag标记的 NeighborPriorityQueue，O(1) 拒绝路径在大规模下更高效
func (idx *VamanaIndex) greedySearchFast(scratch *SearchScratch, startIDs []uint32, query []float32, queryNormSq float32, L int) []Neighbor {
	scratch.Reset()

	// 整个搜索期间持有读锁
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	scratch.Visited.EnsureCapacity(len(idx.vectors))
	scratch.Best.SetCapacity(L)

	// 初始化: 从入口点开始
	for _, startID := range startIDs {
		if int(startID) >= len(idx.vectors) {
			continue
		}
		// 跳过已删除节点
		if idx.deleted.Test(startID) {
			continue
		}
		scratch.Visited.Insert(startID)
		dist := idx.fastDistanceToQuery(startID, query, queryNormSq)
		scratch.Best.Insert(Neighbor{ID: startID, Distance: dist})
		scratch.Cmps++
	}

	// 贪婪搜索
	for scratch.Best.HasUnvisited() {
		// 获取最近的未展开候选（含早停判断）
		closest, ok := scratch.Best.PopClosestUnvisited()
		if !ok {
			break
		}

		// 展开邻居 (不再需要加锁，已在函数开始时持有读锁)
		neighbors := idx.neighbors[closest.ID]

		for i, neighborID := range neighbors {
			// 预取下一个邻居的向量数据，与当前距离计算重叠内存延迟
			if i+1 < len(neighbors) {
				idx.prefetchVector(neighbors[i+1])
			}
			// 跳过已删除节点
			if idx.deleted.Test(neighborID) {
				continue
			}
			if scratch.Visited.Insert(neighborID) {
				dist := idx.fastDistanceToQuery(neighborID, query, queryNormSq)
				scratch.Best.Insert(Neighbor{ID: neighborID, Distance: dist})
				scratch.Cmps++
			}
		}
		scratch.Hops++
	}

	return scratch.Best.All()
}

// greedySearchForBuild 构建专用的贪婪搜索
// 在并行构建期间使用，通过 atomic.Pointer 无锁读取邻居快照
// 前提：idx.vectors 和 idx.neighborPtrs 外层切片大小在构建期间不变
// 同步策略（参照 IP-DiskANN src/index.cpp L944-948）：
//   - 写端：nodeLocks[id].Lock() → 修改 neighbors → neighborPtrs[id].Store() → Unlock()
//   - 读端：neighborPtrs[id].Load() 获取一致快照，零锁开销
//
// 读端可能读到旧值或新值，但一定是完整的 slice header。
// 这与 IP-DiskANN 的 greedy_search 语义等价：读到的可能是旧邻居列表，
// 对贪婪搜索的正确性没有影响（仅影响搜索质量的微小差异）。
func (idx *VamanaIndex) greedySearchForBuild(scratch *SearchScratch, startIDs []uint32, query []float32, queryNormSq float32, L int) []Neighbor {
	scratch.Reset()
	scratch.Visited.EnsureCapacity(len(idx.vectors))
	scratch.Best.SetCapacity(L)

	// 初始化: 从入口点开始
	for _, startID := range startIDs {
		if int(startID) >= len(idx.vectors) {
			continue
		}
		scratch.Visited.Insert(startID)
		dist := idx.fastDistanceToQuery(startID, query, queryNormSq)
		scratch.Best.Insert(Neighbor{ID: startID, Distance: dist})
		scratch.Cmps++
	}

	// 贪婪搜索（atomic.Load 无锁读取邻居快照）
	for scratch.Best.HasUnvisited() {
		closest, ok := scratch.Best.PopClosestUnvisited()
		if !ok {
			break
		}

		// 通过 atomic.Pointer 无锁读取邻居快照
		// 写端通过 setNeighborsLocked/addEdgeAndPruneLocked 中的 Store 保证一致性
		neighborsPtr := idx.neighborPtrs[closest.ID].Load()
		if neighborsPtr == nil {
			scratch.Hops++
			continue
		}
		neighbors := *neighborsPtr

		for i, neighborID := range neighbors {
			// 预取下一个邻居的向量数据，与当前距离计算重叠内存延迟
			if i+1 < len(neighbors) {
				idx.prefetchVector(neighbors[i+1])
			}
			// 边界检查：跳过无效的邻居ID
			if int(neighborID) >= len(idx.vectors) {
				continue
			}
			if scratch.Visited.Insert(neighborID) {
				dist := idx.fastDistanceToQuery(neighborID, query, queryNormSq)
				scratch.Best.Insert(Neighbor{ID: neighborID, Distance: dist})
				scratch.Cmps++
			}
		}
		scratch.Hops++
	}

	return scratch.Best.All()
}

// Search 搜索最近的K个邻居，返回 SearchResult 切片。
func (idx *VamanaIndex) Search(query []float32, topK, efSearch int) ([]SearchResult, error) {
	idx.mu.RLock()
	if len(idx.vectors) == 0 || idx.medoid == math.MaxUint32 {
		idx.mu.RUnlock()
		return nil, nil
	}
	idx.mu.RUnlock()

	neighbors := idx.searchNeighbors(query, topK, efSearch)

	// 转换为 SearchResult
	results := make([]SearchResult, len(neighbors))
	for i, n := range neighbors {
		results[i] = SearchResult{
			ID:       uint64(n.ID),
			Distance: n.Distance,
		}
	}
	return results, nil
}

// searchNeighbors 内部搜索方法，返回 Neighbor 切片（供内部和 BBQ 使用）。
func (idx *VamanaIndex) searchNeighbors(query []float32, k int, efSearch int) []Neighbor {
	scratch := idx.getScratch()
	defer idx.putScratch(scratch)

	L := efSearch
	if L < k {
		L = k
	}

	// 贪婪搜索
	startIDs := []uint32{idx.medoid}
	candidates := idx.greedySearch(scratch, startIDs, query, L)

	// 返回Top-K
	if len(candidates) > k {
		candidates = candidates[:k]
	}

	result := make([]Neighbor, len(candidates))
	copy(result, candidates)
	return result
}
