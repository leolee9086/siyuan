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

import (
	"math"
	"math/rand"
	"testing"
)

// ============================================================================
// Hash table alternatives for nodeID → cache slot lookup
// ============================================================================

// Map-based (current NodeCache): map[uint64]int
// Direct-index: []int32 indexed by nodeID, -1 = not cached
//   Works because BuildFromVectors assigns sequential node IDs 0..N-1.
//   For incremental inserts in append buffer, IDs continue sequentially.
//   Cost: O(1) bounds-checked array read, no hashing.

// directSlotCache uses a flat []int32 array indexed by nodeID.
// nodeID must be < len(slotOf). -1 = not cached.
type directSlotCache struct {
	vectors   [][]float32
	neighbors [][]uint32
	slotOf    []int32 // nodeID → slot (flat array, no hashing)
	size      int
}

func newDirectSlotCache(capacity, maxNodeID int) *directSlotCache {
	slotOf := make([]int32, maxNodeID+1)
	for i := range slotOf {
		slotOf[i] = -1
	}
	return &directSlotCache{
		vectors:   make([][]float32, capacity),
		neighbors: make([][]uint32, capacity),
		slotOf:    slotOf,
	}
}

func (c *directSlotCache) insert(nodeID uint64, vec []float32, nbrs []uint32) bool {
	if c.size >= len(c.vectors) || nodeID >= uint64(len(c.slotOf)) {
		return false
	}
	slot := c.size
	c.vectors[slot] = vec
	c.neighbors[slot] = nbrs
	c.slotOf[nodeID] = int32(slot)
	c.size++
	return true
}

func (c *directSlotCache) getVector(nodeID uint64) ([]float32, bool) {
	if nodeID >= uint64(len(c.slotOf)) {
		return nil, false
	}
	slot := c.slotOf[nodeID]
	if slot < 0 || int(slot) >= c.size {
		return nil, false
	}
	return c.vectors[slot], true
}

func (c *directSlotCache) getNeighbors(nodeID uint64) ([]uint32, bool) {
	if nodeID >= uint64(len(c.slotOf)) {
		return nil, false
	}
	slot := c.slotOf[nodeID]
	if slot < 0 || int(slot) >= c.size {
		return nil, false
	}
	return c.neighbors[slot], true
}

// ============================================================================
// Open-addressing hash table (alternative for sparse IDs)
// ============================================================================

// openAddrCache uses open addressing with linear probing.
// Useful when node IDs are sparse (many deletes + appends create gaps).
// Each slot stores: nodeID, vectorSlot (or -1 = empty).

const openAddrSentinel uint64 = 0xFFFFFFFFFFFFFFFF

type openAddrCache struct {
	keys  []uint64 // nodeID (0 = empty)
	slots []int32  // cache slot index
	mask  int      // tableSize - 1 (power of 2)

	vectors   [][]float32
	neighbors [][]uint32
	size      int
}

func newOpenAddrCache(capacity, tableBits int) *openAddrCache {
	tableSize := 1 << tableBits
	return &openAddrCache{
		keys:      make([]uint64, tableSize),
		slots:     make([]int32, tableSize),
		vectors:   make([][]float32, capacity),
		neighbors: make([][]uint32, capacity),
		mask:      tableSize - 1,
	}
}

func (c *openAddrCache) insert(nodeID uint64, vec []float32, nbrs []uint32) bool {
	if c.size >= len(c.vectors) || nodeID == 0 {
		return false
	}

	idx := uint64(uint32(nodeID)^uint32(nodeID>>32)) & uint64(c.mask)
	tableLen := len(c.keys)
	for i := uint64(0); i < uint64(tableLen); i++ {
		pos := int((idx + i) & uint64(c.mask))
		if c.keys[pos] == 0 || c.keys[pos] == openAddrSentinel {
			c.keys[pos] = nodeID
			c.slots[pos] = int32(c.size)
			c.vectors[c.size] = vec
			c.neighbors[c.size] = nbrs
			c.size++
			return true
		}
		if c.keys[pos] == nodeID {
			return false // already exists
		}
	}
	return false // table full
}

func (c *openAddrCache) getVector(nodeID uint64) ([]float32, bool) {
	if nodeID == 0 {
		return nil, false
	}
	idx := uint64(uint32(nodeID)^uint32(nodeID>>32)) & uint64(c.mask)
	tableLen := len(c.keys)
	for i := uint64(0); i < uint64(tableLen); i++ {
		pos := int((idx + i) & uint64(c.mask))
		if c.keys[pos] == 0 {
			return nil, false // empty, not found
		}
		if c.keys[pos] == nodeID {
			slot := c.slots[pos]
			if int(slot) >= c.size {
				return nil, false
			}
			return c.vectors[slot], true
		}
	}
	return nil, false
}

func (c *openAddrCache) getNeighbors(nodeID uint64) ([]uint32, bool) {
	if nodeID == 0 {
		return nil, false
	}
	idx := uint64(uint32(nodeID)^uint32(nodeID>>32)) & uint64(c.mask)
	tableLen := len(c.keys)
	for i := uint64(0); i < uint64(tableLen); i++ {
		pos := (idx + i) & uint64(c.mask)
		if c.keys[pos] == 0 {
			return nil, false
		}
		if c.keys[pos] == nodeID {
			slot := c.slots[pos]
			if int(slot) >= c.size {
				return nil, false
			}
			return c.neighbors[slot], true
		}
	}
	return nil, false
}

// ============================================================================
// Benchmarks
// ============================================================================

const hashBenchNodes = 100000

func fillGetVectorCache(tb testing.TB, cache interface {
	insert(nodeID uint64, vec []float32, nbrs []uint32) bool
	getVector(nodeID uint64) ([]float32, bool)
}, nodes int, dim int) {
	rng := rand.New(rand.NewSource(42))
	for i := 0; i < nodes; i++ {
		vec := make([]float32, dim)
		for j := 0; j < dim; j++ {
			vec[j] = rng.Float32()
		}
		nbrs := make([]uint32, rng.Intn(63)+1)
		for j := 0; j < len(nbrs); j++ {
			nbrs[j] = uint32(rng.Intn(nodes))
		}
		cache.insert(uint64(i), vec, nbrs)
	}
}

func BenchmarkMapGetVector(b *testing.B) {
	c := newCurrentSliceCache(hashBenchNodes, 768, 64)
	fillGetVectorCache(b, c, hashBenchNodes, 768)
	rng := rand.New(rand.NewSource(99))
	keys := make([]uint64, b.N)
	for i := 0; i < b.N; i++ {
		keys[i] = uint64(rng.Intn(hashBenchNodes))
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = c.getVector(keys[i])
	}
}

func BenchmarkDirectGetVector(b *testing.B) {
	c := newDirectSlotCache(hashBenchNodes, hashBenchNodes)
	fillGetVectorCache(b, c, hashBenchNodes, 768)
	rng := rand.New(rand.NewSource(99))
	keys := make([]uint64, b.N)
	for i := 0; i < b.N; i++ {
		keys[i] = uint64(rng.Intn(hashBenchNodes))
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = c.getVector(keys[i])
	}
}

func BenchmarkOpenAddrGetVector(b *testing.B) {
	tableBits := int(math.Ceil(math.Log2(float64(hashBenchNodes * 2)))) // 2x load factor
	c := newOpenAddrCache(hashBenchNodes, tableBits+1)
	fillGetVectorCache(b, c, hashBenchNodes, 768)
	rng := rand.New(rand.NewSource(99))
	keys := make([]uint64, b.N)
	for i := 0; i < b.N; i++ {
		keys[i] = uint64(rng.Intn(hashBenchNodes))
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = c.getVector(keys[i])
	}
}

// ── Whole lookup (vector + neighbor in one call, simulating search path) ──

func BenchmarkMapFullLookup(b *testing.B) {
	c := newCurrentSliceCache(hashBenchNodes, 768, 64)
	fillGetVectorCache(b, c, hashBenchNodes, 768)
	rng := rand.New(rand.NewSource(99))
	keys := make([]uint64, b.N)
	for i := 0; i < b.N; i++ {
		keys[i] = uint64(rng.Intn(hashBenchNodes))
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		v, _ := c.getVector(keys[i])
		n, _ := c.getNeighbors(keys[i])
		_ = v
		_ = n
	}
}

func BenchmarkDirectFullLookup(b *testing.B) {
	c := newDirectSlotCache(hashBenchNodes, hashBenchNodes)
	fillGetVectorCache(b, c, hashBenchNodes, 768)
	rng := rand.New(rand.NewSource(99))
	keys := make([]uint64, b.N)
	for i := 0; i < b.N; i++ {
		keys[i] = uint64(rng.Intn(hashBenchNodes))
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		v, _ := c.getVector(keys[i])
		n, _ := c.getNeighbors(keys[i])
		_ = v
		_ = n
	}
}

func BenchmarkOpenAddrFullLookup(b *testing.B) {
	tableBits := int(math.Ceil(math.Log2(float64(hashBenchNodes * 2))))
	c := newOpenAddrCache(hashBenchNodes, tableBits+1)
	fillGetVectorCache(b, c, hashBenchNodes, 768)
	rng := rand.New(rand.NewSource(99))
	keys := make([]uint64, b.N)
	for i := 0; i < b.N; i++ {
		keys[i] = uint64(rng.Intn(hashBenchNodes))
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		v, _ := c.getVector(keys[i])
		n, _ := c.getNeighbors(keys[i])
		_ = v
		_ = n
	}
}

// ── Lookup in loop (100 sequential lookups, simulating graph traversal) ──

func BenchmarkMapSequential100(b *testing.B) {
	c := newCurrentSliceCache(hashBenchNodes, 768, 64)
	fillGetVectorCache(b, c, hashBenchNodes, 768)
	keys := make([]uint64, 100)
	for i := 0; i < 100; i++ {
		keys[i] = uint64(i * 1000 % hashBenchNodes)
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		for _, k := range keys {
			_, _ = c.getVector(k)
			_, _ = c.getNeighbors(k)
		}
	}
}

func BenchmarkDirectSequential100(b *testing.B) {
	c := newDirectSlotCache(hashBenchNodes, hashBenchNodes)
	fillGetVectorCache(b, c, hashBenchNodes, 768)
	keys := make([]uint64, 100)
	for i := 0; i < 100; i++ {
		keys[i] = uint64(i * 1000 % hashBenchNodes)
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		for _, k := range keys {
			_, _ = c.getVector(k)
			_, _ = c.getNeighbors(k)
		}
	}
}

func BenchmarkOpenAddrSequential100(b *testing.B) {
	tableBits := int(math.Ceil(math.Log2(float64(hashBenchNodes * 2))))
	c := newOpenAddrCache(hashBenchNodes, tableBits+1)
	fillGetVectorCache(b, c, hashBenchNodes, 768)
	keys := make([]uint64, 100)
	for i := 0; i < 100; i++ {
		keys[i] = uint64(i * 1000 % hashBenchNodes)
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		for _, k := range keys {
			_, _ = c.getVector(k)
			_, _ = c.getNeighbors(k)
		}
	}
}
