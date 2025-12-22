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

// SearchResult represents a search result
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
	
	// Create temporary query item for distance calculation interface if needed, 
	// but here we use computeDistanceVec directly for performance.
	
	// Select initial entry point
	entryPoint := SelectEntryPoint(c, modelName, nil)
	if entryPoint == nil {
		return []SearchResult{}
	}
	
	config := c.Config
	entryLevel := GetItemLevel(entryPoint, modelName)
	
	// Phase 1: Greedy search from top level down to level 1
	// Navigate the graph to reach the region closest to the query
	currentBest := entryPoint
	for level := entryLevel; level > 0; level-- {
		currentBest = c.greedySearchVec(queryVec, currentBest, modelName, level, config.MetricType)
	}
	
	// Phase 2: Search at level 0 (base layer) with ef candidates
	// Use a priority queue to explore neighbors and find k nearest
	candidates := c.searchLevelVec(queryVec, currentBest, modelName, 0, efSearch, config.MetricType)
	
	// Convert candidates to search results
	searchResults := make([]SearchResult, 0, len(candidates))
	for _, candidate := range candidates {
		item, ok := c.GetItem(candidate.ID)
		if !ok {
			// Item might have been deleted concurrently
			continue
		}
		
		// Convert distance to score (0 to 1)
		// For cosine similarity: distance is 1 - cosine
		//   cosine = 1 - distance
		//   score = (cosine + 1) / 2  (map -1..1 to 0..1)
		//   score = (1 - distance + 1) / 2 = 1 - distance/2
		// For L2: result is simply distance
		// We use a generic score conversion for compatibility
		score := float32(1.0)
		if config.MetricType == "cosine" {
			score = 1.0 - candidate.Distance/2.0
		} else {
			// L2 distance, smaller is better.
			// Just return distance in Distance field, Score might be inverse?
			// Let's keep score intuitive: higher is better.
			if candidate.Distance < 1e-6 {
				score = 1.0
			} else {
				score = 1.0 / (1.0 + candidate.Distance)
			}
		}
		
		if score < 0 {
			score = 0
		}
		if score > 1 {
			score = 1
		}
		
		searchResults = append(searchResults, SearchResult{
			ID:       candidate.ID,
			Score:    score,
			Distance: candidate.Distance,
			Meta:     item.Meta,
		})
	}
	
	// Sort by score descending (best match first)
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

// greedySearchVec performs greedy search at a single level using raw vector
// Returns the closest node found at this level
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

// searchLevelVec performs full search at a specific level (usually level 0)
// Returns ef closest candidates found
func (c *Collection) searchLevelVec(queryVec []float32, entryPoint *Item, modelName string, level int, ef int, metricType string) []NeighborRecord {
	visited := make(map[string]bool)
	candidates := NewMinHeap() // Min-heap to store candidates to explore (ordered by distance, closest first popped?)
	// Wait, MinHeap pops smallest. We want to pop closest to query to explore. Correct.
	
	results := NewMaxHeap(ef)  // Max-heap to store best k results found (ordered by distance, furthest first popped/peeked)
	
	entryDist := c.computeDistanceVec(queryVec, entryPoint, modelName, metricType)
	
	candidates.Push(&HeapItem{ID: entryPoint.ID, Distance: entryDist})
	results.Push(&HeapItem{ID: entryPoint.ID, Distance: entryDist})
	visited[entryPoint.ID] = true
	
	for candidates.Len() > 0 {
		// Get closest candidate to explore
		current := candidates.Pop()
		
		// Optimization: if the closest candidate in queue is further than the furthest result we already have,
		// and we have enough results (results is full), then strict search can stop.
		// Because any neighbors of 'current' will likely be even further.
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
			
			// If we found a better candidate (closer) than our current worst result, or if we don't have enough results yet
			if !results.IsFull() {
				candidates.Push(&HeapItem{ID: neighbor.ID, Distance: dist})
				results.Push(&HeapItem{ID: neighbor.ID, Distance: dist})
			} else if dist < results.Peek().Distance {
				candidates.Push(&HeapItem{ID: neighbor.ID, Distance: dist})
				results.Replace(&HeapItem{ID: neighbor.ID, Distance: dist})
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
	
	// Sort by distance ascending (closest first)
	for i := 0; i < len(result)-1; i++ {
		for j := i + 1; j < len(result); j++ {
			if result[j].Distance < result[i].Distance {
				result[i], result[j] = result[j], result[i]
			}
		}
	}
	
	return result
}

// computeDistanceVec computes distance between query vector and item's vector
func (c *Collection) computeDistanceVec(queryVec []float32, item *Item, modelName string, metricType string) float32 {
	vec, ok := item.GetVector(modelName)
	if !ok {
		return float32(1e9) // Treat as infinity if vector missing
	}
	
	if len(vec) != len(queryVec) {
		// Dimension mismatch, treat as infinity
		return float32(1e9)
	}
	
	if metricType == "l2" {
		return L2Distance(queryVec, vec)
	}
	return CosineDistance(queryVec, vec)
}
