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
	"sync/atomic"
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
	dim := idx.dimension

	// 分配连续内存块，一次性容纳所有向量数据
	idx.vectorData = make([]float32, n*dim)
	idx.vectors = make([][]float32, n)
	for i, v := range vectors {
		offset := i * dim
		copy(idx.vectorData[offset:offset+dim], v)
		idx.vectors[i] = idx.vectorData[offset : offset+dim : offset+dim]
	}
	idx.neighbors = make([][]uint32, n)
	idx.neighborPtrs = make([]atomic.Pointer[[]uint32], n)
	idx.nodeLocks = make([]sync.RWMutex, n)
	for i := range idx.neighbors {
		initial := make([]uint32, 0, idx.config.R)
		idx.neighbors[i] = initial
		idx.neighborPtrs[i].Store(&initial)
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

	// 2. RobustPrune剪枝
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
		idx.addEdgeAndPrune(neighbors[i], id, scratch)
	}
}

// setNeighborsLocked 使用节点级锁设置邻居。
// 并行构建期间，其他工作线程可能已经为该节点写入反向边；合并而非覆盖可保持图可达性。
// 同时通过 atomic.Store 更新 neighborPtrs，供 greedySearchForBuild 无锁读取。
func (idx *VamanaIndex) setNeighborsLocked(id uint32, neighbors []uint32) {
	idx.nodeLocks[id].Lock()
	defer idx.nodeLocks[id].Unlock()

	merged := make([]uint32, 0, len(neighbors)+len(idx.neighbors[id]))
	for _, neighbor := range neighbors {
		if !containsID(merged, neighbor) {
			merged = append(merged, neighbor)
		}
	}
	for _, neighbor := range idx.neighbors[id] {
		if !containsID(merged, neighbor) {
			merged = append(merged, neighbor)
		}
	}
	idx.neighbors[id] = merged
	if idx.neighborPtrs != nil {
		idx.neighborPtrs[id].Store(&merged)
	}
}

// addEdgeAndPruneLocked 添加反向边（使用节点级锁）
// 采用 IP-DiskANN inter_insert 的 lock-copy-unlock-prune-lock-write 模式
// (参照 IP-DiskANN src/index.cpp L1231-1276)：
//   - Phase 1 (持锁): 快速检查 + 拷贝邻居列表，决定是否需要剪枝
//   - Phase 2 (无锁): 在锁外执行昂贵的距离计算和 robustPrune
//   - Phase 3 (持锁): 写入剪枝结果
//
// 采用 GRAPH_SLACK_FACTOR 策略：允许邻居数量超过 R，
// 只有当超过 GraphSlackFactor * R 时才触发剪枝，大幅减少剪枝次数
func (idx *VamanaIndex) addEdgeAndPruneLocked(nodeID, newNeighborID uint32) {
	// ── Phase 1 (持锁): 快速检查 + 拷贝 ──
	idx.nodeLocks[nodeID].Lock()

	currentNeighbors := idx.neighbors[nodeID]

	// 检查是否已存在
	if containsID(currentNeighbors, newNeighborID) {
		idx.nodeLocks[nodeID].Unlock()
		return
	}

	// 计算松弛后的最大度数
	maxDegreeWithSlack := int(idx.config.GraphSlackFactor * float32(idx.config.R))

	// 如果未超过松弛阈值，直接添加（不触发剪枝）
	if len(currentNeighbors) < maxDegreeWithSlack {
		updated := append(idx.neighbors[nodeID], newNeighborID)
		idx.neighbors[nodeID] = updated
		if idx.neighborPtrs != nil {
			idx.neighborPtrs[nodeID].Store(&updated)
		}
		idx.nodeLocks[nodeID].Unlock()
		return
	}

	// 需要剪枝：拷贝邻居列表后释放锁
	copyOfNeighbors := make([]uint32, len(currentNeighbors), len(currentNeighbors)+1)
	copy(copyOfNeighbors, currentNeighbors)
	copyOfNeighbors = append(copyOfNeighbors, newNeighborID)

	idx.nodeLocks[nodeID].Unlock()

	// ── Phase 2 (无锁): 距离计算 + robustPrune ──
	nodeVector := idx.vectors[nodeID]
	nodeNormSq := idx.normSquares[nodeID]
	candidates := make([]Neighbor, 0, len(copyOfNeighbors))

	for i, nid := range copyOfNeighbors {
		// 预取下一个邻居的向量数据，与当前距离计算重叠内存延迟
		if i+1 < len(copyOfNeighbors) {
			idx.prefetchVector(copyOfNeighbors[i+1])
		}
		dist := idx.fastDistanceToQuery(nid, nodeVector, nodeNormSq)
		candidates = append(candidates, Neighbor{ID: nid, Distance: dist})
	}

	newNeighbors := idx.robustPrune(nodeID, candidates, idx.config.R, idx.config.Alpha)

	// ── Phase 3 (持锁): 写入剪枝结果 ──
	idx.nodeLocks[nodeID].Lock()
	idx.neighbors[nodeID] = newNeighbors
	if idx.neighborPtrs != nil {
		idx.neighborPtrs[nodeID].Store(&newNeighbors)
	}
	idx.nodeLocks[nodeID].Unlock()
}

// addEdgeAndPrune 添加反向边，必要时剪枝
// 采用与 addEdgeAndPruneLocked 一致的 lock-copy-unlock-prune-lock-write 模式
// 和 GraphSlackFactor 松弛策略，大幅减少剪枝次数
// scratch: 复用的搜索临时空间，用于 robustPruneWithScratch 避免重复分配
func (idx *VamanaIndex) addEdgeAndPrune(nodeID, newNeighborID uint32, scratch *SearchScratch) {
	// ── Phase 1 (持锁): 快速检查 + 拷贝 ──
	idx.nodeLocks[nodeID].Lock()

	currentNeighbors := idx.neighbors[nodeID]

	// 检查是否已存在
	if containsID(currentNeighbors, newNeighborID) {
		idx.nodeLocks[nodeID].Unlock()
		return
	}

	// 计算松弛后的最大度数
	maxDegreeWithSlack := int(idx.config.GraphSlackFactor * float32(idx.config.R))

	// 如果未超过松弛阈值，直接添加（不触发剪枝）
	if len(currentNeighbors) < maxDegreeWithSlack {
		updated := append(idx.neighbors[nodeID], newNeighborID)
		idx.neighbors[nodeID] = updated
		if idx.neighborPtrs != nil {
			idx.neighborPtrs[nodeID].Store(&updated)
		}
		idx.nodeLocks[nodeID].Unlock()
		return
	}

	// 需要剪枝：拷贝邻居列表后释放锁
	copyOfNeighbors := make([]uint32, len(currentNeighbors), len(currentNeighbors)+1)
	copy(copyOfNeighbors, currentNeighbors)
	copyOfNeighbors = append(copyOfNeighbors, newNeighborID)

	idx.nodeLocks[nodeID].Unlock()

	// ── Phase 2 (无锁): 距离计算 + robustPrune ──
	nodeVector := idx.vectors[nodeID]
	nodeNormSq := idx.normSquares[nodeID]
	candidates := make([]Neighbor, 0, len(copyOfNeighbors))

	for i, nid := range copyOfNeighbors {
		// 预取下一个邻居的向量数据，与当前距离计算重叠内存延迟
		if i+1 < len(copyOfNeighbors) {
			idx.prefetchVector(copyOfNeighbors[i+1])
		}
		dist := idx.fastDistanceToQuery(nid, nodeVector, nodeNormSq)
		candidates = append(candidates, Neighbor{ID: nid, Distance: dist})
	}

	newNeighbors := idx.robustPruneWithScratch(nodeID, candidates, idx.config.R, idx.config.Alpha, scratch)

	// ── Phase 3 (持锁): 写入剪枝结果 ──
	idx.nodeLocks[nodeID].Lock()
	idx.neighbors[nodeID] = newNeighbors
	if idx.neighborPtrs != nil {
		idx.neighborPtrs[nodeID].Store(&newNeighbors)
	}
	idx.nodeLocks[nodeID].Unlock()
}

// Insert 单点插入
func (idx *VamanaIndex) Insert(vector []float32) (uint32, error) {
	idx.mu.Lock()

	// 分配新ID
	id := uint32(len(idx.vectors))
	dim := idx.dimension

	// 添加向量到连续内存布局
	requiredLen := (int(id) + 1) * dim
	if requiredLen > cap(idx.vectorData) {
		// 容量不足，2x 扩容
		newCap := cap(idx.vectorData) * 2
		if newCap < requiredLen {
			newCap = requiredLen * 2
		}
		newData := make([]float32, requiredLen, newCap)
		copy(newData, idx.vectorData)
		idx.vectorData = newData
		// 底层数组地址变了，重建所有 sub-slice 视图
		idx.rebuildVectorViews()
	} else {
		idx.vectorData = idx.vectorData[:requiredLen]
	}

	// 将新向量数据复制到连续存储
	offset := int(id) * dim
	copy(idx.vectorData[offset:offset+dim], vector)

	// 创建 sub-slice 视图
	idx.vectors = append(idx.vectors, idx.vectorData[offset:offset+dim:offset+dim])

	idx.neighbors = append(idx.neighbors, nil)

	// 预计算范数平方
	queryNormSq := computeNormSquare(vector)
	idx.normSquares = append(idx.normSquares, queryNormSq)

	// 扩展节点锁（2x 扩容策略，避免每次 Insert 都重建）
	if int(id) >= len(idx.nodeLocks) {
		newCap := len(idx.nodeLocks) * 2
		if newCap < int(id)+1 {
			newCap = (int(id) + 1) * 2
		}
		newLocks := make([]sync.RWMutex, newCap)
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

	// 1. 贪婪搜索找候选（使用预计算的 queryNormSq 避免重复计算）
	startIDs := []uint32{idx.medoid}
	candidates := idx.greedySearchFast(scratch, startIDs, vector, queryNormSq, idx.config.L)

	// 2. RobustPrune剪枝
	neighbors := idx.robustPruneWithScratch(id, candidates, idx.config.R, idx.config.Alpha, scratch)

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
		idx.addEdgeAndPrune(neighbors[i], id, scratch)
	}
	return id, nil
}

// ============================================================================
// 剪枝算法相关函数
// ============================================================================

// robustPruneCore 是 RobustPrune 剪枝算法的核心实现。
// 使用 lastChecked 数组实现增量式距离计算，避免 O(n²) 重复计算。
// 调用者负责提供已初始化（零值）的辅助数组 occludeFactor、lastChecked 和 resultPos。
func (idx *VamanaIndex) robustPruneCore(
	nodeID uint32, candidates []Neighbor, n int, maxDegree int, alpha float32,
	occludeFactor []float32, lastChecked []int, resultPos *[]int,
) []uint32 {
	// 候选集截断：将候选数限制为 2×maxDegree（即 2×R），
	// 丢弃距离最远的候选以大幅减少内循环 O(n×|result|) 的距离计算次数。
	// 候选集已由调用者按距离升序排列，截断尾部即丢弃最远候选。
	maxCandidates := 2 * maxDegree
	if n > maxCandidates {
		n = maxCandidates
		candidates = candidates[:n]
	}

	// Progressive alpha 多轮扫描：先用 alpha=1.0 选择最近邻，
	// 再用目标 alpha 放宽遮挡阈值补充多样性邻居。
	// 参照 IP-DiskANN src/index.cpp 的 robustPrune 实现。
	for curAlpha := float32(1.0); curAlpha <= alpha+0.01; curAlpha *= 1.2 {
		if curAlpha > alpha {
			curAlpha = alpha
		}
		for i := 0; i < n; i++ {
			if len(*resultPos) >= maxDegree {
				break
			}

			if occludeFactor[i] > curAlpha {
				continue
			}

			// 预取当前候选的向量数据，与 occludeFactor 判断重叠内存延迟
			// 此处 cand.ID 的向量即将在 fastDistance 中被访问
			cand := &candidates[i]
			idx.prefetchVector(cand.ID)

			if cand.ID == nodeID {
				occludeFactor[i] = math.MaxFloat32
				continue
			}

			skip := false
			for lastChecked[i] < len(*resultPos) {
				resultIdx := (*resultPos)[lastChecked[i]]
				lastChecked[i]++

				if resultIdx >= i {
					continue
				}

				selectedID := candidates[resultIdx].ID
				distCN := idx.fastDistance(cand.ID, selectedID)

				if distCN < cand.Distance {
					newFactor := cand.Distance / distCN
					if newFactor > occludeFactor[i] {
						occludeFactor[i] = newFactor
					}
				}

				if occludeFactor[i] > curAlpha {
					skip = true
					break
				}
			}

			if !skip && occludeFactor[i] <= curAlpha {
				*resultPos = append(*resultPos, i)
				occludeFactor[i] = math.MaxFloat32
			}
		}
	}

	// 将位置索引转换为实际的节点 ID
	result := make([]uint32, len(*resultPos))
	for i, pos := range *resultPos {
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

// robustPrune RobustPrune剪枝算法
// 选择多样性好的邻居，避免邻居之间过于接近
func (idx *VamanaIndex) robustPrune(nodeID uint32, candidates []Neighbor, maxDegree int, alpha float32) []uint32 {
	if len(candidates) == 0 {
		return nil
	}

	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].Distance < candidates[j].Distance
	})

	n := len(candidates)
	if n > idx.config.MaxOcclusionSize {
		n = idx.config.MaxOcclusionSize
		candidates = candidates[:n]
	}

	occludeFactor := make([]float32, n)
	lastChecked := make([]int, n)
	resultPos := make([]int, 0, maxDegree)

	return idx.robustPruneCore(nodeID, candidates, n, maxDegree, alpha,
		occludeFactor, lastChecked, &resultPos)
}

// robustPruneWithScratch 使用scratch缓冲区的RobustPrune剪枝算法
// 避免每次调用分配临时数组，减少GC压力
func (idx *VamanaIndex) robustPruneWithScratch(nodeID uint32, candidates []Neighbor, maxDegree int, alpha float32, scratch *SearchScratch) []uint32 {
	if len(candidates) == 0 {
		return nil
	}

	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].Distance < candidates[j].Distance
	})

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
	clear(scratch.OccludeFactor)

	if cap(scratch.LastChecked) < n {
		scratch.LastChecked = make([]int, n)
	}
	scratch.LastChecked = scratch.LastChecked[:n]
	clear(scratch.LastChecked)

	if cap(scratch.ResultPos) < maxDegree {
		scratch.ResultPos = make([]int, 0, maxDegree)
	}
	scratch.ResultPos = scratch.ResultPos[:0]

	return idx.robustPruneCore(nodeID, candidates, n, maxDegree, alpha,
		scratch.OccludeFactor, scratch.LastChecked, &scratch.ResultPos)
}
