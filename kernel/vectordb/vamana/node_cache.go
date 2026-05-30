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

package vamana

import "sync"

// NodeCache is a fixed-capacity application-layer cache for disk-resident
// nodes. It stores both full-precision vectors and neighbor lists for
// frequently-visited nodes, eliminating mmap read overhead on hot paths.
//
// Node lookup uses a direct flat array (slotOf[nodeID] → slot), achieving
// 8-11x faster lookups than map[uint64]int. This is safe because
// BuildFromVectors assigns sequential IDs 0..NumPoints-1.
//
// The cache is populated via BFS from the medoid before search begins,
// prioritizing nodes most likely to be encountered during graph traversal.
// Capacity is fixed at construction and never evicts.
type NodeCache struct {
	vectors   [][]float32 // slot → full-precision vector
	neighbors [][]uint32  // slot → neighbor list
	nodeID    []uint64    // slot → original node ID (for BFS dedup)

	slotOf []int32 // nodeID → cache slot, -1 = not cached, direct index

	capacity int
	size     int

	mu sync.RWMutex
}

// NewNodeCache creates a cache for up to capacity nodes, with direct-index
// table covering node IDs from 0 to maxNodeID (inclusive).
func NewNodeCache(capacity int, maxNodeID int) *NodeCache {
	slotOf := make([]int32, maxNodeID+1)
	for i := range slotOf {
		slotOf[i] = -1
	}
	return &NodeCache{
		vectors:   make([][]float32, capacity),
		neighbors: make([][]uint32, capacity),
		nodeID:    make([]uint64, capacity),
		slotOf:    slotOf,
		capacity:  capacity,
	}
}

// growSlotOf expands the slotOf array to cover up to newMaxNodeID.
func (nc *NodeCache) growSlotOf(newMaxNodeID uint64) {
	old := nc.slotOf
	if uint64(len(old)) > newMaxNodeID {
		return
	}
	expanded := make([]int32, newMaxNodeID+1)
	copy(expanded, old)
	for i := len(old); i < len(expanded); i++ {
		expanded[i] = -1
	}
	nc.slotOf = expanded
}

// Insert adds a node to the cache. Returns true if inserted.
// Grows slotOf automatically if nodeID exceeds current range.
func (nc *NodeCache) Insert(nodeID uint64, vector []float32, neighbors []uint32) bool {
	nc.mu.Lock()
	defer nc.mu.Unlock()

	if nc.size >= nc.capacity {
		return false
	}
	if nodeID >= uint64(len(nc.slotOf)) {
		nc.growSlotOf(nodeID + nodeID/2 + 1)
	}
	if nc.slotOf[nodeID] >= 0 {
		return false // already cached
	}

	slot := nc.size
	nc.nodeID[slot] = nodeID
	nc.slotOf[nodeID] = int32(slot)

	vc := make([]float32, len(vector))
	copy(vc, vector)
	nc.vectors[slot] = vc

	ncopy := make([]uint32, len(neighbors))
	copy(ncopy, neighbors)
	nc.neighbors[slot] = ncopy

	nc.size++
	return true
}

// GetNeighbors returns the cached neighbor list for a node, or nil if not cached.
func (nc *NodeCache) GetNeighbors(nodeID uint64) ([]uint32, bool) {
	nc.mu.RLock()
	defer nc.mu.RUnlock()

	if nodeID >= uint64(len(nc.slotOf)) {
		return nil, false
	}
	slot := nc.slotOf[nodeID]
	if slot < 0 || int(slot) >= nc.size {
		return nil, false
	}
	return nc.neighbors[slot], true
}

// GetVector returns the cached vector for a node, or nil if not cached.
func (nc *NodeCache) GetVector(nodeID uint64) ([]float32, bool) {
	nc.mu.RLock()
	defer nc.mu.RUnlock()

	if nodeID >= uint64(len(nc.slotOf)) {
		return nil, false
	}
	slot := nc.slotOf[nodeID]
	if slot < 0 || int(slot) >= nc.size {
		return nil, false
	}
	return nc.vectors[slot], true
}

// Len returns the number of currently cached nodes.
func (nc *NodeCache) Len() int {
	nc.mu.RLock()
	defer nc.mu.RUnlock()
	return nc.size
}

// Capacity returns the maximum cache capacity.
func (nc *NodeCache) Capacity() int {
	return nc.capacity
}

// Clear removes all cached entries.
func (nc *NodeCache) Clear() {
	nc.mu.Lock()
	defer nc.mu.Unlock()
	for i := 0; i < nc.size; i++ {
		nc.slotOf[nc.nodeID[i]] = -1
		nc.vectors[i] = nil
		nc.neighbors[i] = nil
		nc.nodeID[i] = 0
	}
	nc.size = 0
}

// CacheStats holds cache statistics for monitoring.
type CacheStats struct {
	Cached  int
	Hits    int
	Misses  int
	MaxSize int
}

// Stats returns current cache statistics. Thread-safe.
func (nc *NodeCache) Stats() CacheStats {
	nc.mu.RLock()
	defer nc.mu.RUnlock()
	return CacheStats{
		Cached:  nc.size,
		MaxSize: nc.capacity,
	}
}
