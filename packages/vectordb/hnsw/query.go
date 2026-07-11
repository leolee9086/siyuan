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

	"s-forge.local/vectordb/bbq"
)

// =========================================
// HNSW Query (Search)
// =========================================

// Search 搜索 k 个最近邻
// 返回内部 SearchResult（包含 DocID 和精确距离），
// 外部 ID 解析和元数据附加由调用方（Collection 代理层）负责。
func (idx *HNSWIndex) Search(queryVec []float32, k int, efSearch int) []SearchResult {
	if idx.Distancer == nil {
		return nil
	}
	if efSearch <= 0 {
		efSearch = idx.Config.EfSearch
	}
	if efSearch < k {
		efSearch = k
	}

	entryPointID, ok := idx.SelectEntryPoint()
	if !ok {
		return nil
	}

	config := idx.Config
	entryLevel := idx.GetItemLevel(entryPointID)

	alpha := idx.Config.ContaminationAlpha
	var contaminated []float32
	if alpha > 0 {
		contaminated = make([]float32, len(queryVec))
		copy(contaminated, queryVec)
	}

	// BBQ: disable when contamination modifies query
	useBBQ := idx.Dimension >= bbq.BBQEnableThreshold && alpha == 0
	var queryQuantized []byte
	var queryCorrection bbq.QuantizationResult
	if useBBQ {
		queryQuantized, queryCorrection = idx.Distancer.QuantizeQuery(queryVec)
	}

	currentBestID := entryPointID
	searchVec := queryVec
	if alpha > 0 {
		searchVec = contaminated
	}
	for level := entryLevel; level > 0; level-- {
		currentBestID = idx.greedySearchVec(searchVec, queryQuantized, queryCorrection, currentBestID, level, config.MetricType)
		if alpha > 0 {
			bestVec, ok := idx.Distancer.GetUnsafe(currentBestID)
			if ok && len(bestVec) == len(searchVec) {
				for j := range searchVec {
					searchVec[j] = (1-alpha)*searchVec[j] + alpha*bestVec[j]
				}
			}
		}
	}

	candidates := idx.searchLevelVec(searchVec, queryQuantized, queryCorrection, currentBestID, 0, efSearch, config.MetricType)

	// Filter deleted nodes under read lock to avoid concurrent map access.
	idx.Mu.RLock()
	live := make([]NeighborRecord, 0, len(candidates))
	for _, c := range candidates {
		if !idx.Deleted[c.ID] {
			live = append(live, c)
		}
	}
	idx.Mu.RUnlock()

	results := make([]SearchResult, 0, len(live))
	var exactDistances []float32
	if useBBQ {
		candidateIDs := neighborRecordIDs(live, nil)
		exactDistances = idx.Distancer.ComputeDistancesFromVector(queryVec, candidateIDs, config.MetricType, nil)
	}
	for index, candidate := range live {
		var finalDist float32
		if useBBQ {
			finalDist = exactDistances[index]
		} else {
			finalDist = candidate.Distance
		}

		results = append(results, SearchResult{
			ID:       candidate.ID,
			Distance: finalDist,
		})
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].Distance < results[j].Distance
	})

	if len(results) > k {
		results = results[:k]
	}

	return results
}

// greedySearchVec 使用原始向量在单层执行贪心搜索
func (idx *HNSWIndex) greedySearchVec(queryVec []float32, queryQuantized []byte, queryCorrection bbq.QuantizationResult, entryPointID DocID, level int, metricType string) DocID {
	currentBestID := entryPointID
	useBBQ := len(queryQuantized) > 0

	var currentDist float32
	if useBBQ {
		currentDist = idx.Distancer.ComputeBBQDistanceFromQuery(queryQuantized, queryCorrection, currentBestID)
	} else {
		currentDist = idx.Distancer.ComputeDistanceFromVector(queryVec, currentBestID, metricType)
	}

	improved := true
	var neighborIDs []DocID
	var distances []float32
	for improved {
		improved = false
		neighbors := idx.GetLevelNeighborRecords(currentBestID, level)
		if neighbors == nil {
			break
		}

		neighborIDs = neighborRecordIDs(neighbors, neighborIDs)
		if useBBQ {
			distances = idx.Distancer.ComputeBBQDistancesFromQuery(queryQuantized, queryCorrection, neighborIDs, distances)
		} else {
			distances = idx.Distancer.ComputeDistancesFromVector(queryVec, neighborIDs, metricType, distances)
		}
		for index, neighbor := range neighbors {
			dist := distances[index]

			if dist < currentDist {
				currentBestID = neighbor.ID
				currentDist = dist
				improved = true
			}
		}
	}

	return currentBestID
}

// searchLevelVec 使用原始向量在指定层搜索 ef 个候选
func (idx *HNSWIndex) searchLevelVec(queryVec []float32, queryQuantized []byte, queryCorrection bbq.QuantizationResult, entryPointID DocID, level int, ef int, metricType string) []NeighborRecord {
	epoch := idx.Distancer.NewSearchEpoch()

	candidates := minHeapPool.Get().(*MinHeap)
	resetMinHeap(candidates)
	defer minHeapPool.Put(candidates)

	results := maxHeapPool.Get().(*MaxHeap)
	resetMaxHeap(results)
	results.capacity = ef
	defer maxHeapPool.Put(results)

	useBBQ := len(queryQuantized) > 0
	var entryDist float32
	if useBBQ {
		entryDist = idx.Distancer.ComputeBBQDistanceFromQuery(queryQuantized, queryCorrection, entryPointID)
	} else {
		entryDist = idx.Distancer.ComputeDistanceFromVector(queryVec, entryPointID, metricType)
	}

	candidates.Push(HeapItem{ID: entryPointID, Distance: entryDist})
	results.Push(HeapItem{ID: entryPointID, Distance: entryDist})
	idx.Distancer.MarkVisited(entryPointID, epoch)
	var neighborIDs []DocID
	var distances []float32

	for candidates.Len() > 0 {
		current := candidates.Pop()

		if results.IsFull() && current.Distance > results.Peek().Distance {
			break
		}

		neighbors := idx.GetLevelNeighborRecords(current.ID, level)
		if neighbors == nil {
			continue
		}

		if !useBBQ {
			neighborIDs = neighborIDs[:0]
			for _, neighbor := range neighbors {
				if idx.Distancer.IsVisited(neighbor.ID, epoch) {
					continue
				}
				idx.Distancer.MarkVisited(neighbor.ID, epoch)
				neighborIDs = append(neighborIDs, neighbor.ID)
			}
			distances = idx.Distancer.ComputeDistancesFromVector(queryVec, neighborIDs, metricType, distances)
			for index, neighborID := range neighborIDs {
				dist := distances[index]
				if !results.IsFull() {
					candidates.Push(HeapItem{ID: neighborID, Distance: dist})
					results.Push(HeapItem{ID: neighborID, Distance: dist})
				} else if dist < results.Peek().Distance {
					candidates.Push(HeapItem{ID: neighborID, Distance: dist})
					results.Replace(HeapItem{ID: neighborID, Distance: dist})
				}
			}
			continue
		}

		neighborIDs = neighborIDs[:0]
		for _, neighbor := range neighbors {
			if idx.Distancer.IsVisited(neighbor.ID, epoch) {
				continue
			}
			idx.Distancer.MarkVisited(neighbor.ID, epoch)
			neighborIDs = append(neighborIDs, neighbor.ID)
		}
		distances = idx.Distancer.ComputeBBQDistancesFromQuery(queryQuantized, queryCorrection, neighborIDs, distances)
		for index, neighborID := range neighborIDs {
			dist := distances[index]

			if !results.IsFull() {
				candidates.Push(HeapItem{ID: neighborID, Distance: dist})
				results.Push(HeapItem{ID: neighborID, Distance: dist})
			} else if dist < results.Peek().Distance {
				candidates.Push(HeapItem{ID: neighborID, Distance: dist})
				results.Replace(HeapItem{ID: neighborID, Distance: dist})
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

	for i, j := 0, len(result)-1; i < j; i, j = i+1, j-1 {
		result[i], result[j] = result[j], result[i]
	}

	return result
}

// =========================================
// 内联距离函数（用于 BBQ rescore）
// =========================================

func cosineDistance(a, b []float32) float32 {
	if len(a) != len(b) || len(a) == 0 {
		return 2.0
	}

	n := len(a)
	var d0, d1, d2, d3, d4, d5, d6, d7 float32
	var a0, a1, a2, a3, a4, a5, a6, a7 float32
	var b0, b1, b2, b3, b4, b5, b6, b7 float32
	i := 0

	for ; i <= n-8; i += 8 {
		d0 += a[i] * b[i]
		d1 += a[i+1] * b[i+1]
		d2 += a[i+2] * b[i+2]
		d3 += a[i+3] * b[i+3]
		d4 += a[i+4] * b[i+4]
		d5 += a[i+5] * b[i+5]
		d6 += a[i+6] * b[i+6]
		d7 += a[i+7] * b[i+7]
		a0 += a[i] * a[i]
		a1 += a[i+1] * a[i+1]
		a2 += a[i+2] * a[i+2]
		a3 += a[i+3] * a[i+3]
		a4 += a[i+4] * a[i+4]
		a5 += a[i+5] * a[i+5]
		a6 += a[i+6] * a[i+6]
		a7 += a[i+7] * a[i+7]
		b0 += b[i] * b[i]
		b1 += b[i+1] * b[i+1]
		b2 += b[i+2] * b[i+2]
		b3 += b[i+3] * b[i+3]
		b4 += b[i+4] * b[i+4]
		b5 += b[i+5] * b[i+5]
		b6 += b[i+6] * b[i+6]
		b7 += b[i+7] * b[i+7]
	}

	dotProduct := d0 + d1 + d2 + d3 + d4 + d5 + d6 + d7
	normA := a0 + a1 + a2 + a3 + a4 + a5 + a6 + a7
	normB := b0 + b1 + b2 + b3 + b4 + b5 + b6 + b7

	for ; i < n; i++ {
		dotProduct += a[i] * b[i]
		normA += a[i] * a[i]
		normB += b[i] * b[i]
	}

	if normA == 0 || normB == 0 {
		return 1.0
	}

	similarity := dotProduct / (sqrt32(normA) * sqrt32(normB))
	distance := 1.0 - similarity
	if distance < 0 {
		distance = 0
	}
	if distance > 2 {
		distance = 2
	}
	return distance
}

func l2Distance(a, b []float32) float32 {
	if len(a) != len(b) || len(a) == 0 {
		return 1e38
	}

	n := len(a)
	var s0, s1, s2, s3, s4, s5, s6, s7 float32
	i := 0

	for ; i <= n-8; i += 8 {
		d0 := a[i] - b[i]
		d1 := a[i+1] - b[i+1]
		d2 := a[i+2] - b[i+2]
		d3 := a[i+3] - b[i+3]
		d4 := a[i+4] - b[i+4]
		d5 := a[i+5] - b[i+5]
		d6 := a[i+6] - b[i+6]
		d7 := a[i+7] - b[i+7]
		s0 += d0 * d0
		s1 += d1 * d1
		s2 += d2 * d2
		s3 += d3 * d3
		s4 += d4 * d4
		s5 += d5 * d5
		s6 += d6 * d6
		s7 += d7 * d7
	}
	sum := s0 + s1 + s2 + s3 + s4 + s5 + s6 + s7
	for ; i < n; i++ {
		d := a[i] - b[i]
		sum += d * d
	}
	return sum
}

// sqrt32 快速 float32 平方根
func sqrt32(x float32) float32 {
	if x <= 0 {
		return 0
	}
	// 使用 Newton-Raphson 迭代
	r := x
	r = 0.5 * (r + x/r)
	r = 0.5 * (r + x/r)
	r = 0.5 * (r + x/r)
	return r
}
