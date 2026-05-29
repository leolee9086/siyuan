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

package vectordb

import (
	"fmt"
	"sync"
	"testing"
)

// TestConcurrentSearchAndDelete exposes races between Search (read) and
// Delete/Insert (write) on HNSWIndex.Neighbors and HNSWIndex.Deleted.
func TestConcurrentSearchAndDelete(t *testing.T) {
	collection := NewCollection("race-test", 64)
	dim := 64
	numItems := 200

	for i := 0; i < numItems; i++ {
		vec := make([]float32, dim)
		for j := 0; j < dim; j++ {
			vec[j] = float32(i+j) / float32(numItems)
		}
		NormalizeVector(vec)
		err := collection.InsertPoint(Point{
			ID:     fmt.Sprintf("base-%d", i),
			Vector: vec,
		})
		if err != nil {
			t.Fatalf("insert base-%d failed: %v", i, err)
		}
	}

	targets := make([]string, 5)
	for i := 0; i < 5; i++ {
		id := fmt.Sprintf("target-%d", i)
		targets[i] = id
		vec := make([]float32, dim)
		for j := 0; j < dim; j++ {
			vec[j] = float32(numItems+i+j) / float32(numItems+5)
		}
		NormalizeVector(vec)
		err := collection.InsertPoint(Point{ID: id, Vector: vec})
		if err != nil {
			t.Fatalf("insert %s failed: %v", id, err)
		}
	}

	const numSearchers = 4
	done := make(chan struct{})
	var searchers sync.WaitGroup

	for i := 0; i < numSearchers; i++ {
		searchers.Add(1)
		go func(worker int) {
			defer searchers.Done()
			for {
				select {
				case <-done:
					return
				default:
					query := make([]float32, dim)
					for j := 0; j < dim; j++ {
						query[j] = float32(worker*100+j) / 100.0
					}
					NormalizeVector(query)
					results := collection.Search(query, 10, 50)
					_ = results
				}
			}
		}(i)
	}

	const cycles = 50
	var deleters sync.WaitGroup
	for i := 0; i < cycles; i++ {
		deleters.Add(1)
		go func(iter int) {
			defer deleters.Done()
			targetID := targets[iter%len(targets)]
			collection.DeleteItemWithIndex(targetID)
			vec := make([]float32, dim)
			for j := 0; j < dim; j++ {
				vec[j] = float32(iter+j) / float32(cycles)
			}
			NormalizeVector(vec)
			_ = collection.InsertPoint(Point{ID: targetID, Vector: vec})
		}(i)
	}

	deleters.Wait()
	close(done)
	searchers.Wait()

	t.Log("race test completed, no data races detected")
}
