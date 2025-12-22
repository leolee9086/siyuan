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
// HNSW Query (Search)
// =========================================

// SearchResult represents a search result
type SearchResult struct {
	ID       string          `json:"id"`
	Score    float32         `json:"score"`
	Distance float32         `json:"distance"`
	Meta     json.RawMessage `json:"meta"`
}

// Search searches for k nearest neighbors
// Search searches for k nearest neighbors
// Search searches for k nearest neighbors
func (c *Collection) Search(queryVec []float32, k int, efSearch int) []SearchResult {
	if efSearch <= 0 {
		efSearch = c.Config.EfSearch
	}
	if efSearch < k {
		efSearch = k
	}
	
	// Select initial entry point
	entryPointID, ok := SelectEntryPoint(c, nil)
	if !ok {
		return []SearchResult{}
	}
	
	config := c.Config
	entryLevel := GetItemLevel(c, entryPointID, "")
	
    // BBQ: 对查询向量进行4-bit量化
    useBBQ := c.Dimension >= BBQEnableThreshold
    var queryQuantized []byte
    var queryCorrection 量化结果
    if useBBQ {
        queryQuantized, queryCorrection = c.Store.QuantizeQuery(queryVec)
    }
    
	// Phase 1: Greedy search from top level down to level 1
	// Navigate the graph to reach the region closest to the query
	currentBestID := entryPointID
	for level := entryLevel; level > 0; level-- {
		currentBestID = c.greedySearchVec(queryVec, queryQuantized, queryCorrection, currentBestID, level, config.MetricType)
	}
	
	// Phase 2: Search at level 0 (base layer) with ef candidates
	candidates := c.searchLevelVec(queryVec, queryQuantized, queryCorrection, currentBestID, 0, efSearch, config.MetricType)
	
	// Convert candidates to search results
	searchResults := make([]SearchResult, 0, len(candidates))
	for _, candidate := range candidates {
		// 跳过已删除的节点
		if c.Deleted[candidate.ID] {
			continue
		}
		
		// Resolve External ID
		externalID, _ := c.GetExternalID(candidate.ID)
		
        // Re-score with full precision if BBQ was used
        // BBQ距离是估计值,需要用原始向量重新计算精确距离
        
        var finalDist float32
        if useBBQ {
            // 零拷贝优化: 使用 GetUnsafe 避免 4KB 内存分配
            vec, ok := c.Store.GetUnsafe(candidate.ID)
            if ok && len(vec) == len(queryVec) {
                if config.MetricType == "l2" {
                    finalDist = L2Distance(queryVec, vec)
                } else {
                    finalDist = CosineDistance(queryVec, vec)
                }
            } else {
                finalDist = 1e9
            }
        } else {
            finalDist = candidate.Distance
        }
		
		// Convert distance to score (0 to 1)
		score := float32(1.0)
		if config.MetricType == "cosine" {
			score = 1.0 - finalDist/2.0
		} else {
			if finalDist < 1e-6 {
				score = 1.0
			} else {
				score = 1.0 / (1.0 + finalDist)
			}
		}
		
		if score < 0 {
			score = 0
		}
		if score > 1 {
			score = 1
		}
		
		// 获取元数据
		meta, _ := c.GetMeta(candidate.ID)
		
		searchResults = append(searchResults, SearchResult{
			ID:       externalID,
			Score:    score,
			Distance: finalDist,
			Meta:     meta,
		})
	}
	
	// 使用标准库排序 O(n log n) 替代冒泡 O(n²)
	sort.Slice(searchResults, func(i, j int) bool {
		return searchResults[i].Score > searchResults[j].Score
	})
	
	if len(searchResults) > k {
		searchResults = searchResults[:k]
	}
	
	return searchResults
}

// greedySearchVec performs greedy search at a single level using raw vector
// Returns the closest node found at this level
func (c *Collection) greedySearchVec(queryVec []float32, queryQuantized []byte, queryCorrection 量化结果, entryPointID DocID, level int, metricType string) DocID {
	currentBestID := entryPointID
	
    // 使用BBQ计算距离
    useBBQ := len(queryQuantized) > 0
    var currentDist float32
    if useBBQ {
        currentDist = c.Store.ComputeBBQDistanceFromQuery(queryQuantized, queryCorrection, currentBestID)
    } else {
        currentDist = c.Store.ComputeDistanceFromVector(queryVec, currentBestID, metricType)
    }
	
	improved := true
	for improved {
		improved = false
		// 零分配优化: 使用 GetLevelNeighborIDs
		neighborIDs := GetLevelNeighborIDs(c, currentBestID, level)
		if neighborIDs == nil {
			break
		}
		
		for _, neighborID := range neighborIDs {
            var dist float32
            if useBBQ {
                dist = c.Store.ComputeBBQDistanceFromQuery(queryQuantized, queryCorrection, neighborID)
            } else {
                dist = c.Store.ComputeDistanceFromVector(queryVec, neighborID, metricType)
            }
            
			if dist < currentDist {
				currentBestID = neighborID
				currentDist = dist
				improved = true
			}
		}
	}
	
	return currentBestID
}

// searchLevelVec performs full search at a specific level (usually level 0)
// Returns ef closest candidates found
func (c *Collection) searchLevelVec(queryVec []float32, queryQuantized []byte, queryCorrection 量化结果, entryPointID DocID, level int, ef int, metricType string) []NeighborRecord {
	// P0优化: Epoch-based visited set
    epoch := c.Store.NewSearchEpoch()
    
	candidates := NewMinHeap() // Min-heap to store candidates to explore
	results := NewMaxHeap(ef)  // Max-heap to store best k results found
	
    useBBQ := len(queryQuantized) > 0
    var entryDist float32
    if useBBQ {
        entryDist = c.Store.ComputeBBQDistanceFromQuery(queryQuantized, queryCorrection, entryPointID)
    } else {
        entryDist = c.Store.ComputeDistanceFromVector(queryVec, entryPointID, metricType)
    }
	
	candidates.Push(&HeapItem{ID: entryPointID, Distance: entryDist})
	results.Push(&HeapItem{ID: entryPointID, Distance: entryDist})
	c.Store.MarkVisited(entryPointID, epoch)
	
	for candidates.Len() > 0 {
		current := candidates.Pop()
		
		if results.IsFull() && current.Distance > results.Peek().Distance {
			break
		}
		
		// 零分配优化: 使用 GetLevelNeighborIDs
		neighborIDs := GetLevelNeighborIDs(c, current.ID, level)
		if neighborIDs == nil {
			continue
		}
		
		for _, neighborID := range neighborIDs {
			if c.Store.IsVisited(neighborID, epoch) {
				continue
			}
			c.Store.MarkVisited(neighborID, epoch)
			
            var dist float32
            if useBBQ {
                dist = c.Store.ComputeBBQDistanceFromQuery(queryQuantized, queryCorrection, neighborID)
            } else {
                dist = c.Store.ComputeDistanceFromVector(queryVec, neighborID, metricType)
            }
			
			if !results.IsFull() {
				candidates.Push(&HeapItem{ID: neighborID, Distance: dist})
				results.Push(&HeapItem{ID: neighborID, Distance: dist})
			} else if dist < results.Peek().Distance {
				candidates.Push(&HeapItem{ID: neighborID, Distance: dist})
				results.Replace(&HeapItem{ID: neighborID, Distance: dist})
			}
		}
	}
	
	// Extract results from heap
	result := make([]NeighborRecord, 0, results.Len())
	for results.Len() > 0 {
		item := results.Pop()
		result = append(result, NeighborRecord{
			ID:       item.ID,
			Distance: item.Distance,
		})
	}
	
	// 使用标准库排序 O(n log n) 替代冒泡 O(n²)
	sort.Slice(result, func(i, j int) bool {
		return result[i].Distance < result[j].Distance
	})
	
	return result
}

// computeDistanceVec deprecated
func (c *Collection) computeDistanceVec(queryVec []float32, item *Item, modelName string, metricType string) float32 {
    // Redirect to store
    return c.Store.ComputeDistanceFromVector(queryVec, item.DocID, metricType)
}
