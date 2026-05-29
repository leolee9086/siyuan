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
	"encoding/json"
	"fmt"
	"math"
	"math/rand"
	"os"
	"path/filepath"
	"sort"
	"sync"
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
// HNSW 核心功能测试 (通过 Collection 代理层)
// =========================================

func TestHNSWInsertAndSearch(t *testing.T) {
	collection := NewCollection("test", 128)

	rand.Seed(time.Now().UnixNano())
	numItems := 5000
	dimension := 128

	points := make([]Point, numItems)
	for i := 0; i < numItems; i++ {
		vec := make([]float32, dimension)
		for j := 0; j < dimension; j++ {
			vec[j] = rand.Float32()*2 - 1
		}
		NormalizeVector(vec)

		meta := map[string]interface{}{
			"index": i,
		}
		metaBytes, _ := json.Marshal(meta)

		points[i] = Point{
			ID:     fmt.Sprintf("item-%d", i),
			Vector: vec,
			Meta:   metaBytes,
		}
	}

	// 插入所有数据项
	t.Log("开始插入数据...")
	startInsert := time.Now()
	for _, p := range points {
		err := collection.InsertPoint(p)
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
	results := collection.Search(queryVec, k, 100)
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

	// 插入一些数据
	for i := 0; i < 20; i++ {
		vec := make([]float32, 64)
		for j := 0; j < 64; j++ {
			vec[j] = rand.Float32()
		}
		NormalizeVector(vec)

		collection.InsertPoint(Point{
			ID:     fmt.Sprintf("item-%d", i),
			Vector: vec,
		})
	}

	initialCount := collection.ItemCount()
	t.Logf("初始数量: %d", initialCount)

	// 删除一个节点
	collection.DeleteItemWithIndex("item-5")
	t.Logf("删除 item-5")

	// 验证删除
	if _, ok := collection.GetDocID("item-5"); ok {
		t.Error("item-5 应该已被从IDMap移除")
	}

	if collection.ItemCount() != initialCount-1 {
		t.Errorf("删除后数量应为 %d，实际: %d", initialCount-1, collection.ItemCount())
	}

	// 验证搜索仍然正常
	queryVec := make([]float32, 64)
	for j := 0; j < 64; j++ {
		queryVec[j] = rand.Float32()
	}
	results := collection.Search(queryVec, 5, 50)

	for _, r := range results {
		if r.ID == "item-5" {
			t.Error("搜索结果不应包含已删除的 item-5")
		}
	}
}

func TestHNSWRecall(t *testing.T) {
	collection := NewCollection("test", 64)

	dimension := 64
	numItems := 10000

	t.Logf("生成 %d 条数据...", numItems)

	vectors := make([][]float32, numItems)
	rand.Seed(42)
	for i := 0; i < numItems; i++ {
		vec := make([]float32, dimension)
		for j := 0; j < dimension; j++ {
			vec[j] = rand.Float32()*2 - 1
		}
		NormalizeVector(vec)

		collection.InsertPoint(Point{
			ID:     fmt.Sprintf("item-%d", i),
			Vector: vec,
		})
		vectors[i] = vec
	}
	t.Logf("数据插入完成")

	// 多次查询测试
	numQueries := 100
	k := 10
	totalRecall := 0.0

	t.Logf("执行 %d 次查询...", numQueries)
	for q := 0; q < numQueries; q++ {
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
				id:   fmt.Sprintf("item-%d", i),
				dist: CosineDistance(queryVec, vectors[i]),
			}
		}
		sort.Slice(bruteForce, func(i, j int) bool {
			return bruteForce[i].dist < bruteForce[j].dist
		})

		trueTopK := make(map[string]bool)
		for i := 0; i < k; i++ {
			trueTopK[bruteForce[i].id] = true
		}

		// HNSW 搜索
		results := collection.Search(queryVec, k, 300)

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

	if avgRecall < 95.0 {
		t.Errorf("平均召回率过低: %.1f%%，期望 >= 95.0%%", avgRecall)
	}
}

// =========================================
// 持久化测试
// =========================================

func TestPersistence(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "vectordb-test-")
	if err != nil {
		t.Fatalf("创建临时目录失败: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// 1. 创建数据集并插入数据
	collection := NewCollection("test-collection", 64)

	for i := 0; i < 100; i++ {
		meta := map[string]interface{}{
			"index": i,
			"name":  fmt.Sprintf("Item %d", i),
		}
		metaBytes, _ := json.Marshal(meta)

		vec := make([]float32, 64)
		for j := 0; j < 64; j++ {
			vec[j] = rand.Float32()
		}
		NormalizeVector(vec)

		collection.InsertPoint(Point{
			ID:     fmt.Sprintf("item-%d", i),
			Vector: vec,
			Meta:   metaBytes,
		})
	}

	// 2. 保存到磁盘
	t.Log("保存数据集...")
	if err := SaveCollection(collection, tmpDir); err != nil {
		t.Fatalf("保存数据集失败: %v", err)
	}

	metaPath := filepath.Join(tmpDir, "test-collection", "snapshot.msgpack")
	if _, err := os.Stat(metaPath); os.IsNotExist(err) {
		t.Error("快照文件不存在")
	}

	// 3. 从磁盘加载
	t.Log("加载数据集...")
	loadedCollection, err := LoadCollection(tmpDir, "test-collection")
	if err != nil {
		t.Fatalf("加载数据集失败: %v", err)
	}

	// 4. 验证加载结果
	if loadedCollection.ColName != collection.ColName {
		t.Errorf("名称不匹配: %s vs %s", loadedCollection.ColName, collection.ColName)
	}

	if loadedCollection.ItemCount() != collection.ItemCount() {
		t.Errorf("数据项数量不匹配: %d vs %d", loadedCollection.ItemCount(), collection.ItemCount())
	}

	// 验证数据项内容
	docID, ok := loadedCollection.GetDocID("item-50")
	if !ok {
		t.Error("item-50 不存在")
	} else {
		metaBytes, ok := loadedCollection.GetMeta(docID)
		if !ok {
			t.Error("元数据不存在")
		} else {
			var meta map[string]interface{}
			json.Unmarshal(metaBytes, &meta)

			indexVal := meta["index"]
			var indexInt int
			switch v := indexVal.(type) {
			case float64:
				indexInt = int(v)
			case int:
				indexInt = v
			default:
			}
			if float64(indexInt) != 50.0 && meta["index"] != 50.0 {
				t.Errorf("元数据值不匹配: %v", meta)
			}
		}
	}

	// 5. 验证持久化后搜索仍正常
	t.Log("验证持久化后的召回率...")
	item50ID, _ := loadedCollection.GetDocID("item-50")
	item50Vec, _ := loadedCollection.Store.Get(item50ID)

	if item50Vec != nil {
		results := loadedCollection.Search(item50Vec, 10, 100)
		found := false
		for _, r := range results {
			if r.ID == "item-50" {
				found = true
				if r.Distance > 1e-4 {
					t.Errorf("自身搜索距离应接近0，实际: %f", r.Distance)
				}
				break
			}
		}
		if !found {
			t.Error("持久化后未能搜索到已存在的项目 item-50")
		}
	} else {
		t.Error("无法获取 item-50 的向量")
	}

	t.Logf("持久化测试通过: 保存 %d 条，加载 %d 条",
		collection.ItemCount(), loadedCollection.ItemCount())
}

// =========================================
// 鲁棒性与并发测试
// =========================================

func TestHNSWRobustness(t *testing.T) {
	collection := NewCollection("robust-test", 64)

	// 1. 边缘情况：空集合搜索
	t.Log("测试空集合搜索...")
	zeroVec := make([]float32, 64)
	res := collection.Search(zeroVec, 10, 50)
	if len(res) != 0 {
		t.Error("空集合搜索应该返回空结果")
	}

	// 2. 边缘情况：插入零向量
	t.Log("测试插入零向量...")
	err := collection.InsertPoint(Point{
		ID:     "zero-vec",
		Vector: zeroVec,
	})
	if err != nil {
		t.Errorf("插入零向量失败: %v", err)
	}

	// 3. 并发测试
	t.Log("测试高并发读写...")
	var wg sync.WaitGroup
	numWorkers := 10
	numOps := 100

	// 并发插入
	for w := 0; w < numWorkers; w++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			for i := 0; i < numOps; i++ {
				id := fmt.Sprintf("w%d-i%d", workerID, i)
				vec := make([]float32, 64)
				for j := 0; j < 64; j++ {
					vec[j] = rand.Float32()
				}
				NormalizeVector(vec)

				collection.InsertPoint(Point{
					ID:     id,
					Vector: vec,
				})
			}
		}(w)
	}

	// 并发搜索
	for w := 0; w < numWorkers; w++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			for i := 0; i < numOps; i++ {
				query := make([]float32, 64)
				for j := 0; j < 64; j++ {
					query[j] = rand.Float32()
				}
				collection.Search(query, 10, 50)
			}
		}(w)
	}

	wg.Wait()

	expectedCount := 1 + numWorkers*numOps // 1 (zero-vec) + 10*100
	if collection.ItemCount() != expectedCount {
		t.Errorf("并发插入后数量不匹配，期望 %d，实际 %d", expectedCount, collection.ItemCount())
	}
	t.Logf("并发测试通过，最终数量: %d", collection.ItemCount())
}

// =========================================
// 大规模更新与元数据测试
// =========================================

func TestHNSWHeavyUpdates(t *testing.T) {
	collection := NewCollection("heavy-updates", 64)
	numItems := 1000

	// 1. 初始插入
	t.Logf("初始插入 %d 条数据...", numItems)
	for i := 0; i < numItems; i++ {
		vec := make([]float32, 64)
		for j := 0; j < 64; j++ {
			vec[j] = rand.Float32()
		}
		NormalizeVector(vec)
		collection.InsertPoint(Point{
			ID:     fmt.Sprintf("item-%d", i),
			Vector: vec,
		})
	}

	if collection.ItemCount() != numItems {
		t.Errorf("初始数量错误: %d", collection.ItemCount())
	}

	// 2. 删除一半数据
	t.Log("删除一半数据(偶数ID)...")
	for i := 0; i < numItems; i += 2 {
		collection.DeleteItemWithIndex(fmt.Sprintf("item-%d", i))
	}

	expectedCount := numItems / 2
	if collection.ItemCount() != expectedCount {
		t.Errorf("删除后数量错误: %d，期望 %d", collection.ItemCount(), expectedCount)
	}

	// 3. 重新插入被删除的数据 (使用新向量)
	t.Log("重新插入被删除的数据...")
	for i := 0; i < numItems; i += 2 {
		vec := make([]float32, 64)
		for j := 0; j < 64; j++ {
			vec[j] = rand.Float32()
		}
		NormalizeVector(vec)
		collection.InsertPoint(Point{
			ID:     fmt.Sprintf("item-%d", i),
			Vector: vec,
		})
	}

	if collection.ItemCount() != numItems {
		t.Errorf("重新插入后数量错误: %d", collection.ItemCount())
	}

	// 4. 反复更新同一ID
	t.Log("频繁更新同一ID...")
	targetID := "hot-item"
	for k := 0; k < 100; k++ {
		vec := make([]float32, 64)
		for j := 0; j < 64; j++ {
			vec[j] = rand.Float32()
		}
		NormalizeVector(vec)
		err := collection.InsertPoint(Point{
			ID:     targetID,
			Vector: vec,
		})
		if err != nil {
			t.Errorf("更新失败: %v", err)
		}
	}

	if _, ok := collection.GetDocID(targetID); !ok {
		t.Error("热点项目最终应该存在")
	}

	// 简单搜索验证图结构未损坏
	query := make([]float32, 64)
	NormalizeVector(query)
	results := collection.Search(query, 10, 50)
	if len(results) == 0 {
		t.Error("频繁更新后搜索失败")
	}

	t.Log("重负载更新测试通过")
}

func TestMetadataConsistency(t *testing.T) {
	collection := NewCollection("meta-test", 64)

	// 1. 插入带元数据的项目
	meta := map[string]interface{}{
		"tags":  []string{"a", "b"},
		"score": 99.5,
		"info": map[string]string{
			"author": "tester",
		},
	}
	metaBytes, _ := json.Marshal(meta)

	vec := make([]float32, 64)
	NormalizeVector(vec)

	err := collection.InsertPoint(Point{
		ID:     "meta-item",
		Vector: vec,
		Meta:   metaBytes,
	})
	if err != nil {
		t.Fatalf("插入失败: %v", err)
	}

	// 2. 验证元数据读取
	docID, _ := collection.GetDocID("meta-item")
	readMetaBytes, ok := collection.GetMeta(docID)
	if !ok {
		t.Fatal("元数据读取失败")
	}

	var readMeta map[string]interface{}
	if err := json.Unmarshal(readMetaBytes, &readMeta); err != nil {
		t.Fatalf("元数据解析失败: %v", err)
	}

	if info, ok := readMeta["info"].(map[string]interface{}); !ok || info["author"] != "tester" {
		t.Errorf("元数据内容不匹配: %v", readMeta)
	}

	// 3. 更新元数据 (通过重新插入)
	newMeta := map[string]interface{}{
		"updated": true,
	}
	newMetaBytes, _ := json.Marshal(newMeta)

	collection.InsertPoint(Point{
		ID:     "meta-item",
		Vector: vec,
		Meta:   newMetaBytes,
	})

	docID, _ = collection.GetDocID("meta-item")
	readMetaBytes, _ = collection.GetMeta(docID)

	var updatedMeta map[string]interface{}
	json.Unmarshal(readMetaBytes, &updatedMeta)

	if val, ok := updatedMeta["updated"].(bool); !ok || !val {
		t.Error("元数据更新未能生效")
	}
	if _, ok := updatedMeta["tags"]; ok {
		t.Error("旧元数据字段应该消失")
	}

	t.Log("元数据一致性测试通过")
}

// TestUpdateVectorStaleGraphEdges 验证修复后 InsertPoint 更新向量时图边正确重建。
//
// 修复前 (Bug): InsertPoint 遇已有 ID 跳过 HNSW Insert → 向量变了图边卡在旧位置
//    → 搜索新位置时召回率暴跌（~22% vs 100%）
//
// 修复后: InsertPoint 遇已有 ID 先 Delete（清理旧边）再 Insert（重建新边）
//    → 两个索引召回率应接近
//
// 对比方案：两个大小相同的集合，插入相同基线数据。
//   - 集合 Fresh: 直接插入 vecB（正确的图边）
//   - 集合 Updated: 先插入 vecA 再更新为 vecB（Delete+Insert 模式）
func TestUpdateVectorStaleGraphEdges(t *testing.T) {
	dim := 64
	baseSize := 5000
	numTargets := 50
	efSearch := 50

	baselines := make([][]float32, baseSize)
	for i := 0; i < baseSize; i++ {
		v := make([]float32, dim)
		for j := 0; j < dim; j++ {
			v[j] = rand.Float32()*2 - 1
		}
		NormalizeVector(v)
		baselines[i] = v
	}

	vecsA := make([][]float32, numTargets)
	vecsB := make([][]float32, numTargets)
	for t := 0; t < numTargets; t++ {
		for {
			a := make([]float32, dim)
			b := make([]float32, dim)
			for j := 0; j < dim; j++ {
				a[j] = rand.Float32()*2 - 1
				b[j] = rand.Float32()*2 - 1
			}
			NormalizeVector(a)
			NormalizeVector(b)
			if CosineDistance(a, b) >= 0.8 {
				vecsA[t] = a
				vecsB[t] = b
				break
			}
		}
	}

	fresh := NewCollection("fresh", dim)
	updated := NewCollection("updated", dim)

	for i, v := range baselines {
		fresh.InsertPoint(Point{ID: fmt.Sprintf("base-%d", i), Vector: v})
		updated.InsertPoint(Point{ID: fmt.Sprintf("base-%d", i), Vector: v})
	}

	for t := 0; t < numTargets; t++ {
		fresh.InsertPoint(Point{ID: fmt.Sprintf("target-%d", t), Vector: vecsB[t]})
	}
	for t := 0; t < numTargets; t++ {
		updated.InsertPoint(Point{ID: fmt.Sprintf("target-%d", t), Vector: vecsA[t]})
	}
	for t := 0; t < numTargets; t++ {
		updated.InsertPoint(Point{ID: fmt.Sprintf("target-%d", t), Vector: vecsB[t]})
	}

	freshHits := 0
	updatedHits := 0
	for t := 0; t < numTargets; t++ {
		targetID := fmt.Sprintf("target-%d", t)
		rF := fresh.Search(vecsB[t], 10, efSearch)
		rU := updated.Search(vecsB[t], 10, efSearch)
		if _, ok := findResultRank(rF, targetID); ok {
			freshHits++
		}
		if _, ok := findResultRank(rU, targetID); ok {
			updatedHits++
		}
	}

	freshRate := float64(freshHits) / float64(numTargets) * 100
	updatedRate := float64(updatedHits) / float64(numTargets) * 100
	t.Logf("Fresh  索引: %d/%d = %.1f%%", freshHits, numTargets, freshRate)
	t.Logf("Updated索引: %d/%d = %.1f%%", updatedHits, numTargets, updatedRate)

	if updatedRate < freshRate*0.8 {
		t.Errorf("修复未生效: Updated 召回率 %.1f%% 仍明显低于 Fresh %.1f%%", updatedRate, freshRate)
	} else {
		t.Logf("OK: 修复后两个索引召回率接近")
	}

	// 额外验证：Updated 节点用旧向量 vecA 不应再被召回
	staleHits := 0
	for t := 0; t < numTargets; t++ {
		targetID := fmt.Sprintf("target-%d", t)
		r := updated.Search(vecsA[t], 10, efSearch)
		if _, ok := findResultRank(r, targetID); ok {
			staleHits++
		}
	}
	if staleHits > 0 {
		t.Logf("   旧向量仍召回 %d/%d 个 target（图删除不彻底）", staleHits, numTargets)
	}
}

// findResultRank 在搜索结果中查找指定 ID，返回序号和是否找到
func findResultRank(results []SearchResult, id string) (rank int, found bool) {
	for i, r := range results {
		if r.ID == id {
			return i + 1, true
		}
	}
	return -1, false
}
