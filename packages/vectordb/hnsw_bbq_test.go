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
	"bytes"
	"fmt"
	"math"
	"math/rand"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/vmihailenco/msgpack/v5"
	"s-forge.local/vectordb/bbq"
)

// TestBBQThreshold verifies that the vector database works correctly
// for dimensions just around the BBQ threshold (32 and 33).
func TestBBQThreshold(t *testing.T) {
	testDimensions(t, 32, "dim-32-no-bbq")
	testDimensions(t, 33, "dim-33-with-bbq-4bit-query")
	testDimensions(t, 64, "dim-64-with-bbq-4bit-query")
}

func TestHNSWBBQQueryUsesAsymmetric4Bit(t *testing.T) {
	for _, dim := range []int{33, 128, 768} {
		t.Run(fmt.Sprintf("dim-%d", dim), func(t *testing.T) {
			store := NewVectorStore(dim, "l2")
			indexed := make([]float32, dim)
			query := make([]float32, dim)
			for i := 0; i < dim; i++ {
				indexed[i] = float32((i*7)%19) - 9
				query[i] = float32((i*11)%23) - 11
			}
			store.Set(0, indexed)

			queryCode, queryCorrection := store.QuantizeQuery(query)
			quantized := make([]byte, dim)
			expectedCorrection := store.quantizer.Quantize(query, quantized, 4, store.centroid)
			expectedCode := bbq.PackBitTranspose4(quantized)
			if !bytes.Equal(queryCode, expectedCode) || queryCorrection != expectedCorrection {
				t.Fatalf("查询必须使用 4-bit BitTranspose 编码")
			}

			indexCode := store.bbqPacked[:store.packedSize]
			dotProduct := bbq.ComputeTransposedDotProduct(queryCode, indexCode)
			expectedDistance := store.scorer.ComputeQuantizedDistance(dotProduct, queryCorrection, store.bbqCorrections[0], dim, 0, true)
			if distance := store.ComputeBBQDistanceFromQuery(queryCode, queryCorrection, 0); distance != expectedDistance {
				t.Fatalf("4-bit×1-bit 距离不一致：实际 %f，期望 %f", distance, expectedDistance)
			}
		})
	}
}

func TestHNSWBBQCentroidUsesIncrementalEpochs(t *testing.T) {
	const dimension = 128
	store := NewVectorStore(dimension, "l2")
	first := make([]float32, dimension)
	second := make([]float32, dimension)
	for index := 0; index < dimension; index++ {
		first[index] = float32(index%11) + 20
		second[index] = float32((index*3)%17) + 40
	}

	store.Set(0, first)
	if store.centroidEpoch != 1 || store.centroidCount != 1 {
		t.Fatalf("首个向量必须建立非零质心 epoch：epoch=%d，count=%d", store.centroidEpoch, store.centroidCount)
	}
	for index, value := range store.centroid {
		if value != first[index] {
			t.Fatalf("首个质心不等于首个向量：维度=%d，实际=%f，期望=%f", index, value, first[index])
		}
	}

	store.Set(1, second)
	if store.centroidEpoch != 2 || store.centroidCount != 2 {
		t.Fatalf("数据量翻倍必须开启新 epoch：epoch=%d，count=%d", store.centroidEpoch, store.centroidCount)
	}
	expectedCentroid := make([]float32, dimension)
	for index := range expectedCentroid {
		expectedCentroid[index] = (first[index] + second[index]) / 2
		if store.centroid[index] != expectedCentroid[index] {
			t.Fatalf("增量质心不正确：维度=%d，实际=%f，期望=%f", index, store.centroid[index], expectedCentroid[index])
		}
	}

	quantized := make([]byte, dimension)
	expectedCorrection := store.quantizer.Quantize(first, quantized, bbq.IndexQuantizationBits, expectedCentroid)
	expectedPacked := bbq.PackBinary(quantized)
	if !bytes.Equal(store.bbqPacked[:store.packedSize], expectedPacked) || store.bbqCorrections[0] != expectedCorrection {
		t.Fatalf("开启新质心 epoch 后必须重编码既有 1-bit data code")
	}
}

func TestHNSWBBQCentroidStateSurvivesReopen(t *testing.T) {
	const dimension = 128
	collection := NewCollectionWithMetric("centroid-reopen", dimension, "l2")
	for id := 0; id < 8; id++ {
		vector := make([]float32, dimension)
		for index := range vector {
			vector[index] = float32(id*13+index%19) / 7
		}
		if err := collection.InsertPoint(Point{ID: fmt.Sprintf("point-%d", id), Vector: vector}); err != nil {
			t.Fatal(err)
		}
	}
	if err := collection.DeletePointWithError("point-3"); err != nil {
		t.Fatal(err)
	}

	query := make([]float32, dimension)
	for index := range query {
		query[index] = float32(index%23) / 5
	}
	beforeCode, beforeCorrection := collection.Store.QuantizeQuery(query)
	beforeCentroid := append([]float32(nil), collection.Store.centroid...)
	beforeEpoch := collection.Store.centroidEpoch
	beforeCount := collection.Store.centroidCount

	basePath := t.TempDir()
	if err := SaveCollection(collection, basePath); err != nil {
		t.Fatal(err)
	}
	reopened, err := LoadCollection(basePath, collection.ColName)
	if err != nil {
		t.Fatal(err)
	}
	afterCode, afterCorrection := reopened.Store.QuantizeQuery(query)
	if !bytes.Equal(beforeCode, afterCode) || beforeCorrection != afterCorrection {
		t.Fatalf("重启前后的 4-bit query 编码不一致")
	}
	if reopened.Store.centroidEpoch != beforeEpoch || reopened.Store.centroidCount != beforeCount {
		t.Fatalf("重启后质心状态不一致：epoch=%d/%d，count=%d/%d", reopened.Store.centroidEpoch, beforeEpoch, reopened.Store.centroidCount, beforeCount)
	}
	for index := range beforeCentroid {
		if math.Float32bits(reopened.Store.centroid[index]) != math.Float32bits(beforeCentroid[index]) {
			t.Fatalf("重启后质心不一致：维度=%d", index)
		}
	}
}

func TestHNSWBBQSnapshotKeepsOnlyPackedDataCodes(t *testing.T) {
	const dimension = 128
	collection := NewCollectionWithMetric("packed-bbq", dimension, "l2")
	for id := 0; id < 3; id++ {
		vector := make([]float32, dimension)
		for index := range vector {
			vector[index] = float32(id*dimension + index)
		}
		if err := collection.InsertPoint(Point{ID: fmt.Sprintf("point-%d", id), Vector: vector}); err != nil {
			t.Fatal(err)
		}
	}
	if got, want := len(collection.Store.bbqPacked), 3*((dimension+7)/8); got != want {
		t.Fatalf("1-bit data code 大小错误：实际=%d，期望=%d", got, want)
	}
	if got, want := len(collection.Store.bbqScratch), dimension; got != want {
		t.Fatalf("量化 scratch 大小错误：实际=%d，期望=%d", got, want)
	}

	basePath := t.TempDir()
	if err := SaveCollection(collection, basePath); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(filepath.Join(basePath, collection.ColName, SnapshotFileName))
	if err != nil {
		t.Fatal(err)
	}
	var snapshot SnapshotData
	if err := msgpack.Unmarshal(data, &snapshot); err != nil {
		t.Fatal(err)
	}
	if len(snapshot.BBQQuantized) != 0 {
		t.Fatalf("快照不应持久化未打包 BBQ 临时代码：%d bytes", len(snapshot.BBQQuantized))
	}
	reopened, err := LoadCollection(basePath, collection.ColName)
	if err != nil {
		t.Fatal(err)
	}
	query := make([]float32, dimension)
	if results := reopened.Search(query, 1, 32); len(results) != 1 {
		t.Fatalf("移除未打包代码后重开查询失败：%d", len(results))
	}
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
