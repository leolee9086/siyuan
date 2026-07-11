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

package hnsw

import (
	"sync"

	"s-forge.local/vectordb/bbq"
)

// heapPool 复用 MinHeap/MaxHeap 以减少 GC 压力。
// searchLevel 每次插入的每一层都会创建堆，1M 节点构建时产生数百万次分配。
var minHeapPool = sync.Pool{
	New: func() interface{} { return NewMinHeap() },
}

var maxHeapPool = sync.Pool{
	New: func() interface{} { return NewMaxHeap(256) },
}

// resetHeap 将堆清空但保留底层数组容量，供 sync.Pool 复用。
func resetMinHeap(h *MinHeap) {
	h.data = h.data[:0]
}

func resetMaxHeap(h *MaxHeap) {
	h.data = h.data[:0]
}

// =========================================
// HNSW Build (Insert)
// =========================================

// Insert 将一个新节点插入 HNSW 索引。
// docID 是已由外部分配的内部文档 ID，向量已存储在 Distancer 中。
// 返回值表示是否为新插入（非更新）。
func (idx *HNSWIndex) Insert(docID DocID) bool {
	idx.Mu.Lock()
	delete(idx.Deleted, docID)
	idx.Mu.Unlock()

	config := idx.Config
	level := idx.InitItemNeighbors(docID)

	entryPointID, ok := idx.SelectEntryPoint()
	if !ok {
		idx.Mu.Lock()
		if idx.EntryPoint == InvalidEntryPoint {
			idx.EntryPoint = docID
			idx.MaxLayer = level
		}
		idx.Mu.Unlock()
		return true
	}

	// Build HNSW index connections
	idx.buildHNSWIndex(docID, entryPointID, level)

	// Update entry point if new node has higher level
	idx.Mu.Lock()
	if level > idx.MaxLayer {
		idx.MaxLayer = level
		idx.EntryPoint = docID
	}
	idx.Mu.Unlock()

	_ = config // used implicitly via idx.Config in sub-methods
	return true
}

// buildHNSWIndex 为节点构建 HNSW 连接
func (idx *HNSWIndex) buildHNSWIndex(itemDocID DocID, entryPointID DocID, itemLevel int) {
	config := idx.Config
	entryLevel := idx.GetItemLevel(entryPointID)

	currentBestID := entryPointID
	var queryCode []byte
	var queryCorrection bbq.QuantizationResult
	if idx.Dimension >= bbq.BBQEnableThreshold && idx.Distancer != nil {
		queryCode, queryCorrection = idx.Distancer.QuantizeVector(itemDocID)
	}

	// Phase 1: 从顶层贪心搜索到 itemLevel+1
	for level := entryLevel; level > itemLevel; level-- {
		currentBestID = idx.greedySearch(itemDocID, queryCode, queryCorrection, currentBestID, level, config.MetricType)
	}

	// 预分配双向连接维护的缓冲区，在层级循环外分配一次，循环内复用
	// 最大容量 = 2*M + 1（Level 0 最大邻居数 + 新节点）
	candidateBuf := make([]NeighborRecord, 0, config.M*2+1)

	// Phase 2: 在每一层构建连接
	for level := min(entryLevel, itemLevel); level >= 0; level-- {
		candidates := idx.searchLevel(itemDocID, queryCode, queryCorrection, currentBestID, level, config.EfConstruction, config.MetricType)

		M := ExpectedNeighborCount(level, config.M)
		selected := idx.selectNeighborsHeuristic(itemDocID, candidates, M, config.MetricType, true, true)

		idx.SetLevelNeighbors(itemDocID, level, selected)

		// 添加双向连接
		// 优化：直接使用邻居列表中缓存的距离，避免 O(M²) 距离重算
		// 优化：复用预分配的 candidateBuf，避免循环内 make 分配
		// 优化：松弛因子策略 — 当邻居度数未超过 SlackFactor×M 时直接 append，跳过 heuristic 剪枝
		slackM := int(config.GraphSlackFactor * float32(M))
		for _, neighbor := range selected {
			cachedRecords := idx.GetLevelNeighborRecords(neighbor.ID, level)

			// 松弛因子判断：当前度数 + 1（新节点）<= slackM 时直接添加，跳过 heuristic
			if len(cachedRecords)+1 <= slackM {
				idx.SetLevelNeighbors(neighbor.ID, level, append(cachedRecords, NeighborRecord{
					ID:       itemDocID,
					Distance: neighbor.Distance,
				}))
				continue
			}

			// 超过松弛阈值，执行 heuristic 剪枝回到 M
			// 复用缓冲区：重置长度，保留底层数组
			candidateBuf = candidateBuf[:0]
			candidateBuf = append(candidateBuf, cachedRecords...)
			candidateBuf = append(candidateBuf, NeighborRecord{
				ID:       itemDocID,
				Distance: neighbor.Distance,
			})

			newNeighbors := idx.selectNeighborsHeuristic(neighbor.ID, candidateBuf, M, config.MetricType, true, true)
			idx.SetLevelNeighbors(neighbor.ID, level, newNeighbors)
		}

		if len(candidates) > 0 {
			currentBestID = candidates[0].ID
		}
	}
}

// greedySearch 在单层执行贪心搜索（节点对节点）
// 优化：非BBQ路径预取 queryVec，消除每次距离计算中的重复向量查找
func (idx *HNSWIndex) greedySearch(queryID DocID, queryCode []byte, queryCorrection bbq.QuantizationResult, entryPointID DocID, level int, metricType string) DocID {
	currentBestID := entryPointID
	useBQ := len(queryCode) > 0

	if !useBQ && idx.Distancer != nil {
		// 预取 queryVec，后续循环中复用，避免每次 ComputeDistance 都查找 queryID 的向量
		queryVec, ok := idx.Distancer.GetUnsafe(queryID)
		if !ok {
			return currentBestID
		}
		currentDist := idx.Distancer.ComputeDistanceFromVector(queryVec, currentBestID, metricType)
		var neighborIDs []DocID
		var distances []float32

		improved := true
		for improved {
			improved = false
			neighbors := idx.GetLevelNeighborRecords(currentBestID, level)
			if neighbors == nil {
				break
			}
			neighborIDs = neighborRecordIDs(neighbors, neighborIDs)
			distances = idx.Distancer.ComputeDistancesFromVector(queryVec, neighborIDs, metricType, distances)
			for index, neighbor := range neighbors {
				dist := distances[index]
				if dist < currentDist {
					currentBestID = neighbor.ID
					currentDist = dist
					improved = true
				}
			}
		}
		return currentBestID
	}
	if !useBQ {
		currentDist := validDistance(idx.nodeDistancer.ComputeDistance(queryID, currentBestID, metricType))
		improved := true
		for improved {
			improved = false
			neighbors := idx.GetLevelNeighborRecords(currentBestID, level)
			for _, neighbor := range neighbors {
				dist := validDistance(idx.nodeDistancer.ComputeDistance(queryID, neighbor.ID, metricType))
				if dist < currentDist {
					currentBestID = neighbor.ID
					currentDist = dist
					improved = true
				}
			}
		}
		return currentBestID
	}

	// BBQ 路径：新插入向量作为 4-bit query，已有节点保持 1-bit data code。
	currentDist := idx.Distancer.ComputeBBQDistanceFromQuery(queryCode, queryCorrection, currentBestID)
	var neighborIDs []DocID
	var distances []float32
	improved := true
	for improved {
		improved = false
		neighbors := idx.GetLevelNeighborRecords(currentBestID, level)
		if neighbors == nil {
			break
		}
		neighborIDs = neighborRecordIDs(neighbors, neighborIDs)
		distances = idx.Distancer.ComputeBBQDistancesFromQuery(queryCode, queryCorrection, neighborIDs, distances)
		for index, neighbor := range neighbors {
			dist := distances[index]
			if dist < currentDist {
				currentBestID = neighbor.ID
				currentDist = dist
				improved = true
			}
		}
	}

	return currentBestID
}

// searchLevel 在指定层搜索 ef 个候选节点（节点对节点）
// 优化：非BBQ路径预取 queryVec，消除每次距离计算中的重复向量查找
func (idx *HNSWIndex) searchLevel(queryID DocID, queryCode []byte, queryCorrection bbq.QuantizationResult, entryPointID DocID, level int, ef int, metricType string) []NeighborRecord {
	useBQ := len(queryCode) > 0
	if !useBQ && idx.Distancer == nil {
		return idx.searchLevelByNode(queryID, entryPointID, level, ef, metricType)
	}
	epoch := idx.Distancer.NewSearchEpoch()

	candidates := minHeapPool.Get().(*MinHeap)
	resetMinHeap(candidates)
	defer minHeapPool.Put(candidates)

	results := maxHeapPool.Get().(*MaxHeap)
	resetMaxHeap(results)
	results.capacity = ef
	defer maxHeapPool.Put(results)

	// 非BBQ路径：预取 queryVec 避免重复查找
	var queryVec []float32
	if !useBQ {
		var ok bool
		queryVec, ok = idx.Distancer.GetUnsafe(queryID)
		if !ok {
			return nil
		}
	}

	var entryDist float32
	if useBQ {
		entryDist = idx.Distancer.ComputeBBQDistanceFromQuery(queryCode, queryCorrection, entryPointID)
	} else {
		entryDist = idx.Distancer.ComputeDistanceFromVector(queryVec, entryPointID, metricType)
	}

	candidates.Push(HeapItem{ID: entryPointID, Distance: entryDist})
	results.Push(HeapItem{ID: entryPointID, Distance: entryDist})
	idx.Distancer.MarkVisited(entryPointID, epoch)
	var neighborIDs []DocID
	var distances []float32

	for candidates.Len() > 0 {
		current := candidates.Pop()

		if results.IsFull() && current.Distance > results.Peek().Distance {
			break
		}

		neighbors := idx.GetLevelNeighborRecords(current.ID, level)
		if neighbors == nil {
			continue
		}

		if !useBQ {
			neighborIDs = neighborIDs[:0]
			for _, neighbor := range neighbors {
				if idx.Distancer.IsVisited(neighbor.ID, epoch) {
					continue
				}
				idx.Distancer.MarkVisited(neighbor.ID, epoch)
				neighborIDs = append(neighborIDs, neighbor.ID)
			}
			distances = idx.Distancer.ComputeDistancesFromVector(queryVec, neighborIDs, metricType, distances)
			for index, neighborID := range neighborIDs {
				dist := distances[index]
				if !results.IsFull() {
					candidates.Push(HeapItem{ID: neighborID, Distance: dist})
					results.Push(HeapItem{ID: neighborID, Distance: dist})
				} else if dist < results.Peek().Distance {
					candidates.Push(HeapItem{ID: neighborID, Distance: dist})
					results.Replace(HeapItem{ID: neighborID, Distance: dist})
				}
			}
			continue
		}

		neighborIDs = neighborIDs[:0]
		for _, neighbor := range neighbors {
			if idx.Distancer.IsVisited(neighbor.ID, epoch) {
				continue
			}
			idx.Distancer.MarkVisited(neighbor.ID, epoch)
			neighborIDs = append(neighborIDs, neighbor.ID)
		}
		distances = idx.Distancer.ComputeBBQDistancesFromQuery(queryCode, queryCorrection, neighborIDs, distances)
		for index, neighborID := range neighborIDs {
			dist := distances[index]

			if !results.IsFull() {
				candidates.Push(HeapItem{ID: neighborID, Distance: dist})
				results.Push(HeapItem{ID: neighborID, Distance: dist})
			} else if dist < results.Peek().Distance {
				candidates.Push(HeapItem{ID: neighborID, Distance: dist})
				results.Replace(HeapItem{ID: neighborID, Distance: dist})
			}
		}
	}

	result := make([]NeighborRecord, 0, results.Len())
	for results.Len() > 0 {
		item := results.Pop()
		result = append(result, NeighborRecord{
			ID:       item.ID,
			Distance: item.Distance,
		})
	}

	// MaxHeap.Pop 按降序弹出（最大距离优先），反转即得升序。
	// 替代 sort.Slice（反射开销），O(n) 反转 vs O(n log n) 排序。
	for i, j := 0, len(result)-1; i < j; i, j = i+1, j-1 {
		result[i], result[j] = result[j], result[i]
	}

	return result
}

// searchLevelByNode 使用节点间距离构建非向量图，访问集合只在当前插入中存活。
func (idx *HNSWIndex) searchLevelByNode(queryID DocID, entryPointID DocID, level int, ef int, metricType string) []NeighborRecord {
	candidates := minHeapPool.Get().(*MinHeap)
	resetMinHeap(candidates)
	defer minHeapPool.Put(candidates)

	results := maxHeapPool.Get().(*MaxHeap)
	resetMaxHeap(results)
	results.capacity = ef
	defer maxHeapPool.Put(results)

	entryDist := validDistance(idx.nodeDistancer.ComputeDistance(queryID, entryPointID, metricType))
	candidates.Push(HeapItem{ID: entryPointID, Distance: entryDist})
	results.Push(HeapItem{ID: entryPointID, Distance: entryDist})
	visited := map[DocID]struct{}{entryPointID: {}}

	for candidates.Len() > 0 {
		current := candidates.Pop()
		if results.IsFull() && current.Distance > results.Peek().Distance {
			break
		}
		for _, neighbor := range idx.GetLevelNeighborRecords(current.ID, level) {
			if _, ok := visited[neighbor.ID]; ok {
				continue
			}
			visited[neighbor.ID] = struct{}{}
			dist := validDistance(idx.nodeDistancer.ComputeDistance(queryID, neighbor.ID, metricType))
			if !results.IsFull() {
				candidates.Push(HeapItem{ID: neighbor.ID, Distance: dist})
				results.Push(HeapItem{ID: neighbor.ID, Distance: dist})
			} else if dist < results.Peek().Distance {
				candidates.Push(HeapItem{ID: neighbor.ID, Distance: dist})
				results.Replace(HeapItem{ID: neighbor.ID, Distance: dist})
			}
		}
	}

	result := make([]NeighborRecord, 0, results.Len())
	for results.Len() > 0 {
		item := results.Pop()
		result = append(result, NeighborRecord{ID: item.ID, Distance: item.Distance})
	}
	for i, j := 0, len(result)-1; i < j; i, j = i+1, j-1 {
		result[i], result[j] = result[j], result[i]
	}
	return result
}

// selectNeighborsHeuristic 使用 HNSW 启发式选择邻居，确保连通性和多样性
func (idx *HNSWIndex) selectNeighborsHeuristic(itemID DocID, candidates []NeighborRecord, M int, metricType string, _ bool, keepPrunedConnections bool) []NeighborRecord {
	if len(candidates) <= M {
		return candidates
	}

	sortNeighborsByDistance(candidates)
	if idx.Dimension >= bbq.BBQEnableThreshold && idx.Distancer != nil {
		// BBQ 构图候选已经按 4-bit query × 1-bit data 距离排序。
		// 对前 2M 个候选执行有界多样性筛选，只选出一半邻居，再按距离补齐；这保留长程边，同时限制高维精确距离开销。
		maxCandidates := 2 * M
		if len(candidates) > maxCandidates {
			candidates = candidates[:maxCandidates]
		}
		diverseTarget := M / 4
		if diverseTarget < 1 {
			diverseTarget = 1
		}
		result := make([]NeighborRecord, 0, M)
		for _, candidate := range candidates {
			if len(result) >= diverseTarget {
				break
			}
			isGood := true
			for _, selected := range result {
				if idx.Distancer.ComputeDistance(candidate.ID, selected.ID, metricType) < candidate.Distance {
					isGood = false
					break
				}
			}
			if isGood {
				result = append(result, candidate)
			}
		}
		for _, candidate := range candidates {
			if len(result) >= M {
				break
			}
			if !containsNeighborRecord(result, candidate.ID) {
				result = append(result, candidate)
			}
		}
		return result
	}
	// 与 DiskANN/Vamana 的 RobustPrune 一致，只在最近的 2M 个候选中执行二次多样性判断。
	// 更远候选极少进入最终邻居集，却会把高维精确距离开销放大到 O(efConstruction*M*dim)。
	if maxCandidates := 2 * M; len(candidates) > maxCandidates {
		candidates = candidates[:maxCandidates]
	}

	result := make([]NeighborRecord, 0, M)

	for _, candidate := range candidates {
		if len(result) >= M {
			break
		}

		isGood := true
		var candidateVec []float32
		if idx.Distancer != nil {
			var ok bool
			candidateVec, ok = idx.Distancer.GetUnsafe(candidate.ID)
			if !ok {
				continue
			}
		}
		for _, res := range result {
			var distToRes float32
			if idx.Distancer != nil {
				distToRes = idx.Distancer.ComputeDistanceFromVector(candidateVec, res.ID, metricType)
			} else {
				distToRes = validDistance(idx.nodeDistancer.ComputeDistance(candidate.ID, res.ID, metricType))
			}
			if distToRes < candidate.Distance {
				isGood = false
				break
			}
		}

		if isGood {
			result = append(result, candidate)
		}
	}

	if keepPrunedConnections && len(result) < M {
		for _, candidate := range candidates {
			if len(result) >= M {
				break
			}
			found := false
			for _, res := range result {
				if res.ID == candidate.ID {
					found = true
					break
				}
			}
			if !found {
				result = append(result, candidate)
			}
		}
	}

	return result
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func containsNeighborRecord(records []NeighborRecord, id DocID) bool {
	for _, record := range records {
		if record.ID == id {
			return true
		}
	}
	return false
}
