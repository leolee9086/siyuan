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
	"errors"
	"math"
	"math/rand/v2"
	"runtime"
	"sort"
	"sync"
)

// 错误定义
var (
	ErrAlreadyDeleted = errors.New("node already deleted")
	ErrNodeNotFound   = errors.New("node not found")
)

// VamanaIndex Vamana图索引主结构
type VamanaIndex struct {
	// 配置参数
	config Config

	// 向量数据 (内存版本)
	vectors   [][]float32
	dimension int

	// 图结构
	neighbors [][]uint32 // neighbors[nodeID] = []neighborIDs
	medoid    uint32     // 入口点

	// 预计算数据 (性能优化)
	normSquares []float32 // 每个向量的 ||v||² 预计算值

	// 软删除支持
	deleted  *Bitset // 已删除节点位图
	nDeleted uint64  // 删除计数

	// 并发控制
	mu        sync.RWMutex
	nodeLocks []sync.RWMutex

	// 搜索临时空间池
	scratchPool sync.Pool
}

// New 创建新的Vamana索引
func New(dimension int, config Config) *VamanaIndex {
	config.Validate()
	idx := &VamanaIndex{
		config:      config,
		dimension:   dimension,
		vectors:     make([][]float32, 0),
		neighbors:   make([][]uint32, 0),
		medoid:      math.MaxUint32,
		normSquares: make([]float32, 0),
		deleted:     NewBitset(1024),
		nDeleted:    0,
	}

	idx.scratchPool = sync.Pool{
		New: func() interface{} {
			return NewSearchScratch(1024, config.L)
		},
	}

	return idx
}

// NumPoints 返回索引中的点数 (不含已删除)
func (idx *VamanaIndex) NumPoints() int {
	idx.mu.RLock()
	defer idx.mu.RUnlock()
	return len(idx.vectors) - int(idx.nDeleted)
}

// NumPointsTotal 返回索引中的总点数 (含已删除)
func (idx *VamanaIndex) NumPointsTotal() int {
	idx.mu.RLock()
	defer idx.mu.RUnlock()
	return len(idx.vectors)
}

// NumDeleted 返回已删除的点数
func (idx *VamanaIndex) NumDeleted() uint64 {
	idx.mu.RLock()
	defer idx.mu.RUnlock()
	return idx.nDeleted
}

// Dimension 返回向量维度
func (idx *VamanaIndex) Dimension() int {
	return idx.dimension
}

// getScratch 获取搜索临时空间
func (idx *VamanaIndex) getScratch() *SearchScratch {
	return idx.scratchPool.Get().(*SearchScratch)
}

// putScratch 归还搜索临时空间
func (idx *VamanaIndex) putScratch(s *SearchScratch) {
	idx.scratchPool.Put(s)
}

// distance 计算两个节点之间的欧氏距离
func (idx *VamanaIndex) distance(id1, id2 uint32) float32 {
	v1 := idx.vectors[id1]
	v2 := idx.vectors[id2]
	return euclideanDistance(v1, v2)
}

// distanceToQuery 计算节点到查询向量的欧氏距离
func (idx *VamanaIndex) distanceToQuery(id uint32, query []float32) float32 {
	return euclideanDistance(idx.vectors[id], query)
}

// euclideanDistance 计算欧氏距离的平方 (避免开方以提高性能)
// 使用4路循环展开优化，减少循环开销
func euclideanDistance(a, b []float32) float32 {
	n := len(a)
	var sum0, sum1, sum2, sum3 float32

	// 4路展开主循环
	i := 0
	for ; i <= n-4; i += 4 {
		d0 := a[i] - b[i]
		d1 := a[i+1] - b[i+1]
		d2 := a[i+2] - b[i+2]
		d3 := a[i+3] - b[i+3]
		sum0 += d0 * d0
		sum1 += d1 * d1
		sum2 += d2 * d2
		sum3 += d3 * d3
	}

	// 处理剩余元素
	sum := sum0 + sum1 + sum2 + sum3
	for ; i < n; i++ {
		diff := a[i] - b[i]
		sum += diff * diff
	}
	return sum
}

// dotProduct 计算两个向量的点积
// 使用8路循环展开优化，减少循环开销
func dotProduct(a, b []float32) float32 {
	n := len(a)
	var s0, s1, s2, s3, s4, s5, s6, s7 float32

	i := 0
	// 8路展开主循环
	for ; i <= n-8; i += 8 {
		s0 += a[i] * b[i]
		s1 += a[i+1] * b[i+1]
		s2 += a[i+2] * b[i+2]
		s3 += a[i+3] * b[i+3]
		s4 += a[i+4] * b[i+4]
		s5 += a[i+5] * b[i+5]
		s6 += a[i+6] * b[i+6]
		s7 += a[i+7] * b[i+7]
	}

	// 处理剩余元素（0-7个）
	sum := s0 + s1 + s2 + s3 + s4 + s5 + s6 + s7
	for ; i < n; i++ {
		sum += a[i] * b[i]
	}
	return sum
}

// computeNormSquare 计算向量的范数平方 ||v||²
func computeNormSquare(v []float32) float32 {
	return dotProduct(v, v)
}

// precomputeNormSquares 预计算所有向量的范数平方
func (idx *VamanaIndex) precomputeNormSquares() {
	idx.normSquares = make([]float32, len(idx.vectors))
	for i, v := range idx.vectors {
		idx.normSquares[i] = computeNormSquare(v)
	}
}

// fastDistance 使用预计算范数加速两节点间距离计算
// ||a-b||² = ||a||² + ||b||² - 2<a,b>
func (idx *VamanaIndex) fastDistance(id1, id2 uint32) float32 {
	dot := dotProduct(idx.vectors[id1], idx.vectors[id2])
	return idx.normSquares[id1] + idx.normSquares[id2] - 2*dot
}

// fastDistanceToQuery 使用预计算范数和查询范数加速查询距离计算
func (idx *VamanaIndex) fastDistanceToQuery(id uint32, query []float32, queryNormSq float32) float32 {
	dot := dotProduct(idx.vectors[id], query)
	return idx.normSquares[id] + queryNormSq - 2*dot
}

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
func (idx *VamanaIndex) greedySearchFast(scratch *SearchScratch, startIDs []uint32, query []float32, queryNormSq float32, L int) []Neighbor {
	scratch.Reset()

	// 整个搜索期间持有读锁
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	scratch.Visited.EnsureCapacity(len(idx.vectors))

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
		// 获取最近的未访问节点
		closest, ok := scratch.Best.PopClosestUnvisited()
		if !ok {
			break
		}

		// 展开邻居 (不再需要加锁，已在函数开始时持有读锁)
		neighbors := idx.neighbors[closest.ID]

		for _, neighborID := range neighbors {
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
// 在并行构建期间使用，直接读取邻居（无锁）
// 前提：idx.vectors 和 idx.neighbors 的大小在构建期间不变
// 注意：邻居列表可能被其他goroutine修改，但这是可接受的（最终一致性）
func (idx *VamanaIndex) greedySearchForBuild(scratch *SearchScratch, startIDs []uint32, query []float32, queryNormSq float32, L int) []Neighbor {
	scratch.Reset()
	scratch.Visited.EnsureCapacity(len(idx.vectors))

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

	// 贪婪搜索（无锁读取邻居，接受最终一致性）
	for scratch.Best.HasUnvisited() {
		closest, ok := scratch.Best.PopClosestUnvisited()
		if !ok {
			break
		}

		// 直接读取邻居（无锁），可能读到部分更新的数据，但这是可接受的
		neighbors := idx.neighbors[closest.ID]

		for _, neighborID := range neighbors {
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

// containsID 检查slice中是否包含指定ID
func containsID(ids []uint32, id uint32) bool {
	for _, v := range ids {
		if v == id {
			return true
		}
	}
	return false
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

// Search 搜索最近的K个邻居
func (idx *VamanaIndex) Search(query []float32, k int, efSearch int) []Neighbor {
	idx.mu.RLock()
	if len(idx.vectors) == 0 || idx.medoid == math.MaxUint32 {
		idx.mu.RUnlock()
		return nil
	}
	idx.mu.RUnlock()

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

// GetVector 获取指定ID的向量
func (idx *VamanaIndex) GetVector(id uint32) []float32 {
	idx.mu.RLock()
	defer idx.mu.RUnlock()
	if int(id) >= len(idx.vectors) {
		return nil
	}
	return idx.vectors[id]
}

// GetNeighbors 获取指定ID的邻居列表
func (idx *VamanaIndex) GetNeighbors(id uint32) []uint32 {
	idx.mu.RLock()
	defer idx.mu.RUnlock()
	if int(id) >= len(idx.neighbors) {
		return nil
	}
	return idx.neighbors[id]
}

// Delete 软删除指定节点
// 采用懒惰处理策略：不立即更新邻居的邻居列表，搜索时跳过已删除节点
func (idx *VamanaIndex) Delete(id uint32) error {
	idx.mu.Lock()
	defer idx.mu.Unlock()

	if int(id) >= len(idx.vectors) {
		return ErrNodeNotFound
	}

	if idx.deleted.Test(id) {
		return ErrAlreadyDeleted
	}

	idx.deleted.Set(id)
	idx.nDeleted++

	return nil
}

// IsDeleted 检查节点是否已删除
func (idx *VamanaIndex) IsDeleted(id uint32) bool {
	idx.mu.RLock()
	defer idx.mu.RUnlock()
	return idx.deleted.Test(id)
}

// NeedsCompaction 检查是否需要压缩合并
// 当删除比例超过30%时返回true
func (idx *VamanaIndex) NeedsCompaction() bool {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	if len(idx.vectors) == 0 {
		return false
	}
	return float64(idx.nDeleted)/float64(len(idx.vectors)) > 0.3
}

// GetNormSquare 获取指定ID的范数平方 (用于外部优化)
func (idx *VamanaIndex) GetNormSquare(id uint32) float32 {
	idx.mu.RLock()
	defer idx.mu.RUnlock()
	if int(id) >= len(idx.normSquares) {
		return 0
	}
	return idx.normSquares[id]
}
