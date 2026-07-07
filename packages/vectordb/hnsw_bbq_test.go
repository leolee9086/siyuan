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

// 本文件由 kernel/vectordb/hnsw_bbq_test.go 移植，
// 导入路径已适配 packages/vectordb 的独立模块结构。

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

	// Test Search: verify that we can find the item itself
	for i := 0; i < 10; i++ {
		queryVec := vectors[i]
		results := collection.Search(queryVec, 1, 10)

		if len(results) == 0 {
			t.Errorf("Dim %d: Search failed to find any results for item %d", dim, i)
			continue
		}

		top := results[0]
		if top.ID != fmt.Sprintf("item-%d", i) {
			if top.Distance > 1e-5 {
				t.Errorf("Dim %d: Search result mismatch for item %d. Got %s with dist %f", dim, i, top.ID, top.Distance)
			}
		}
	}
	t.Logf("Dim %d: Basic search sanity check passed.", dim)
}
