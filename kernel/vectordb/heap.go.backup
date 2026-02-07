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

package vectordb

// =========================================
// 最小堆实现
// 用于 HNSW 搜索中的优先队列
// =========================================

// HeapItem 堆元素
type HeapItem struct {
	ID       DocID
	Distance float32
	Data     *Item // 可选，用于携带完整数据
}

// MinHeap 最小堆（按距离升序）
type MinHeap struct {
	data []*HeapItem
}

// NewMinHeap 创建最小堆
// 预分配容量减少搜索过程中的扩容次数
func NewMinHeap() *MinHeap {
	return &MinHeap{
		data: make([]*HeapItem, 0, 64), // 预分配容量
	}
}

// Len 堆大小
func (h *MinHeap) Len() int {
	return len(h.data)
}

// IsEmpty 是否为空
func (h *MinHeap) IsEmpty() bool {
	return len(h.data) == 0
}

// Push 压入元素
func (h *MinHeap) Push(item *HeapItem) {
	h.data = append(h.data, item)
	h.upHeap(len(h.data) - 1)
}

// Pop 弹出最小元素
func (h *MinHeap) Pop() *HeapItem {
	if len(h.data) == 0 {
		return nil
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
func (h *MinHeap) Peek() *HeapItem {
	if len(h.data) == 0 {
		return nil
	}
	return h.data[0]
}

// upHeap 上浮操作
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

// downHeap 下沉操作
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

// ToArray 转为数组
func (h *MinHeap) ToArray() []*HeapItem {
	result := make([]*HeapItem, len(h.data))
	copy(result, h.data)
	return result
}

// =========================================
// 最大堆实现
// 用于维护 Top-K 结果
// =========================================

// MaxHeap 最大堆（按距离降序）
type MaxHeap struct {
	data     []*HeapItem
	capacity int // 容量限制，0 表示无限制
}

// NewMaxHeap 创建最大堆
func NewMaxHeap(capacity int) *MaxHeap {
	return &MaxHeap{
		data:     make([]*HeapItem, 0, capacity),
		capacity: capacity,
	}
}

// Len 堆大小
func (h *MaxHeap) Len() int {
	return len(h.data)
}

// IsEmpty 是否为空
func (h *MaxHeap) IsEmpty() bool {
	return len(h.data) == 0
}

// IsFull 是否已满
func (h *MaxHeap) IsFull() bool {
	return h.capacity > 0 && len(h.data) >= h.capacity
}

// Push 压入元素
func (h *MaxHeap) Push(item *HeapItem) {
	if h.IsFull() {
		return // 满了不压入
	}
	h.data = append(h.data, item)
	h.upHeap(len(h.data) - 1)
}

// Pop 弹出最大元素
func (h *MaxHeap) Pop() *HeapItem {
	if len(h.data) == 0 {
		return nil
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
func (h *MaxHeap) Peek() *HeapItem {
	if len(h.data) == 0 {
		return nil
	}
	return h.data[0]
}

// Replace 替换堆顶元素（比 Pop + Push 更高效）
func (h *MaxHeap) Replace(item *HeapItem) *HeapItem {
	if len(h.data) == 0 {
		h.Push(item)
		return nil
	}
	
	top := h.data[0]
	h.data[0] = item
	h.downHeap(0)
	return top
}

// upHeap 上浮操作（最大堆）
func (h *MaxHeap) upHeap(pos int) {
	item := h.data[pos]
	
	for pos > 0 {
		parent := (pos - 1) >> 1
		parentItem := h.data[parent]
		
		// 最大堆：子节点大于父节点时上浮
		if item.Distance <= parentItem.Distance {
			break
		}
		
		h.data[pos] = parentItem
		pos = parent
	}
	
	h.data[pos] = item
}

// downHeap 下沉操作（最大堆）
func (h *MaxHeap) downHeap(pos int) {
	size := len(h.data)
	halfSize := size >> 1
	item := h.data[pos]
	
	for pos < halfSize {
		leftChild := (pos << 1) + 1
		rightChild := leftChild + 1
		
		bestChild := leftChild
		bestValue := h.data[leftChild]
		
		// 最大堆：选择更大的子节点
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
func (h *MaxHeap) ToSortedArray() []*HeapItem {
	// 复制堆数据
	tempHeap := &MaxHeap{
		data:     make([]*HeapItem, len(h.data)),
		capacity: h.capacity,
	}
	copy(tempHeap.data, h.data)
	
	// 依次弹出，得到降序
	result := make([]*HeapItem, 0, len(h.data))
	for tempHeap.Len() > 0 {
		result = append(result, tempHeap.Pop())
	}
	
	// 反转得到升序
	for i, j := 0, len(result)-1; i < j; i, j = i+1, j-1 {
		result[i], result[j] = result[j], result[i]
	}
	
	return result
}
