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
	"math/rand"
	"sync"
)

// =========================================
// HNSW 层级工具
// =========================================

// RandomLevel 使用指数分布生成随机层级。
// 使用论文公式 threshold = exp(-1/m_L)；NewHNSWIndex 会把零值配置归一化为 m_L=1/ln(M)。
func (idx *HNSWIndex) RandomLevel() int {
	threshold := math.Exp(-1.0 / idx.Config.LevelML)
	level := 0
	for rand.Float64() < threshold && level < idx.Config.MaxLevel-1 {
		level++
	}
	return level
}

// InitItemNeighbors 初始化节点邻居结构，返回分配的最大层级。
func (idx *HNSWIndex) InitItemNeighbors(docID DocID) int {
	level := idx.RandomLevel()
	neighbors := make([][]NeighborRecord, level+1)
	for l := 0; l <= level; l++ {
		neighbors[l] = make([]NeighborRecord, 0, idx.Config.M)
	}

	idx.Mu.Lock()
	for int(docID) >= len(idx.Neighbors) {
		idx.Neighbors = append(idx.Neighbors, nil)
	}
	for int(docID) >= len(idx.nodeLocks) {
		idx.nodeLocks = append(idx.nodeLocks, &sync.RWMutex{})
	}
	idx.Neighbors[docID] = neighbors
	idx.Mu.Unlock()

	return level
}

// SetNodeLocks 初始化快照恢复后的节点锁；调用时不得存在并发访问。
func (idx *HNSWIndex) SetNodeLocks(count int) {
	locks := make([]*sync.RWMutex, count)
	for i := range locks {
		locks[i] = &sync.RWMutex{}
	}

	idx.Mu.Lock()
	idx.nodeLocks = locks
	idx.Mu.Unlock()
}

// IsDeleted 返回节点是否已被软删除。
func (idx *HNSWIndex) IsDeleted(docID DocID) bool {
	idx.Mu.RLock()
	deleted := idx.Deleted[docID]
	idx.Mu.RUnlock()
	return deleted
}

// Restore 恢复持久化的图状态；调用时不得存在并发访问。
func (idx *HNSWIndex) Restore(neighbors [][][]NeighborRecord, deleted map[DocID]bool, entryPoint DocID, maxLayer int) {
	locks := make([]*sync.RWMutex, len(neighbors))
	for i := range locks {
		locks[i] = &sync.RWMutex{}
	}

	idx.Mu.Lock()
	idx.Neighbors = neighbors
	idx.nodeLocks = locks
	idx.Deleted = deleted
	idx.EntryPoint = entryPoint
	idx.MaxLayer = maxLayer
	idx.Mu.Unlock()
}

// Snapshot 返回图状态的一致副本。
func (idx *HNSWIndex) Snapshot() ([][][]NeighborRecord, map[DocID]bool, DocID, int) {
	idx.Mu.RLock()
	defer idx.Mu.RUnlock()

	neighbors := make([][][]NeighborRecord, len(idx.Neighbors))
	for docID, levels := range idx.Neighbors {
		if levels == nil {
			continue
		}
		lock := idx.nodeLocks[docID]
		lock.RLock()
		neighbors[docID] = make([][]NeighborRecord, len(levels))
		for level, records := range levels {
			neighbors[docID][level] = append([]NeighborRecord(nil), records...)
		}
		lock.RUnlock()
	}

	deleted := make(map[DocID]bool, len(idx.Deleted))
	for docID, value := range idx.Deleted {
		deleted[docID] = value
	}
	return neighbors, deleted, idx.EntryPoint, idx.MaxLayer
}

// GetItemLevel 获取节点最大层级。
func (idx *HNSWIndex) GetItemLevel(docID DocID) int {
	idx.Mu.RLock()
	defer idx.Mu.RUnlock()
	if int(docID) >= len(idx.Neighbors) {
		return -1
	}
	lock := idx.nodeLocks[docID]
	lock.RLock()
	level := len(idx.Neighbors[docID]) - 1
	lock.RUnlock()
	return level
}

// GetLevelNeighborRecords 返回邻居记录副本，调用方可以安全持有和修改。
func (idx *HNSWIndex) GetLevelNeighborRecords(docID DocID, level int) []NeighborRecord {
	idx.Mu.RLock()
	defer idx.Mu.RUnlock()
	if int(docID) >= len(idx.Neighbors) || level < 0 {
		return nil
	}
	lock := idx.nodeLocks[docID]
	lock.RLock()
	defer lock.RUnlock()
	if level >= len(idx.Neighbors[docID]) {
		return nil
	}
	return append([]NeighborRecord(nil), idx.Neighbors[docID][level]...)
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

// SetLevelNeighbors 设置指定层级的邻居（含距离缓存）。
func (idx *HNSWIndex) SetLevelNeighbors(docID DocID, level int, neighbors []NeighborRecord) {
	records := append([]NeighborRecord(nil), neighbors...)

	idx.Mu.RLock()
	defer idx.Mu.RUnlock()
	if int(docID) >= len(idx.Neighbors) {
		return
	}
	lock := idx.nodeLocks[docID]
	lock.Lock()
	for level >= len(idx.Neighbors[docID]) {
		idx.Neighbors[docID] = append(idx.Neighbors[docID], nil)
	}
	idx.Neighbors[docID][level] = records
	lock.Unlock()
}

// SetLevelNeighborIDs 直接设置邻居 ID（距离设为 0，用于删除路径）。
func (idx *HNSWIndex) SetLevelNeighborIDs(docID DocID, level int, ids []DocID) {
	records := make([]NeighborRecord, len(ids))
	for i, id := range ids {
		records[i] = NeighborRecord{ID: id, Distance: 0}
	}
	idx.SetLevelNeighbors(docID, level, records)
}

// RemoveNeighbor 从邻居列表中移除指定节点。
func (idx *HNSWIndex) RemoveNeighbor(docID DocID, level int, neighborID DocID) {
	idx.Mu.RLock()
	defer idx.Mu.RUnlock()
	if int(docID) >= len(idx.Neighbors) {
		return
	}
	lock := idx.nodeLocks[docID]
	lock.Lock()
	defer lock.Unlock()
	if level < 0 || level >= len(idx.Neighbors[docID]) {
		return
	}

	records := idx.Neighbors[docID][level]
	newRecords := make([]NeighborRecord, 0, len(records))
	for _, record := range records {
		if record.ID != neighborID {
			newRecords = append(newRecords, record)
		}
	}
	idx.Neighbors[docID][level] = newRecords
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

func neighborRecordIDs(records []NeighborRecord, dst []DocID) []DocID {
	if cap(dst) < len(records) {
		dst = make([]DocID, len(records))
	} else {
		dst = dst[:len(records)]
	}
	for index, record := range records {
		dst[index] = record.ID
	}
	return dst
}
