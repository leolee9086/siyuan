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
	"math/bits"
)

// ============================================================================
// 公共接口
// ============================================================================

// Index 定义只读向量索引的公共接口。
//
// VamanaIndex（内存索引）和 DiskVamanaIndex（磁盘索引）均实现此接口，
// 使调用者可以面向统一的抽象进行搜索操作。
type Index interface {
	// Search 搜索最近的 topK 个邻居。
	//
	// 参数：
	//   - query: 查询向量，维度必须与索引一致
	//   - topK: 返回的最近邻数量
	//   - efSearch: 搜索列表大小（越大越精确但越慢）
	//
	// 返回按距离升序排列的搜索结果，索引为空或已关闭时返回 nil, nil。
	Search(query []float32, topK, efSearch int) ([]SearchResult, error)

	// NumPoints 返回索引中的有效点数（不含已删除）。
	NumPoints() uint64

	// Dimension 返回向量维度。
	Dimension() int

	// Close 释放索引关联的资源。
	// 内存索引的 Close 为空操作；磁盘索引释放 mmap 等资源。
	Close() error
}

// MutableIndex 定义可变向量索引的公共接口。
//
// 在 Index 基础上增加插入和删除操作。
// 目前仅 DiskVamanaIndex 实现此接口。
type MutableIndex interface {
	Index

	// Insert 插入一个新向量，返回分配的节点 ID。
	Insert(vector []float32) (uint64, error)

	// Delete 软删除指定节点。
	Delete(id uint64) error
}

// ============================================================================
// 搜索结果类型
// ============================================================================

// SearchResult 表示一条搜索结果，包含节点 ID 和到查询向量的距离。
type SearchResult struct {
	ID       uint64  // 节点 ID
	Distance float32 // 到查询向量的距离（欧氏距离平方）
}

// ============================================================================
// 常量
// ============================================================================

// Neighbor 邻居节点 (带距离)
type Neighbor struct {
	ID       uint32
	Distance float32
}

// Less 按距离升序比较
func (n Neighbor) Less(other Neighbor) bool {
	return n.Distance < other.Distance
}

// AdjacencyList 邻接表 (定长数组，避免slice开销)
type AdjacencyList struct {
	neighbors [MaxDegree]uint32
	length    int
}

// NewAdjacencyList 创建新的邻接表
func NewAdjacencyList() *AdjacencyList {
	return &AdjacencyList{length: 0}
}

// Len 返回邻居数量
func (a *AdjacencyList) Len() int {
	return a.length
}

// Get 获取指定位置的邻居ID
func (a *AdjacencyList) Get(i int) uint32 {
	if i < 0 || i >= a.length {
		return 0
	}
	return a.neighbors[i]
}

// Contains 检查是否包含指定ID。
//
// 设计决策：此处使用线性扫描 O(n) 而非 map 查找，原因如下：
//   - AdjacencyList 最大长度为 MaxDegree=128，元素为 uint32（4字节）
//   - 128 个 uint32 仅占 512 字节，完全在 L1 缓存行内
//   - 对于小规模连续内存的线性扫描，缓存友好性使其比 map 查找更快
//   - 避免了 map 的哈希计算开销和额外内存分配
func (a *AdjacencyList) Contains(id uint32) bool {
	for i := 0; i < a.length; i++ {
		if a.neighbors[i] == id {
			return true
		}
	}
	return false
}

// Push 添加邻居 (去重)
func (a *AdjacencyList) Push(id uint32) bool {
	if a.length >= MaxDegree {
		return false
	}
	if a.Contains(id) {
		return false
	}
	a.neighbors[a.length] = id
	a.length++
	return true
}

// Clear 清空邻接表
func (a *AdjacencyList) Clear() {
	a.length = 0
}

// ToSlice 转换为slice
func (a *AdjacencyList) ToSlice() []uint32 {
	result := make([]uint32, a.length)
	copy(result, a.neighbors[:a.length])
	return result
}

// SetFromSlice 从slice设置
func (a *AdjacencyList) SetFromSlice(ids []uint32) {
	a.length = 0
	for _, id := range ids {
		if a.length >= MaxDegree {
			break
		}
		a.neighbors[a.length] = id
		a.length++
	}
}

// EpochSet 基于Epoch的访问标记 (避免频繁清空)
type EpochSet struct {
	epoch uint32
	marks []uint32
}

// NewEpochSet 创建新的EpochSet
func NewEpochSet(capacity int) *EpochSet {
	return &EpochSet{
		epoch: 1,
		marks: make([]uint32, capacity),
	}
}

// Reset 重置访问标记 (仅增加epoch)
func (e *EpochSet) Reset() {
	e.epoch++
	if e.epoch == 0 {
		// 溢出时才真正清空
		for i := range e.marks {
			e.marks[i] = 0
		}
		e.epoch = 1
	}
}

// Contains 检查是否已访问
func (e *EpochSet) Contains(id uint32) bool {
	if int(id) >= len(e.marks) {
		return false
	}
	return e.marks[id] == e.epoch
}

// Insert 标记为已访问，返回是否是新插入
func (e *EpochSet) Insert(id uint32) bool {
	if int(id) >= len(e.marks) {
		// 指数扩容，避免频繁分配
		newCap := len(e.marks) * 2
		if newCap < int(id)+1 {
			newCap = int(id) + 1
		}
		newMarks := make([]uint32, newCap)
		copy(newMarks, e.marks)
		e.marks = newMarks
	}
	if e.marks[id] == e.epoch {
		return false
	}
	e.marks[id] = e.epoch
	return true
}

// EnsureCapacity 确保容量足够
func (e *EpochSet) EnsureCapacity(capacity int) {
	if len(e.marks) < capacity {
		newMarks := make([]uint32, capacity)
		copy(newMarks, e.marks)
		e.marks = newMarks
	}
}

// NeighborPriorityQueue 带访问标记的优先队列
// 采用与TypeScript版本相同的策略：有序数组 + flag标记 + currentIndex遍历
type NeighborPriorityQueue struct {
	data         []Neighbor
	flags        []bool // 标记节点是否需要扩展
	capacity     int
	currentIndex int // 当前遍历位置
	count        int // 有效元素数量
	lastPopped   int
}

// NewNeighborPriorityQueue 创建新的优先队列
func NewNeighborPriorityQueue(capacity int) *NeighborPriorityQueue {
	return &NeighborPriorityQueue{
		data:         make([]Neighbor, capacity),
		flags:        make([]bool, capacity),
		capacity:     capacity,
		currentIndex: 0,
		count:        0,
		lastPopped:   -1,
	}
}

// Reset 重置队列
func (pq *NeighborPriorityQueue) Reset() {
	pq.currentIndex = 0
	pq.count = 0
	pq.lastPopped = -1
}

// SetCapacity 设置队列容量 (性能优化: 允许复用时调整容量)
func (pq *NeighborPriorityQueue) SetCapacity(capacity int) {
	if capacity > len(pq.data) {
		// 需要扩容
		newData := make([]Neighbor, capacity)
		newFlags := make([]bool, capacity)
		copy(newData, pq.data)
		copy(newFlags, pq.flags)
		pq.data = newData
		pq.flags = newFlags
	}
	pq.capacity = capacity
}

// Len 返回队列长度
func (pq *NeighborPriorityQueue) Len() int {
	return pq.count
}

// Insert 插入邻居 (保持有序)
// 使用二分查找插入，O(log n) 查找 + O(n) 移动
func (pq *NeighborPriorityQueue) Insert(n Neighbor) bool {
	pq.lastPopped = -1
	// 如果数组未满，直接插入
	if pq.count < pq.capacity {
		pos := pq.binarySearchInsertPos(n.Distance)
		copy(pq.data[pos+1:pq.count+1], pq.data[pos:pq.count])
		copy(pq.flags[pos+1:pq.count+1], pq.flags[pos:pq.count])
		pq.data[pos] = n
		pq.flags[pos] = true
		pq.count++
		// 如果插入位置在currentIndex之前，由于元素右移，
		// currentIndex现在指向的是原来currentIndex-1位置的元素
		// 所以需要将currentIndex右移一位以指向原来的元素
		// 但是，新插入的元素（在pos位置）是未访问的，
		// 如果pos < currentIndex, 新元素被跳过了
		// 正确做法：如果pos < currentIndex, currentIndex min= pos
		if pos < pq.currentIndex {
			pq.currentIndex = pos // 回退到新元素位置，确保它被访问
		}
		return true
	}

	// 如果数组已满，检查是否可以替换最后一个元素
	if n.Distance < pq.data[pq.count-1].Distance {
		pos := pq.binarySearchInsertPos(n.Distance)
		copy(pq.data[pos+1:pq.count], pq.data[pos:pq.count-1])
		copy(pq.flags[pos+1:pq.count], pq.flags[pos:pq.count-1])
		pq.data[pos] = n
		pq.flags[pos] = true
		// 同样的逻辑：如果pos < currentIndex, 回退currentIndex
		if pos < pq.currentIndex {
			pq.currentIndex = pos
		}
		return true
	}

	return false
}

// binarySearchInsertPos 二分查找插入位置
func (pq *NeighborPriorityQueue) binarySearchInsertPos(distance float32) int {
	left, right := 0, pq.count
	for left < right {
		mid := (left + right) >> 1
		if pq.data[mid].Distance < distance {
			left = mid + 1
		} else {
			right = mid
		}
	}
	return left
}

// HasUnvisited 检查是否有未访问的节点
// 从currentIndex开始检查，因为之前的节点要么已访问，要么flag为false
func (pq *NeighborPriorityQueue) HasUnvisited() bool {
	for i := pq.currentIndex; i < pq.count; i++ {
		if pq.flags[i] {
			return true
		}
	}
	return false
}

// PopClosestUnvisited 获取最近的未访问节点并标记为已访问
func (pq *NeighborPriorityQueue) PopClosestUnvisited() (Neighbor, bool) {
	for pq.currentIndex < pq.count {
		if pq.flags[pq.currentIndex] {
			pq.lastPopped = pq.currentIndex
			pq.flags[pq.currentIndex] = false
			n := pq.data[pq.currentIndex]
			pq.currentIndex++
			return n, true
		}
		pq.currentIndex++
	}
	return Neighbor{}, false
}

// ReinsertLastPopped 用校正距离重新插入刚弹出的节点，不改变候选数量。
func (pq *NeighborPriorityQueue) ReinsertLastPopped(n Neighbor) bool {
	position := pq.lastPopped
	if position < 0 || position >= pq.count || pq.data[position].ID != n.ID {
		return false
	}
	copy(pq.data[position:pq.count-1], pq.data[position+1:pq.count])
	copy(pq.flags[position:pq.count-1], pq.flags[position+1:pq.count])
	pq.count--
	if pq.currentIndex > position {
		pq.currentIndex--
	}
	pq.lastPopped = -1
	return pq.Insert(n)
}

// TopK 返回最近的K个邻居
func (pq *NeighborPriorityQueue) TopK(k int) []Neighbor {
	if k > pq.count {
		k = pq.count
	}
	result := make([]Neighbor, k)
	copy(result, pq.data[:k])
	return result
}

// All 返回所有邻居
func (pq *NeighborPriorityQueue) All() []Neighbor {
	result := make([]Neighbor, pq.count)
	copy(result, pq.data[:pq.count])
	return result
}

// allView 返回队列的只读视图，仅允许在队列下次修改或归还对象池前使用。
func (pq *NeighborPriorityQueue) allView() []Neighbor {
	return pq.data[:pq.count]
}

// SearchScratch 搜索临时空间 (可复用)
type SearchScratch struct {
	// 已访问节点集合 (Epoch-based优化)
	Visited *EpochSet
	Refined *EpochSet

	// 最佳候选优先队列
	Best *NeighborPriorityQueue

	// 统计信息
	Cmps uint32 // 距离计算次数
	Hops uint32 // 跳数

	// robustPrune 复用缓冲区（避免每次调用分配）
	OccludeFactor   []float32 // 遮挡因子
	LastChecked     []int     // 增量检查位置
	ResultPos       []int     // 结果位置
	QueryQuantized  []byte
	QueryTransposed []byte
	AppendQuantized []byte
}

// NewSearchScratch 创建新的搜索临时空间
func NewSearchScratch(capacity int, searchListSize int) *SearchScratch {
	return &SearchScratch{
		Visited:         NewEpochSet(capacity),
		Best:            NewNeighborPriorityQueue(searchListSize),
		Cmps:            0,
		Hops:            0,
		OccludeFactor:   make([]float32, 0, 256),
		LastChecked:     make([]int, 0, 256),
		ResultPos:       make([]int, 0, 64),
		QueryQuantized:  make([]byte, 0, 256),
		QueryTransposed: make([]byte, 0, 128),
		AppendQuantized: make([]byte, 0, 256),
	}
}

// Reset 重置临时空间
func (s *SearchScratch) Reset() {
	s.Visited.Reset()
	if s.Refined != nil {
		s.Refined.Reset()
	}
	s.Best.Reset()
	s.Cmps = 0
	s.Hops = 0
}

// Bitset 位图实现 (用于软删除标记)
type Bitset struct {
	bits []uint64
	size int // 位数
}

// NewBitset 创建新的位图
func NewBitset(size int) *Bitset {
	numWords := (size + 63) / 64
	return &Bitset{
		bits: make([]uint64, numWords),
		size: size,
	}
}

// Set 设置指定位
func (b *Bitset) Set(i uint32) {
	if int(i) >= b.size {
		b.grow(int(i) + 1)
	}
	b.bits[i/64] |= 1 << (i % 64)
}

// Clear 清除指定位
func (b *Bitset) Clear(i uint32) {
	if int(i) >= b.size {
		return
	}
	b.bits[i/64] &^= 1 << (i % 64)
}

// Test 测试指定位是否设置
func (b *Bitset) Test(i uint32) bool {
	if int(i) >= b.size {
		return false
	}
	return (b.bits[i/64] & (1 << (i % 64))) != 0
}

// grow 扩展位图容量
func (b *Bitset) grow(newSize int) {
	if newSize <= b.size {
		return
	}
	numWords := (newSize + 63) / 64
	if numWords > len(b.bits) {
		newBits := make([]uint64, numWords)
		copy(newBits, b.bits)
		b.bits = newBits
	}
	b.size = newSize
}

// Count 返回设置的位数
func (b *Bitset) Count() int {
	count := 0
	for _, word := range b.bits {
		count += bits.OnesCount64(word)
	}
	return count
}
