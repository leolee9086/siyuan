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
	
	// Remove from level map
	c.Mu.Lock()
	RemoveNodeFromLevelMap(c.HNSWLevelMap, modelName, docID)
	c.Mu.Unlock()
	
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
	c.DeleteItem(id)
	
	// Recompute affected neighbors
	for _, neighborID := range affectedNeighbors {
		c.recomputeNeighbors(neighborID, modelName)
	}
}

// recomputeNeighbors recomputes neighbors after deletion
func (c *Collection) recomputeNeighbors(docID DocID, modelName string) {
	item, ok := c.Items[docID]
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
				
				neighborItem, ok := c.Items[n.ID]
				if !ok {
					continue
				}
				
				distance := c.computeDistance(item, neighborItem, modelName, config.MetricType)
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
	
	// Sort items for deterministic build (by DocID)
	// We need to implement a sort.
	// Simple bubble sort or import sort?
	// Let's use simple sort since import sort might need interface.
	for i := 0; i < len(items)-1; i++ {
	    for j := i+1; j < len(items); j++ {
	        if items[i].DocID > items[j].DocID {
	            items[i], items[j] = items[j], items[i]
	        }
	    }
	}
	
	// Clear level map
	c.Mu.Lock()
	c.HNSWLevelMap[modelName] = make(map[int][]DocID)
	c.HNSWNodes[modelName] = make(map[DocID][]LevelData)
	c.Mu.Unlock()
	
	// Initialize first node
	firstItem := items[0]
	level := InitItemNeighbors(c, firstItem.DocID, modelName, config.MaxLevel)
	c.Mu.Lock()
	AddNodeToLevelMap(c.HNSWLevelMap, modelName, firstItem.DocID, level)
	c.Mu.Unlock()
	
	// Insert other nodes
	for i := 1; i < len(items); i++ {
		item := items[i]
		
		level := InitItemNeighbors(c, item.DocID, modelName, config.MaxLevel)
		
		c.Mu.Lock()
		AddNodeToLevelMap(c.HNSWLevelMap, modelName, item.DocID, level)
		c.Mu.Unlock()
		
		visited := make(map[DocID]bool)
		visited[item.DocID] = true
		entryPointID, ok := SelectEntryPoint(c, modelName, visited)
		
		if ok {
			c.buildHNSWIndex(item, modelName, entryPointID, level)
		}
	}
	
	return nil
}
