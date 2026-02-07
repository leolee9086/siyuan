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
	"math/rand"
)

// =========================================
// HNSW 层级工具
// =========================================

// RandomLevel 使用指数分布生成随机层级
func RandomLevel(maxLevel int) int {
	level := 0
	for rand.Float32() < 0.5 && level < maxLevel-1 {
		level++
	}
	return level
}

// InitItemNeighbors 初始化节点邻居结构，返回分配的最大层级
func (idx *HNSWIndex) InitItemNeighbors(docID DocID) int {
	level := RandomLevel(idx.Config.MaxLevel)

	idx.Mu.Lock()
	defer idx.Mu.Unlock()

	// 确保 Neighbors 数组容量足够
	for int(docID) >= len(idx.Neighbors) {
		idx.Neighbors = append(idx.Neighbors, nil)
	}

	// 初始化各层邻居列表
	neighbors := make([][]DocID, level+1)
	for l := 0; l <= level; l++ {
		neighbors[l] = make([]DocID, 0, idx.Config.M)
	}
	idx.Neighbors[docID] = neighbors

	return level
}

// GetItemLevel 获取节点最大层级
func (idx *HNSWIndex) GetItemLevel(docID DocID) int {
	idx.Mu.RLock()
	defer idx.Mu.RUnlock()

	if int(docID) >= len(idx.Neighbors) {
		return -1
	}
	return len(idx.Neighbors[docID]) - 1
}

// GetLevelNeighborIDs 零分配版本：直接返回邻居 ID 切片
// 调用方不得修改返回的切片！
func (idx *HNSWIndex) GetLevelNeighborIDs(docID DocID, level int) []DocID {
	if int(docID) >= len(idx.Neighbors) {
		return nil
	}
	if level >= len(idx.Neighbors[docID]) || level < 0 {
		return nil
	}
	return idx.Neighbors[docID][level]
}

// GetLevelNeighbors 兼容版本：返回 NeighborRecord
func (idx *HNSWIndex) GetLevelNeighbors(docID DocID, level int) []NeighborRecord {
	ids := idx.GetLevelNeighborIDs(docID, level)
	if ids == nil {
		return nil
	}

	records := make([]NeighborRecord, len(ids))
	for i, id := range ids {
		records[i] = NeighborRecord{
			ID:       id,
			Distance: 0,
		}
	}
	return records
}

// SetLevelNeighbors 设置指定层级的邻居
func (idx *HNSWIndex) SetLevelNeighbors(docID DocID, level int, neighbors []NeighborRecord) {
	idx.Mu.Lock()
	defer idx.Mu.Unlock()

	if int(docID) >= len(idx.Neighbors) {
		return
	}

	ids := make([]DocID, len(neighbors))
	for i, n := range neighbors {
		ids[i] = n.ID
	}

	for level >= len(idx.Neighbors[docID]) {
		idx.Neighbors[docID] = append(idx.Neighbors[docID], nil)
	}
	idx.Neighbors[docID][level] = ids
}

// SetLevelNeighborIDs 直接设置邻居 ID（无 NeighborRecord 转换）
func (idx *HNSWIndex) SetLevelNeighborIDs(docID DocID, level int, ids []DocID) {
	idx.Mu.Lock()
	defer idx.Mu.Unlock()

	if int(docID) >= len(idx.Neighbors) {
		return
	}

	for level >= len(idx.Neighbors[docID]) {
		idx.Neighbors[docID] = append(idx.Neighbors[docID], nil)
	}
	idx.Neighbors[docID][level] = ids
}

// RemoveNeighbor 从邻居列表中移除指定节点
func (idx *HNSWIndex) RemoveNeighbor(docID DocID, level int, neighborID DocID) {
	idx.Mu.Lock()
	defer idx.Mu.Unlock()

	if int(docID) >= len(idx.Neighbors) {
		return
	}
	if level >= len(idx.Neighbors[docID]) {
		return
	}

	ids := idx.Neighbors[docID][level]
	newIds := make([]DocID, 0, len(ids))
	for _, id := range ids {
		if id != neighborID {
			newIds = append(newIds, id)
		}
	}
	idx.Neighbors[docID][level] = newIds
}

// =========================================
// 入口点管理
// =========================================

// SelectEntryPoint 选择入口点
func (idx *HNSWIndex) SelectEntryPoint() (DocID, bool) {
	idx.Mu.RLock()
	defer idx.Mu.RUnlock()

	ep := idx.EntryPoint
	if ep == InvalidEntryPoint {
		return 0, false
	}

	return ep, true
}

// ExpectedNeighborCount 返回层级对应的最大邻居数
func ExpectedNeighborCount(level int, M int) int {
	if level == 0 {
		return M * 2
	}
	return M
}

// =========================================
// 排序工具
// =========================================

// sortNeighborsByDistance 使用插入排序按距离升序排列
// 对于小数组（M 通常为 16-32）插入排序是最优选择
func sortNeighborsByDistance(neighbors []NeighborRecord) {
	for i := 1; i < len(neighbors); i++ {
		key := neighbors[i]
		j := i - 1
		for j >= 0 && neighbors[j].Distance > key.Distance {
			neighbors[j+1] = neighbors[j]
			j--
		}
		neighbors[j+1] = key
	}
}
