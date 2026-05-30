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
	"math/rand"
	"runtime"
	"testing"
)

// ============================================================================
// Benchmarks: slice-of-slices (current) vs flat storage (proposed)
// ============================================================================

// currentSliceCache mirrors NodeCache's current internal layout.
// vectors: [][]float32, slot → slice
// neighbors: [][]uint32, slot → slice
type currentSliceCache struct {
	vectors   [][]float32
	neighbors [][]uint32
	nodeID    []uint64
	slotOf    map[uint64]int
	size      int
}

func newCurrentSliceCache(capacity, dim, maxDegree int) *currentSliceCache {
	return &currentSliceCache{
		vectors:   make([][]float32, capacity),
		neighbors: make([][]uint32, capacity),
		nodeID:    make([]uint64, capacity),
		slotOf:    make(map[uint64]int, capacity),
	}
}

func (c *currentSliceCache) insert(nodeID uint64, vec []float32, nbrs []uint32) bool {
	if c.size >= len(c.vectors) {
		return false
	}
	slot := c.size
	c.vectors[slot] = vec
	c.neighbors[slot] = nbrs
	c.nodeID[slot] = nodeID
	c.slotOf[nodeID] = slot
	c.size++
	return true
}

func (c *currentSliceCache) getVector(nodeID uint64) ([]float32, bool) {
	slot, ok := c.slotOf[nodeID]
	if !ok {
		return nil, false
	}
	return c.vectors[slot], true
}

func (c *currentSliceCache) getNeighbors(nodeID uint64) ([]uint32, bool) {
	slot, ok := c.slotOf[nodeID]
	if !ok {
		return nil, false
	}
	return c.neighbors[slot], true
}

// flatCache uses contiguous float32/uint32 arrays.
// vectors: []float32, slot*dim .. (slot+1)*dim
// neighbors: []uint32, slot*maxDegree .. (slot+1)*maxDegree
type flatCache struct {
	vectors   []float32
	neighbors []uint32
	nodeID    []uint64
	slotOf    map[uint64]int
	size      int
	dim       int
	maxDegree int
}

func newFlatCache(capacity, dim, maxDegree int) *flatCache {
	return &flatCache{
		vectors:   make([]float32, capacity*dim),
		neighbors: make([]uint32, capacity*maxDegree),
		nodeID:    make([]uint64, capacity),
		slotOf:    make(map[uint64]int, capacity),
		dim:       dim,
		maxDegree: maxDegree,
	}
}

func (c *flatCache) insert(nodeID uint64, vec []float32, nbrs []uint32) bool {
	if c.size >= len(c.nodeID) {
		return false
	}
	slot := c.size
	base := slot * c.dim
	copy(c.vectors[base:base+c.dim], vec)

	nbase := slot * c.maxDegree
	copy(c.neighbors[nbase:nbase+len(nbrs)], nbrs)
	for i := len(nbrs); i < c.maxDegree; i++ {
		c.neighbors[nbase+i] = 0xFFFFFFFF // sentinel
	}

	c.nodeID[slot] = nodeID
	c.slotOf[nodeID] = slot
	c.size++
	return true
}

func (c *flatCache) getVector(nodeID uint64) ([]float32, bool) {
	slot, ok := c.slotOf[nodeID]
	if !ok {
		return nil, false
	}
	base := slot * c.dim
	return c.vectors[base : base+c.dim], true
}

func (c *flatCache) getNeighbors(nodeID uint64) ([]uint32, bool) {
	slot, ok := c.slotOf[nodeID]
	if !ok {
		return nil, false
	}
	base := slot * c.maxDegree
	// Find actual length (sentinel-terminated)
	l := 0
	for l < c.maxDegree && c.neighbors[base+l] != 0xFFFFFFFF {
		l++
	}
	return c.neighbors[base : base+l], true
}

// ============================================================================
// Benchmarks
// ============================================================================

func fillTestCache(tb testing.TB, cache interface {
	insert(nodeID uint64, vec []float32, nbrs []uint32) bool
}, nodes int, dim int, maxDegree int) {
	rng := rand.New(rand.NewSource(42))
	for i := 0; i < nodes; i++ {
		vec := make([]float32, dim)
		for j := 0; j < dim; j++ {
			vec[j] = rng.Float32()
		}
		degree := rng.Intn(maxDegree) + 1
		nbrs := make([]uint32, degree)
		for j := 0; j < degree; j++ {
			nbrs[j] = uint32(rng.Intn(100000))
		}
		cache.insert(uint64(i), vec, nbrs)
	}
}

const benchNodes = 10000

// ── 768 dim ──

func BenchmarkSliceCacheGetVector768(b *testing.B) {
	c := newCurrentSliceCache(benchNodes, 768, 64)
	fillTestCache(b, c, benchNodes, 768, 64)
	var key uint64
	b.ResetTimer()
	sum := float32(0)
	for i := 0; i < b.N; i++ {
		key = uint64(i % benchNodes)
		v, _ := c.getVector(key)
		sum += v[0]
	}
	runtime.KeepAlive(sum)
}

func BenchmarkFlatCacheGetVector768(b *testing.B) {
	c := newFlatCache(benchNodes, 768, 64)
	fillTestCache(b, c, benchNodes, 768, 64)
	var key uint64
	b.ResetTimer()
	sum := float32(0)
	for i := 0; i < b.N; i++ {
		key = uint64(i % benchNodes)
		v, _ := c.getVector(key)
		sum += v[0]
	}
	runtime.KeepAlive(sum)
}

func BenchmarkSliceCacheGetNeighbors768(b *testing.B) {
	c := newCurrentSliceCache(benchNodes, 768, 64)
	fillTestCache(b, c, benchNodes, 768, 64)
	var key uint64
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		key = uint64(i % benchNodes)
		n, _ := c.getNeighbors(key)
		runtime.KeepAlive(n)
	}
}

func BenchmarkFlatCacheGetNeighbors768(b *testing.B) {
	c := newFlatCache(benchNodes, 768, 64)
	fillTestCache(b, c, benchNodes, 768, 64)
	var key uint64
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		key = uint64(i % benchNodes)
		n, _ := c.getNeighbors(key)
		runtime.KeepAlive(n)
	}
}

// ── 128 dim ──

func BenchmarkSliceCacheGetVector128(b *testing.B) {
	c := newCurrentSliceCache(benchNodes, 128, 64)
	fillTestCache(b, c, benchNodes, 128, 64)
	var key uint64
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		key = uint64(i % benchNodes)
		v, _ := c.getVector(key)
		runtime.KeepAlive(v[0])
	}
}

func BenchmarkFlatCacheGetVector128(b *testing.B) {
	c := newFlatCache(benchNodes, 128, 64)
	fillTestCache(b, c, benchNodes, 128, 64)
	var key uint64
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		key = uint64(i % benchNodes)
		v, _ := c.getVector(key)
		runtime.KeepAlive(v[0])
	}
}

// ── Whole-search simulation (getVector + getNeighbors in alternation) ──

func BenchmarkSliceCacheFullLookup768(b *testing.B) {
	c := newCurrentSliceCache(benchNodes, 768, 64)
	fillTestCache(b, c, benchNodes, 768, 64)
	keys := make([]uint64, b.N)
	for i := 0; i < b.N; i++ {
		keys[i] = uint64(i % benchNodes)
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		v, _ := c.getVector(keys[i])
		n, _ := c.getNeighbors(keys[i])
		runtime.KeepAlive(v)
		runtime.KeepAlive(n)
	}
}

func BenchmarkFlatCacheFullLookup768(b *testing.B) {
	c := newFlatCache(benchNodes, 768, 64)
	fillTestCache(b, c, benchNodes, 768, 64)
	keys := make([]uint64, b.N)
	for i := 0; i < b.N; i++ {
		keys[i] = uint64(i % benchNodes)
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		v, _ := c.getVector(keys[i])
		n, _ := c.getNeighbors(keys[i])
		runtime.KeepAlive(v)
		runtime.KeepAlive(n)
	}
}

// ── Memory footprint ──

func TestCacheMemoryFootprint(t *testing.T) {
	dim := 768
	maxDegree := 64
	nodes := 10000

	var m1, m2, m3, m4 runtime.MemStats

	runtime.GC()
	runtime.ReadMemStats(&m1)
	sc := newCurrentSliceCache(nodes, dim, maxDegree)
	fillTestCache(t, sc, nodes, dim, maxDegree)
	runtime.GC()
	runtime.ReadMemStats(&m2)

	runtime.GC()
	runtime.ReadMemStats(&m3)
	fc := newFlatCache(nodes, dim, maxDegree)
	fillTestCache(t, fc, nodes, dim, maxDegree)
	runtime.GC()
	runtime.ReadMemStats(&m4)

	sliceMB := float64(m2.HeapAlloc-m1.HeapAlloc) / (1024 * 1024)
	flatMB := float64(m4.HeapAlloc-m3.HeapAlloc) / (1024 * 1024)
	t.Logf("Slice-of-slices: %.1f MB", sliceMB)
	t.Logf("Flat storage:    %.1f MB", flatMB)
	if flatMB > sliceMB*1.05 {
		t.Errorf("flat storage should NOT use more memory than slice-of-slices")
	}
}
