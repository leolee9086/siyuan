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
	
	c.Mu.Lock()
    defer c.Mu.Unlock()
    
    // Ensure capacity
    // Note: This relies on c.Nodes growing in sync with docID.
    // Usually InitItemNeighbors is called after SetItem, so we should check capacity.
    if int(docID) >= len(c.Nodes) {
        // Grow nodes
        newNodes := make([]NodeData, int(docID)+1+1000) // Buffer
        copy(newNodes, c.Nodes)
        c.Nodes = newNodes
    }
    
    // Initialize node
    // Optimization: For Level 0, we could use a single flat array in Collection later.
    // For now, allocate slice of slices.
    neighbors := make([][]DocID, level+1)
    for l := 0; l <= level; l++ {
        // Pre-allocate capacity? M?
        neighbors[l] = make([]DocID, 0, c.Config.M)
    }
    
    c.Nodes[docID] = NodeData{
        Level:     level,
        Neighbors: neighbors,
    }
    
    // NOTE: EntryPoint and MaxLayer update should happen in InsertItem AFTER linking
    // to avoid searching from a disconnected node.
	
	return level
}

// GetItemLevel gets item's max level
func GetItemLevel(c *Collection, docID DocID, modelName string) int {
    c.Mu.RLock()
    defer c.Mu.RUnlock()
    
    if int(docID) >= len(c.Nodes) {
        return -1
    }
    return c.Nodes[docID].Level
}

// GetLevelNeighborIDs 零分配版本：直接返回邻居ID切片引用
// 调用方不得修改返回的切片！
func GetLevelNeighborIDs(c *Collection, docID DocID, modelName string, level int) []DocID {
    if int(docID) >= len(c.Nodes) {
        return nil
    }
    node := c.Nodes[docID]
    
    if level > node.Level || level < 0 || level >= len(node.Neighbors) {
        return nil
    }
    
    return node.Neighbors[level]
}

// GetLevelNeighbors gets neighbors at specific level (分配版本，兼容旧接口)
func GetLevelNeighbors(c *Collection, docID DocID, modelName string, level int) []NeighborRecord {
    ids := GetLevelNeighborIDs(c, docID, modelName, level)
    if ids == nil {
        return nil
    }
    
    records := make([]NeighborRecord, len(ids))
    for i, id := range ids {
        records[i] = NeighborRecord{
            ID:       id,
            Distance: 0,
        }
    }
    return records
}

// SetLevelNeighbors sets neighbors at specific level
func SetLevelNeighbors(c *Collection, docID DocID, modelName string, level int, neighbors []NeighborRecord) {
	c.Mu.Lock()
	defer c.Mu.Unlock()
	
    if int(docID) >= len(c.Nodes) {
        return
    }
    
    // Extract IDs
    ids := make([]DocID, len(neighbors))
    for i, n := range neighbors {
        ids[i] = n.ID
    }
    
    // Safety check for level
    if level <= c.Nodes[docID].Level {
        c.Nodes[docID].Neighbors[level] = ids
    }
}

// RemoveNeighbor removes a neighbor from item at specific level
func RemoveNeighbor(c *Collection, docID DocID, modelName string, level int, neighborID DocID) {
    c.Mu.Lock()
    defer c.Mu.Unlock()
    
    if int(docID) >= len(c.Nodes) {
        return
    }
    
    node := c.Nodes[docID]
    if level > node.Level {
        return
    }
    
    ids := node.Neighbors[level]
    newIds := make([]DocID, 0, len(ids))
    for _, id := range ids {
        if id != neighborID {
            newIds = append(newIds, id)
        }
    }
    c.Nodes[docID].Neighbors[level] = newIds
}

// =========================================
// Level Map Utils
// =========================================

// SelectEntryPoint returns the global entry point
// The exclude list is largely unused in standard inserts, unless we want to avoid self.
func SelectEntryPoint(c *Collection, modelName string, exclude map[DocID]bool) (DocID, bool) {
    c.Mu.RLock()
    defer c.Mu.RUnlock()
    
    ep := c.EntryPoint
    if ep == DocID(0xFFFFFFFF) {
        return 0, false
    }
    
    // If we need to exclude the entry point (e.g. it's the node we are inserting and it was set as EP)
    // This happens if we update EP before linking.
    if exclude != nil && exclude[ep] {
        // Need to find another node?
        // With single EP optimization, we might not have a list of all nodes at top level handy
        // unless we keep HNSWLevelMap.
        // But types.go removed HNSWLevelMap.
        // Fallback: If excluded, return false?
        // Or scan nodes (slow).
        // In InsertItem, we set EP *after* searching if level is higher.
        // If level is lower, we start from current EP.
        // HNSW EP is usually just one node.
        return 0, false 
    }
    
    return ep, true
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
