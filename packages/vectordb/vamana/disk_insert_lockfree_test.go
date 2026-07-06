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
	"path/filepath"
	"sync"
	"testing"

	"s-forge.local/vectordb/storage"
)

// Small dataset parameters for fast -race testing of Insert lock-free refactor.
const (
	smallDim     = 32
	smallBaseNum = 200
)

// setupSmallDiskIndex builds a small disk index for fast lock-free Insert tests.
func setupSmallDiskIndex(t *testing.T) *DiskVamanaIndex {
	t.Helper()

	originalFactory := OpenDiskIndexReader
	t.Cleanup(func() { OpenDiskIndexReader = originalFactory })
	OpenDiskIndexReader = func(path string, readOnly bool) (storage.DiskIndexReader, error) {
		return storage.OpenReader(path, readOnly)
	}

	tmpDir := t.TempDir()
	basePath := filepath.Join(tmpDir, "small_test")

	rng := rand.New(rand.NewSource(42))
	vectors := generateIncrTestVectors(rng, smallBaseNum, smallDim)

	config := DefaultDiskBuildConfig()
	config.R = 32
	config.L = 50
	config.Alpha = 1.2
	config.EnableBBQ = true

	_, err := BuildFromVectors(basePath, vectors, config)
	if err != nil {
		t.Fatalf("BuildFromVectors failed: %v", err)
	}

	idx, err := Open(basePath)
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	t.Cleanup(func() { idx.Close() })

	return idx
}

// TestInsertLockFree_Basic verifies Insert works correctly after lock-free refactor.
func TestInsertLockFree_Basic(t *testing.T) {
	idx := setupSmallDiskIndex(t)

	rng := rand.New(rand.NewSource(100))
	before := idx.totalPoints()

	// Insert 20 vectors
	for i := 0; i < 20; i++ {
		vec := make([]float32, smallDim)
		for j := range vec {
			vec[j] = rng.Float32()
		}
		id, err := idx.Insert(vec)
		if err != nil {
			t.Fatalf("Insert[%d] failed: %v", i, err)
		}
		if id != before+uint64(i) {
			t.Errorf("Insert[%d]: expected ID %d, got %d", i, before+uint64(i), id)
		}
	}

	after := idx.totalPoints()
	if after != before+20 {
		t.Errorf("totalPoints: expected %d, got %d", before+20, after)
	}
}

// TestInsertLockFree_ConcurrentInsertSearch verifies no deadlock with concurrent Insert+Search.
func TestInsertLockFree_ConcurrentInsertSearch(t *testing.T) {
	idx := setupSmallDiskIndex(t)

	rng := rand.New(rand.NewSource(200))
	var wg sync.WaitGroup

	// 5 concurrent inserters
	for g := 0; g < 5; g++ {
		wg.Add(1)
		go func(seed int64) {
			defer wg.Done()
			r := rand.New(rand.NewSource(seed))
			for i := 0; i < 10; i++ {
				vec := make([]float32, smallDim)
				for j := range vec {
					vec[j] = r.Float32()
				}
				if _, err := idx.Insert(vec); err != nil {
					t.Errorf("concurrent Insert failed: %v", err)
					return
				}
			}
		}(int64(g * 1000))
	}

	// 5 concurrent searchers
	for g := 0; g < 5; g++ {
		wg.Add(1)
		go func(seed int64) {
			defer wg.Done()
			r := rand.New(rand.NewSource(seed))
			for i := 0; i < 10; i++ {
				q := make([]float32, smallDim)
				for j := range q {
					q[j] = r.Float32()
				}
				_, _ = idx.Search(q, 5, 50)
			}
		}(int64(g*1000 + 500))
	}

	wg.Wait()

	_ = rng // suppress unused warning
}

// TestInsertLockFree_InsertThenDeleteThenCompact verifies full cycle with small data.
func TestInsertLockFree_InsertThenDeleteThenCompact(t *testing.T) {
	idx := setupSmallDiskIndex(t)

	rng := rand.New(rand.NewSource(300))

	// Insert 10 vectors
	insertedIDs := make([]uint64, 0, 10)
	for i := 0; i < 10; i++ {
		vec := make([]float32, smallDim)
		for j := range vec {
			vec[j] = rng.Float32()
		}
		id, err := idx.Insert(vec)
		if err != nil {
			t.Fatalf("Insert[%d] failed: %v", i, err)
		}
		insertedIDs = append(insertedIDs, id)
	}

	// Delete 5 of the inserted vectors
	for i := 0; i < 5; i++ {
		if err := idx.Delete(insertedIDs[i]); err != nil {
			t.Fatalf("Delete(%d) failed: %v", insertedIDs[i], err)
		}
	}

	// Compact
	compactPath := filepath.Join(t.TempDir(), "compacted")
	result, err := idx.Compact(compactPath)
	if err != nil {
		t.Fatalf("Compact failed: %v", err)
	}

	if result.DeletedPoints != 5 {
		t.Errorf("expected 5 deleted points, got %d", result.DeletedPoints)
	}

	// Open compacted index and search
	compactIdx, err := Open(compactPath)
	if err != nil {
		t.Fatalf("Open compacted failed: %v", err)
	}
	defer compactIdx.Close()

	q := make([]float32, smallDim)
	for j := range q {
		q[j] = rng.Float32()
	}
	results, err := compactIdx.Search(q, 5, 50)
	if err != nil {
		t.Fatalf("Search on compacted failed: %v", err)
	}
	if len(results) == 0 {
		t.Error("Search on compacted returned no results")
	}
}

// TestInsertLockFree_ConcurrentInsertDelete verifies no deadlock with concurrent Insert+Delete.
func TestInsertLockFree_ConcurrentInsertDelete(t *testing.T) {
	idx := setupSmallDiskIndex(t)

	var wg sync.WaitGroup

	// 3 concurrent inserters
	for g := 0; g < 3; g++ {
		wg.Add(1)
		go func(seed int64) {
			defer wg.Done()
			r := rand.New(rand.NewSource(seed))
			for i := 0; i < 10; i++ {
				vec := make([]float32, smallDim)
				for j := range vec {
					vec[j] = r.Float32()
				}
				_, _ = idx.Insert(vec)
			}
		}(int64(g * 1000))
	}

	// 2 concurrent deleters (delete from base nodes, skip medoid)
	for g := 0; g < 2; g++ {
		wg.Add(1)
		go func(seed int64) {
			defer wg.Done()
			r := rand.New(rand.NewSource(seed))
			medoid := idx.metadata.Medoid
			for i := 0; i < 5; i++ {
				id := uint64(r.Intn(smallBaseNum))
				if id == medoid {
					continue
				}
				_ = idx.Delete(id)
			}
		}(int64(g*1000 + 500))
	}

	wg.Wait()
}
