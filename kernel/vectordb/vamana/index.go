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
func euclideanDistance(a, b []float32) float32 {
	var sum float32
	for i := range a {
		diff := a[i] - b[i]
		sum += diff * diff
	}
	return sum
}

// computeNormSquare 计算向量的范数平方 ||v||²
func computeNormSquare(v []float32) float32 {
	var sum float32
	for _, x := range v {
		sum += x * x
	}
	return sum
}

// precomputeNormSquares 预计算所有向量的范数平方
func (idx *VamanaIndex) precomputeNormSquares() {
	idx.normSquares = make([]float32, len(idx.vectors))
	for i, v := range idx.vectors {
		idx.normSquares[i] = computeNormSquare(v)
	}
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
		dist := idx.distanceToQuery(startID, query)
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
				dist := idx.distanceToQuery(neighborID, query)
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
				selectedID := candidates[resultIdx].ID
				distCN := idx.distance(cand.ID, selectedID)

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
func (idx *VamanaIndex) Build(vectors [][]float32) error {
	if len(vectors) == 0 {
		return nil
	}

	// 先添加所有向量
	idx.mu.Lock()
	idx.vectors = make([][]float32, len(vectors))
	copy(idx.vectors, vectors)
	idx.neighbors = make([][]uint32, len(vectors))
	idx.nodeLocks = make([]sync.RWMutex, len(vectors))
	for i := range idx.neighbors {
		idx.neighbors[i] = make([]uint32, 0, idx.config.R)
	}
	// 重置删除位图
	idx.deleted = NewBitset(len(vectors))
	idx.nDeleted = 0
	idx.mu.Unlock()

	// 预计算所有向量的范数平方
	idx.precomputeNormSquares()

	// 计算质心并选择入口点
	idx.medoid = idx.findMedoid()

	// 随机打乱插入顺序 (提高图质量)
	order := rand.Perm(len(vectors))

	// 逐点构建图
	for _, i := range order {
		idx.buildNode(uint32(i))
	}

	return nil
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
