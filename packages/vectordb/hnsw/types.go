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
	"math"
	"sync"
	"sync/atomic"

	"s-forge.local/vectordb/bbq"
)

// =========================================
// 核心类型定义
// =========================================

// DocID 文档内部标识符
type DocID = uint32

// InvalidEntryPoint 无效入口点标记值
const InvalidEntryPoint DocID = 0xFFFFFFFF

// Config HNSW 索引配置
type Config struct {
	M                  int     `msgpack:"m"`
	EfConstruction     int     `msgpack:"ef_construction"`
	EfSearch           int     `msgpack:"ef_search"`
	MaxLevel           int     `msgpack:"max_level"`
	MetricType         string  `msgpack:"metric"`
	GraphSlackFactor   float32 `msgpack:"graph_slack_factor"`
	LevelML            float64 `msgpack:"level_ml"`        // 0=论文默认 1/ln(M)，>0=显式 m_L
	ContaminationAlpha float32 `msgpack:"contamination_a"` // 0=disabled
}

// DefaultConfig 返回默认 HNSW 配置
func DefaultConfig() Config {
	return Config{
		M:                16,
		EfConstruction:   200,
		EfSearch:         200,
		MaxLevel:         16,
		MetricType:       "cosine",
		GraphSlackFactor: 1.3,
	}
}

// NeighborRecord 邻居记录 (Graph Edge)
type NeighborRecord struct {
	ID       DocID   `msgpack:"id"`
	Distance float32 `msgpack:"distance"`
}

// SearchResult HNSW 内部搜索结果
// 包含节点 ID 和距离，不包含外部 ID 或元数据
type SearchResult struct {
	ID       DocID
	Distance float32
}

// =========================================
// Distancer 接口 — 解耦距离计算与存储层
// =========================================

// NodeDistancer 是 HNSW 建图唯一必需的距离能力。
// 节点间距离应当对称、稳定并使用“越小越近”的语义；HNSW 不要求数据项必须是向量。
type NodeDistancer interface {
	// ComputeDistance 计算两个已索引节点间的距离
	ComputeDistance(a, b DocID, metric string) float32
}

// VectorDistancer 提供 float32 向量查询的精确距离快路径。
// 只有 Search 和向量建图优化需要实现它，纯图索引无需实现。
type VectorDistancer interface {
	// ComputeDistanceFromVector 计算查询向量与已索引节点的距离
	ComputeDistanceFromVector(query []float32, id DocID, metric string) float32

	// ComputeDistancesFromVector 批量计算同一查询向量与多个已索引节点的距离，并复用 dst 容量。
	ComputeDistancesFromVector(query []float32, ids []DocID, metric string, dst []float32) []float32

	// GetUnsafe 零拷贝获取向量（调用方不得修改返回值）
	GetUnsafe(id DocID) ([]float32, bool)
}

// BBQDistancer 提供固定 4-bit query × 1-bit data 的非对称 BBQ 加速能力。
type BBQDistancer interface {
	// ComputeBBQDistanceFromQuery 使用 4-bit 查询与 1-bit 索引计算非对称 BBQ 距离
	ComputeBBQDistanceFromQuery(queryPacked []byte, queryCorr bbq.QuantizationResult, id DocID) float32
	// ComputeBBQDistancesFromQuery 批量计算非对称 BBQ 距离，并复用 dst 容量。
	ComputeBBQDistancesFromQuery(queryPacked []byte, queryCorr bbq.QuantizationResult, ids []DocID, dst []float32) []float32

	// QuantizeQuery 对查询向量进行量化
	QuantizeQuery(query []float32) ([]byte, bbq.QuantizationResult)

	// QuantizeVector 将已存储向量临时量化为 4-bit 查询编码，用于非对称构图。
	QuantizeVector(id DocID) ([]byte, bbq.QuantizationResult)
}

// VisitTracker 提供可复用的并发访问标记，避免向量搜索为每次查询分配 map。
type VisitTracker interface {
	// NewSearchEpoch 开始新的搜索 epoch
	NewSearchEpoch() uint32

	// IsVisited 检查节点是否在当前 epoch 中已被访问
	IsVisited(id DocID, epoch uint32) bool

	// MarkVisited 标记节点为已访问
	MarkVisited(id DocID, epoch uint32)
}

// Distancer 保留完整向量距离能力的兼容接口。
// 新的非向量索引只需实现 NodeDistancer，并通过 SearchBy 提供查询距离。
type Distancer interface {
	NodeDistancer
	VectorDistancer
	BBQDistancer
	VisitTracker
}

// QueryDistancer 将任意查询对象适配为查询到图节点的排序值。
// 实现者可持有字符串、稀疏词项、BM25 查询状态或其他不透明数据；相似度应转换为越小越优的值。
type QueryDistancer interface {
	DistanceTo(id DocID) float32
}

// BatchQueryDistancer 是可选的批量查询距离快路径。
type BatchQueryDistancer interface {
	QueryDistancer
	DistancesTo(ids []DocID, dst []float32) []float32
}

// =========================================
// HNSWIndex — HNSW 图索引核心结构
// =========================================

// HNSWIndex 封装 HNSW 算法所需的全部状态
// 包括图结构、配置和距离计算接口。
// 不包含 ID 映射和元数据管理（由外部 Collection 负责）。
type HNSWIndex struct {
	Config    Config
	Dimension int

	// 图结构
	// Neighbors[docID][level] -> []NeighborRecord (ID + 缓存距离)
	// 距离缓存用于避免双向连接维护时的 O(M²) 距离重算
	Neighbors [][][]NeighborRecord
	Deleted   map[DocID]bool

	// HNSW 入口点
	EntryPoint DocID
	MaxLayer   int

	// 距离计算（由外部注入）
	Distancer     Distancer
	nodeDistancer NodeDistancer
	// bbqHybridSearch 控制 BBQ 粗筛后是否用全精度距离驱动第 0 层扩张。
	bbqHybridSearch atomic.Bool

	// 并发控制
	// Mu 保护元数据（EntryPoint、MaxLayer、Deleted）和 Neighbors/nodeLocks 切片。
	// nodeLocks 保护每个节点的邻居列表 Neighbors[docID]，指针保证切片扩展时不会复制已使用的锁。
	Mu        sync.RWMutex
	nodeLocks []*sync.RWMutex
}

// NewHNSWIndex 创建新的 HNSW 索引
func NewHNSWIndex(dimension int, config Config, distancer NodeDistancer) *HNSWIndex {
	// 零值兼容：GraphSlackFactor 未设置时使用默认值 1.3
	if config.GraphSlackFactor <= 0 {
		config.GraphSlackFactor = 1.3
	}
	if config.LevelML <= 0 && config.M > 1 {
		config.LevelML = 1.0 / math.Log(float64(config.M))
	}
	idx := &HNSWIndex{
		Config:        config,
		Dimension:     dimension,
		Neighbors:     make([][][]NeighborRecord, 0),
		Deleted:       make(map[DocID]bool),
		EntryPoint:    InvalidEntryPoint,
		MaxLayer:      -1,
		nodeDistancer: distancer,
		nodeLocks:     make([]*sync.RWMutex, 0),
	}
	idx.Distancer, _ = distancer.(Distancer)
	idx.bbqHybridSearch.Store(true)
	return idx
}

// =========================================
// 堆类型 — 用于 HNSW 搜索中的优先队列
// 使用值类型 HeapItem 而非指针，避免每次 Push 的堆分配开销
// =========================================

// HeapItem 堆元素（值类型，8字节，栈友好）
type HeapItem struct {
	ID       DocID
	Distance float32
}

// MinHeap 最小堆（按距离升序）
type MinHeap struct {
	data []HeapItem
}

// NewMinHeap 创建最小堆
func NewMinHeap() *MinHeap {
	return &MinHeap{
		data: make([]HeapItem, 0, 64),
	}
}

// Len 堆大小
func (h *MinHeap) Len() int { return len(h.data) }

// IsEmpty 是否为空
func (h *MinHeap) IsEmpty() bool { return len(h.data) == 0 }

// Push 压入元素
func (h *MinHeap) Push(item HeapItem) {
	h.data = append(h.data, item)
	h.upHeap(len(h.data) - 1)
}

// Pop 弹出最小元素
func (h *MinHeap) Pop() HeapItem {
	if len(h.data) == 0 {
		return HeapItem{}
	}

	top := h.data[0]
	lastIdx := len(h.data) - 1

	if lastIdx > 0 {
		h.data[0] = h.data[lastIdx]
		h.data = h.data[:lastIdx]
		h.downHeap(0)
	} else {
		h.data = h.data[:0]
	}

	return top
}

// Peek 查看最小元素
func (h *MinHeap) Peek() HeapItem {
	if len(h.data) == 0 {
		return HeapItem{}
	}
	return h.data[0]
}

func (h *MinHeap) upHeap(pos int) {
	item := h.data[pos]
	for pos > 0 {
		parent := (pos - 1) >> 1
		parentItem := h.data[parent]
		if item.Distance >= parentItem.Distance {
			break
		}
		h.data[pos] = parentItem
		pos = parent
	}
	h.data[pos] = item
}

func (h *MinHeap) downHeap(pos int) {
	size := len(h.data)
	halfSize := size >> 1
	item := h.data[pos]

	for pos < halfSize {
		leftChild := (pos << 1) + 1
		rightChild := leftChild + 1

		bestChild := leftChild
		bestValue := h.data[leftChild]

		if rightChild < size && h.data[rightChild].Distance < bestValue.Distance {
			bestChild = rightChild
			bestValue = h.data[rightChild]
		}

		if item.Distance <= bestValue.Distance {
			break
		}

		h.data[pos] = bestValue
		pos = bestChild
	}

	h.data[pos] = item
}

// MaxHeap 最大堆（按距离降序）
type MaxHeap struct {
	data     []HeapItem
	capacity int
}

// NewMaxHeap 创建最大堆
func NewMaxHeap(capacity int) *MaxHeap {
	return &MaxHeap{
		data:     make([]HeapItem, 0, capacity),
		capacity: capacity,
	}
}

// Len 堆大小
func (h *MaxHeap) Len() int { return len(h.data) }

// IsEmpty 是否为空
func (h *MaxHeap) IsEmpty() bool { return len(h.data) == 0 }

// IsFull 是否已满
func (h *MaxHeap) IsFull() bool {
	return h.capacity > 0 && len(h.data) >= h.capacity
}

// Push 压入元素
func (h *MaxHeap) Push(item HeapItem) {
	if h.IsFull() {
		return
	}
	h.data = append(h.data, item)
	h.upHeap(len(h.data) - 1)
}

// Pop 弹出最大元素
func (h *MaxHeap) Pop() HeapItem {
	if len(h.data) == 0 {
		return HeapItem{}
	}

	top := h.data[0]
	lastIdx := len(h.data) - 1

	if lastIdx > 0 {
		h.data[0] = h.data[lastIdx]
		h.data = h.data[:lastIdx]
		h.downHeap(0)
	} else {
		h.data = h.data[:0]
	}

	return top
}

// Peek 查看最大元素
func (h *MaxHeap) Peek() HeapItem {
	if len(h.data) == 0 {
		return HeapItem{}
	}
	return h.data[0]
}

// Replace 替换堆顶元素（比 Pop + Push 更高效）
func (h *MaxHeap) Replace(item HeapItem) HeapItem {
	if len(h.data) == 0 {
		h.Push(item)
		return HeapItem{}
	}

	top := h.data[0]
	h.data[0] = item
	h.downHeap(0)
	return top
}

func (h *MaxHeap) upHeap(pos int) {
	item := h.data[pos]
	for pos > 0 {
		parent := (pos - 1) >> 1
		parentItem := h.data[parent]
		if item.Distance <= parentItem.Distance {
			break
		}
		h.data[pos] = parentItem
		pos = parent
	}
	h.data[pos] = item
}

func (h *MaxHeap) downHeap(pos int) {
	size := len(h.data)
	halfSize := size >> 1
	item := h.data[pos]

	for pos < halfSize {
		leftChild := (pos << 1) + 1
		rightChild := leftChild + 1

		bestChild := leftChild
		bestValue := h.data[leftChild]

		if rightChild < size && h.data[rightChild].Distance > bestValue.Distance {
			bestChild = rightChild
			bestValue = h.data[rightChild]
		}

		if item.Distance >= bestValue.Distance {
			break
		}

		h.data[pos] = bestValue
		pos = bestChild
	}

	h.data[pos] = item
}

// ToSortedArray 转为排序数组（升序）
func (h *MaxHeap) ToSortedArray() []HeapItem {
	tempHeap := &MaxHeap{
		data:     make([]HeapItem, len(h.data)),
		capacity: h.capacity,
	}
	copy(tempHeap.data, h.data)

	result := make([]HeapItem, 0, len(h.data))
	for tempHeap.Len() > 0 {
		result = append(result, tempHeap.Pop())
	}

	for i, j := 0, len(result)-1; i < j; i, j = i+1, j-1 {
		result[i], result[j] = result[j], result[i]
	}

	return result
}
