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
// HNSW Delete and Rebuild
// =========================================

// DeleteItemWithIndex deletes item and updates HNSW index
func (c *Collection) DeleteItemWithIndex(id string, modelName string) {
	item, ok := c.GetItem(id)
	if !ok {
		return
	}
	docID := item.DocID
	
	affectedNeighbors := make([]DocID, 0)
	
	// Remove from level map - Removed
	
	// Remove from all neighbors' adjacency lists
	level := GetItemLevel(c, docID, modelName)
	for l := 0; l <= level; l++ {
		neighbors := GetLevelNeighbors(c, docID, modelName, l)
		if neighbors == nil {
			continue
		}
		
		for _, neighbor := range neighbors {
			RemoveNeighbor(c, neighbor.ID, modelName, l, docID)
			affectedNeighbors = append(affectedNeighbors, neighbor.ID)
		}
	}
	
	// Delete item
	// Note: We don't remove from Store (sparse array) to avoid shifting
    // Or we should?
    // VectorStore doesn't support delete yet.
    // For soft delete, we just remove from Items/IDMap.
    // HNSW graph edges are removed above.
	c.DeleteItem(id)
    
    // Also remove node data from Nodes?
    // c.Nodes[docID] = NodeData{} ?
    // Or mark as empty.
    c.Mu.Lock()
    if int(docID) < len(c.Nodes) {
        c.Nodes[docID] = NodeData{Level: -1} // Mark as deleted/invalid
    }
    
    // If deleted node was entry point, reselect
    if c.EntryPoint == docID {
        // Simple reselect
        // This is slow if we scan all nodes.
        // Or pick first valid node.
        // Ideally we pick one from max level.
        c.EntryPoint = DocID(0xFFFFFFFF)
        // Scan nodes to find new EP
        // Optimization: Keep track of max level nodes?
        // Fallback: Use RecalculateEP
        
        // Scan nodes for highest level
        maxL := -1
        var newEp DocID = 0xFFFFFFFF
        for i, node := range c.Nodes {
            if i != int(docID) && node.Level >= 0 && node.Level > maxL {
                // Must be valid item
                if _, ok := c.Items[DocID(i)]; ok {
                    maxL = node.Level
                    newEp = DocID(i)
                }
            }
        }
        c.EntryPoint = newEp
        c.MaxLayer = maxL
    }
    c.Mu.Unlock()
	
	// Recompute affected neighbors
	for _, neighborID := range affectedNeighbors {
		c.recomputeNeighbors(neighborID, modelName)
	}
}

// recomputeNeighbors recomputes neighbors after deletion
func (c *Collection) recomputeNeighbors(docID DocID, modelName string) {
	_, ok := c.Items[docID]
	if !ok {
		return
	}
	
	config := c.Config
	level := GetItemLevel(c, docID, modelName)
	
	for l := 0; l <= level; l++ {
		expectedNeighbors := ExpectedNeighborCount(l, config.M)
		neighbors := GetLevelNeighbors(c, docID, modelName, l)
		
		if len(neighbors) >= expectedNeighbors {
			continue
		}
		
// BFS to find more neighbors
		visited := make(map[DocID]bool)
		visited[docID] = true
		for _, n := range neighbors {
			visited[n.ID] = true
		}
		
		queue := make([]DocID, 0)
		for _, n := range neighbors {
			queue = append(queue, n.ID)
		}
		
		for len(queue) > 0 && len(neighbors) < expectedNeighbors {
			currentID := queue[0]
			queue = queue[1:]
			
			currentNeighbors := GetLevelNeighbors(c, currentID, modelName, l)
			if currentNeighbors == nil {
				continue
			}
			
			for _, n := range currentNeighbors {
				if visited[n.ID] {
					continue
				}
				if n.ID == docID {
					continue
				}
				
				visited[n.ID] = true
				queue = append(queue, n.ID)
				
				// Valid check implicit if in graph, but check Items/Nodes just in case
                if int(n.ID) >= len(c.Nodes) || c.Nodes[n.ID].Level == -1 {
                    continue
                }
				
				distance := c.Store.ComputeDistance(docID, n.ID, config.MetricType)
				neighbors = append(neighbors, NeighborRecord{
					ID:       n.ID,
					Distance: distance,
				})
				
				if len(neighbors) >= expectedNeighbors {
					break
				}
			}
		}
		
		// Sort and truncate
		sortNeighborsByDistance(neighbors)
		if len(neighbors) > expectedNeighbors {
			neighbors = neighbors[:expectedNeighbors]
		}
		
		SetLevelNeighbors(c, docID, modelName, l, neighbors)
	}
}

// ReselectEntryPoint reselects entry point
func (c *Collection) ReselectEntryPoint(modelName string) (DocID, bool) {
	return SelectEntryPoint(c, modelName, nil)
}

// RebuildIndex rebuilds entire HNSW index
func (c *Collection) RebuildIndex(modelName string) error {
	config := c.Config
	
	// Collect all items
	items := make([]*Item, 0)
	c.Mu.RLock()
	for _, item := range c.Items {
		if _, ok := item.GetVector(modelName); ok {
			items = append(items, item)
		}
	}
	c.Mu.RUnlock()
	
	if len(items) == 0 {
		return nil
	}
	
	// 使用标准库排序 O(n log n) 替代冒泡 O(n²)
	sort.Slice(items, func(i, j int) bool {
		return items[i].DocID < items[j].DocID
	})
	
	// Clear Graph
	c.Mu.Lock()
    // Reset Nodes
    // Keep nodes array but reset content?
    // Rebuild assumes items exist in Items map.
    // DocIDs are preserved.
    // So we just clear neighbors.
    for i := range c.Nodes {
        c.Nodes[i] = NodeData{Level: -1}
    }
    c.EntryPoint = DocID(0xFFFFFFFF)
    c.MaxLayer = -1
	c.Mu.Unlock()
	
	// Initialize first node
	firstItem := items[0]
	_ = InitItemNeighbors(c, firstItem.DocID, modelName, config.MaxLevel)
    // EntryPoint is updated in InitItemNeighbors/Insert logic
	
	// Insert other nodes
	for i := 1; i < len(items); i++ {
		item := items[i]
		
		level := InitItemNeighbors(c, item.DocID, modelName, config.MaxLevel)
		
		// visited := make(map[DocID]bool)
		// visited[item.DocID] = true
		entryPointID, ok := SelectEntryPoint(c, modelName, nil)
		
		if ok {
			c.buildHNSWIndex(item, modelName, entryPointID, level)
		}
	}
	
	return nil
}
