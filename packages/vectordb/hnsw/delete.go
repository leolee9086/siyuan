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
	"sort"
	"sync"
)

// =========================================
// HNSW Delete
// =========================================

// Delete 从 HNSW 索引中删除节点。
// 执行软删除并修复受影响邻居的连接。
func (idx *HNSWIndex) Delete(docID DocID) {
	if idx.IsDeleted(docID) {
		return
	}

	affectedNeighbors := make([]DocID, 0)

	// 从所有邻居的邻接表中移除
	level := idx.GetItemLevel(docID)
	for l := 0; l <= level; l++ {
		neighborIDs := idx.GetLevelNeighborIDs(docID, l)
		if neighborIDs == nil {
			continue
		}

		for _, neighborID := range neighborIDs {
			idx.RemoveNeighbor(neighborID, l, docID)
			affectedNeighbors = append(affectedNeighbors, neighborID)
		}
	}

	// 软删除、清空邻居并更新入口点。
	idx.Mu.Lock()
	idx.Deleted[docID] = true

	if int(docID) < len(idx.Neighbors) {
		lock := idx.nodeLocks[docID]
		lock.Lock()
		idx.Neighbors[docID] = nil
		lock.Unlock()
	}

	if idx.EntryPoint == docID {
		idx.EntryPoint = InvalidEntryPoint
		maxL := -1
		var newEp DocID = InvalidEntryPoint

		for i := 0; i < len(idx.Neighbors); i++ {
			if DocID(i) == docID || idx.Deleted[DocID(i)] {
				continue
			}
			if idx.Neighbors[i] == nil {
				continue
			}
			nodeLevel := len(idx.Neighbors[i]) - 1
			if nodeLevel > maxL {
				maxL = nodeLevel
				newEp = DocID(i)
			}
		}
		idx.EntryPoint = newEp
		idx.MaxLayer = maxL
	}
	idx.Mu.Unlock()

	// 重计算受影响的邻居
	for _, neighborID := range affectedNeighbors {
		idx.recomputeNeighbors(neighborID)
	}
}

// recomputeNeighbors 删除后重计算邻居连接。
func (idx *HNSWIndex) recomputeNeighbors(docID DocID) {
	if idx.IsDeleted(docID) {
		return
	}

	config := idx.Config
	level := idx.GetItemLevel(docID)

	for l := 0; l <= level; l++ {
		expectedNeighbors := ExpectedNeighborCount(l, config.M)
		neighborIDs := idx.GetLevelNeighborIDs(docID, l)

		if len(neighborIDs) >= expectedNeighbors {
			continue
		}

		// BFS 寻找更多邻居
		visited := make(map[DocID]bool)
		visited[docID] = true

		candidates := make([]NeighborRecord, 0, expectedNeighbors*2)

		// 向量索引预取 docID 的向量；非向量索引直接使用节点间距离。
		var docVec []float32
		var hasVec bool
		if idx.Distancer != nil {
			docVec, hasVec = idx.Distancer.GetUnsafe(docID)
		}

		queue := make([]DocID, 0)
		for _, nid := range neighborIDs {
			queue = append(queue, nid)
			visited[nid] = true
		}

		for len(queue) > 0 && len(candidates) < expectedNeighbors*2 {
			current := queue[0]
			queue = queue[1:]

			if idx.IsDeleted(current) {
				continue
			}

			var dist float32
			if hasVec {
				dist = idx.Distancer.ComputeDistanceFromVector(docVec, current, config.MetricType)
			} else {
				dist = validDistance(idx.nodeDistancer.ComputeDistance(docID, current, config.MetricType))
			}
			candidates = append(candidates, NeighborRecord{ID: current, Distance: dist})

			nextNeighbors := idx.GetLevelNeighborIDs(current, l)
			for _, nnID := range nextNeighbors {
				if !visited[nnID] && !idx.IsDeleted(nnID) {
					visited[nnID] = true
					queue = append(queue, nnID)
				}
			}
		}

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

		idx.SetLevelNeighborIDs(docID, l, newNeighborIDs)
	}
}

// RebuildIndex 重建索引。
// 需要外部提供 resetFn 来重置索引状态并重新插入所有有效节点。
// resetFn 参数：当前有效的 docID 列表。
// 这个方法清空图结构，由外部负责重新调用 Insert。
func (idx *HNSWIndex) RebuildIndex(validDocIDs []DocID) {
	idx.Mu.Lock()
	idx.Neighbors = make([][][]NeighborRecord, 0)
	idx.nodeLocks = make([]*sync.RWMutex, 0)
	idx.Deleted = make(map[DocID]bool)
	idx.EntryPoint = InvalidEntryPoint
	idx.MaxLayer = -1
	idx.Mu.Unlock()

	for _, docID := range validDocIDs {
		idx.Insert(docID)
	}
}
