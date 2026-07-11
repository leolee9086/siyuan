// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

package hnsw

import "math"

// SearchBy 使用不透明查询距离搜索最近邻。
// QueryDistancer 可以封装字符串编辑距离、稀疏检索状态或已转换为“越小越好”的相关性分数。
func (idx *HNSWIndex) SearchBy(query QueryDistancer, k int, efSearch int) []SearchResult {
	if query == nil || k <= 0 || idx.nodeDistancer == nil {
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

	currentBestID := entryPointID
	for level := idx.GetItemLevel(entryPointID); level > 0; level-- {
		currentBestID = idx.greedySearchBy(query, currentBestID, level)
	}
	candidates := idx.searchLevelBy(query, currentBestID, 0, efSearch)

	idx.Mu.RLock()
	results := make([]SearchResult, 0, min(k, len(candidates)))
	for _, candidate := range candidates {
		if idx.Deleted[candidate.ID] {
			continue
		}
		results = append(results, SearchResult{ID: candidate.ID, Distance: candidate.Distance})
		if len(results) == k {
			break
		}
	}
	idx.Mu.RUnlock()
	return results
}

func (idx *HNSWIndex) greedySearchBy(query QueryDistancer, entryPointID DocID, level int) DocID {
	currentBestID := entryPointID
	currentDist := validDistance(query.DistanceTo(currentBestID))
	var neighborIDs []DocID
	var distances []float32
	for {
		improved := false
		neighbors := idx.GetLevelNeighborRecords(currentBestID, level)
		neighborIDs = neighborRecordIDs(neighbors, neighborIDs)
		distances = queryDistances(query, neighborIDs, distances)
		for i, neighbor := range neighbors {
			if distances[i] < currentDist {
				currentBestID = neighbor.ID
				currentDist = distances[i]
				improved = true
			}
		}
		if !improved {
			return currentBestID
		}
	}
}

func (idx *HNSWIndex) searchLevelBy(query QueryDistancer, entryPointID DocID, level int, ef int) []NeighborRecord {
	candidates := minHeapPool.Get().(*MinHeap)
	resetMinHeap(candidates)
	defer minHeapPool.Put(candidates)

	results := maxHeapPool.Get().(*MaxHeap)
	resetMaxHeap(results)
	results.capacity = ef
	defer maxHeapPool.Put(results)

	entryDist := validDistance(query.DistanceTo(entryPointID))
	candidates.Push(HeapItem{ID: entryPointID, Distance: entryDist})
	results.Push(HeapItem{ID: entryPointID, Distance: entryDist})
	visited := map[DocID]struct{}{entryPointID: {}}
	var neighborIDs []DocID
	var distances []float32

	for candidates.Len() > 0 {
		current := candidates.Pop()
		if results.IsFull() && current.Distance > results.Peek().Distance {
			break
		}

		neighborIDs = neighborIDs[:0]
		for _, neighbor := range idx.GetLevelNeighborRecords(current.ID, level) {
			if _, ok := visited[neighbor.ID]; ok {
				continue
			}
			visited[neighbor.ID] = struct{}{}
			neighborIDs = append(neighborIDs, neighbor.ID)
		}
		distances = queryDistances(query, neighborIDs, distances)
		for i, neighborID := range neighborIDs {
			dist := distances[i]
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
		result = append(result, NeighborRecord{ID: item.ID, Distance: item.Distance})
	}
	for i, j := 0, len(result)-1; i < j; i, j = i+1, j-1 {
		result[i], result[j] = result[j], result[i]
	}
	return result
}

func queryDistances(query QueryDistancer, ids []DocID, dst []float32) []float32 {
	if batch, ok := query.(BatchQueryDistancer); ok {
		dst = batch.DistancesTo(ids, dst)
		if len(dst) != len(ids) {
			if cap(dst) < len(ids) {
				dst = make([]float32, len(ids))
			} else {
				dst = dst[:len(ids)]
			}
			for i, id := range ids {
				dst[i] = query.DistanceTo(id)
			}
		}
		for i := range ids {
			dst[i] = validDistance(dst[i])
		}
		return dst
	}
	if cap(dst) < len(ids) {
		dst = make([]float32, len(ids))
	} else {
		dst = dst[:len(ids)]
	}
	for i, id := range ids {
		dst[i] = validDistance(query.DistanceTo(id))
	}
	return dst
}

func validDistance(distance float32) float32 {
	if math.IsNaN(float64(distance)) {
		return math.MaxFloat32
	}
	return distance
}
