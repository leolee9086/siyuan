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
	
	// 1. Add to Items map (Assigns DocID)
	c.SetItem(item)
	
	// 2. Initialize neighbors
	level := InitItemNeighbors(c, item.DocID, modelName, config.MaxLevel)
	
	// 3. Update level map
	c.Mu.Lock()
	AddNodeToLevelMap(c.HNSWLevelMap, modelName, item.DocID, level)
	c.Mu.Unlock()
	
	// 4. Select entry point
	// Exclusion list for finding entry point? Usually nil for insert.
	// But we might want to exclude the node itself if it was already partly in graph?
	// New node is not in graph yet (except we just added it to LevelMap).
	// SelectEntryPoint iterates LevelMap. We just added ourself.
	// We should exclude ourself to avoid finding ourself as entry point (if we are at top level).
	visited := make(map[DocID]bool)
	visited[item.DocID] = true
	
	entryPointID, ok := SelectEntryPoint(c, modelName, visited)
	
	if !ok {
		// First node or no other nodes, no need to build connections
		return nil
	}
	
	// 5. Build HNSW index
	c.buildHNSWIndex(item, modelName, entryPointID, level)
	
	return nil
}

// buildHNSWIndex builds HNSW connections for item
func (c *Collection) buildHNSWIndex(item *Item, modelName string, entryPointID DocID, itemLevel int) {
	config := c.Config
	entryLevel := GetItemLevel(c, entryPointID, modelName)
	
	currentBestID := entryPointID
	
	// Phase 1: Greedy search from top to itemLevel+1
	for level := entryLevel; level > itemLevel; level-- {
		currentBestID = c.greedySearch(item, currentBestID, modelName, level, config.MetricType)
	}
	
	// Phase 2: Build connections at each level
	for level := min(entryLevel, itemLevel); level >= 0; level-- {
		// Search for candidates
		candidates := c.searchLevel(item, currentBestID, modelName, level, config.EfConstruction, config.MetricType)
		
		// Select neighbors using heuristic
		M := ExpectedNeighborCount(level, config.M)
		selected := c.selectNeighborsHeuristic(item, candidates, modelName, M, config.MetricType, true, true)
		
		// Set neighbors for new item
		SetLevelNeighbors(c, item.DocID, modelName, level, selected)
		
		// Add bidirectional connections
		for _, neighbor := range selected {
			neighborItem, ok := c.Items[neighbor.ID]
			if !ok {
				continue
			}
			
			// Get current neighbors of neighbor
			neighborNeighbors := GetLevelNeighbors(c, neighbor.ID, modelName, level)
			if neighborNeighbors == nil {
				neighborNeighbors = make([]NeighborRecord, 0)
			}
			
			// Add new connection (candidate) to neighbor's list
			// Need to re-select neighbors for the neighbor node to maintain M and diversity
			candidatesForNeighbor := make([]NeighborRecord, len(neighborNeighbors)+1)
			copy(candidatesForNeighbor, neighborNeighbors)
			candidatesForNeighbor[len(neighborNeighbors)] = NeighborRecord{
				ID:       item.DocID,
				Distance: neighbor.Distance,
			}
			
			// Re-select with heuristic
			newNeighbors := c.selectNeighborsHeuristic(neighborItem, candidatesForNeighbor, modelName, M, config.MetricType, true, true)
			SetLevelNeighbors(c, neighbor.ID, modelName, level, newNeighbors)
		}
		
		// Use closest candidate as next entry point
		if len(candidates) > 0 {
			closestID := candidates[0].ID
			currentBestID = closestID
		}
	}
}

// greedySearch performs greedy search at single level
func (c *Collection) greedySearch(query *Item, entryPointID DocID, modelName string, level int, metricType string) DocID {
	currentBestID := entryPointID
	currentBestItem, ok := c.Items[currentBestID]
	if !ok {
	    return entryPointID
	}
	
	currentDist := c.computeDistance(query, currentBestItem, modelName, metricType)
	
	improved := true
	for improved {
		improved = false
		neighbors := GetLevelNeighbors(c, currentBestID, modelName, level)
		if neighbors == nil {
			break
		}
		
		for _, neighbor := range neighbors {
			neighborItem, ok := c.Items[neighbor.ID]
			if !ok {
				continue
			}
			
			dist := c.computeDistance(query, neighborItem, modelName, metricType)
			if dist < currentDist {
				currentBestID = neighbor.ID
				currentDist = dist
				improved = true
			}
		}
	}
	
	return currentBestID
}

// searchLevel searches for ef candidates at level
func (c *Collection) searchLevel(query *Item, entryPointID DocID, modelName string, level int, ef int, metricType string) []NeighborRecord {
	visited := make(map[DocID]bool)
	candidates := NewMinHeap() // Keep furthest candidate to explore
	results := NewMaxHeap(ef)  // Keep nearest results found so far
	
	entryPointItem, ok := c.Items[entryPointID]
	if !ok {
	    return []NeighborRecord{}
	}
	
	entryDist := c.computeDistance(query, entryPointItem, modelName, metricType)
	candidates.Push(&HeapItem{ID: entryPointID, Distance: entryDist})
	results.Push(&HeapItem{ID: entryPointID, Distance: entryDist})
	visited[entryPointID] = true
	
	for candidates.Len() > 0 {
		current := candidates.Pop()
		
		// If current (closest in candidates) is further than furthest in results, and results is full
		// Then we can't find better candidates by exploring current
		if results.IsFull() && current.Distance > results.Peek().Distance {
			break
		}
		// Check if valid? GetLevelNeighbors handles nil/bounds check
		neighbors := GetLevelNeighbors(c, current.ID, modelName, level)
		if neighbors == nil {
			continue
		}
		
		for _, neighbor := range neighbors {
			if visited[neighbor.ID] {
				continue
			}
			visited[neighbor.ID] = true
			
			neighborItem, ok := c.Items[neighbor.ID]
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
	sortNeighborsByDistance(candidates)
	
	result := make([]NeighborRecord, 0, M)
	
	for _, candidate := range candidates {
		if len(result) >= M {
			break
		}
		
		// Check distance from candidate to existing results
		// Heuristic: Add candidate only if it is closer to item than to any already selected neighbor
		isGood := true
		
		candidateItem, ok := c.Items[candidate.ID]
		if !ok {
			continue // skip invalid
		}
		
		for _, res := range result {
			resItem, ok := c.Items[res.ID]
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

// sortNeighborsByDistance sorts neighbor slice by distance ascending
func sortNeighborsByDistance(neighbors []NeighborRecord) {
    // Bubble sort or similar for small arrays (M is small, usually 16-32)
    // Insertion sort is best for small arrays.
    for i := 1; i < len(neighbors); i++ {
        key := neighbors[i]
        j := i - 1
        for j >= 0 && neighbors[j].Distance > key.Distance {
            neighbors[j+1] = neighbors[j]
            j = j - 1
        }
        neighbors[j+1] = key
    }
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

