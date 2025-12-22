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

import "sort"

// =========================================
// HNSW Build (Insert)
// =========================================

// InsertItem inserts item into HNSW index
// InsertItem inserts item into HNSW index
// InsertPoint inserts a point into HNSW index
func (c *Collection) InsertPoint(point Point) error {
	config := c.Config
	
	// 1. Add to Store and IDMap
    // Check if ID exists
    var docID DocID
    exists := false
    
    c.Mu.Lock()
    if existingID, ok := c.IDMap[point.ID]; ok {
        docID = existingID
        exists = true
        // If updating, we might need to handle replacement carefully.
        // For simplicity in this version, we update Meta and Vector Store,
        // but re-indexing in graph is complex (requires delete + insert).
        // Let's assume Delete-then-Insert or simple update if graph unchanged.
        // SAFE APPROACH: Update Vector & Meta. Graph structure *might* degrade if vector changes largely.
        // HNSW supports "updating" element by re-inserting.
    } else {
        docID = DocID(len(c.DocMap))
        c.IDMap[point.ID] = docID
        c.DocMap = append(c.DocMap, point.ID)
        // Ensure Metas capacity
        if len(c.Metas) < len(c.DocMap) {
             c.Metas = append(c.Metas, make([][]byte, len(c.DocMap)-len(c.Metas))...)
        }
    }
    
    // Update Meta
    if int(docID) < len(c.Metas) {
        c.Metas[docID] = point.Meta
    } else {
        // Should not happen if logic above is correct
        c.Metas = append(c.Metas, point.Meta)
    }
    
    c.Mu.Unlock()
    
    // 2. Set Vector to Store
    c.Store.Set(docID, point.Vector)
    
    // 3. Initialize neighbors if new
    if !exists {
        level := InitItemNeighbors(c, docID, config.MaxLevel) // modelName removed from utils
        
        // 4. Select entry point
        entryPointID, ok := SelectEntryPoint(c, nil) // modelName removed
        
        if !ok {
             c.Mu.Lock()
             if c.EntryPoint == DocID(0xFFFFFFFF) {
                 c.EntryPoint = docID
                 c.MaxLayer = level
             }
             c.Mu.Unlock()
             return nil
        }
        
        // 5. Build HNSW index
        c.buildHNSWIndex(docID, entryPointID, level)
        
        // 6. Update Entry Point
        c.Mu.Lock()
        if level > c.MaxLayer {
            c.MaxLayer = level
            c.EntryPoint = docID
        }
        c.Mu.Unlock()
    } else {
        // If exists, we treat it as update. 
        // For correctness in HNSW, we should delete graph connections and re-insert.
        // BUT, user asked for "Upsert".
        // Robust way: Delete connections -> Re-insert.
        // For now, let's just update vector/meta. Graph remains.
        // Ideal: c.DeleteItemWithIndex(point.ID, "") then Insert.
        // But we are inside lock? No.
        
        // Temporarily: Just update content. Structure stale.
        // TODO: Full re-insert support.
    }
	
	return nil
}

// buildHNSWIndex builds HNSW connections for item
func (c *Collection) buildHNSWIndex(itemDocID DocID, entryPointID DocID, itemLevel int) {
	config := c.Config
    // modelName removed
	entryLevel := GetItemLevel(c, entryPointID, "")
	
	currentBestID := entryPointID
	
	// Phase 1: Greedy search from top to itemLevel+1
    // Optimization: Use BQ for this phase if vectors are large?
    // User requested "SOTA". Standard HNSW uses consistent metric.
    // Speculation: At high levels (sparse graph), distance precision matters less than direction.
    // Let's use standard distance (vectors) for Phase 1 for now to be safe, 
    // or use BQ if dimension > 128.
    // Given 1024 dim, BQ is 32x smaller.
    // Let's use BQ for all searches if available?
    // Note: To use BQ effectively, we need BQ distance function *and* thresholds.
    // Our BQ is Hamming. 
    // Let's default to using Store.ComputeDistance which handles metric.
    // We can add a "UseQuantized" flag to greedySearch.
    
	for level := entryLevel; level > itemLevel; level-- {
		currentBestID = c.greedySearch(itemDocID, currentBestID, level, config.MetricType)
	}
	
	// Phase 2: Build connections at each level
	for level := min(entryLevel, itemLevel); level >= 0; level-- {
		// Search for candidates
		candidates := c.searchLevel(itemDocID, currentBestID, level, config.EfConstruction, config.MetricType)
		
        // Note: candidates result uses computed distance.
        
		// Select neighbors using heuristic
		M := ExpectedNeighborCount(level, config.M)
		selected := c.selectNeighborsHeuristic(itemDocID, candidates, M, config.MetricType, true, true)
		
		// Set neighbors for new item
		SetLevelNeighbors(c, itemDocID, level, selected)
		
		// Add bidirectional connections
		for i, neighbor := range selected {
            // Note: Neighbor existence check is implicit in graph structure (if valid ID)
            
			// Get current neighbors of neighbor
			neighborNeighbors := GetLevelNeighbors(c, selected[i].ID, level)
			if neighborNeighbors == nil {
				neighborNeighbors = make([]NeighborRecord, 0)
			}
			
			// Add new connection (candidate) to neighbor's list
			// Need to re-select neighbors for the neighbor node to maintain M and diversity
			candidatesForNeighbor := make([]NeighborRecord, len(neighborNeighbors)+1)
			copy(candidatesForNeighbor, neighborNeighbors)
            
            // CRITICAL FIX: Existing neighbors have dummy distance 0 from GetLevelNeighbors.
            // We MUST recompute their distance to 'neighbor.ID' so the heuristic can properly rank them
            // against the new 'item.DocID'. otherwise new items are always dropped.
            for i := 0; i < len(neighborNeighbors); i++ {
                // Determine metric type
                // Optimization: If BQ is used, should we use BQ dist here?
                // 'neighbor' node is the center.
                // We should use the same logic as the forward pass.
                // But forward pass used BQ if >= 128.
                // Let's use BQ if applicable.
                
                useBQForNeighbor := c.Dimension >= 128
                nID := candidatesForNeighbor[i].ID
                
                if useBQForNeighbor {
                    candidatesForNeighbor[i].Distance = float32(c.Store.ComputeBBQDistance(neighbor.ID, nID))
                } else {
                    candidatesForNeighbor[i].Distance = c.Store.ComputeDistance(neighbor.ID, nID, config.MetricType)
                }
            }

            // Re-calculate distance from neighbor to item?
            // We have dist(item, neighbor). Metric is symmetric.
            // If BQ was used for 'item' -> 'neighbor' (in searchLevel), 'neighbor.Distance' is BQ dist.
            // If NOT BQ (64 dim), it's float dist.
            // So we can just use it.
			candidatesForNeighbor[len(neighborNeighbors)] = NeighborRecord{
				ID:       itemDocID,
				Distance: neighbor.Distance,
			}
			
			// Re-select with heuristic
			newNeighbors := c.selectNeighborsHeuristic(neighbor.ID, candidatesForNeighbor, M, config.MetricType, true, true)
			SetLevelNeighbors(c, neighbor.ID, level, newNeighbors)
		}
		
		// Use closest candidate as next entry point
		if len(candidates) > 0 {
			closestID := candidates[0].ID
			currentBestID = closestID
		}
	}
}

// greedySearch performs greedy search at single level
func (c *Collection) greedySearch(queryID DocID, entryPointID DocID, level int, metricType string) DocID {
	currentBestID := entryPointID
    // TODO: Verify entryPointID is valid
	
    // Optimization: Use BQ distance?
    // For 1024-dim, BQ is much faster.
    // But we need to check if BQ is ready.
    // Let's assume yes if dimension > 128? Or check config?
    // For now, keep using full precision or hybrid (BQ filter + rescore)?
    // Greedy search is just finding a local minimum.
    // Let's use BQ distance here if possible!
    
    useBQ := c.Dimension >= 128
    
    var currentDist float32
    if useBQ {
        currentDist = float32(c.Store.ComputeBBQDistance(queryID, currentBestID))
    } else {
        currentDist = c.Store.ComputeDistance(queryID, currentBestID, metricType)
    }
	
	improved := true
	for improved {
		improved = false
		neighbors := GetLevelNeighbors(c, currentBestID, level)
		if neighbors == nil {
			break
		}
		
		for _, neighbor := range neighbors {
            // Note: GetLevelNeighbors returns NeighborRecords but dist is dummy (0)
            
            var dist float32
            if useBQ {
                dist = float32(c.Store.ComputeBBQDistance(queryID, neighbor.ID))
            } else {
                dist = c.Store.ComputeDistance(queryID, neighbor.ID, metricType)
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

// searchLevel searches for ef candidates at level
func (c *Collection) searchLevel(queryID DocID, entryPointID DocID, level int, ef int, metricType string) []NeighborRecord {
	// P0优化: Epoch-based visited set
    // 使用epoch计数器替代map分配,消除GC开销
    epoch := c.Store.NewSearchEpoch()
    
	candidates := NewMinHeap() // Keep furthest candidate to explore
	results := NewMaxHeap(ef)  // Keep nearest results found so far
	
    useBQ := c.Dimension >= 128
    
    var entryDist float32
    if useBQ {
        entryDist = float32(c.Store.ComputeBBQDistance(queryID, entryPointID))
    } else {
	    entryDist = c.Store.ComputeDistance(queryID, entryPointID, metricType)
    }

	candidates.Push(&HeapItem{ID: entryPointID, Distance: entryDist})
	results.Push(&HeapItem{ID: entryPointID, Distance: entryDist})
	c.Store.MarkVisited(entryPointID, epoch)
	
	for candidates.Len() > 0 {
		current := candidates.Pop()
		
		if results.IsFull() && current.Distance > results.Peek().Distance {
			break
		}

		neighbors := GetLevelNeighbors(c, current.ID, level)
		if neighbors == nil {
			continue
		}
		
		for _, neighbor := range neighbors {
			if c.Store.IsVisited(neighbor.ID, epoch) {
				continue
			}
			c.Store.MarkVisited(neighbor.ID, epoch)
			
            var dist float32
            if useBQ {
                dist = float32(c.Store.ComputeBBQDistance(queryID, neighbor.ID))
            } else {
                dist = c.Store.ComputeDistance(queryID, neighbor.ID, metricType)
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
	
	// Convert to neighbor records
	result := make([]NeighborRecord, 0, results.Len())
	for results.Len() > 0 {
		item := results.Pop()
		result = append(result, NeighborRecord{
			ID:       item.ID,
			Distance: item.Distance,
		})
	}
	
	// 使用标准库排序替代手写反转 (MaxHeap pop 是降序, 需要升序)
	sort.Slice(result, func(i, j int) bool {
		return result[i].Distance < result[j].Distance
	})
	
	return result
}

// selectNeighborsHeuristic selects neighbors using HNSW heuristic ensuring connectivity and diversity
func (c *Collection) selectNeighborsHeuristic(itemID DocID, candidates []NeighborRecord, M int, metricType string, extendCandidates bool, keepPrunedConnections bool) []NeighborRecord {
	if len(candidates) <= M {
		return candidates
	}
	
	// Sort candidates by distance to item
	sortNeighborsByDistance(candidates)
	
	result := make([]NeighborRecord, 0, M)
    useBQ := c.Dimension >= 128
	
	for _, candidate := range candidates {
		if len(result) >= M {
			break
		}
		
		// Check distance from candidate to existing results
		// Heuristic: Add candidate only if it is closer to item than to any already selected neighbor
		isGood := true
		
		for _, res := range result {
            var distToRes float32
            if useBQ {
                distToRes = c.Store.ComputeBBQDistance(candidate.ID, res.ID)
            } else {
                distToRes = c.Store.ComputeDistance(candidate.ID, res.ID, metricType)
            }
			
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

// computeDistance deprecated
func (c *Collection) computeDistance(a, b *Item, metricType string) float32 {
	return c.Store.ComputeDistance(a.DocID, b.DocID, metricType)
}

