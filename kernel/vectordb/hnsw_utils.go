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
func InitItemNeighbors(item *Item, modelName string, maxLevel int) int {
	level := RandomLevel(maxLevel)
	
	levels := make([]LevelData, level+1)
	for l := 0; l <= level; l++ {
		levels[l] = LevelData{
			Type:  l,
			Items: make([]NeighborRecord, 0),
		}
	}
	item.SetHNSWNeighbors(modelName, levels)
	
	return level
}

// GetItemLevel gets item's max level
func GetItemLevel(item *Item, modelName string) int {
	neighbors := item.GetHNSWNeighbors(modelName)
	if len(neighbors) == 0 {
		return -1
	}
	
	// Assuming levels are sorted or we find max
	// Usually stored as index 0=level0, 1=level1...
	return len(neighbors) - 1
}

// GetLevelNeighbors gets neighbors at specific level
func GetLevelNeighbors(item *Item, modelName string, level int) []NeighborRecord {
	levelData := item.GetLevelNeighbors(modelName, level)
	if levelData == nil {
		return nil
	}
	return levelData.Items
}

// SetLevelNeighbors sets neighbors at specific level
func SetLevelNeighbors(item *Item, modelName string, level int, neighbors []NeighborRecord) {
	allLevels := item.GetHNSWNeighbors(modelName)
	if allLevels == nil {
		return
	}
	
	// Ensure we are setting correct level
	// LevelData type should match level
	found := false
	for i := range allLevels {
		if allLevels[i].Type == level {
			allLevels[i].Items = neighbors
			found = true
			break
		}
	}
	
	// If not found (should not happen if Init called correctly)
	if !found {
		// handle error or ignore?
	}
}

// RemoveNeighbor removes a neighbor from item at specific level
func RemoveNeighbor(item *Item, modelName string, level int, neighborID string) {
	neighbors := GetLevelNeighbors(item, modelName, level)
	if neighbors == nil {
		return
	}
	
	newNeighbors := make([]NeighborRecord, 0, len(neighbors))
	for _, n := range neighbors {
		if n.ID != neighborID {
			newNeighbors = append(newNeighbors, n)
		}
	}
	SetLevelNeighbors(item, modelName, level, newNeighbors)
}

// =========================================
// Level Map Utils
// =========================================

// AddNodeToLevelMap adds node ID to level map
func AddNodeToLevelMap(levelMap map[string]map[int][]string, modelName string, id string, level int) {
	if levelMap[modelName] == nil {
		levelMap[modelName] = make(map[int][]string)
	}
	
	// Add to all levels up to assigned level
	// No, HNSW "LevelMap" usually tracks nodes AT each level, to find entry points?
	// ACTUALLY: HNSW entry point is highest level node.
	// We need to know which nodes exist at level L to traverse layer L.
	// If a node has level 3, it exists at 0, 1, 2, 3.
	// Implementation choice: do we store it in list for 0, test for 1, etc?
	// Or just "top level" in a list?
	// Usually we need to pick an entry point. The global entry point is sufficient.
	// But `SelectEntryPoint` implementation iterates level map.
	// So we should add to map for relevant levels.
	
	// Let's store at 'max level' or all levels?
	// If SelectEntryPoint searches from Top to Bottom, it needs to find ONE node at Top.
	// Standard HNSW maintains a GLOBAL entry point (highest level node).
	// If we use LevelMap, maybe we store all nodes at each level?
	// Let's assume AddNodeToLevelMap adds to the map[level] -> list of nodes.
	
	for l := 0; l <= level; l++ {
		levelMap[modelName][l] = append(levelMap[modelName][l], id)
	}
}

// RemoveNodeFromLevelMap removes node from level map
func RemoveNodeFromLevelMap(levelMap map[string]map[int][]string, modelName string, id string) {
	modelMap := levelMap[modelName]
	if modelMap == nil {
		return
	}
	
	for level, nodes := range modelMap {
		newNodes := make([]string, 0, len(nodes))
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
// Returns a node at the highest available level
func SelectEntryPoint(c *Collection, modelName string, exclude map[string]bool) *Item {
	levelMap := c.GetLevelMap(modelName)
	if levelMap == nil {
		return nil
	}
	
	// Find highest level existing in map
	maxLevel := -1
	for level := range levelMap {
		if level > maxLevel {
			maxLevel = level
		}
	}
	
	if maxLevel < 0 {
		return nil
	}
	
	// Find valid node starting from max level
	for level := maxLevel; level >= 0; level-- {
		nodes := levelMap[level]
		for _, nodeID := range nodes {
			if exclude != nil && exclude[nodeID] {
				continue
			}
			item, ok := c.GetItem(nodeID)
			if ok {
				return item
			}
		}
	}
	
	return nil
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
