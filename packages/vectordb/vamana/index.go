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
	"sync"
	"sync/atomic"

	"s-forge.local/vectordb/bbq"
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
	// vectorData 是连续内存布局的底层存储，所有 float32 数据紧密排列
	// vectors 是指向 vectorData 的 sub-slice 视图，保证 idx.vectors[id] 访问模式不变
	vectorData []float32   // 连续存储: vectorData[id*dim .. (id+1)*dim]
	vectors    [][]float32 // sub-slice 视图: vectors[id] = vectorData[id*dim : (id+1)*dim]
	dimension  int

	// 图结构
	neighbors    [][]uint32                 // neighbors[nodeID] = []neighborIDs
	neighborPtrs []atomic.Pointer[[]uint32] // 构建专用：无锁原子邻居指针（与 neighbors 同步）
	medoid       uint32                     // 入口点

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

	// BBQ 量化数据
	bbqEnabled     bool      // 是否启用 BBQ (dim >= BBQEnableThreshold 时自动启用)
	bbqPacked      []byte    // 打包的 1-bit 量化数据 (用于 1-bit 和 4-bit BitTranspose 查询)
	bbqCorrections []float32 // 校正因子 (Correction: 欧氏=normSq, 余弦=centroidDot)
	bbqCentroid    []float32 // 全局质心向量
	bbqPackedSize  int       // 每个向量打包后的字节数 = (dimension + 7) / 8

	// BBQ 量化元数据 (用于精确距离还原)
	bbqLowerBounds   []float32 // 每个向量的量化区间下界
	bbqUpperBounds   []float32 // 每个向量的量化区间上界
	bbqQuantizedSums []float32 // 每个向量的量化分量和

	// BBQ 预创建组件 (性能优化: 避免热路径上的对象分配)
	bbqScorer    *bbq.QuantizedScorer // 预创建评分器
	bbqQuantizer *bbq.ScalarQuantizer // 预创建量化器

	// BBQ 搜索临时空间池 (性能优化: 复用 query4Bit 切片)
	bbqQuery4BitPool sync.Pool

	// BBQ 查询量化位数 (1 或 4)
	bbqQueryBits int
}

// New 创建新的Vamana索引
func New(dimension int, config Config) *VamanaIndex {
	config.Validate()

	// 判断是否启用 BBQ (dim >= BBQEnableThreshold 时自动启用)
	bbqEnabled := dimension >= bbq.BBQEnableThreshold
	bbqPackedSize := 0
	if bbqEnabled {
		bbqPackedSize = (dimension + 7) / 8 // 每 8 维度压缩为 1 字节
	}

	idx := &VamanaIndex{
		config:         config,
		dimension:      dimension,
		vectorData:     make([]float32, 0),
		vectors:        make([][]float32, 0),
		neighbors:      make([][]uint32, 0),
		medoid:         math.MaxUint32,
		normSquares:    make([]float32, 0),
		deleted:        NewBitset(1024),
		nDeleted:       0,
		bbqEnabled:     bbqEnabled,
		bbqPacked:      nil,
		bbqCorrections: nil,
		bbqCentroid:    nil,
		bbqPackedSize:  bbqPackedSize,
		bbqQueryBits:   DefaultBBQQueryBits,
	}

	idx.scratchPool = sync.Pool{
		New: func() interface{} {
			return NewSearchScratch(1024, config.L)
		},
	}

	// 预创建 BBQ 组件 (性能优化: 避免热路径上的对象分配)
	// 使用配置中的距离度量，与图构建保持一致
	if bbqEnabled {
		idx.bbqScorer = bbq.NewQuantizedScorer(config.DistanceMetric)
		idx.bbqQuantizer = bbq.NewScalarQuantizer(config.DistanceMetric)
		idx.bbqQuery4BitPool = sync.Pool{
			New: func() interface{} {
				return make([]byte, dimension)
			},
		}
	}

	return idx
}

// ============================================================================
// 基础访问器
// ============================================================================

// NumPoints 返回索引中的有效点数 (不含已删除)
func (idx *VamanaIndex) NumPoints() uint64 {
	idx.mu.RLock()
	defer idx.mu.RUnlock()
	return uint64(len(idx.vectors)) - idx.nDeleted
}

// NumPointsTotal 返回索引中的总点数 (含已删除)
func (idx *VamanaIndex) NumPointsTotal() uint64 {
	idx.mu.RLock()
	defer idx.mu.RUnlock()
	return uint64(len(idx.vectors))
}

// Close 释放索引关联的资源。
// 内存索引无需释放外部资源，此方法为空操作，仅用于满足 Index 接口。
func (idx *VamanaIndex) Close() error {
	return nil
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

// BBQQueryBits 返回当前 BBQ 查询量化位数
func (idx *VamanaIndex) BBQQueryBits() int {
	return idx.bbqQueryBits
}

// SetBBQQueryBits 设置 BBQ 查询量化位数 (仅接受 1 或 4)
func (idx *VamanaIndex) SetBBQQueryBits(bits int) {
	if bits != 1 && bits != 4 {
		return
	}
	idx.bbqQueryBits = bits
}

// ============================================================================
// Scratch 池管理
// ============================================================================

// getScratch 获取搜索临时空间
func (idx *VamanaIndex) getScratch() *SearchScratch {
	return idx.scratchPool.Get().(*SearchScratch)
}

// putScratch 归还搜索临时空间
func (idx *VamanaIndex) putScratch(s *SearchScratch) {
	idx.scratchPool.Put(s)
}

// ============================================================================
// 距离计算方法 (VamanaIndex 方法)
// ============================================================================

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

// precomputeNormSquares 预计算所有向量的范数平方
func (idx *VamanaIndex) precomputeNormSquares() {
	idx.normSquares = precomputeNorms(idx.vectors)
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

// ============================================================================
// 数据访问方法
// ============================================================================

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

// GetNormSquare 获取指定ID的范数平方 (用于外部优化)
func (idx *VamanaIndex) GetNormSquare(id uint32) float32 {
	idx.mu.RLock()
	defer idx.mu.RUnlock()
	if int(id) >= len(idx.normSquares) {
		return 0
	}
	return idx.normSquares[id]
}

// ============================================================================
// 删除操作
// ============================================================================

// Delete 软删除指定节点，并执行完整的 IP-DiskANN 6步边修复算法。
//
// 算法步骤（对应 IP-DiskANN src/index.cpp L3130-3303）：
//  1. 以被删节点向量为 query 执行贪心搜索 → Visited 集合 + Candidates (top-k)
//  2. 从 Visited 中找近似入邻居 N'_in(p)
//  3. 修复入边：对每个 z ∈ N'_in(p)，用 candidates 中最近的替代节点替换 p
//  4. 修复出边：对被删节点的每个出邻居 w，添加替代反向连接
//  5. 标记删除 + 清空邻居列表
//  6. 对度数超过 R 的受影响顶点执行 robustPruneSimple
//
// 边修复逻辑的具体实现位于 delete.go 中的 inplaceDelete 方法。
func (idx *VamanaIndex) Delete(id uint32) error {
	idx.mu.Lock()
	defer idx.mu.Unlock()

	if int(id) >= len(idx.vectors) {
		return ErrNodeNotFound
	}

	if idx.deleted.Test(id) {
		return ErrAlreadyDeleted
	}

	idx.inplaceDelete(id)
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

// rebuildVectorViews 重建所有 vectors sub-slice 视图
// 当 vectorData 底层数组因扩容而重新分配时，必须调用此方法
// 使所有 vectors[i] 重新指向新的 vectorData 底层数组
// 调用者必须持有 idx.mu 写锁
func (idx *VamanaIndex) rebuildVectorViews() {
	dim := idx.dimension
	n := len(idx.vectors)
	for i := 0; i < n; i++ {
		offset := i * dim
		idx.vectors[i] = idx.vectorData[offset : offset+dim : offset+dim]
	}
}

// 编译时接口检查
var _ Index = (*VamanaIndex)(nil)
