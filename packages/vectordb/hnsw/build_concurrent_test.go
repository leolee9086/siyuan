package hnsw

import (
	"sync"
	"testing"
)

func TestConcurrentReverseEdgesDoNotLoseUpdates(t *testing.T) {
	const edgeCount = 128
	index := NewHNSWIndex(0, Config{M: edgeCount, MaxLevel: 1, GraphSlackFactor: 2}, nil)
	for id := 0; id <= edgeCount; id++ {
		index.InitItemNeighbors(DocID(id))
	}

	var workers sync.WaitGroup
	workers.Add(edgeCount)
	for id := 1; id <= edgeCount; id++ {
		id := DocID(id)
		go func() {
			defer workers.Done()
			index.addNeighborRecord(0, 0, NeighborRecord{ID: id, Distance: float32(id)}, edgeCount, edgeCount+1)
		}()
	}
	workers.Wait()

	neighbors := index.GetLevelNeighborRecords(0, 0)
	if len(neighbors) != edgeCount {
		t.Fatalf("concurrent reverse-edge updates lost entries: got %d, want %d", len(neighbors), edgeCount)
	}
	seen := make(map[DocID]struct{}, edgeCount)
	for _, neighbor := range neighbors {
		seen[neighbor.ID] = struct{}{}
	}
	for id := 1; id <= edgeCount; id++ {
		if _, ok := seen[DocID(id)]; !ok {
			t.Fatalf("missing reverse edge to %d", id)
		}
	}
}
