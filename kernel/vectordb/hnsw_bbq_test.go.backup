package vectordb

import (
	"fmt"
	"math/rand"
	"testing"
	"time"
)

// TestBBQThreshold verifies that the vector database works correctly
// for dimensions just around the BBQ threshold (32 and 33).
func TestBBQThreshold(t *testing.T) {
	testDimensions(t, 32, "dim-32-no-bbq")
	testDimensions(t, 33, "dim-33-with-bbq-4bit-query")
    testDimensions(t, 64, "dim-64-with-bbq-4bit-query")
}

func testDimensions(t *testing.T, dim int, name string) {
	t.Logf("Testing dimension %d (%s)...", dim, name)
	
	collection := NewCollection(name, dim)
	
	// Generate data
	numItems := 100
	rand.Seed(time.Now().UnixNano())
	
	vectors := make([][]float32, numItems)
	for i := 0; i < numItems; i++ {
		vec := make([]float32, dim)
		for j := 0; j < dim; j++ {
			vec[j] = rand.Float32()*2 - 1
		}
		NormalizeVector(vec)
		vectors[i] = vec
		
		err := collection.InsertPoint(Point{
			ID:     fmt.Sprintf("item-%d", i),
			Vector: vec,
		})
		if err != nil {
			t.Fatalf("Insert failed: %v", err)
		}
	}
	
	// Test Search
	// Verify that we can find the item itself (sanity check)
	for i := 0; i < 10; i++ { // Check first 10 items
		queryVec := vectors[i]
		results := collection.Search(queryVec, 1, 10)
		
		if len(results) == 0 {
			t.Errorf("Dim %d: Search failed to find any results for item %d", dim, i)
			continue
		}
		
		// The top result should be the item itself or very close to it
		// Note: With BBQ, exact match might not always be top if the dataset is dense, 
		// but since we query with the exact vector, it should be extremely close.
		// However, BBQ is an approximation. 
		// But Search re-scores with full precision at the end (L86 in hnsw_query.go).
		// So the top result should definitely be the item itself (distance ~ 0, score ~ 1).
		
		top := results[0]
		if top.ID != fmt.Sprintf("item-%d", i) {
			// If not the exact ID, check if distance is very small (duplicate or near-duplicate)
			if top.Distance > 1e-5 {
				t.Errorf("Dim %d: Search result mismatch for item %d. Got %s with dist %f", dim, i, top.ID, top.Distance)
			}
		}
	}
	t.Logf("Dim %d: Basic search sanity check passed.", dim)
}
