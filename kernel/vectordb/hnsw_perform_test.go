package vectordb

import (
	"fmt"
	"math/rand"
	"testing"
	"time"
)

// TestHNSW1MPerformance tests performance with larger datasets.
// By default, it runs with a smaller dataset (e.g., 10k) to verify logic quickly.
func TestHNSW1MPerformance(t *testing.T) {
	if testing.Short() {
		t.Skip("large-scale performance test")
	}
	numItems := 200000
	dimension := 128
	collection := NewCollection("perf-1m", dimension)

	t.Logf("Running 1M Performance Test (scaled to %d items for quick check)...", numItems)
	t.Log("Generating data (lazy generation during insert to save memory/time)...")

	startInsert := time.Now()
	var lastLogTime time.Time

	for i := 0; i < numItems; i++ {
		vec := make([]float32, dimension)
		for j := 0; j < dimension; j++ {
			vec[j] = rand.Float32()*2 - 1
		}
		NormalizeVector(vec)

		err := collection.InsertPoint(Point{
			ID:     fmt.Sprintf("item-%d", i),
			Vector: vec,
		})
		if err != nil {
			t.Fatalf("Insert failed at %d: %v", i, err)
		}

		if i > 0 && i%(numItems/10) == 0 {
			now := time.Now()
			if lastLogTime.IsZero() {
				lastLogTime = startInsert
			}
			elapsed := now.Sub(lastLogTime)
			itemsPerSec := float64(numItems/10) / elapsed.Seconds()
			t.Logf("Inserted %d/%d (%.0f items/sec)", i, numItems, itemsPerSec)
			lastLogTime = now
		}
	}

	insertDuration := time.Since(startInsert)
	t.Logf("Insert Complete. Total items: %d", collection.ItemCount())
	t.Logf("Total Insert Time: %v", insertDuration)
	t.Logf("Average Insert Rate: %.2f items/sec", float64(numItems)/insertDuration.Seconds())

	t.Log("Testing Search Performance...")
	numQueries := 100
	k := 10

	startSearch := time.Now()
	for i := 0; i < numQueries; i++ {
		query := make([]float32, dimension)
		for j := 0; j < dimension; j++ {
			query[j] = rand.Float32()*2 - 1
		}
		NormalizeVector(query)
		collection.Search(query, k, 300)
	}
	searchDuration := time.Since(startSearch)

	avgLatency := searchDuration.Seconds() * 1000 / float64(numQueries)
	qps := float64(numQueries) / searchDuration.Seconds()

	t.Logf("Search Complete. Queries: %d, Top-K: %d", numQueries, k)
	t.Logf("Total Search Time: %v", searchDuration)
	t.Logf("Average Latency: %.2f ms", avgLatency)
	t.Logf("QPS: %.2f", qps)
	t.Log("1M Performance Test (Scaled) Passed.")
}

func TestHNSW1024DimPerformance(t *testing.T) {
	if testing.Short() {
		t.Skip("high-dimensional performance test")
	}
	numItems := 10000
	dimension := 1024
	collection := NewCollection("perf-1024", dimension)

	t.Logf("Running 1024-Dim Performance Test (%d items)...", numItems)

	startInsert := time.Now()
	for i := 0; i < numItems; i++ {
		vec := make([]float32, dimension)
		for j := 0; j < dimension; j++ {
			vec[j] = rand.Float32()*2 - 1
		}
		NormalizeVector(vec)

		err := collection.InsertPoint(Point{
			ID:     fmt.Sprintf("item-%d", i),
			Vector: vec,
		})
		if err != nil {
			t.Fatalf("Insert failed at %d: %v", i, err)
		}
	}
	insertDuration := time.Since(startInsert)
	t.Logf("Insert Complete. Total items: %d", numItems)
	t.Logf("Total Insert Time: %v", insertDuration)
	t.Logf("Insert Rate: %.2f items/sec", float64(numItems)/insertDuration.Seconds())

	t.Log("Testing Search Performance (1024 dim)...")
	numQueries := 100
	k := 10

	startSearch := time.Now()
	for i := 0; i < numQueries; i++ {
		query := make([]float32, dimension)
		for j := 0; j < dimension; j++ {
			query[j] = rand.Float32()*2 - 1
		}
		NormalizeVector(query)
		collection.Search(query, k, 300)
	}
	searchDuration := time.Since(startSearch)

	avgLatency := searchDuration.Seconds() * 1000 / float64(numQueries)
	qps := float64(numQueries) / searchDuration.Seconds()

	t.Logf("Search Complete. Queries: %d, Top-K: %d", numQueries, k)
	t.Logf("Total Search Time: %v", searchDuration)
	t.Logf("Average Latency: %.2f ms", avgLatency)
	t.Logf("QPS: %.2f", qps)
}
