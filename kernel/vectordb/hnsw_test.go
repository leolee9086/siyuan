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
	"math"
	"math/rand"
	"os"
	"path/filepath"
	"sort"
	"testing"
	"time"
)

// =========================================
// 距离计算测试
// =========================================

func TestCosineDistance(t *testing.T) {
	// 测试相同向量
	v1 := []float32{1, 0, 0}
	v2 := []float32{1, 0, 0}
	dist := CosineDistance(v1, v2)
	if dist > 0.001 {
		t.Errorf("相同向量距离应接近0，实际: %f", dist)
	}

	// 测试正交向量
	v3 := []float32{1, 0, 0}
	v4 := []float32{0, 1, 0}
	dist = CosineDistance(v3, v4)
	if math.Abs(float64(dist)-1.0) > 0.001 {
		t.Errorf("正交向量距离应接近1，实际: %f", dist)
	}

	// 测试相反向量
	v5 := []float32{1, 0, 0}
	v6 := []float32{-1, 0, 0}
	dist = CosineDistance(v5, v6)
	if math.Abs(float64(dist)-2.0) > 0.001 {
		t.Errorf("相反向量距离应接近2，实际: %f", dist)
	}
}

func TestL2Distance(t *testing.T) {
	v1 := []float32{0, 0, 0}
	v2 := []float32{3, 4, 0}
	dist := L2Distance(v1, v2)
	if math.Abs(float64(dist)-25.0) > 0.001 { // 3^2 + 4^2 = 25
		t.Errorf("L2距离平方应为25，实际: %f", dist)
	}
}

// =========================================
// 堆测试
// =========================================

func TestMinHeap(t *testing.T) {
	heap := NewMinHeap()
	
	heap.Push(&HeapItem{ID: "a", Distance: 3})
	heap.Push(&HeapItem{ID: "b", Distance: 1})
	heap.Push(&HeapItem{ID: "c", Distance: 2})
	
	if heap.Len() != 3 {
		t.Errorf("堆大小应为3，实际: %d", heap.Len())
	}
	
	// 最小值应该先出
	item := heap.Pop()
	if item.ID != "b" || item.Distance != 1 {
		t.Errorf("应该先弹出b，实际: %s", item.ID)
	}
	
	item = heap.Pop()
	if item.ID != "c" || item.Distance != 2 {
		t.Errorf("应该弹出c，实际: %s", item.ID)
	}
}

func TestMaxHeap(t *testing.T) {
	heap := NewMaxHeap(3)
	
	heap.Push(&HeapItem{ID: "a", Distance: 1})
	heap.Push(&HeapItem{ID: "b", Distance: 3})
	heap.Push(&HeapItem{ID: "c", Distance: 2})
	
	if !heap.IsFull() {
		t.Error("堆应该已满")
	}
	
	// 最大值应该先出
	item := heap.Pop()
	if item.ID != "b" || item.Distance != 3 {
		t.Errorf("应该先弹出b，实际: %s", item.ID)
	}
}

// =========================================
// HNSW 核心功能测试
// =========================================

func TestHNSWInsertAndSearch(t *testing.T) {
	// 创建数据集
	collection := NewCollection("test", 128)
	modelName := "test-model"
	collection.InitLevelMap(modelName)
	
	// 生成随机向量
	rand.Seed(time.Now().UnixNano())
	numItems := 5000 // 增加到 5000 条
	dimension := 128
	
	items := make([]*Item, numItems)
	for i := 0; i < numItems; i++ {
		item := NewItem(fmt.Sprintf("item-%d", i))
		item.Meta = map[string]interface{}{
			"index": i,
		}
		
		// 生成随机向量
		vec := make([]float32, dimension)
		for j := 0; j < dimension; j++ {
			vec[j] = rand.Float32()*2 - 1 // [-1, 1]
		}
		NormalizeVector(vec)
		item.SetVector(modelName, vec)
		
		items[i] = item
	}
	
	// 插入所有数据项
	t.Log("开始插入数据...")
	startInsert := time.Now()
	for _, item := range items {
		err := collection.InsertItem(item, modelName)
		if err != nil {
			t.Fatalf("插入失败: %v", err)
		}
	}
	insertDuration := time.Since(startInsert)
	t.Logf("插入 %d 条数据耗时: %v (%.2f 条/秒)", numItems, insertDuration, float64(numItems)/insertDuration.Seconds())
	
	// 验证数量
	if collection.ItemCount() != numItems {
		t.Errorf("数据项数量应为 %d，实际: %d", numItems, collection.ItemCount())
	}
	
	// 搜索测试
	t.Log("开始搜索测试...")
	queryVec := make([]float32, dimension)
	for j := 0; j < dimension; j++ {
		queryVec[j] = rand.Float32()*2 - 1
	}
	NormalizeVector(queryVec)
	
	k := 10
	startSearch := time.Now()
	results := collection.Search(queryVec, modelName, k, 100)
	searchDuration := time.Since(startSearch)
	t.Logf("搜索 Top-%d 耗时: %v", k, searchDuration)
	
	if len(results) == 0 {
		t.Error("搜索结果不应为空")
	}
	
	if len(results) > k {
		t.Errorf("搜索结果数量不应超过 %d，实际: %d", k, len(results))
	}
	
	// 验证结果按分数降序排列
	for i := 1; i < len(results); i++ {
		if results[i].Score > results[i-1].Score {
			t.Errorf("结果应按分数降序排列，位置 %d 分数 %.4f > 位置 %d 分数 %.4f",
				i, results[i].Score, i-1, results[i-1].Score)
		}
	}
	
	t.Logf("Top-3 结果:")
	for i := 0; i < min(3, len(results)); i++ {
		t.Logf("  %d. ID=%s, Score=%.4f, Distance=%.4f", i+1, results[i].ID, results[i].Score, results[i].Distance)
	}
}

func TestHNSWDelete(t *testing.T) {
	collection := NewCollection("test", 64)
	modelName := "test-model"
	collection.InitLevelMap(modelName)
	
	// 插入一些数据
	for i := 0; i < 20; i++ {
		item := NewItem(fmt.Sprintf("item-%d", i))
		vec := make([]float32, 64)
		for j := 0; j < 64; j++ {
			vec[j] = rand.Float32()
		}
		NormalizeVector(vec)
		item.SetVector(modelName, vec)
		collection.InsertItem(item, modelName)
	}
	
	initialCount := collection.ItemCount()
	t.Logf("初始数量: %d", initialCount)
	
	// 删除一个节点
	affectedNeighbors := collection.DeleteItemWithIndex("item-5", modelName)
	t.Logf("删除 item-5，受影响邻居数: %d", len(affectedNeighbors))
	
	// 验证删除
	if _, ok := collection.GetItem("item-5"); ok {
		t.Error("item-5 应该已被删除")
	}
	
	if collection.ItemCount() != initialCount-1 {
		t.Errorf("删除后数量应为 %d，实际: %d", initialCount-1, collection.ItemCount())
	}
	
	// 验证搜索仍然正常
	queryVec := make([]float32, 64)
	for j := 0; j < 64; j++ {
		queryVec[j] = rand.Float32()
	}
	results := collection.Search(queryVec, modelName, 5, 50)
	
	for _, r := range results {
		if r.ID == "item-5" {
			t.Error("搜索结果不应包含已删除的 item-5")
		}
	}
}

func TestHNSWRecall(t *testing.T) {
	// 召回率测试 - 使用多次查询取平均值
	collection := NewCollection("test", 64)
	modelName := "test-model"
	collection.InitLevelMap(modelName)
	
	dimension := 64
	numItems := 10000
	
	// 生成数据
	t.Logf("生成 %d 条数据...", numItems)
	items := make([]*Item, numItems)
	vectors := make([][]float32, numItems)
	rand.Seed(42) // 固定种子保证可重现
	for i := 0; i < numItems; i++ {
		item := NewItem(fmt.Sprintf("item-%d", i))
		vec := make([]float32, dimension)
		for j := 0; j < dimension; j++ {
			vec[j] = rand.Float32()*2 - 1
		}
		NormalizeVector(vec)
		item.SetVector(modelName, vec)
		items[i] = item
		vectors[i] = vec
		collection.InsertItem(item, modelName)
	}
	t.Logf("数据插入完成")
	
	// 多次查询测试
	numQueries := 100
	k := 10
	totalRecall := 0.0
	
	t.Logf("执行 %d 次查询...", numQueries)
	for q := 0; q < numQueries; q++ {
		// 生成查询向量
		queryVec := make([]float32, dimension)
		for j := 0; j < dimension; j++ {
			queryVec[j] = rand.Float32()*2 - 1
		}
		NormalizeVector(queryVec)
		
		// 暴力搜索获取真实 Top-K
		type distItem struct {
			id   string
			dist float32
		}
		bruteForce := make([]distItem, numItems)
		for i := 0; i < numItems; i++ {
			bruteForce[i] = distItem{
				id:   items[i].ID,
				dist: CosineDistance(queryVec, vectors[i]),
			}
		}
		// 排序
		sort.Slice(bruteForce, func(i, j int) bool {
			return bruteForce[i].dist < bruteForce[j].dist
		})
		
		trueTopK := make(map[string]bool)
		for i := 0; i < k; i++ {
			trueTopK[bruteForce[i].id] = true
		}
		
		// HNSW 搜索
		results := collection.Search(queryVec, modelName, k, 200)
		
		// 计算召回率
		hits := 0
		for _, r := range results {
			if trueTopK[r.ID] {
				hits++
			}
		}
		recall := float64(hits) / float64(k)
		totalRecall += recall
	}
	
	avgRecall := totalRecall / float64(numQueries) * 100
	t.Logf("平均召回率: %.1f%% (%d 次查询)", avgRecall, numQueries)
	
	if avgRecall < 80 {
		t.Errorf("平均召回率过低: %.1f%%，期望 >= 80%%", avgRecall)
	}
}

// =========================================
// 性能基准测试
// =========================================

func BenchmarkHNSWInsert(b *testing.B) {
	collection := NewCollection("bench", 128)
	modelName := "bench-model"
	collection.InitLevelMap(modelName)
	
	// 预先生成数据
	items := make([]*Item, b.N)
	for i := 0; i < b.N; i++ {
		item := NewItem(fmt.Sprintf("item-%d", i))
		vec := make([]float32, 128)
		for j := 0; j < 128; j++ {
			vec[j] = rand.Float32()
		}
		item.SetVector(modelName, vec)
		items[i] = item
	}
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		collection.InsertItem(items[i], modelName)
	}
}

func BenchmarkHNSWSearch(b *testing.B) {
	collection := NewCollection("bench", 128)
	modelName := "bench-model"
	collection.InitLevelMap(modelName)
	
	// 插入 1000 条数据
	for i := 0; i < 1000; i++ {
		item := NewItem(fmt.Sprintf("item-%d", i))
		vec := make([]float32, 128)
		for j := 0; j < 128; j++ {
			vec[j] = rand.Float32()
		}
		item.SetVector(modelName, vec)
		collection.InsertItem(item, modelName)
	}
	
	// 生成查询向量
	queryVec := make([]float32, 128)
	for j := 0; j < 128; j++ {
		queryVec[j] = rand.Float32()
	}
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		collection.Search(queryVec, modelName, 10, 100)
	}
}

// =========================================
// 持久化测试
// =========================================

func TestPersistence(t *testing.T) {
	// 创建临时目录
	tmpDir, err := os.MkdirTemp("", "vectordb-test-")
	if err != nil {
		t.Fatalf("创建临时目录失败: %v", err)
	}
	defer os.RemoveAll(tmpDir)
	
	modelName := "test-model"
	
	// 1. 创建数据集并插入数据
	collection := NewCollection("test-collection", 64)
	collection.InitLevelMap(modelName)
	
	for i := 0; i < 100; i++ {
		item := NewItem(fmt.Sprintf("item-%d", i))
		item.Meta = map[string]interface{}{
			"index": i,
			"name":  fmt.Sprintf("Item %d", i),
		}
		vec := make([]float32, 64)
		for j := 0; j < 64; j++ {
			vec[j] = rand.Float32()
		}
		NormalizeVector(vec)
		item.SetVector(modelName, vec)
		collection.InsertItem(item, modelName)
	}
	
	// 2. 保存到磁盘
	t.Log("保存数据集...")
	if err := SaveCollection(collection, tmpDir); err != nil {
		t.Fatalf("保存数据集失败: %v", err)
	}
	
	// 验证文件存在
	metaPath := filepath.Join(tmpDir, "test-collection", "meta.msgpack")
	if _, err := os.Stat(metaPath); os.IsNotExist(err) {
		t.Error("元数据文件不存在")
	}
	
	// 3. 从磁盘加载
	t.Log("加载数据集...")
	loadedCollection, err := LoadCollection(tmpDir, "test-collection")
	if err != nil {
		t.Fatalf("加载数据集失败: %v", err)
	}
	
	// 4. 验证加载结果
	if loadedCollection.Name != collection.Name {
		t.Errorf("名称不匹配: %s vs %s", loadedCollection.Name, collection.Name)
	}
	
	if loadedCollection.ItemCount() != collection.ItemCount() {
		t.Errorf("数据项数量不匹配: %d vs %d", loadedCollection.ItemCount(), collection.ItemCount())
	}
	
	// 验证数据项内容
	loadedItem, ok := loadedCollection.GetItem("item-50")
	if !ok {
		t.Error("item-50 不存在")
	} else {
		// msgpack 反序列化后整数可能变为不同类型
		indexVal := loadedItem.Meta["index"]
		var indexInt int
		switch v := indexVal.(type) {
		case int:
			indexInt = v
		case int8:
			indexInt = int(v)
		case int16:
			indexInt = int(v)
		case int32:
			indexInt = int(v)
		case int64:
			indexInt = int(v)
		case uint8:
			indexInt = int(v)
		case float64:
			indexInt = int(v)
		default:
			t.Errorf("元数据类型不匹配: %T", indexVal)
		}
		if indexInt != 50 {
			t.Errorf("元数据值不匹配: %v", loadedItem.Meta)
		}
		
		vec, ok := loadedItem.GetVector(modelName)
		if !ok {
			t.Error("向量不存在")
		} else if len(vec) != 64 {
			t.Errorf("向量维度不匹配: %d", len(vec))
		}
	}
	
	t.Logf("持久化测试通过: 保存 %d 条，加载 %d 条", 
		collection.ItemCount(), loadedCollection.ItemCount())
}
