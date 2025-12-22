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
// HNSW Build (Insert)
// =========================================

// InsertItem inserts item into HNSW index
func (c *Collection) InsertItem(item *Item, modelName string) error {
	config := c.Config
	
	// 1. Add to Items map
	c.SetItem(item)
	
	// 2. Initialize neighbors
	level := InitItemNeighbors(item, modelName, config.MaxLevel)
	
	// 3. Update level map
	c.Mu.Lock()
	AddNodeToLevelMap(c.HNSWLevelMap, modelName, item.ID, level)
	c.Mu.Unlock()
	
	// 4. Select entry point
	visited := make(map[string]bool)
	visited[item.ID] = true
	entryPoint := SelectEntryPoint(c, modelName, visited)
	
	if entryPoint == nil {
		// First node, no need to build connections
		return nil
	}
	
	// 5. Build HNSW index
	c.buildHNSWIndex(item, modelName, entryPoint, level)
	
	return nil
}

// buildHNSWIndex builds HNSW connections for item
func (c *Collection) buildHNSWIndex(item *Item, modelName string, entryPoint *Item, itemLevel int) {
	config := c.Config
	entryLevel := GetItemLevel(entryPoint, modelName)
	
	currentBest := entryPoint
	
	// Phase 1: Greedy search from top to itemLevel+1
	for level := entryLevel; level > itemLevel; level-- {
		currentBest = c.greedySearch(item, currentBest, modelName, level, config.MetricType)
	}
	
	// Phase 2: Build connections at each level
	for level := min(entryLevel, itemLevel); level >= 0; level-- {
		// Search for candidates
		candidates := c.searchLevel(item, currentBest, modelName, level, config.EfConstruction, config.MetricType)
		
		// Select neighbors using heuristic
		M := ExpectedNeighborCount(level, config.M)
		selected := c.selectNeighborsHeuristic(item, candidates, modelName, M, config.MetricType, true, true)
		
		// Set neighbors for new item
		SetLevelNeighbors(item, modelName, level, selected)
		
		// Add bidirectional connections
		for _, neighbor := range selected {
			neighborItem, ok := c.GetItem(neighbor.ID)
			if !ok {
				continue
			}
			
			// Get current neighbors of neighbor
			neighborNeighbors := GetLevelNeighbors(neighborItem, modelName, level)
			if neighborNeighbors == nil {
				neighborNeighbors = make([]NeighborRecord, 0)
			}
			
			// Add new connection (candidate) to neighbor's list
			// Need to re-select neighbors for the neighbor node to maintain M and diversity
			candidatesForNeighbor := make([]NeighborRecord, len(neighborNeighbors)+1)
			copy(candidatesForNeighbor, neighborNeighbors)
			candidatesForNeighbor[len(neighborNeighbors)] = NeighborRecord{
				ID:       item.ID,
				Distance: neighbor.Distance,
			}
			
			// Re-select with heuristic
			newNeighbors := c.selectNeighborsHeuristic(neighborItem, candidatesForNeighbor, modelName, M, config.MetricType, true, true)
			SetLevelNeighbors(neighborItem, modelName, level, newNeighbors)
		}
		
		// Use closest candidate as next entry point
		if len(candidates) > 0 {
			closestID := candidates[0].ID
			if closest, ok := c.GetItem(closestID); ok {
				currentBest = closest
			}
		}
	}
}

// greedySearch performs greedy search at single level
func (c *Collection) greedySearch(query *Item, entryPoint *Item, modelName string, level int, metricType string) *Item {
	currentBest := entryPoint
	currentDist := c.computeDistance(query, currentBest, modelName, metricType)
	
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
			
			dist := c.computeDistance(query, neighborItem, modelName, metricType)
			if dist < currentDist {
				currentBest = neighborItem
				currentDist = dist
				improved = true
			}
		}
	}
	
	return currentBest
}

// searchLevel searches for ef candidates at level
func (c *Collection) searchLevel(query *Item, entryPoint *Item, modelName string, level int, ef int, metricType string) []NeighborRecord {
	visited := make(map[string]bool)
	candidates := NewMinHeap() // Keep furthest candidate to explore
	results := NewMaxHeap(ef)  // Keep nearest results found so far
	
	entryDist := c.computeDistance(query, entryPoint, modelName, metricType)
	candidates.Push(&HeapItem{ID: entryPoint.ID, Distance: entryDist})
	results.Push(&HeapItem{ID: entryPoint.ID, Distance: entryDist})
	visited[entryPoint.ID] = true
	
	for candidates.Len() > 0 {
		current := candidates.Pop()
		
		// If current (closest in candidates) is further than furthest in results, and results is full
		// Then we can't find better candidates by exploring current
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
			
			dist := c.computeDistance(query, neighborItem, modelName, metricType)
			
			if !results.IsFull() {
				candidates.Push(&HeapItem{ID: neighbor.ID, Distance: dist})
				results.Push(&HeapItem{ID: neighbor.ID, Distance: dist})
			} else if dist < results.Peek().Distance {
				candidates.Push(&HeapItem{ID: neighbor.ID, Distance: dist})
				results.Replace(&HeapItem{ID: neighbor.ID, Distance: dist})
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
	
	// Reverse to get ascending order (closest first)
	for i, j := 0, len(result)-1; i < j; i, j = i+1, j-1 {
		result[i], result[j] = result[j], result[i]
	}
	
	return result
}

// selectNeighborsHeuristic selects neighbors using HNSW heuristic ensuring connectivity and diversity
func (c *Collection) selectNeighborsHeuristic(item *Item, candidates []NeighborRecord, modelName string, M int, metricType string, extendCandidates bool, keepPrunedConnections bool) []NeighborRecord {
	if len(candidates) <= M {
		return candidates
	}
	
	// Sort candidates by distance to item
	// Note: candidates array passed here is usually already sorted, but let's ensure it or perform a partial sort if needed.
	// For heuristic, we need strictly sorted.
	sortNeighborsByDistance(candidates)
	
	if extendCandidates {
		// Extend candidates by waiting neighbors' neighbors?
		// Standard basic heuristic just filters.
		// Extended heuristic not implemented here for brevity unless required.
	}
	
	result := make([]NeighborRecord, 0, M)
	
	for _, candidate := range candidates {
		if len(result) >= M {
			break
		}
		
		// Check distance from candidate to existing results
		// Heuristic: Add candidate only if it is closer to item than to any already selected neighbor
		isGood := true
		
		candidateItem, ok := c.GetItem(candidate.ID)
		if !ok {
			continue // skip invalid
		}
		
		for _, res := range result {
			resItem, ok := c.GetItem(res.ID)
			if !ok {
				continue
			}
			
			distToRes := c.computeDistance(candidateItem, resItem, modelName, metricType)
			
			// If candidate is closer to an existing neighbor than to the query item, skip it
			// This encourages diversity (vertices in different directions)
			if distToRes < candidate.Distance {
				isGood = false
				break
			}
		}
		
		if isGood {
			result = append(result, candidate)
		}
	}
	
	// If keepPrunedConnections is true and we haven't filled M, 
	// we might want to add some discarded connections back?
	// Standard implementation often just stops here or fills up with non-diverse ones if needed.
	// We will fill up with remaining closest if we have space, to ensure connectivity?
	// The paper says: "if the number of selected neighbors is less than M, we can add some of the discarded connections"
	
	if keepPrunedConnections && len(result) < M {
		for _, candidate := range candidates {
			if len(result) >= M {
				break
			}
			// Check if already in result
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

// computeDistance computes distance between two items
func (c *Collection) computeDistance(a, b *Item, modelName string, metricType string) float32 {
	vecA, okA := a.GetVector(modelName)
	vecB, okB := b.GetVector(modelName)
	
	if !okA || !okB {
		return float32(1e9)
	}
	
	if metricType == "l2" {
		return L2Distance(vecA, vecB)
	}
	return CosineDistance(vecA, vecB)
}

