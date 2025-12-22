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
)

// =========================================
// HNSW Level Utils
// =========================================

// RandomLevel generates random level using exponential distribution
func RandomLevel(maxLevel int) int {
	level := 0
	for rand.Float32() < 0.5 && level < maxLevel-1 {
		level++
	}
	return level
}

// InitItemNeighbors initializes HNSW neighbors for item
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
	if neighbors == nil {
		return -1
	}
	
	maxLevel := -1
	for _, n := range neighbors {
		if n.Type > maxLevel {
			maxLevel = n.Type
		}
	}
	return maxLevel
}

// GetLevelNeighbors gets neighbors at level
func GetLevelNeighbors(item *Item, modelName string, level int) []NeighborRecord {
	levelData := item.GetLevelNeighbors(modelName, level)
	if levelData == nil {
		return nil
	}
	return levelData.Items
}

// SetLevelNeighbors sets neighbors at level
func SetLevelNeighbors(item *Item, modelName string, level int, neighbors []NeighborRecord) {
	allLevels := item.GetHNSWNeighbors(modelName)
	if allLevels == nil {
		return
	}
	
	for i := range allLevels {
		if allLevels[i].Type == level {
			allLevels[i].Items = neighbors
			return
		}
	}
}

// RemoveNeighbor removes neighbor from item at level
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

// AddNodeToLevelMap adds node to level map
func AddNodeToLevelMap(levelMap map[string]map[int][]string, modelName string, id string, level int) {
	if levelMap[modelName] == nil {
		levelMap[modelName] = make(map[int][]string)
	}
	
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
		for _, nodeID := range nodes {
			if nodeID != id {
				newNodes = append(newNodes, nodeID)
			}
		}
		modelMap[level] = newNodes
	}
}

// SelectEntryPoint selects entry point
func SelectEntryPoint(c *Collection, modelName string, exclude map[string]bool) *Item {
	levelMap := c.GetLevelMap(modelName)
	if levelMap == nil {
		return nil
	}
	
	// Find highest level
	maxLevel := -1
	for level := range levelMap {
		if level > maxLevel {
			maxLevel = level
		}
	}
	
	if maxLevel < 0 {
		return nil
	}
	
	// Find first valid node at highest level
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

// ExpectedNeighborCount returns expected neighbor count at level
func ExpectedNeighborCount(level int, M int) int {
	if level == 0 {
		return M * 2
	}
	return M
}
