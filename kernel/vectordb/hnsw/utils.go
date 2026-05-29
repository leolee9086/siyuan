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
	"sync"
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
// 使用全局锁保护 Neighbors/nodeLocks 切片的扩展
func (idx *HNSWIndex) InitItemNeighbors(docID DocID) int {
	level := RandomLevel(idx.Config.MaxLevel)

	idx.Mu.Lock()

	// 确保 Neighbors 和 nodeLocks 数组容量足够
	for int(docID) >= len(idx.Neighbors) {
		idx.Neighbors = append(idx.Neighbors, nil)
	}
	for int(docID) >= len(idx.nodeLocks) {
		idx.nodeLocks = append(idx.nodeLocks, sync.Mutex{})
	}

	idx.Mu.Unlock()

	// 初始化各层邻居列表（在节点锁下操作）
	neighbors := make([][]NeighborRecord, level+1)
	for l := 0; l <= level; l++ {
		neighbors[l] = make([]NeighborRecord, 0, idx.Config.M)
	}

	idx.nodeLocks[docID].Lock()
	idx.Neighbors[docID] = neighbors
	idx.nodeLocks[docID].Unlock()

	return level
}

// SetNodeLocks replaces the internal nodeLocks slice. Used during snapshot
// restore; must only be called with no concurrent access.
func (idx *HNSWIndex) SetNodeLocks(locks []sync.Mutex) {
	idx.Mu.Lock()
	idx.nodeLocks = locks
	idx.Mu.Unlock()
}

// GetItemLevel 获取节点最大层级
// 读取 Neighbors[docID] 的长度，使用节点锁保护
func (idx *HNSWIndex) GetItemLevel(docID DocID) int {
	if int(docID) >= len(idx.Neighbors) {
		return -1
	}
	idx.nodeLocks[docID].Lock()
	l := len(idx.Neighbors[docID]) - 1
	idx.nodeLocks[docID].Unlock()
	return l
}

// GetLevelNeighborRecords 零分配版本：直接返回邻居记录切片（含缓存距离）
// 调用方不得修改返回的切片！
func (idx *HNSWIndex) GetLevelNeighborRecords(docID DocID, level int) []NeighborRecord {
	if int(docID) >= len(idx.Neighbors) {
		return nil
	}
	if level >= len(idx.Neighbors[docID]) || level < 0 {
		return nil
	}
	return idx.Neighbors[docID][level]
}

// GetLevelNeighborIDs 从邻居记录中提取 ID 列表
// 返回新分配的切片，调用方可安全修改
func (idx *HNSWIndex) GetLevelNeighborIDs(docID DocID, level int) []DocID {
	records := idx.GetLevelNeighborRecords(docID, level)
	if records == nil {
		return nil
	}
	ids := make([]DocID, len(records))
	for i, r := range records {
		ids[i] = r.ID
	}
	return ids
}

// GetLevelNeighbors 兼容版本：返回 NeighborRecord 的副本
func (idx *HNSWIndex) GetLevelNeighbors(docID DocID, level int) []NeighborRecord {
	records := idx.GetLevelNeighborRecords(docID, level)
	if records == nil {
		return nil
	}
	result := make([]NeighborRecord, len(records))
	copy(result, records)
	return result
}

// SetLevelNeighbors 设置指定层级的邻居（含距离缓存）
// 使用节点级锁保护单个节点的邻居列表
func (idx *HNSWIndex) SetLevelNeighbors(docID DocID, level int, neighbors []NeighborRecord) {
	if int(docID) >= len(idx.Neighbors) {
		return
	}

	records := make([]NeighborRecord, len(neighbors))
	copy(records, neighbors)

	idx.nodeLocks[docID].Lock()
	for level >= len(idx.Neighbors[docID]) {
		idx.Neighbors[docID] = append(idx.Neighbors[docID], nil)
	}
	idx.Neighbors[docID][level] = records
	idx.nodeLocks[docID].Unlock()
}

// SetLevelNeighborIDs 直接设置邻居 ID（距离设为 0，用于 delete 路径）
// 使用节点级锁保护
func (idx *HNSWIndex) SetLevelNeighborIDs(docID DocID, level int, ids []DocID) {
	if int(docID) >= len(idx.Neighbors) {
		return
	}

	records := make([]NeighborRecord, len(ids))
	for i, id := range ids {
		records[i] = NeighborRecord{ID: id, Distance: 0}
	}

	idx.nodeLocks[docID].Lock()
	for level >= len(idx.Neighbors[docID]) {
		idx.Neighbors[docID] = append(idx.Neighbors[docID], nil)
	}
	idx.Neighbors[docID][level] = records
	idx.nodeLocks[docID].Unlock()
}

// RemoveNeighbor 从邻居列表中移除指定节点
// 使用节点级锁保护
func (idx *HNSWIndex) RemoveNeighbor(docID DocID, level int, neighborID DocID) {
	if int(docID) >= len(idx.Neighbors) {
		return
	}

	idx.nodeLocks[docID].Lock()
	if level >= len(idx.Neighbors[docID]) {
		idx.nodeLocks[docID].Unlock()
		return
	}

	records := idx.Neighbors[docID][level]
	newRecords := make([]NeighborRecord, 0, len(records))
	for _, r := range records {
		if r.ID != neighborID {
			newRecords = append(newRecords, r)
		}
	}
	idx.Neighbors[docID][level] = newRecords
	idx.nodeLocks[docID].Unlock()
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
