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

	"github.com/siyuan-note/siyuan/kernel/vectordb/bbq"
)

// =========================================
// HNSW Build (Insert)
// =========================================

// Insert 将一个新节点插入 HNSW 索引
// docID 是已由外部分配的内部文档 ID，向量已存储在 Distancer 中。
// 返回值表示是否为新插入（非更新）。
func (idx *HNSWIndex) Insert(docID DocID) bool {
	config := idx.Config

	level := idx.InitItemNeighbors(docID)

	entryPointID, ok := idx.SelectEntryPoint()
	if !ok {
		idx.Mu.Lock()
		if idx.EntryPoint == InvalidEntryPoint {
			idx.EntryPoint = docID
			idx.MaxLayer = level
		}
		idx.Mu.Unlock()
		return true
	}

	// Build HNSW index connections
	idx.buildHNSWIndex(docID, entryPointID, level)

	// Update entry point if new node has higher level
	idx.Mu.Lock()
	if level > idx.MaxLayer {
		idx.MaxLayer = level
		idx.EntryPoint = docID
	}
	idx.Mu.Unlock()

	_ = config // used implicitly via idx.Config in sub-methods
	return true
}

// buildHNSWIndex 为节点构建 HNSW 连接
func (idx *HNSWIndex) buildHNSWIndex(itemDocID DocID, entryPointID DocID, itemLevel int) {
	config := idx.Config
	entryLevel := idx.GetItemLevel(entryPointID)

	currentBestID := entryPointID

	// Phase 1: 从顶层贪心搜索到 itemLevel+1
	for level := entryLevel; level > itemLevel; level-- {
		currentBestID = idx.greedySearch(itemDocID, currentBestID, level, config.MetricType)
	}

	// Phase 2: 在每一层构建连接
	for level := min(entryLevel, itemLevel); level >= 0; level-- {
		candidates := idx.searchLevel(itemDocID, currentBestID, level, config.EfConstruction, config.MetricType)

		M := ExpectedNeighborCount(level, config.M)
		selected := idx.selectNeighborsHeuristic(itemDocID, candidates, M, config.MetricType, true, true)

		idx.SetLevelNeighbors(itemDocID, level, selected)

		// 添加双向连接
		for i, neighbor := range selected {
			neighborNeighbors := idx.GetLevelNeighbors(selected[i].ID, level)
			if neighborNeighbors == nil {
				neighborNeighbors = make([]NeighborRecord, 0)
			}

			candidatesForNeighbor := make([]NeighborRecord, len(neighborNeighbors)+1)
			copy(candidatesForNeighbor, neighborNeighbors)

			// 重新计算现有邻居到 neighbor 的距离
			useBQForNeighbor := idx.Dimension >= bbq.BBQEnableThreshold
			for j := 0; j < len(neighborNeighbors); j++ {
				nID := candidatesForNeighbor[j].ID
				if useBQForNeighbor {
					candidatesForNeighbor[j].Distance = idx.Distancer.ComputeBBQDistance(neighbor.ID, nID)
				} else {
					candidatesForNeighbor[j].Distance = idx.Distancer.ComputeDistance(neighbor.ID, nID, config.MetricType)
				}
			}

			candidatesForNeighbor[len(neighborNeighbors)] = NeighborRecord{
				ID:       itemDocID,
				Distance: neighbor.Distance,
			}

			newNeighbors := idx.selectNeighborsHeuristic(neighbor.ID, candidatesForNeighbor, M, config.MetricType, true, true)
			idx.SetLevelNeighbors(neighbor.ID, level, newNeighbors)
		}

		if len(candidates) > 0 {
			currentBestID = candidates[0].ID
		}
	}
}

// greedySearch 在单层执行贪心搜索（节点对节点）
func (idx *HNSWIndex) greedySearch(queryID DocID, entryPointID DocID, level int, metricType string) DocID {
	currentBestID := entryPointID
	useBQ := idx.Dimension >= bbq.BBQEnableThreshold

	var currentDist float32
	if useBQ {
		currentDist = idx.Distancer.ComputeBBQDistance(queryID, currentBestID)
	} else {
		currentDist = idx.Distancer.ComputeDistance(queryID, currentBestID, metricType)
	}

	improved := true
	for improved {
		improved = false
		neighbors := idx.GetLevelNeighbors(currentBestID, level)
		if neighbors == nil {
			break
		}

		for _, neighbor := range neighbors {
			var dist float32
			if useBQ {
				dist = idx.Distancer.ComputeBBQDistance(queryID, neighbor.ID)
			} else {
				dist = idx.Distancer.ComputeDistance(queryID, neighbor.ID, metricType)
			}

			if dist < currentDist {
				currentBestID = neighbor.ID
				currentDist = dist
				improved = true
			}
		}
	}

	return currentBestID
}

// searchLevel 在指定层搜索 ef 个候选节点（节点对节点）
func (idx *HNSWIndex) searchLevel(queryID DocID, entryPointID DocID, level int, ef int, metricType string) []NeighborRecord {
	epoch := idx.Distancer.NewSearchEpoch()

	candidates := NewMinHeap()
	results := NewMaxHeap(ef)

	useBQ := idx.Dimension >= bbq.BBQEnableThreshold

	var entryDist float32
	if useBQ {
		entryDist = idx.Distancer.ComputeBBQDistance(queryID, entryPointID)
	} else {
		entryDist = idx.Distancer.ComputeDistance(queryID, entryPointID, metricType)
	}

	candidates.Push(&HeapItem{ID: entryPointID, Distance: entryDist})
	results.Push(&HeapItem{ID: entryPointID, Distance: entryDist})
	idx.Distancer.MarkVisited(entryPointID, epoch)

	for candidates.Len() > 0 {
		current := candidates.Pop()

		if results.IsFull() && current.Distance > results.Peek().Distance {
			break
		}

		neighbors := idx.GetLevelNeighbors(current.ID, level)
		if neighbors == nil {
			continue
		}

		for _, neighbor := range neighbors {
			if idx.Distancer.IsVisited(neighbor.ID, epoch) {
				continue
			}
			idx.Distancer.MarkVisited(neighbor.ID, epoch)

			var dist float32
			if useBQ {
				dist = idx.Distancer.ComputeBBQDistance(queryID, neighbor.ID)
			} else {
				dist = idx.Distancer.ComputeDistance(queryID, neighbor.ID, metricType)
			}

			if !results.IsFull() {
				candidates.Push(&HeapItem{ID: neighbor.ID, Distance: dist})
				results.Push(&HeapItem{ID: neighbor.ID, Distance: dist})
			} else if dist < results.Peek().Distance {
				candidates.Push(&HeapItem{ID: neighbor.ID, Distance: dist})
				results.Replace(&HeapItem{ID: neighbor.ID, Distance: dist})
			}
		}
	}

	result := make([]NeighborRecord, 0, results.Len())
	for results.Len() > 0 {
		item := results.Pop()
		result = append(result, NeighborRecord{
			ID:       item.ID,
			Distance: item.Distance,
		})
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].Distance < result[j].Distance
	})

	return result
}

// selectNeighborsHeuristic 使用 HNSW 启发式选择邻居，确保连通性和多样性
func (idx *HNSWIndex) selectNeighborsHeuristic(itemID DocID, candidates []NeighborRecord, M int, metricType string, _ bool, keepPrunedConnections bool) []NeighborRecord {
	if len(candidates) <= M {
		return candidates
	}

	sortNeighborsByDistance(candidates)

	result := make([]NeighborRecord, 0, M)
	useBQ := idx.Dimension >= bbq.BBQEnableThreshold

	for _, candidate := range candidates {
		if len(result) >= M {
			break
		}

		isGood := true
		for _, res := range result {
			var distToRes float32
			if useBQ {
				distToRes = idx.Distancer.ComputeBBQDistance(candidate.ID, res.ID)
			} else {
				distToRes = idx.Distancer.ComputeDistance(candidate.ID, res.ID, metricType)
			}

			if distToRes < candidate.Distance {
				isGood = false
				break
			}
		}

		if isGood {
			result = append(result, candidate)
		}
	}

	if keepPrunedConnections && len(result) < M {
		for _, candidate := range candidates {
			if len(result) >= M {
				break
			}
			found := false
			for _, res := range result {
				if res.ID == candidate.ID {
					found = true
					break
				}
			}
			if !found {
				result = append(result, candidate)
			}
		}
	}

	return result
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
