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

import "sort"

// ============================================================================
// 距离计算函数
// ============================================================================

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

// ============================================================================
// 堆选择算法
// ============================================================================

// selectTopK 使用堆选择算法获取 top-k 最小距离的邻居
// 时间复杂度: O(n log k)，比完整排序 O(n log n) 更高效
func selectTopK(candidates []Neighbor, k int) []Neighbor {
	if len(candidates) <= k {
		result := make([]Neighbor, len(candidates))
		copy(result, candidates)
		sort.Slice(result, func(i, j int) bool {
			return result[i].Distance < result[j].Distance
		})
		return result
	}

	// 使用最大堆维护 k 个最小元素
	// 堆顶是当前 k 个元素中的最大值
	heap := make([]Neighbor, k)
	copy(heap, candidates[:k])

	// 建立最大堆
	for i := k/2 - 1; i >= 0; i-- {
		heapifyDown(heap, i, k)
	}

	// 遍历剩余元素，如果比堆顶小则替换
	for i := k; i < len(candidates); i++ {
		if candidates[i].Distance < heap[0].Distance {
			heap[0] = candidates[i]
			heapifyDown(heap, 0, k)
		}
	}

	// 堆排序得到有序结果
	for i := k - 1; i > 0; i-- {
		heap[0], heap[i] = heap[i], heap[0]
		heapifyDown(heap, 0, i)
	}

	return heap
}

// heapifyDown 最大堆下沉操作
func heapifyDown(heap []Neighbor, i, n int) {
	for {
		largest := i
		left := 2*i + 1
		right := 2*i + 2

		if left < n && heap[left].Distance > heap[largest].Distance {
			largest = left
		}
		if right < n && heap[right].Distance > heap[largest].Distance {
			largest = right
		}

		if largest == i {
			break
		}

		heap[i], heap[largest] = heap[largest], heap[i]
		i = largest
	}
}

// ============================================================================
// 辅助函数
// ============================================================================

// containsID 检查slice中是否包含指定ID
func containsID(ids []uint32, id uint32) bool {
	for _, v := range ids {
		if v == id {
			return true
		}
	}
	return false
}
