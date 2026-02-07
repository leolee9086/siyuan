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
	"encoding/json"
	"sort"
)

// =========================================
// HNSW Delete (简化版)
// =========================================

// DeleteItemWithIndex 删除项目并更新 HNSW 索引
func (c *Collection) DeleteItemWithIndex(id string) {
	docID, ok := c.GetDocID(id)
	if !ok {
		return
	}

	affectedNeighbors := make([]DocID, 0)

	// 从所有邻居的邻接表中移除
	level := c.GetNodeLevel(docID)
	for l := 0; l <= level; l++ {
		neighborIDs := c.GetLevelNeighborIDs(docID, l)
		if neighborIDs == nil {
			continue
		}

		for _, neighborID := range neighborIDs {
			RemoveNeighbor(c, neighborID, l, docID)
			affectedNeighbors = append(affectedNeighbors, neighborID)
		}
	}

	// 软删除
	c.Mu.Lock()
	c.Deleted[docID] = true
	delete(c.IDMap, id)

	// 清空邻居列表
	if int(docID) < len(c.Neighbors) {
		c.Neighbors[docID] = nil
	}

	// 如果删除的是入口点，重新选择
	if c.EntryPoint == docID {
		c.EntryPoint = DocID(0xFFFFFFFF)
		maxL := -1
		var newEp DocID = 0xFFFFFFFF

		for i := 0; i < len(c.Neighbors); i++ {
			if DocID(i) == docID || c.Deleted[DocID(i)] {
				continue
			}
			nodeLevel := len(c.Neighbors[i]) - 1
			if nodeLevel > maxL {
				maxL = nodeLevel
				newEp = DocID(i)
			}
		}
		c.EntryPoint = newEp
		c.MaxLayer = maxL
	}
	c.Mu.Unlock()

	// 重计算受影响的邻居
	for _, neighborID := range affectedNeighbors {
		c.recomputeNeighbors(neighborID)
	}
}

// recomputeNeighbors 删除后重计算邻居
func (c *Collection) recomputeNeighbors(docID DocID) {
	if c.Deleted[docID] {
		return
	}

	config := c.Config
	level := c.GetNodeLevel(docID)

	for l := 0; l <= level; l++ {
		expectedNeighbors := ExpectedNeighborCount(l, config.M)
		neighborIDs := c.GetLevelNeighborIDs(docID, l)

		if len(neighborIDs) >= expectedNeighbors {
			continue
		}

		// BFS 寻找更多邻居
		visited := make(map[DocID]bool)
		visited[docID] = true

		candidates := make([]NeighborRecord, 0, expectedNeighbors*2)

		queue := make([]DocID, 0)
		for _, nid := range neighborIDs {
			queue = append(queue, nid)
			visited[nid] = true
		}

		for len(queue) > 0 && len(candidates) < expectedNeighbors*2 {
			current := queue[0]
			queue = queue[1:]

			if c.Deleted[current] {
				continue
			}

			dist := c.Store.ComputeDistance(docID, current, config.MetricType)
			candidates = append(candidates, NeighborRecord{ID: current, Distance: dist})

			nextNeighbors := c.GetLevelNeighborIDs(current, l)
			for _, nnID := range nextNeighbors {
				if !visited[nnID] && !c.Deleted[nnID] {
					visited[nnID] = true
					queue = append(queue, nnID)
				}
			}
		}

		// 排序选择最近的
		sort.Slice(candidates, func(i, j int) bool {
			return candidates[i].Distance < candidates[j].Distance
		})

		newNeighborIDs := make([]DocID, 0, expectedNeighbors)
		for _, cand := range candidates {
			if len(newNeighborIDs) >= expectedNeighbors {
				break
			}
			newNeighborIDs = append(newNeighborIDs, cand.ID)
		}

		SetLevelNeighborIDs(c, docID, l, newNeighborIDs)
	}
}

// RebuildIndex 重建索引
func (c *Collection) RebuildIndex() error {
	// 收集所有有效项 (直接包含 vector 和 meta)
	points := make([]Point, 0)

	c.Mu.RLock()
	for i, id := range c.DocMap {
		docID := DocID(i)
		if c.Deleted[docID] {
			continue
		}
        
        // 获取向量
        vec, ok := c.Store.GetUnsafe(docID)
        if !ok {
            continue // Should not happen
        }
        // 复制向量 (因为 Rebuild 会清空 Store 重新插入，或者我们可以优化为仅清空 Graph？)
        // InsertPoint 会 append 到 Store。如果全量重建，我们应该清空 Store？
        // 但 c.Store 是 append-only，为了避免大量拷贝，我们可以重新构建 Graph 而不移动数据？
        // 但 InsertPoint 逻辑是分配新 DocID。
        
        // 方案 A: 彻底重建。清空 DocMap, IDMap, Metas, Store, Neighbors。
        // 这样可以物理移除已删除的数据，从碎片中恢复。推荐。
        
        vecCopy := make([]float32, len(vec))
        copy(vecCopy, vec)
        
        var meta json.RawMessage
        if int(docID) < len(c.Metas) {
            meta = c.Metas[docID]
        }
        
		points = append(points, Point{
			ID:     id,
			Vector: vecCopy,
			Meta:   meta,
		})
	}
	c.Mu.RUnlock()

	if len(points) == 0 {
        // Empty collection
        c.Mu.Lock()
        c.Neighbors = make([][][]DocID, 0)
        c.Deleted = make(map[DocID]bool)
        c.IDMap = make(map[string]DocID)
        c.DocMap = make([]string, 0)
        c.Metas = make([][]byte, 0)
        c.Store = NewVectorStore(c.Dimension) // Reset store
        c.EntryPoint = DocID(0xFFFFFFFF)
        c.MaxLayer = -1
        c.Mu.Unlock()
		return nil
	}
    
    // Reset collection structure
    c.Mu.Lock()
    c.Neighbors = make([][][]DocID, 0)
    c.Deleted = make(map[DocID]bool)
    c.IDMap = make(map[string]DocID)
    c.DocMap = make([]string, 0)
    c.Metas = make([][]byte, 0)
    c.Store = NewVectorStore(c.Dimension) // Reset store
    c.EntryPoint = DocID(0xFFFFFFFF)
    c.MaxLayer = -1
    c.Mu.Unlock()

	// 重新插入
	for _, point := range points {
		c.InsertPoint(point)
	}

	return nil
}
