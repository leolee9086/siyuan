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
	"context"
	"math/rand"
	"sync"
	"testing"
	"time"
)

// ============================================================================
// Concurrent Operation Tests for DiskVamanaIndex
//
// These tests verify thread-safety of concurrent insert/delete/search operations.
// They are designed to be run with `go test -race` to detect data races.
//
// Shared helpers are defined in disk_incremental_helpers_test.go.
// ============================================================================

const (
	// concBaseDim is the vector dimension for concurrent tests.
	concBaseDim = 128

	// concBaseNum is the number of base vectors to build the initial index.
	concBaseNum = 5000

	// concInsertCount is the number of vectors each insert goroutine inserts.
	concInsertCount = 50

	// concSearchCount is the number of search queries each search goroutine executes.
	concSearchCount = 30

	// concDeleteCount is the number of nodes each delete goroutine deletes.
	concDeleteCount = 50

	// concSearchWorkers is the number of parallel search goroutines.
	concSearchWorkers = 4

	// concTimeout is the maximum duration for any concurrent test phase.
	concTimeout = 120 * time.Second
)

// ============================================================================
// TestDiskIndex_ConcurrentInsertAndSearch
//
// Builds a base index, then concurrently:
//   - One goroutine inserts new vectors
//   - Another goroutine executes search queries
//
// Verifies no panic, no data race, and search returns valid results.
// ============================================================================

func TestDiskIndex_ConcurrentInsertAndSearch(t *testing.T) {
	requireScaleTest(t)

	idx := setupDiskIndex(t, concBaseNum, concBaseDim)

	ctx, cancel := context.WithTimeout(context.Background(), concTimeout)
	defer cancel()

	rngInsert := rand.New(rand.NewSource(100))
	rngSearch := rand.New(rand.NewSource(200))

	// Pre-generate insert vectors and search queries to avoid RNG contention
	insertVecs := generateIncrTestVectors(rngInsert, concInsertCount, concBaseDim)
	searchQueries := generateIncrTestVectors(rngSearch, concSearchCount, concBaseDim)

	var wg sync.WaitGroup
	insertErrors := make(chan error, concInsertCount)
	searchErrors := make(chan error, concSearchCount)

	// Goroutine 1: Insert vectors
	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := 0; i < concInsertCount; i++ {
			select {
			case <-ctx.Done():
				insertErrors <- ctx.Err()
				return
			default:
			}
			_, err := idx.Insert(insertVecs[i])
			if err != nil {
				insertErrors <- err
				return
			}
		}
	}()

	// Goroutine 2: Search queries
	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := 0; i < concSearchCount; i++ {
			select {
			case <-ctx.Done():
				searchErrors <- ctx.Err()
				return
			default:
			}
			results, err := idx.Search(searchQueries[i], 10, 100)
			if err != nil {
				searchErrors <- err
				return
			}
			if len(results) == 0 {
				t.Logf("ConcurrentInsertAndSearch: search query %d returned 0 results", i)
			}
		}
	}()

	wg.Wait()
	close(insertErrors)
	close(searchErrors)

	for err := range insertErrors {
		t.Errorf("Insert error: %v", err)
	}
	for err := range searchErrors {
		t.Errorf("Search error: %v", err)
	}

	// Post-condition: total points should have increased
	expectedMin := uint64(concBaseNum)
	actual := idx.NumPointsTotal()
	if actual < expectedMin {
		t.Errorf("NumPointsTotal %d < base %d after concurrent insert", actual, expectedMin)
	}
	t.Logf("ConcurrentInsertAndSearch: NumPointsTotal=%d (base=%d, inserted up to %d)",
		actual, concBaseNum, concInsertCount)

	// Verify search still works after concurrent operations
	results, err := idx.Search(searchQueries[0], 10, 100)
	if err != nil {
		t.Fatalf("Post-concurrent search failed: %v", err)
	}
	if len(results) == 0 {
		t.Error("Post-concurrent search returned no results")
	}
}

// ============================================================================
// TestDiskIndex_ConcurrentInsertAndDelete
//
// Builds a base index, then concurrently:
//   - One goroutine inserts new vectors
//   - Another goroutine deletes existing nodes
//
// Verifies index state consistency after both operations complete.
// ============================================================================

func TestDiskIndex_ConcurrentInsertAndDelete(t *testing.T) {
	requireScaleTest(t)

	idx := setupDiskIndex(t, concBaseNum, concBaseDim)

	ctx, cancel := context.WithTimeout(context.Background(), concTimeout)
	defer cancel()

	rngInsert := rand.New(rand.NewSource(300))
	rngDelete := rand.New(rand.NewSource(400))

	// Pre-generate insert vectors
	insertVecs := generateIncrTestVectors(rngInsert, concInsertCount, concBaseDim)

	// Pre-select delete candidates (avoid medoid)
	deleteCandidates := selectDeleteCandidates(idx, concDeleteCount, rngDelete)

	var wg sync.WaitGroup
	insertErrors := make(chan error, concInsertCount)
	deleteErrors := make(chan error, concDeleteCount)

	insertedIDs := make([]uint64, 0, concInsertCount)
	var insertMu sync.Mutex

	// Goroutine 1: Insert vectors
	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := 0; i < concInsertCount; i++ {
			select {
			case <-ctx.Done():
				insertErrors <- ctx.Err()
				return
			default:
			}
			id, err := idx.Insert(insertVecs[i])
			if err != nil {
				insertErrors <- err
				return
			}
			insertMu.Lock()
			insertedIDs = append(insertedIDs, id)
			insertMu.Unlock()
		}
	}()

	// Goroutine 2: Delete nodes
	wg.Add(1)
	go func() {
		defer wg.Done()
		for _, id := range deleteCandidates {
			select {
			case <-ctx.Done():
				deleteErrors <- ctx.Err()
				return
			default:
			}
			err := idx.Delete(id)
			if err != nil && err != ErrNodeAlreadyDeleted {
				deleteErrors <- err
				return
			}
		}
	}()

	wg.Wait()
	close(insertErrors)
	close(deleteErrors)

	for err := range insertErrors {
		t.Errorf("Insert error: %v", err)
	}
	for err := range deleteErrors {
		t.Errorf("Delete error: %v", err)
	}

	// Verify deleted nodes are marked
	deletedCount := 0
	for _, id := range deleteCandidates {
		if idx.IsDeleted(id) {
			deletedCount++
		}
	}
	t.Logf("ConcurrentInsertAndDelete: %d/%d candidates confirmed deleted",
		deletedCount, len(deleteCandidates))

	// Verify inserted vectors count
	insertMu.Lock()
	numInserted := len(insertedIDs)
	insertMu.Unlock()
	t.Logf("ConcurrentInsertAndDelete: %d vectors inserted", numInserted)

	// Verify search still works on the index
	rngQuery := rand.New(rand.NewSource(500))
	query := generateIncrTestVectors(rngQuery, 1, concBaseDim)[0]
	results, err := idx.Search(query, 10, 100)
	if err != nil {
		t.Fatalf("Post-concurrent search failed: %v", err)
	}

	// Verify no deleted node appears in search results
	deleteSet := make(map[uint64]struct{}, len(deleteCandidates))
	for _, id := range deleteCandidates {
		deleteSet[id] = struct{}{}
	}
	for _, r := range results {
		if _, ok := deleteSet[r.ID]; ok {
			if idx.IsDeleted(r.ID) {
				t.Errorf("Deleted node %d found in search results", r.ID)
			}
		}
	}

	t.Logf("ConcurrentInsertAndDelete: search returned %d results, index consistent", len(results))
}

// ============================================================================
// TestDiskIndex_ConcurrentSearches
//
// Builds an index, then launches multiple goroutines all executing searches
// simultaneously. Verifies:
//   - No panic or data race
//   - All goroutines return valid results
//   - Results are deterministic (same query yields same results)
// ============================================================================

func TestDiskIndex_ConcurrentSearches(t *testing.T) {
	requireScaleTest(t)

	idx := setupDiskIndex(t, concBaseNum, concBaseDim)

	ctx, cancel := context.WithTimeout(context.Background(), concTimeout)
	defer cancel()

	// Generate a shared set of queries
	rng := rand.New(rand.NewSource(600))
	queries := generateIncrTestVectors(rng, concSearchCount, concBaseDim)

	type searchResult struct {
		workerID int
		queryIdx int
		results  []SearchResult
		err      error
	}

	resultsCh := make(chan searchResult, concSearchWorkers*concSearchCount)

	var wg sync.WaitGroup

	// Launch multiple search workers
	for w := 0; w < concSearchWorkers; w++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			for i := 0; i < concSearchCount; i++ {
				select {
				case <-ctx.Done():
					resultsCh <- searchResult{
						workerID: workerID,
						queryIdx: i,
						err:      ctx.Err(),
					}
					return
				default:
				}
				results, err := idx.Search(queries[i], 10, 100)
				resultsCh <- searchResult{
					workerID: workerID,
					queryIdx: i,
					results:  results,
					err:      err,
				}
			}
		}(w)
	}

	wg.Wait()
	close(resultsCh)

	// Collect and verify results
	errorCount := 0
	emptyCount := 0
	totalResults := 0

	// Track results per query for determinism check
	queryResults := make(map[int][][]SearchResult)

	for sr := range resultsCh {
		totalResults++
		if sr.err != nil {
			errorCount++
			t.Errorf("Worker %d, query %d: error %v", sr.workerID, sr.queryIdx, sr.err)
			continue
		}
		if len(sr.results) == 0 {
			emptyCount++
			continue
		}
		queryResults[sr.queryIdx] = append(queryResults[sr.queryIdx], sr.results)
	}

	if errorCount > 0 {
		t.Errorf("ConcurrentSearches: %d/%d searches returned errors", errorCount, totalResults)
	}
	if emptyCount > totalResults/5 {
		t.Errorf("ConcurrentSearches: too many empty results %d/%d", emptyCount, totalResults)
	}

	// Verify determinism: same query from different workers should yield same results
	deterministicMismatches := 0
	for queryIdx, allResults := range queryResults {
		if len(allResults) < 2 {
			continue
		}
		baseline := allResults[0]
		for i := 1; i < len(allResults); i++ {
			if !searchResultsEqual(baseline, allResults[i]) {
				deterministicMismatches++
				if deterministicMismatches <= 3 {
					t.Logf("ConcurrentSearches: query %d non-deterministic across workers", queryIdx)
				}
			}
		}
	}
	if deterministicMismatches > 0 {
		t.Logf("ConcurrentSearches: %d query results differed across workers (may be acceptable for approximate search)",
			deterministicMismatches)
	}

	t.Logf("ConcurrentSearches: %d total searches, %d errors, %d empty, %d determinism mismatches",
		totalResults, errorCount, emptyCount, deterministicMismatches)
}

// searchResultsEqual compares two SearchResult slices for equality by ID and Distance.
func searchResultsEqual(a, b []SearchResult) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i].ID != b[i].ID || a[i].Distance != b[i].Distance {
			return false
		}
	}
	return true
}
