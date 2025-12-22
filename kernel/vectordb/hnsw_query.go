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

// =========================================
// HNSW Query (Search)
// =========================================

// SearchResult search result
type SearchResult struct {
	ID       string                 `json:"id"`
	Score    float32                `json:"score"`
	Distance float32                `json:"distance"`
	Meta     map[string]interface{} `json:"meta"`
}

// Search searches for k nearest neighbors
func (c *Collection) Search(queryVec []float32, modelName string, k int, efSearch int) []SearchResult {
	if efSearch <= 0 {
		efSearch = c.Config.EfSearch
	}
	if efSearch < k {
		efSearch = k
	}
	
	// Create temporary query item
	queryItem := NewItem("__query__")
	queryItem.SetVector(modelName, queryVec)
	
	// Select entry point
	entryPoint := SelectEntryPoint(c, modelName, nil)
	if entryPoint == nil {
		return []SearchResult{}
	}
	
	config := c.Config
	entryLevel := GetItemLevel(entryPoint, modelName)
	
	// Phase 1: Greedy search from top to level 1
	currentBest := entryPoint
	for level := entryLevel; level > 0; level-- {
		currentBest = c.greedySearchVec(queryVec, currentBest, modelName, level, config.MetricType)
	}
	
	// Phase 2: Search at level 0 with ef candidates
	candidates := c.searchLevelVec(queryVec, currentBest, modelName, 0, efSearch, config.MetricType)
	
	// Convert to search results
	searchResults := make([]SearchResult, 0, len(candidates))
	for _, candidate := range candidates {
		item, ok := c.GetItem(candidate.ID)
		if !ok {
			continue
		}
		
		score := float32(1.0) - candidate.Distance/2.0
		if score < 0 {
			score = 0
		}
		
		searchResults = append(searchResults, SearchResult{
			ID:       candidate.ID,
			Score:    score,
			Distance: candidate.Distance,
			Meta:     item.Meta,
		})
	}
	
	// Sort by score descending
	for i := 0; i < len(searchResults)-1; i++ {
		for j := i + 1; j < len(searchResults); j++ {
			if searchResults[j].Score > searchResults[i].Score {
				searchResults[i], searchResults[j] = searchResults[j], searchResults[i]
			}
		}
	}
	
	if len(searchResults) > k {
		searchResults = searchResults[:k]
	}
	
	return searchResults
}

// greedySearchVec greedy search with raw vector
func (c *Collection) greedySearchVec(queryVec []float32, entryPoint *Item, modelName string, level int, metricType string) *Item {
	currentBest := entryPoint
	currentDist := c.computeDistanceVec(queryVec, currentBest, modelName, metricType)
	
	improved := true
	for improved {
		improved = false
		neighbors := GetLevelNeighbors(currentBest, modelName, level)
		if neighbors == nil {
			break
		}
		
		for _, neighbor := range neighbors {
			neighborItem, ok := c.GetItem(neighbor.ID)
			if !ok {
				continue
			}
			
			dist := c.computeDistanceVec(queryVec, neighborItem, modelName, metricType)
			if dist < currentDist {
				currentBest = neighborItem
				currentDist = dist
				improved = true
			}
		}
	}
	
	return currentBest
}

// searchLevelVec search level with raw vector
func (c *Collection) searchLevelVec(queryVec []float32, entryPoint *Item, modelName string, level int, ef int, metricType string) []NeighborRecord {
	visited := make(map[string]bool)
	candidates := NewMinHeap()
	results := NewMaxHeap(ef)
	
	entryDist := c.computeDistanceVec(queryVec, entryPoint, modelName, metricType)
	candidates.Push(&HeapItem{ID: entryPoint.ID, Distance: entryDist})
	results.Push(&HeapItem{ID: entryPoint.ID, Distance: entryDist})
	visited[entryPoint.ID] = true
	
	for candidates.Len() > 0 {
		current := candidates.Pop()
		
		if results.IsFull() && current.Distance > results.Peek().Distance {
			break
		}
		
		currentItem, ok := c.GetItem(current.ID)
		if !ok {
			continue
		}
		
		neighbors := GetLevelNeighbors(currentItem, modelName, level)
		if neighbors == nil {
			continue
		}
		
		for _, neighbor := range neighbors {
			if visited[neighbor.ID] {
				continue
			}
			visited[neighbor.ID] = true
			
			neighborItem, ok := c.GetItem(neighbor.ID)
			if !ok {
				continue
			}
			
			dist := c.computeDistanceVec(queryVec, neighborItem, modelName, metricType)
			
			if !results.IsFull() || dist < results.Peek().Distance {
				candidates.Push(&HeapItem{ID: neighbor.ID, Distance: dist})
				results.Push(&HeapItem{ID: neighbor.ID, Distance: dist})
			}
		}
	}
	
	// Convert to neighbor records
	result := make([]NeighborRecord, 0, results.Len())
	for results.Len() > 0 {
		item := results.Pop()
		result = append(result, NeighborRecord{
			ID:       item.ID,
			Distance: item.Distance,
		})
	}
	
	// Reverse to get ascending order
	for i, j := 0, len(result)-1; i < j; i, j = i+1, j-1 {
		result[i], result[j] = result[j], result[i]
	}
	
	return result
}

// computeDistanceVec computes distance between vector and item
func (c *Collection) computeDistanceVec(queryVec []float32, item *Item, modelName string, metricType string) float32 {
	vec, ok := item.GetVector(modelName)
	if !ok {
		return float32(1e9)
	}
	
	if metricType == "l2" {
		return L2Distance(queryVec, vec)
	}
	return CosineDistance(queryVec, vec)
}
