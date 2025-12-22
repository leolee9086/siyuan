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

import (
	"math/rand"
	"time"
)

func init() {
	rand.Seed(time.Now().UnixNano())
}

// =========================================
// HNSW 层级工具 (简化版)
// =========================================

// RandomLevel 使用指数分布生成随机层级
func RandomLevel(maxLevel int) int {
	level := 0
	for rand.Float32() < 0.5 && level < maxLevel-1 {
		level++
	}
	return level
}

// InitItemNeighbors 初始化节点邻居结构
// 返回分配的最大层级
func InitItemNeighbors(c *Collection, docID DocID, modelName string, maxLevel int) int {
	level := RandomLevel(maxLevel)

	c.Mu.Lock()
	defer c.Mu.Unlock()

	// 确保 Neighbors 数组容量足够
	for int(docID) >= len(c.Neighbors) {
		c.Neighbors = append(c.Neighbors, nil)
	}

	// 初始化各层邻居列表
	neighbors := make([]docIDSlice, level+1)
	for l := 0; l <= level; l++ {
		neighbors[l] = make([]DocID, 0, c.Config.M)
	}
	c.Neighbors[docID] = neighbors

	return level
}

// GetItemLevel 获取节点最大层级
func GetItemLevel(c *Collection, docID DocID, modelName string) int {
	c.Mu.RLock()
	defer c.Mu.RUnlock()

	if int(docID) >= len(c.Neighbors) {
		return -1
	}
	return len(c.Neighbors[docID]) - 1
}

// GetLevelNeighborIDs 零分配版本：直接返回邻居 ID 切片
// 调用方不得修改返回的切片！
func GetLevelNeighborIDs(c *Collection, docID DocID, modelName string, level int) []DocID {
	if int(docID) >= len(c.Neighbors) {
		return nil
	}
	if level >= len(c.Neighbors[docID]) || level < 0 {
		return nil
	}
	return c.Neighbors[docID][level]
}

// GetLevelNeighbors 兼容版本：返回 NeighborRecord
func GetLevelNeighbors(c *Collection, docID DocID, modelName string, level int) []NeighborRecord {
	ids := GetLevelNeighborIDs(c, docID, modelName, level)
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
func SetLevelNeighbors(c *Collection, docID DocID, modelName string, level int, neighbors []NeighborRecord) {
	c.Mu.Lock()
	defer c.Mu.Unlock()

	if int(docID) >= len(c.Neighbors) {
		return
	}

	// 提取 ID
	ids := make([]DocID, len(neighbors))
	for i, n := range neighbors {
		ids[i] = n.ID
	}

	// 确保层级数组足够
	for level >= len(c.Neighbors[docID]) {
		c.Neighbors[docID] = append(c.Neighbors[docID], nil)
	}
	c.Neighbors[docID][level] = ids
}

// SetLevelNeighborIDs 直接设置邻居 ID (无 NeighborRecord 转换)
func SetLevelNeighborIDs(c *Collection, docID DocID, level int, ids []DocID) {
	c.Mu.Lock()
	defer c.Mu.Unlock()

	if int(docID) >= len(c.Neighbors) {
		return
	}

	for level >= len(c.Neighbors[docID]) {
		c.Neighbors[docID] = append(c.Neighbors[docID], nil)
	}
	c.Neighbors[docID][level] = ids
}

// RemoveNeighbor 从邻居列表中移除指定节点
func RemoveNeighbor(c *Collection, docID DocID, modelName string, level int, neighborID DocID) {
	c.Mu.Lock()
	defer c.Mu.Unlock()

	if int(docID) >= len(c.Neighbors) {
		return
	}
	if level >= len(c.Neighbors[docID]) {
		return
	}

	ids := c.Neighbors[docID][level]
	newIds := make([]DocID, 0, len(ids))
	for _, id := range ids {
		if id != neighborID {
			newIds = append(newIds, id)
		}
	}
	c.Neighbors[docID][level] = newIds
}

// =========================================
// 入口点管理
// =========================================

// SelectEntryPoint 返回全局入口点
func SelectEntryPoint(c *Collection, modelName string, exclude map[DocID]bool) (DocID, bool) {
	c.Mu.RLock()
	defer c.Mu.RUnlock()

	ep := c.EntryPoint
	if ep == DocID(0xFFFFFFFF) {
		return 0, false
	}

	if exclude != nil && exclude[ep] {
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
// 工具函数
// =========================================

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
