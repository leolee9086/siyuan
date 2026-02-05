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
	"math"
	"math/rand/v2"
	"runtime"
	"sort"
	"sync"
)

// ============================================================================
// 索引构建相关函数
// ============================================================================

// Build 从向量集合批量构建索引
// 默认使用 CPU 核心数作为并行工作线程数
func (idx *VamanaIndex) Build(vectors [][]float32) error {
	return idx.BuildParallel(vectors, runtime.NumCPU())
}

// BuildParallel 并行构建索引
// numWorkers: 并行工作线程数，建议设置为 CPU 核心数
// 使用分块并行策略，每个 worker 独立处理一批节点
func (idx *VamanaIndex) BuildParallel(vectors [][]float32, numWorkers int) error {
	if len(vectors) == 0 {
		return nil
	}
	if numWorkers <= 0 {
		numWorkers = 1
	}

	// 初始化数据结构
	idx.initializeForBuild(vectors)

	// 预计算所有向量的范数平方
	idx.precomputeNormSquares()

	// 计算质心并选择入口点
	idx.medoid = idx.findMedoid()

	// 随机打乱插入顺序 (提高图质量)
	order := rand.Perm(len(vectors))

	// 分块并行构建
	chunkSize := 10000
	for start := 0; start < len(order); start += chunkSize {
		end := start + chunkSize
		if end > len(order) {
			end = len(order)
		}
		idx.processChunkParallel(order[start:end], numWorkers)
	}

	return nil
}

// initializeForBuild 初始化构建所需的数据结构
func (idx *VamanaIndex) initializeForBuild(vectors [][]float32) {
	idx.mu.Lock()
	defer idx.mu.Unlock()

	n := len(vectors)
	idx.vectors = make([][]float32, n)
	copy(idx.vectors, vectors)
	idx.neighbors = make([][]uint32, n)
	idx.nodeLocks = make([]sync.RWMutex, n)
	for i := range idx.neighbors {
		idx.neighbors[i] = make([]uint32, 0, idx.config.R)
	}
	// 重置删除位图
	idx.deleted = NewBitset(n)
	idx.nDeleted = 0

	// BBQ 量化计算
	if idx.bbqEnabled {
		idx.computeBBQCentroid()
		idx.computeBBQDataParallel(runtime.NumCPU())
	}
}

// processChunkParallel 并行处理一批节点
func (idx *VamanaIndex) processChunkParallel(nodeIDs []int, numWorkers int) {
	if len(nodeIDs) == 0 {
		return
	}

	// 如果节点数少于 worker 数，减少 worker
	if numWorkers > len(nodeIDs) {
		numWorkers = len(nodeIDs)
	}

	var wg sync.WaitGroup
	ch := make(chan int, len(nodeIDs))

	// 将所有节点 ID 放入通道
	for _, id := range nodeIDs {
		ch <- id
	}
	close(ch)

	// 启动 worker
	for w := 0; w < numWorkers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			// 每个 worker 独立的 scratch
			scratch := idx.getScratch()
			defer idx.putScratch(scratch)

			for id := range ch {
				idx.buildNodeWithScratch(uint32(id), scratch)
			}
		}()
	}

	wg.Wait()
}

// buildNodeWithScratch 使用提供的 scratch 为节点构建邻居关系
// 这是并行构建的核心方法，使用节点级锁而非全局锁
func (idx *VamanaIndex) buildNodeWithScratch(id uint32, scratch *SearchScratch) {
	vector := idx.vectors[id]
	// 使用预计算的范数平方（在 precomputeNormSquares 中已计算）
	queryNormSq := idx.normSquares[id]

	// 1. 贪婪搜索找候选（使用无锁版本，避免全局锁竞争）
	startIDs := []uint32{idx.medoid}
	candidates := idx.greedySearchForBuild(scratch, startIDs, vector, queryNormSq, idx.config.L)

	// 2. RobustPrune剪枝（使用scratch复用缓冲区）
	neighbors := idx.robustPruneWithScratch(id, candidates, idx.config.R, idx.config.Alpha, scratch)

	// 3. 使用节点级锁设置邻居
	idx.setNeighborsLocked(id, neighbors)

	// 4. 添加反向边
	maxBackedges := len(neighbors)
	if maxBackedges > idx.config.MaxBackedges {
		maxBackedges = idx.config.MaxBackedges
	}
	for i := 0; i < maxBackedges; i++ {
		idx.addEdgeAndPruneLocked(neighbors[i], id)
	}
}

// buildNode 为已存在的节点构建邻居关系
func (idx *VamanaIndex) buildNode(id uint32) {
	vector := idx.vectors[id]

	scratch := idx.getScratch()
	defer idx.putScratch(scratch)

	// 1. 贪婪搜索找候选
	startIDs := []uint32{idx.medoid}
	candidates := idx.greedySearch(scratch, startIDs, vector, idx.config.L)

	// 2. RobustPrune剪枝
	neighbors := idx.robustPrune(id, candidates, idx.config.R, idx.config.Alpha)

	// 3. 设置节点的邻居
	idx.mu.Lock()
	idx.neighbors[id] = neighbors
	idx.mu.Unlock()

	// 4. 添加反向边
	maxBackedges := len(neighbors)
	if maxBackedges > idx.config.MaxBackedges {
		maxBackedges = idx.config.MaxBackedges
	}
	for i := 0; i < maxBackedges; i++ {
		idx.addEdgeAndPrune(neighbors[i], id)
	}
}

// setNeighborsLocked 使用节点级锁设置邻居
// 注意：idx.neighbors 切片在初始化后不再 resize，因此只需节点锁
func (idx *VamanaIndex) setNeighborsLocked(id uint32, neighbors []uint32) {
	idx.nodeLocks[id].Lock()
	defer idx.nodeLocks[id].Unlock()
	idx.neighbors[id] = neighbors
}

// addEdgeAndPruneLocked 添加反向边（使用节点级锁）
// 采用C++版本的GRAPH_SLACK_FACTOR策略：允许邻居数量超过R，
// 只有当超过 GraphSlackFactor * R 时才触发剪枝，大幅减少剪枝次数
func (idx *VamanaIndex) addEdgeAndPruneLocked(nodeID, newNeighborID uint32) {
	idx.nodeLocks[nodeID].Lock()
	defer idx.nodeLocks[nodeID].Unlock()

	currentNeighbors := idx.neighbors[nodeID]

	// 检查是否已存在
	if containsID(currentNeighbors, newNeighborID) {
		return
	}

	// 计算松弛后的最大度数
	maxDegreeWithSlack := int(idx.config.GraphSlackFactor * float32(idx.config.R))

	// 如果未超过松弛阈值，直接添加（不触发剪枝）
	if len(currentNeighbors) < maxDegreeWithSlack {
		idx.neighbors[nodeID] = append(idx.neighbors[nodeID], newNeighborID)
		return
	}

	// 超过松弛阈值，需要剪枝
	nodeVector := idx.vectors[nodeID]
	nodeNormSq := idx.normSquares[nodeID]
	candidates := make([]Neighbor, 0, len(currentNeighbors)+1)

	for _, nid := range currentNeighbors {
		dist := idx.fastDistanceToQuery(nid, nodeVector, nodeNormSq)
		candidates = append(candidates, Neighbor{ID: nid, Distance: dist})
	}

	// 添加新邻居
	newDist := idx.fastDistanceToQuery(newNeighborID, nodeVector, nodeNormSq)
	candidates = append(candidates, Neighbor{ID: newNeighborID, Distance: newDist})

	// 使用完整的robustPrune剪枝，保证图质量
	newNeighbors := idx.robustPrune(nodeID, candidates, idx.config.R, idx.config.Alpha)

	idx.neighbors[nodeID] = newNeighbors
}

// addEdgeAndPrune 添加反向边，必要时剪枝
func (idx *VamanaIndex) addEdgeAndPrune(nodeID, newNeighborID uint32) {
	idx.nodeLocks[nodeID].Lock()
	defer idx.nodeLocks[nodeID].Unlock()

	idx.mu.RLock()
	currentNeighbors := idx.neighbors[nodeID]
	idx.mu.RUnlock()

	// 检查是否已存在
	if containsID(currentNeighbors, newNeighborID) {
		return
	}

	// 如果未满，直接添加
	if len(currentNeighbors) < idx.config.R {
		idx.mu.Lock()
		idx.neighbors[nodeID] = append(idx.neighbors[nodeID], newNeighborID)
		idx.mu.Unlock()
		return
	}

	// 需要剪枝：构建候选列表
	nodeVector := idx.vectors[nodeID]
	candidates := make([]Neighbor, 0, len(currentNeighbors)+1)

	for _, nid := range currentNeighbors {
		dist := idx.distanceToQuery(nid, nodeVector)
		candidates = append(candidates, Neighbor{ID: nid, Distance: dist})
	}

	// 添加新邻居
	newDist := idx.distanceToQuery(newNeighborID, nodeVector)
	candidates = append(candidates, Neighbor{ID: newNeighborID, Distance: newDist})

	// 剪枝
	newNeighbors := idx.robustPrune(nodeID, candidates, idx.config.R, idx.config.Alpha)

	idx.mu.Lock()
	idx.neighbors[nodeID] = newNeighbors
	idx.mu.Unlock()
}

// Insert 单点插入
func (idx *VamanaIndex) Insert(vector []float32) (uint32, error) {
	idx.mu.Lock()

	// 分配新ID
	id := uint32(len(idx.vectors))

	// 添加向量
	idx.vectors = append(idx.vectors, vector)
	idx.neighbors = append(idx.neighbors, nil)

	// 预计算范数平方
	idx.normSquares = append(idx.normSquares, computeNormSquare(vector))

	// 扩展节点锁
	if int(id) >= len(idx.nodeLocks) {
		newLocks := make([]sync.RWMutex, id+1)
		copy(newLocks, idx.nodeLocks)
		idx.nodeLocks = newLocks
	}

	// 如果是第一个点，设为入口点
	if idx.medoid == math.MaxUint32 {
		idx.medoid = id
		idx.neighbors[id] = make([]uint32, 0)
		idx.mu.Unlock()
		return id, nil
	}

	idx.mu.Unlock()

	// 获取搜索临时空间
	scratch := idx.getScratch()
	defer idx.putScratch(scratch)

	// 1. 贪婪搜索找候选
	startIDs := []uint32{idx.medoid}
	candidates := idx.greedySearch(scratch, startIDs, vector, idx.config.L)

	// 2. RobustPrune剪枝
	neighbors := idx.robustPrune(id, candidates, idx.config.R, idx.config.Alpha)

	// 3. 设置新节点的邻居
	idx.mu.Lock()
	idx.neighbors[id] = neighbors
	idx.mu.Unlock()

	// 4. 添加反向边
	maxBackedges := len(neighbors)
	if maxBackedges > idx.config.MaxBackedges {
		maxBackedges = idx.config.MaxBackedges
	}
	for i := 0; i < maxBackedges; i++ {
		idx.addEdgeAndPrune(neighbors[i], id)
	}

	return id, nil
}

// ============================================================================
// 剪枝算法相关函数
// ============================================================================

// robustPrune RobustPrune剪枝算法
// 选择多样性好的邻居，避免邻居之间过于接近
// 优化版本：使用 lastChecked 数组实现增量式距离计算，避免 O(n²) 重复计算
func (idx *VamanaIndex) robustPrune(nodeID uint32, candidates []Neighbor, maxDegree int, alpha float32) []uint32 {
	if len(candidates) == 0 {
		return nil
	}

	// 按距离排序
	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].Distance < candidates[j].Distance
	})

	// 限制候选数量
	n := len(candidates)
	if n > idx.config.MaxOcclusionSize {
		n = idx.config.MaxOcclusionSize
		candidates = candidates[:n]
	}

	// 初始化辅助数组
	occludeFactor := make([]float32, n)
	// lastChecked[i] 记录候选节点 i 已经与结果列表中的前多少个节点比较过
	// 这样在 alpha 递增时，只需要继续比较新添加的结果节点
	lastChecked := make([]int, n)
	// resultPos[j] 记录结果列表中第 j 个节点在 candidates 中的位置
	// 用于快速查找已选节点的距离信息
	resultPos := make([]int, 0, maxDegree)

	currentAlpha := float32(1.0)
	incrementFactor := float32(1.2)
	if alpha < incrementFactor {
		incrementFactor = alpha
	}

	for len(resultPos) < maxDegree {
		for i := 0; i < n; i++ {
			if len(resultPos) >= maxDegree {
				break
			}

			// 如果遮挡因子已经超过当前 alpha，跳过
			if occludeFactor[i] > currentAlpha {
				continue
			}

			cand := &candidates[i]

			// 排除自身
			if cand.ID == nodeID {
				occludeFactor[i] = math.MaxFloat32
				continue
			}

			// 增量式检查：只计算与新添加的结果节点之间的距离
			// lastChecked[i] 记录了上次检查到的位置
			skip := false
			for lastChecked[i] < len(resultPos) {
				resultIdx := resultPos[lastChecked[i]]
				lastChecked[i]++

				// 如果结果节点在候选列表中的位置 >= 当前位置，
				// 说明结果节点的距离 >= 当前候选节点的距离，不会产生遮挡
				if resultIdx >= i {
					continue
				}

				// 计算候选节点与已选结果节点之间的距离
				// 使用fastDistance利用预计算范数加速
				selectedID := candidates[resultIdx].ID
				distCN := idx.fastDistance(cand.ID, selectedID)

				// 更新遮挡因子（三角不等式剪枝）
				if distCN < cand.Distance {
					newFactor := cand.Distance / distCN
					if newFactor > occludeFactor[i] {
						occludeFactor[i] = newFactor
					}
				}

				// 检查是否超过当前 alpha
				if occludeFactor[i] > currentAlpha {
					skip = true
					break
				}
			}

			// 如果通过所有检查，将此候选节点加入结果
			if !skip && occludeFactor[i] <= currentAlpha {
				resultPos = append(resultPos, i)
				occludeFactor[i] = math.MaxFloat32
			}
		}

		// 如果已达到最大 alpha，退出
		if currentAlpha >= alpha {
			break
		}

		// 递增 alpha 进行下一轮
		currentAlpha = currentAlpha * incrementFactor
		if currentAlpha > alpha {
			currentAlpha = alpha
		}
	}

	// 将位置索引转换为实际的节点 ID
	result := make([]uint32, len(resultPos))
	for i, pos := range resultPos {
		result[i] = candidates[pos].ID
	}

	// 饱和填充
	if idx.config.SaturateAfterPrune && alpha > 1.0 {
		for _, cand := range candidates {
			if len(result) >= maxDegree {
				break
			}
			if !containsID(result, cand.ID) && cand.ID != nodeID {
				result = append(result, cand.ID)
			}
		}
	}

	return result
}

// robustPruneWithScratch 使用scratch缓冲区的RobustPrune剪枝算法
// 避免每次调用分配临时数组，减少GC压力
func (idx *VamanaIndex) robustPruneWithScratch(nodeID uint32, candidates []Neighbor, maxDegree int, alpha float32, scratch *SearchScratch) []uint32 {
	if len(candidates) == 0 {
		return nil
	}

	// 按距离排序
	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].Distance < candidates[j].Distance
	})

	// 限制候选数量
	n := len(candidates)
	if n > idx.config.MaxOcclusionSize {
		n = idx.config.MaxOcclusionSize
		candidates = candidates[:n]
	}

	// 复用scratch缓冲区
	if cap(scratch.OccludeFactor) < n {
		scratch.OccludeFactor = make([]float32, n)
	}
	scratch.OccludeFactor = scratch.OccludeFactor[:n]
	for i := range scratch.OccludeFactor {
		scratch.OccludeFactor[i] = 0
	}

	if cap(scratch.LastChecked) < n {
		scratch.LastChecked = make([]int, n)
	}
	scratch.LastChecked = scratch.LastChecked[:n]
	for i := range scratch.LastChecked {
		scratch.LastChecked[i] = 0
	}

	if cap(scratch.ResultPos) < maxDegree {
		scratch.ResultPos = make([]int, 0, maxDegree)
	}
	scratch.ResultPos = scratch.ResultPos[:0]

	currentAlpha := float32(1.0)
	incrementFactor := float32(1.2)
	if alpha < incrementFactor {
		incrementFactor = alpha
	}

	for len(scratch.ResultPos) < maxDegree {
		for i := 0; i < n; i++ {
			if len(scratch.ResultPos) >= maxDegree {
				break
			}

			if scratch.OccludeFactor[i] > currentAlpha {
				continue
			}

			cand := &candidates[i]

			if cand.ID == nodeID {
				scratch.OccludeFactor[i] = math.MaxFloat32
				continue
			}

			skip := false
			for scratch.LastChecked[i] < len(scratch.ResultPos) {
				resultIdx := scratch.ResultPos[scratch.LastChecked[i]]
				scratch.LastChecked[i]++

				if resultIdx >= i {
					continue
				}

				selectedID := candidates[resultIdx].ID
				distCN := idx.fastDistance(cand.ID, selectedID)

				if distCN < cand.Distance {
					newFactor := cand.Distance / distCN
					if newFactor > scratch.OccludeFactor[i] {
						scratch.OccludeFactor[i] = newFactor
					}
				}

				if scratch.OccludeFactor[i] > currentAlpha {
					skip = true
					break
				}
			}

			if !skip && scratch.OccludeFactor[i] <= currentAlpha {
				scratch.ResultPos = append(scratch.ResultPos, i)
				scratch.OccludeFactor[i] = math.MaxFloat32
			}
		}

		if currentAlpha >= alpha {
			break
		}

		currentAlpha = currentAlpha * incrementFactor
		if currentAlpha > alpha {
			currentAlpha = alpha
		}
	}

	// 将位置索引转换为实际的节点 ID
	result := make([]uint32, len(scratch.ResultPos))
	for i, pos := range scratch.ResultPos {
		result[i] = candidates[pos].ID
	}

	// 饱和填充
	if idx.config.SaturateAfterPrune && alpha > 1.0 {
		for _, cand := range candidates {
			if len(result) >= maxDegree {
				break
			}
			if !containsID(result, cand.ID) && cand.ID != nodeID {
				result = append(result, cand.ID)
			}
		}
	}

	return result
}
