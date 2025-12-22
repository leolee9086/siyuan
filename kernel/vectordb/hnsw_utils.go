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
	"math/rand"
	"time"
)

func init() {
	rand.Seed(time.Now().UnixNano())
}

// =========================================
// HNSW Level Utils
// =========================================

// RandomLevel generates random level using exponential distribution
func RandomLevel(maxLevel int) int {
	level := 0
	// P(level >= l) = (1/e)^l approx? Standard HNSW uses optimal parameter mL = 1/ln(M)
	// Here we use simple 0.5 probability for simplicity or matching implementation
	for rand.Float32() < 0.5 && level < maxLevel-1 {
		level++
	}
	return level
}

// InitItemNeighbors initializes HNSW neighbors for item
// Returns the max level assigned to this item
func InitItemNeighbors(c *Collection, docID DocID, modelName string, maxLevel int) int {
	level := RandomLevel(maxLevel)
	
	levels := make([]LevelData, level+1)
	for l := 0; l <= level; l++ {
		levels[l] = LevelData{
			Type:  l,
			Items: make([]NeighborRecord, 0),
		}
	}
	
	c.Mu.Lock()
	if c.HNSWNodes[modelName] == nil {
	    c.HNSWNodes[modelName] = make(map[DocID][]LevelData)
	}
	c.HNSWNodes[modelName][docID] = levels
	c.Mu.Unlock()
	
	return level
}

// GetItemLevel gets item's max level
func GetItemLevel(c *Collection, docID DocID, modelName string) int {
    c.Mu.RLock()
    defer c.Mu.RUnlock()
    
    if c.HNSWNodes[modelName] == nil {
        return -1
    }
	neighbors := c.HNSWNodes[modelName][docID]
	if len(neighbors) == 0 {
		return -1
	}
	
	return len(neighbors) - 1
}

// GetLevelNeighbors gets neighbors at specific level
func GetLevelNeighbors(c *Collection, docID DocID, modelName string, level int) []NeighborRecord {
    c.Mu.RLock()
    defer c.Mu.RUnlock()
    
    if c.HNSWNodes[modelName] == nil {
        return nil
    }
    
    allLevels := c.HNSWNodes[modelName][docID]
    // Valid check
    if level >= len(allLevels) {
        return nil
    }
    
    // Direct access if sorted by level index
    return allLevels[level].Items
}

// SetLevelNeighbors sets neighbors at specific level
func SetLevelNeighbors(c *Collection, docID DocID, modelName string, level int, neighbors []NeighborRecord) {
	c.Mu.Lock()
	defer c.Mu.Unlock()
	
    if c.HNSWNodes[modelName] == nil {
        return
    }
    
    allLevels := c.HNSWNodes[modelName][docID]
    if level < len(allLevels) {
        allLevels[level].Items = neighbors
    }
}

// RemoveNeighbor removes a neighbor from item at specific level
func RemoveNeighbor(c *Collection, docID DocID, modelName string, level int, neighborID DocID) {
    // Acquire lock inside Set/Get is risky for read-modify-write if not atomic.
    // Better to have specific function or lock outside.
    // For now, let's just do it with lock.
    
    c.Mu.Lock()
    defer c.Mu.Unlock()
    
    if c.HNSWNodes[modelName] == nil {
        return
    }
    allLevels := c.HNSWNodes[modelName][docID]
    if level >= len(allLevels) {
        return
    }
    
    neighbors := allLevels[level].Items
	newNeighbors := make([]NeighborRecord, 0, len(neighbors))
	for _, n := range neighbors {
		if n.ID != neighborID {
			newNeighbors = append(newNeighbors, n)
		}
	}
	
	allLevels[level].Items = newNeighbors
}

// =========================================
// Level Map Utils
// =========================================

// AddNodeToLevelMap adds node ID to level map
func AddNodeToLevelMap(levelMap map[string]map[int][]DocID, modelName string, id DocID, level int) {
	if levelMap[modelName] == nil {
		levelMap[modelName] = make(map[int][]DocID)
	}
	
	for l := 0; l <= level; l++ {
		levelMap[modelName][l] = append(levelMap[modelName][l], id)
	}
}

// RemoveNodeFromLevelMap removes node from level map
func RemoveNodeFromLevelMap(levelMap map[string]map[int][]DocID, modelName string, id DocID) {
	modelMap := levelMap[modelName]
	if modelMap == nil {
		return
	}
	
	for level, nodes := range modelMap {
		newNodes := make([]DocID, 0, len(nodes))
		found := false
		for _, nodeID := range nodes {
			if nodeID != id {
				newNodes = append(newNodes, nodeID)
			} else {
				found = true
			}
		}
		if found {
			modelMap[level] = newNodes
		}
	}
}

// SelectEntryPoint selects an entry point for HNSW search
// Returns a node DocID at the highest available level
func SelectEntryPoint(c *Collection, modelName string, exclude map[DocID]bool) (DocID, bool) {
    c.Mu.RLock()
    defer c.Mu.RUnlock()
    
	levelMap := c.HNSWLevelMap[modelName]
	if levelMap == nil {
		return 0, false
	}
	
	// Find highest level existing in map
	maxLevel := -1
	for level := range levelMap {
		if level > maxLevel {
			maxLevel = level
		}
	}
	
	if maxLevel < 0 {
		return 0, false
	}
	
	// Find valid node starting from max level
	// NOTE: HNSW entry point is usually global. We just need ANY valid node.
	// Prioritize highest level.
	for level := maxLevel; level >= 0; level-- {
		nodes := levelMap[level]
		for _, nodeID := range nodes {
			if exclude != nil && exclude[nodeID] {
				continue
			}
			
			// Verify it exists in Items map (soft-delete check)
			if _, ok := c.Items[nodeID]; ok {
			    return nodeID, true
			}
		}
	}
	
	return 0, false
}

// ExpectedNeighborCount returns M parameter for a level
func ExpectedNeighborCount(level int, M int) int {
	if level == 0 {
		return M * 2 // Layer 0 usually allows Mmax0 (often 2*M)
	}
	return M
}

// min integer helper
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// max integer helper
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
