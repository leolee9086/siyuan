package vamana

import (
	"math/rand"
	"sync"
	"testing"
	"time"
)

// ============================================================================
// Synthetic Benchmark: Global Lock vs Fine-grained Locking
//
// This benchmark simulates the workload of a vector database under high concurrency
// to demonstrate the theoretical throughput difference between:
// 1. Global Lock (Current Architecture)
// 2. Fine-grained/Sharded Lock (Proposed Architecture)
//
// Workload Simulation:
// - "Insert": Simulates traversing a graph. It needs to lock nodes during traversal.
//   - Global Lock: One big lock for the whole operation.
//   - Fine-grained: Locks individual nodes or shards during traversal.
// - "Search": Simulates reading the graph.
// ============================================================================

const (
	// Simulation parameters
	numPoints      = 100000                // Total points in index
	numShards      = 256                   // Number of shards for fine-grained locking
	workDuration   = 50 * time.Microsecond // CPU time per node visit (simulating distance calc)
	traversalSteps = 50                    // Nodes visited per Insert/Search
)

// GlobalLockIndex simulates the current architecture
type GlobalLockIndex struct {
	mu   sync.RWMutex
	data []int // dummy data
}

func (idx *GlobalLockIndex) Insert() {
	idx.mu.Lock()
	defer idx.mu.Unlock()

	// Simulate traversal work
	for i := 0; i < traversalSteps; i++ {
		// Simulate computation time (distance calc, etc)
		// We use a busy loop to simulate CPU work, not time.Sleep which yields
		simulateCPUWork(workDuration)
	}
}

func (idx *GlobalLockIndex) Search() {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	for i := 0; i < traversalSteps; i++ {
		simulateCPUWork(workDuration)
	}
}

// FineGrainedIndex simulates the proposed architecture with sharded locks
type FineGrainedIndex struct {
	shards []sync.RWMutex
	data   []int
}

func NewFineGrainedIndex() *FineGrainedIndex {
	return &FineGrainedIndex{
		shards: make([]sync.RWMutex, numShards),
		data:   make([]int, numPoints),
	}
}

func (idx *FineGrainedIndex) Insert() {
	// Simulate traversing nodes, locking only relevant shards
	// In Vamana, we lock nodes as we visit them, or lock a small window.
	// Here we simulate locking a shard for a brief moment for each step.

	rng := rand.New(rand.NewSource(time.Now().UnixNano()))

	for i := 0; i < traversalSteps; i++ {
		// Pick a random shard to lock (simulating visiting a node)
		shardID := rng.Intn(numShards)

		idx.shards[shardID].Lock()
		simulateCPUWork(workDuration) // Compute distance, check neighbors
		idx.shards[shardID].Unlock()
	}
}

func (idx *FineGrainedIndex) Search() {
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))

	for i := 0; i < traversalSteps; i++ {
		shardID := rng.Intn(numShards)

		idx.shards[shardID].RLock()
		simulateCPUWork(workDuration)
		idx.shards[shardID].RUnlock()
	}
}

// Helper to simulate CPU intensive work
func simulateCPUWork(d time.Duration) {
	start := time.Now()
	for time.Since(start) < d {
		// busy loop
	}
}

// -----------------------------------------------------------------------------
// Benchmarks
// -----------------------------------------------------------------------------

func BenchmarkLockingStrategy(b *testing.B) {
	globalIdx := &GlobalLockIndex{}
	fineIdx := NewFineGrainedIndex()

	// Scenarios:
	// 1. Heavy Write (100% Insert)
	// 2. Heavy Read (90% Search, 10% Insert)
	// 3. Balanced (50% Search, 50% Insert)

	// Case 1: Global Lock - Heavy Write
	b.Run("GlobalLock_HeavyWrite", func(b *testing.B) {
		b.RunParallel(func(pb *testing.PB) {
			for pb.Next() {
				globalIdx.Insert()
			}
		})
	})

	// Case 2: Fine-grained Lock - Heavy Write
	b.Run("FineGrained_HeavyWrite", func(b *testing.B) {
		b.RunParallel(func(pb *testing.PB) {
			for pb.Next() {
				fineIdx.Insert()
			}
		})
	})

	// Case 3: Global Lock - Balanced (Approximated by mixed workers)
	// Since RunParallel runs identical functions, we simulate mix by RNG
	b.Run("GlobalLock_Mixed50_50", func(b *testing.B) {
		b.RunParallel(func(pb *testing.PB) {
			r := rand.New(rand.NewSource(time.Now().UnixNano()))
			for pb.Next() {
				if r.Float32() < 0.5 {
					globalIdx.Insert()
				} else {
					globalIdx.Search()
				}
			}
		})
	})

	// Case 4: Fine-grained Lock - Balanced
	b.Run("FineGrained_Mixed50_50", func(b *testing.B) {
		b.RunParallel(func(pb *testing.PB) {
			r := rand.New(rand.NewSource(time.Now().UnixNano()))
			for pb.Next() {
				if r.Float32() < 0.5 {
					fineIdx.Insert()
				} else {
					fineIdx.Search()
				}
			}
		})
	})

	// Case 5: Real World? High Read, Low Write (90/10)
	b.Run("GlobalLock_ReadHeavy90_10", func(b *testing.B) {
		b.RunParallel(func(pb *testing.PB) {
			r := rand.New(rand.NewSource(time.Now().UnixNano()))
			for pb.Next() {
				if r.Float32() < 0.1 {
					globalIdx.Insert()
				} else {
					globalIdx.Search()
				}
			}
		})
	})

	b.Run("FineGrained_ReadHeavy90_10", func(b *testing.B) {
		b.RunParallel(func(pb *testing.PB) {
			r := rand.New(rand.NewSource(time.Now().UnixNano()))
			for pb.Next() {
				if r.Float32() < 0.1 {
					fineIdx.Insert()
				} else {
					fineIdx.Search()
				}
			}
		})
	})
}
