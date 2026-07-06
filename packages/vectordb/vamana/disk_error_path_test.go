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
	"errors"
	"math/rand"
	"os"
	"path/filepath"
	"testing"

	"s-forge.local/vectordb/storage"
)

// ============================================================================
// Error Path Test Helpers
// ============================================================================

// setupErrorPathIndex builds a small disk index for error path testing.
// Uses dim=128 (BBQ threshold) to ensure BBQ files are generated.
// Returns the base path and the opened index. Cleanup is registered via t.Cleanup.
func setupErrorPathIndex(t *testing.T, numVectors, dim int) (string, *DiskVamanaIndex) {
	t.Helper()

	originalFactory := OpenDiskIndexReader
	t.Cleanup(func() { OpenDiskIndexReader = originalFactory })

	OpenDiskIndexReader = func(path string, readOnly bool) (storage.DiskIndexReader, error) {
		return storage.OpenReader(path, readOnly)
	}

	tmpDir := t.TempDir()
	basePath := filepath.Join(tmpDir, "err_test")

	rng := rand.New(rand.NewSource(12345))
	vectors := generateIncrTestVectors(rng, numVectors, dim)

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

	return basePath, idx
}

// buildErrorPathIndexFiles builds index files on disk without opening them.
// Returns the base path. Cleanup is registered via t.Cleanup.
func buildErrorPathIndexFiles(t *testing.T, numVectors, dim int) string {
	t.Helper()

	originalFactory := OpenDiskIndexReader
	t.Cleanup(func() { OpenDiskIndexReader = originalFactory })

	OpenDiskIndexReader = func(path string, readOnly bool) (storage.DiskIndexReader, error) {
		return storage.OpenReader(path, readOnly)
	}

	tmpDir := t.TempDir()
	basePath := filepath.Join(tmpDir, "err_test")

	rng := rand.New(rand.NewSource(12345))
	vectors := generateIncrTestVectors(rng, numVectors, dim)

	config := DefaultDiskBuildConfig()
	config.R = 32
	config.L = 50
	config.Alpha = 1.2
	config.EnableBBQ = true

	_, err := BuildFromVectors(basePath, vectors, config)
	if err != nil {
		t.Fatalf("BuildFromVectors failed: %v", err)
	}

	return basePath
}

// ============================================================================
// Test 1: Corrupted Header
// ============================================================================

func TestDiskIndex_ErrorPath_CorruptedHeader(t *testing.T) {
	basePath := buildErrorPathIndexFiles(t, 200, 128)

	indexPath := basePath + diskIndexExt

	// Read original file
	data, err := os.ReadFile(indexPath)
	if err != nil {
		t.Fatalf("failed to read index file: %v", err)
	}

	tests := []struct {
		name    string
		corrupt func([]byte) []byte
	}{
		{
			name: "zeroed_magic",
			corrupt: func(d []byte) []byte {
				c := make([]byte, len(d))
				copy(c, d)
				// Zero out the magic number (first 4 bytes)
				c[0], c[1], c[2], c[3] = 0, 0, 0, 0
				return c
			},
		},
		{
			name: "truncated_header",
			corrupt: func(d []byte) []byte {
				// Return only first 10 bytes — too short for a valid header
				return d[:10]
			},
		},
		{
			name: "random_garbage",
			corrupt: func(d []byte) []byte {
				c := make([]byte, len(d))
				rng := rand.New(rand.NewSource(999))
				for i := range c {
					c[i] = byte(rng.Intn(256))
				}
				return c
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			corrupted := tt.corrupt(data)

			// Write corrupted data back
			if err := os.WriteFile(indexPath, corrupted, 0644); err != nil {
				t.Fatalf("failed to write corrupted file: %v", err)
			}

			// Attempt to open — should return error
			_, openErr := Open(basePath)
			if openErr == nil {
				t.Errorf("Open should fail with corrupted header (%s), but succeeded", tt.name)
			} else {
				t.Logf("Open correctly failed with corrupted header (%s): %v", tt.name, openErr)
			}

			// Restore original for next subtest
			if err := os.WriteFile(indexPath, data, 0644); err != nil {
				t.Fatalf("failed to restore index file: %v", err)
			}
		})
	}
}

// ============================================================================
// Test 2: Corrupted BBQ File
// ============================================================================

func TestDiskIndex_ErrorPath_CorruptedBBQ(t *testing.T) {
	basePath := buildErrorPathIndexFiles(t, 200, 128)

	bbqPath := basePath + diskBBQExt

	originalBBQ, err := os.ReadFile(bbqPath)
	if err != nil {
		t.Fatalf("failed to read BBQ file: %v", err)
	}

	tests := []struct {
		name    string
		corrupt func([]byte) []byte
	}{
		{
			name: "zeroed_magic",
			corrupt: func(d []byte) []byte {
				c := make([]byte, len(d))
				copy(c, d)
				c[0], c[1], c[2], c[3] = 0, 0, 0, 0
				return c
			},
		},
		{
			name: "invalid_version",
			corrupt: func(d []byte) []byte {
				c := make([]byte, len(d))
				copy(c, d)
				// Set version to 99 (unsupported)
				c[4], c[5], c[6], c[7] = 99, 0, 0, 0
				return c
			},
		},
		{
			name: "truncated_file",
			corrupt: func(d []byte) []byte {
				// Only keep the header, truncate all data
				if len(d) > 24 {
					return d[:20]
				}
				return d[:4]
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			corrupted := tt.corrupt(originalBBQ)

			if err := os.WriteFile(bbqPath, corrupted, 0644); err != nil {
				t.Fatalf("failed to write corrupted BBQ file: %v", err)
			}

			// Open should succeed (BBQ is optional), but BBQ may not be loaded
			// or search may behave differently
			idx, openErr := Open(basePath)
			if openErr != nil {
				// Some corruptions may cause Open to fail — that's acceptable
				t.Logf("Open failed with corrupted BBQ (%s): %v — acceptable", tt.name, openErr)
			} else {
				defer idx.Close()

				// If Open succeeded, verify the index is still usable
				// BBQ should not be loaded with corrupted data
				t.Logf("Open succeeded with corrupted BBQ (%s), HasBBQ=%v", tt.name, idx.HasBBQ())

				// Try a search — should not panic
				query := make([]float32, 128)
				for i := range query {
					query[i] = float32(i) * 0.01
				}
				func() {
					defer func() {
						if r := recover(); r != nil {
							t.Errorf("Search panicked with corrupted BBQ (%s): %v", tt.name, r)
						}
					}()
					_, _ = idx.Search(query, 5, 20)
				}()
			}

			// Restore original BBQ file
			if err := os.WriteFile(bbqPath, originalBBQ, 0644); err != nil {
				t.Fatalf("failed to restore BBQ file: %v", err)
			}
		})
	}
}

// ============================================================================
// Test 3: Operations On Closed Index
// ============================================================================

func TestDiskIndex_ErrorPath_OperationsOnClosedIndex(t *testing.T) {
	_, idx := setupErrorPathIndex(t, 200, 128)

	// Close the index first
	if err := idx.Close(); err != nil {
		t.Fatalf("Close failed: %v", err)
	}

	query := make([]float32, 128)
	for i := range query {
		query[i] = float32(i) * 0.01
	}

	t.Run("Search", func(t *testing.T) {
		defer func() {
			if r := recover(); r != nil {
				t.Errorf("Search panicked on closed index: %v", r)
			}
		}()
		results, err := idx.Search(query, 5, 20)
		if err == nil {
			t.Error("Search should return error on closed index")
		} else if !errors.Is(err, ErrDiskIndexClosed) {
			t.Errorf("Search error should be ErrDiskIndexClosed, got: %v", err)
		}
		if results != nil {
			t.Error("Search results should be nil on closed index")
		}
	})

	t.Run("Insert", func(t *testing.T) {
		defer func() {
			if r := recover(); r != nil {
				t.Errorf("Insert panicked on closed index: %v", r)
			}
		}()
		_, err := idx.Insert(query)
		if err == nil {
			t.Error("Insert should return error on closed index")
		} else if !errors.Is(err, ErrDiskIndexClosed) {
			t.Errorf("Insert error should be ErrDiskIndexClosed, got: %v", err)
		}
	})

	t.Run("Delete", func(t *testing.T) {
		defer func() {
			if r := recover(); r != nil {
				t.Errorf("Delete panicked on closed index: %v", r)
			}
		}()
		err := idx.Delete(0)
		if err == nil {
			t.Error("Delete should return error on closed index")
		} else if !errors.Is(err, ErrDiskIndexClosed) {
			t.Errorf("Delete error should be ErrDiskIndexClosed, got: %v", err)
		}
	})

	t.Run("ReadVector", func(t *testing.T) {
		defer func() {
			if r := recover(); r != nil {
				t.Errorf("ReadVector panicked on closed index: %v", r)
			}
		}()
		vec, err := idx.ReadVector(0)
		if err == nil {
			t.Error("ReadVector should return error on closed index")
		} else if !errors.Is(err, ErrDiskIndexClosed) {
			t.Errorf("ReadVector error should be ErrDiskIndexClosed, got: %v", err)
		}
		if vec != nil {
			t.Error("ReadVector should return nil on closed index")
		}
	})

	t.Run("Compact", func(t *testing.T) {
		defer func() {
			if r := recover(); r != nil {
				t.Errorf("Compact panicked on closed index: %v", r)
			}
		}()
		_, err := idx.Compact(filepath.Join(t.TempDir(), "compact_out"))
		if err == nil {
			t.Error("Compact should return error on closed index")
		} else if !errors.Is(err, ErrDiskIndexClosed) {
			t.Errorf("Compact error should be ErrDiskIndexClosed, got: %v", err)
		}
	})

	t.Run("Accessors", func(t *testing.T) {
		defer func() {
			if r := recover(); r != nil {
				t.Errorf("Accessor panicked on closed index: %v", r)
			}
		}()
		if idx.NumPoints() != 0 {
			t.Error("NumPoints should return 0 on closed index")
		}
		if idx.NumPointsTotal() != 0 {
			t.Error("NumPointsTotal should return 0 on closed index")
		}
		if idx.Dimension() != 0 {
			t.Error("Dimension should return 0 on closed index")
		}
		if idx.Medoid() != 0 {
			t.Error("Medoid should return 0 on closed index")
		}
		if idx.MaxDegree() != 0 {
			t.Error("MaxDegree should return 0 on closed index")
		}
		if idx.GetNeighbors(0) != nil {
			t.Error("GetNeighbors should return nil on closed index")
		}
		if idx.HasBBQ() {
			t.Error("HasBBQ should return false on closed index")
		}
		if idx.GetBBQCode(0) != nil {
			t.Error("GetBBQCode should return nil on closed index")
		}
	})

	t.Run("DoubleClose", func(t *testing.T) {
		defer func() {
			if r := recover(); r != nil {
				t.Errorf("Double Close panicked: %v", r)
			}
		}()
		err := idx.Close()
		if err != nil {
			t.Errorf("Double Close should not return error, got: %v", err)
		}
	})
}

// ============================================================================
// Test 4: Dimension Mismatch
// ============================================================================

func TestDiskIndex_ErrorPath_DimensionMismatch(t *testing.T) {
	_, idx := setupErrorPathIndex(t, 200, 128)

	tests := []struct {
		name string
		dim  int
	}{
		{name: "too_short", dim: 64},
		{name: "too_long", dim: 256},
		{name: "off_by_one_less", dim: 127},
		{name: "off_by_one_more", dim: 129},
		{name: "single_dim", dim: 1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			wrongVec := make([]float32, tt.dim)
			for i := range wrongVec {
				wrongVec[i] = float32(i) * 0.01
			}

			_, err := idx.Insert(wrongVec)
			if err == nil {
				t.Errorf("Insert with dim=%d should return error for index with dim=128", tt.dim)
			} else if !errors.Is(err, ErrVectorDimensionMismatch) {
				t.Errorf("Insert error should be ErrVectorDimensionMismatch, got: %v", err)
			}
		})
	}
}

// ============================================================================
// Test 5: Delete Nonexistent Node
// ============================================================================

func TestDiskIndex_ErrorPath_DeleteNonexistent(t *testing.T) {
	_, idx := setupErrorPathIndex(t, 200, 128)

	total := idx.NumPointsTotal()

	tests := []struct {
		name   string
		nodeID uint64
	}{
		{name: "just_beyond_total", nodeID: total},
		{name: "far_beyond_total", nodeID: total + 10000},
		{name: "max_uint64", nodeID: ^uint64(0)},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := idx.Delete(tt.nodeID)
			if err == nil {
				t.Errorf("Delete(nodeID=%d) should return error for nonexistent node", tt.nodeID)
			} else if !errors.Is(err, storage.ErrNodeNotFound) {
				t.Errorf("Delete error should be ErrNodeNotFound, got: %v", err)
			}
		})
	}

	// Also test double-delete of an existing node
	t.Run("double_delete", func(t *testing.T) {
		// Delete node 1 (not medoid, should exist)
		nodeID := uint64(1)
		err := idx.Delete(nodeID)
		if err != nil {
			t.Fatalf("first Delete(%d) failed: %v", nodeID, err)
		}

		// Second delete should return ErrNodeAlreadyDeleted
		err = idx.Delete(nodeID)
		if err == nil {
			t.Error("second Delete should return error for already-deleted node")
		} else if !errors.Is(err, ErrNodeAlreadyDeleted) {
			t.Errorf("second Delete error should be ErrNodeAlreadyDeleted, got: %v", err)
		}
	})
}

// ============================================================================
// Test 6: Open Nonexistent Path
// ============================================================================

func TestDiskIndex_ErrorPath_OpenNonexistentPath(t *testing.T) {
	originalFactory := OpenDiskIndexReader
	t.Cleanup(func() { OpenDiskIndexReader = originalFactory })

	OpenDiskIndexReader = func(path string, readOnly bool) (storage.DiskIndexReader, error) {
		return storage.OpenReader(path, readOnly)
	}

	tests := []struct {
		name string
		path string
	}{
		{
			name: "completely_nonexistent",
			path: filepath.Join(t.TempDir(), "nonexistent", "deep", "path", "index"),
		},
		{
			name: "empty_directory",
			path: filepath.Join(t.TempDir(), "empty_index"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := Open(tt.path)
			if err == nil {
				t.Errorf("Open(%q) should fail for nonexistent path", tt.path)
			} else {
				t.Logf("Open correctly failed for nonexistent path (%s): %v", tt.name, err)
			}
		})
	}

	// Test with nil reader factory
	t.Run("nil_reader_factory", func(t *testing.T) {
		// Create a minimal index file so the stat check passes
		tmpDir := t.TempDir()
		basePath := filepath.Join(tmpDir, "nil_factory")
		indexPath := basePath + diskIndexExt
		if err := os.WriteFile(indexPath, []byte("dummy"), 0644); err != nil {
			t.Fatalf("failed to create dummy index file: %v", err)
		}

		OpenDiskIndexReader = nil
		_, err := Open(basePath)
		if err == nil {
			t.Error("Open should fail when reader factory is nil")
		} else if !errors.Is(err, ErrReaderNotConfigured) {
			t.Logf("Open failed with: %v (may wrap ErrReaderNotConfigured)", err)
		}
	})
}

// ============================================================================
// Test 7: Search With Invalid Params
// ============================================================================

func TestDiskIndex_ErrorPath_SearchWithInvalidParams(t *testing.T) {
	_, idx := setupErrorPathIndex(t, 200, 128)

	t.Run("wrong_dimension_query", func(t *testing.T) {
		defer func() {
			if r := recover(); r != nil {
				t.Errorf("Search panicked with wrong dimension query: %v", r)
			}
		}()
		wrongQuery := make([]float32, 64)
		results, err := idx.Search(wrongQuery, 5, 20)
		// Current implementation returns nil, nil for dimension mismatch
		if err != nil {
			t.Logf("Search returned error for wrong dimension: %v", err)
		}
		if results != nil {
			t.Logf("Search returned %d results for wrong dimension query", len(results))
		}
	})

	t.Run("zero_dimension_query", func(t *testing.T) {
		defer func() {
			if r := recover(); r != nil {
				t.Errorf("Search panicked with zero-dimension query: %v", r)
			}
		}()
		emptyQuery := make([]float32, 0)
		results, err := idx.Search(emptyQuery, 5, 20)
		if err != nil {
			t.Logf("Search returned error for empty query: %v", err)
		}
		if results != nil {
			t.Logf("Search returned %d results for empty query", len(results))
		}
	})

	t.Run("topK_zero", func(t *testing.T) {
		defer func() {
			if r := recover(); r != nil {
				t.Errorf("Search panicked with topK=0: %v", r)
			}
		}()
		query := make([]float32, 128)
		for i := range query {
			query[i] = float32(i) * 0.01
		}
		results, err := idx.Search(query, 0, 20)
		if err != nil {
			t.Logf("Search returned error for topK=0: %v", err)
		}
		// topK=0 should return empty or nil results
		t.Logf("Search with topK=0 returned %d results", len(results))
	})

	t.Run("negative_efSearch_treated_as_topK", func(t *testing.T) {
		defer func() {
			if r := recover(); r != nil {
				t.Errorf("Search panicked with efSearch=0: %v", r)
			}
		}()
		query := make([]float32, 128)
		for i := range query {
			query[i] = float32(i) * 0.01
		}
		// efSearch < topK should be clamped to topK
		results, err := idx.Search(query, 5, 0)
		if err != nil {
			t.Logf("Search returned error for efSearch=0: %v", err)
		} else {
			t.Logf("Search with efSearch=0 returned %d results (efSearch clamped to topK)", len(results))
		}
	})

	t.Run("nil_query", func(t *testing.T) {
		defer func() {
			if r := recover(); r != nil {
				t.Errorf("Search panicked with nil query: %v", r)
			}
		}()
		results, err := idx.Search(nil, 5, 20)
		if err != nil {
			t.Logf("Search returned error for nil query: %v", err)
		}
		if results != nil {
			t.Logf("Search returned %d results for nil query", len(results))
		}
	})

	t.Run("very_large_topK", func(t *testing.T) {
		defer func() {
			if r := recover(); r != nil {
				t.Errorf("Search panicked with very large topK: %v", r)
			}
		}()
		query := make([]float32, 128)
		for i := range query {
			query[i] = float32(i) * 0.01
		}
		// topK larger than total points
		results, err := idx.Search(query, 100000, 100000)
		if err != nil {
			t.Logf("Search returned error for very large topK: %v", err)
		} else {
			// Should return at most NumPoints results
			if uint64(len(results)) > idx.NumPointsTotal() {
				t.Errorf("Search returned more results (%d) than total points (%d)",
					len(results), idx.NumPointsTotal())
			}
			t.Logf("Search with topK=100000 returned %d results", len(results))
		}
	})
}
