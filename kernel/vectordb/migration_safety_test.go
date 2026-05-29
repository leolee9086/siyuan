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

	"github.com/siyuan-note/siyuan/kernel/vectordb/storage"
	"github.com/siyuan-note/siyuan/kernel/vectordb/vamana"
)

// ============================================================================
// 迁移护航测试
//
// 这些测试的目的是建立回归基线，确保引擎整合迁移过程中：
// 1. HNSW / Vamana / DiskVamana 对同一数据的搜索结果相互等价
// 2. 持久化→加载→搜索的一致性
// 3. 增量操作后搜索不变性
// 4. 现有 HNSW 测试不受影响
// ============================================================================

// ── 测试初始化 ──────────────────────────────────────────────────────────────

func init() {
	// 为 DiskVamana 设置平台 mmap reader
	vamana.SetOpenDiskIndexReader(storage.OpenReader)
}

// ── 测试配置 ────────────────────────────────────────────────────────────────

const (
	migrationDim      = 64   // 向量维度（低维避免 BBQ 影响，聚焦算法等价性）
	migrationNumItems = 2000 // 插入数量
	migrationNumQuery = 20   // 查询数量
	migrationK        = 10   // Top-K
	migrationEfSearch = 100  // 搜索宽度
)

// ── 辅助函数 ────────────────────────────────────────────────────────────────

// generateTestVectors 生成归一化的随机测试向量集
func generateTestVectors(n, dim int, seed int64) [][]float32 {
	rng := rand.New(rand.NewSource(seed))
	vecs := make([][]float32, n)
	for i := range vecs {
		v := make([]float32, dim)
		for j := range v {
			v[j] = rng.Float32()*2 - 1
		}
		NormalizeVector(v)
		vecs[i] = v
	}
	return vecs
}

// generateTestQueries 生成查询向量集
func generateTestQueries(n, dim int, seed int64) [][]float32 {
	return generateTestVectors(n, dim, seed)
}

// fillBFStore 用测试向量填充 VectorStore 并返回 BF 基线搜索结果
func buildBFResults(vecs [][]float32) func(query []float32, k int) []searchHit {
	n := len(vecs)
	dim := len(vecs[0])
	store := NewVectorStore(dim)
	for i, v := range vecs {
		store.Set(DocID(i), v)
	}

	return func(query []float32, k int) []searchHit {
		type item struct {
			id   DocID
			dist float32
		}
		items := make([]item, 0, n)
		for docID := DocID(0); docID < DocID(n); docID++ {
			vec, ok := store.GetUnsafe(docID)
			if !ok {
				continue
			}
			d := CosineDistance(query, vec)
			items = append(items, item{id: docID, dist: d})
		}
		sort.Slice(items, func(i, j int) bool { return items[i].dist < items[j].dist })
		if len(items) > k {
			items = items[:k]
		}
		hits := make([]searchHit, len(items))
		for i, it := range items {
			hits[i] = searchHit{id: fmt.Sprintf("bf-%d", it.id), dist: it.dist}
		}
		return hits
	}
}

type searchHit struct {
	id   string
	dist float32
}

// computeRecall 计算引擎结果相对于 BF 基线的召回率
func computeRecall(results []searchHit, baseline map[string]bool) float64 {
	if len(baseline) == 0 {
		return 0
	}
	hits := 0
	for _, r := range results {
		if baseline[r.id] {
			hits++
		}
	}
	return float64(hits) / float64(len(baseline))
}

func makeBaselineSet(hits []searchHit) map[string]bool {
	s := make(map[string]bool, len(hits))
	for _, h := range hits {
		s[h.id] = true
	}
	return s
}

func collectionInsertVectors(col *Collection, vecs [][]float32) {
	for i, v := range vecs {
		_ = col.InsertPoint(Point{
			ID:     fmt.Sprintf("item-%d", i),
			Vector: v,
		})
	}
}

// ============================================================================
// Test 1: BruteForce 基线自洽
// ============================================================================

func TestBruteForceBaseline(t *testing.T) {
	dim := migrationDim
	numItems := 500
	vecs := generateTestVectors(numItems, dim, 42)
	bf := buildBFResults(vecs)

	hits := bf(vecs[0], 10)
	if len(hits) == 0 || hits[0].dist > 0.001 {
		t.Errorf("自身搜索距离应为 0，实际 top1 距离: %.6f", hits[0].dist)
	}
	for i := 1; i < len(hits); i++ {
		if hits[i].dist < hits[i-1].dist-0.0001 {
			t.Errorf("结果应按距离升序: pos %d(%.4f) < pos %d(%.4f)", i, hits[i].dist, i-1, hits[i-1].dist)
		}
	}
	t.Logf("BF 基线: %d items, top1 distance=%.6f", numItems, hits[0].dist)
}

// ============================================================================
// Test 2: HNSW vs BF 召回率（回归保护）
// ============================================================================

func TestHNSWRecallBaseline(t *testing.T) {
	dim := migrationDim
	numItems := migrationNumItems
	vecs := generateTestVectors(numItems, dim, 42)
	queries := generateTestQueries(migrationNumQuery, dim, 99)
	bf := buildBFResults(vecs)

	col := NewCollection("hnsw-recall", dim)
	collectionInsertVectors(col, vecs)

	var totalRecall float64
	for qi, q := range queries {
		bfHits := bf(q, migrationK)
		bfSet := makeBaselineSet(bfHits)

		colResults := col.Search(q, migrationK, migrationEfSearch)
		mapped := make([]searchHit, len(colResults))
		for i, r := range colResults {
			docID, ok := col.GetDocID(r.ID)
			if !ok {
				t.Fatalf("结果 ID %s 不在 IDMap", r.ID)
			}
			mapped[i] = searchHit{id: fmt.Sprintf("bf-%d", docID), dist: r.Distance}
		}
		recall := computeRecall(mapped, bfSet)
		totalRecall += recall
		if recall < 0.85 {
			t.Logf("[WARN] HNSW 查询 %d 召回率偏低: %.1f%%", qi, recall*100)
		}
	}
	avg := totalRecall / float64(len(queries)) * 100
	t.Logf("HNSW 平均召回率: %.1f%% (%d queries x %d items)", avg, len(queries), numItems)
	if avg < 90.0 {
		t.Errorf("HNSW 平均召回率过低: %.1f%%, 期望 >= 90%%", avg)
	}
}

// ============================================================================
// Test 3: Vamana 内存索引 vs BF
// ============================================================================

func TestVamanaRecall(t *testing.T) {
	dim := migrationDim
	numItems := migrationNumItems
	vecs := generateTestVectors(numItems, dim, 42)
	queries := generateTestQueries(migrationNumQuery, dim, 99)
	bf := buildBFResults(vecs)

	cfg := vamana.DefaultConfig()
	cfg.R = 32
	cfg.L = 100
	cfg.Alpha = 1.2
	idx := vamana.New(dim, cfg)
	idx.Build(vecs)

	var totalRecall float64
	for qi, q := range queries {
		bfHits := bf(q, migrationK)
		bfSet := makeBaselineSet(bfHits)

		vResults, err := idx.Search(q, migrationK, migrationEfSearch)
		if err != nil {
			t.Fatalf("Vamana Search: %v", err)
		}
		mapped := make([]searchHit, len(vResults))
		for i, r := range vResults {
			mapped[i] = searchHit{id: fmt.Sprintf("bf-%d", r.ID), dist: r.Distance}
		}
		recall := computeRecall(mapped, bfSet)
		totalRecall += recall
		if recall < 0.85 {
			t.Logf("[WARN] Vamana 查询 %d 召回率偏低: %.1f%%", qi, recall*100)
		}
	}
	avg := totalRecall / float64(len(queries)) * 100
	t.Logf("Vamana(内存) 平均召回率: %.1f%% (R=%d)", avg, cfg.R)
	if avg < 90.0 {
		t.Errorf("Vamana 平均召回率过低: %.1f%%, 期望 >= 90%%", avg)
	}
}

// ============================================================================
// Test 4: DiskVamana vs BF
// ============================================================================

func TestDiskVamanaRecall(t *testing.T) {
	dim := migrationDim
	numItems := migrationNumItems
	vecs := generateTestVectors(numItems, dim, 42)
	queries := generateTestQueries(migrationNumQuery, dim, 99)
	bf := buildBFResults(vecs)

	tmpDir, err := os.MkdirTemp("", "diskvamana-recall-")
	if err != nil {
		t.Fatalf("temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	basePath := filepath.Join(tmpDir, "test-index")
	buildCfg := vamana.DefaultDiskBuildConfig()
	buildCfg.R = 32
	buildCfg.L = 100
	buildCfg.Alpha = 1.2
	buildCfg.EnableBBQ = false
	buildCfg.NumWorkers = 2

	result, err := vamana.BuildFromVectors(basePath, vecs, buildCfg)
	if err != nil {
		t.Fatalf("DiskVamana Build: %v", err)
	}
	t.Logf("DiskVamana 构建: %d 点, dim=%d, medoid=%d", result.NumPoints, result.Dimension, result.Medoid)

	idx, err := vamana.Open(basePath)
	if err != nil {
		t.Fatalf("DiskVamana Open: %v", err)
	}
	defer idx.Close()

	var totalRecall float64
	for qi, q := range queries {
		bfHits := bf(q, migrationK)
		bfSet := makeBaselineSet(bfHits)

		dResults, err := idx.Search(q, migrationK, migrationEfSearch)
		if err != nil {
			t.Fatalf("DiskVamana Search: %v", err)
		}
		mapped := make([]searchHit, len(dResults))
		for i, r := range dResults {
			mapped[i] = searchHit{id: fmt.Sprintf("bf-%d", r.ID), dist: r.Distance}
		}
		recall := computeRecall(mapped, bfSet)
		totalRecall += recall
		if recall < 0.85 {
			t.Logf("[WARN] DiskVamana 查询 %d 召回率偏低: %.1f%%", qi, recall*100)
		}
	}
	avg := totalRecall / float64(len(queries)) * 100
	t.Logf("DiskVamana 平均召回率: %.1f%%", avg)
	if avg < 90.0 {
		t.Errorf("DiskVamana 平均召回率过低: %.1f%%, 期望 >= 90%%", avg)
	}
}

// ============================================================================
// Test 5: DiskVamana 增量插入 + 搜索
// ============================================================================

func TestDiskVamanaIncrementalInsert(t *testing.T) {
	dim := migrationDim
	seedSize := 500
	incSize := 200
	vecs := generateTestVectors(seedSize+incSize, dim, 42)
	seedVecs := vecs[:seedSize]
	incVecs := vecs[seedSize:]
	queries := generateTestQueries(5, dim, 99)
	bf := buildBFResults(vecs) // 全量 BF

	tmpDir, err := os.MkdirTemp("", "diskvamana-inc-")
	if err != nil {
		t.Fatalf("temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	basePath := filepath.Join(tmpDir, "test-index")
	buildCfg := vamana.DefaultDiskBuildConfig()
	buildCfg.R = 32
	buildCfg.L = 100
	buildCfg.Alpha = 1.2
	buildCfg.EnableBBQ = false
	buildCfg.NumWorkers = 2

	_, err = vamana.BuildFromVectors(basePath, seedVecs, buildCfg)
	if err != nil {
		t.Fatalf("seed build: %v", err)
	}

	idx, err := vamana.Open(basePath)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	defer idx.Close()

	for _, v := range incVecs {
		if _, err := idx.Insert(v); err != nil {
			t.Fatalf("incremental insert: %v", err)
		}
	}

	var totalRecall float64
	for _, q := range queries {
		bfHits := bf(q, migrationK)
		bfSet := makeBaselineSet(bfHits)

		dResults, err := idx.Search(q, migrationK, migrationEfSearch)
		if err != nil {
			t.Fatalf("search: %v", err)
		}
		mapped := make([]searchHit, len(dResults))
		for i, r := range dResults {
			mapped[i] = searchHit{id: fmt.Sprintf("bf-%d", r.ID), dist: r.Distance}
		}
		totalRecall += computeRecall(mapped, bfSet)
	}
	avg := totalRecall / float64(len(queries)) * 100
	t.Logf("DiskVamana(增量 seed=%d + inc=%d) 平均召回率: %.1f%%", seedSize, incSize, avg)
	if avg < 85.0 {
		t.Errorf("增量后召回率过低: %.1f%%, 期望 >= 85%%", avg)
	}
}

// ============================================================================
// Test 6: DiskVamana 持久化 Roundtrip
// ============================================================================

func TestDiskVamanaPersistence(t *testing.T) {
	dim := migrationDim
	numItems := 1000
	vecs := generateTestVectors(numItems, dim, 42)
	queries := generateTestQueries(5, dim, 99)

	tmpDir, err := os.MkdirTemp("", "diskvamana-persist-")
	if err != nil {
		t.Fatalf("temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	basePath := filepath.Join(tmpDir, "test-index")
	buildCfg := vamana.DefaultDiskBuildConfig()
	buildCfg.R = 32
	buildCfg.L = 100
	buildCfg.EnableBBQ = false
	buildCfg.NumWorkers = 2

	_, err = vamana.BuildFromVectors(basePath, vecs, buildCfg)
	if err != nil {
		t.Fatalf("build: %v", err)
	}

	// 打开并首次搜索
	idx1, err := vamana.Open(basePath)
	if err != nil {
		t.Fatalf("open1: %v", err)
	}
	firstIDSet := make([]map[uint64]bool, len(queries))
	for qi, q := range queries {
		r, _ := idx1.Search(q, migrationK, migrationEfSearch)
		firstIDSet[qi] = make(map[uint64]bool, len(r))
		for _, hit := range r {
			firstIDSet[qi][hit.ID] = true
		}
	}
	idx1.Close()

	// 重新打开
	idx2, err := vamana.Open(basePath)
	if err != nil {
		t.Fatalf("open2: %v", err)
	}
	defer idx2.Close()

	var totalOverlap float64
	for qi, q := range queries {
		r, _ := idx2.Search(q, migrationK, migrationEfSearch)
		hits := 0
		for _, hit := range r {
			if firstIDSet[qi][hit.ID] {
				hits++
			}
		}
		overlap := float64(hits) / float64(len(r))
		totalOverlap += overlap
		if overlap < 1.0 {
			t.Logf("[WARN] query %d persistence overlap: %.1f%%", qi, overlap*100)
		}
	}
	avg := totalOverlap / float64(len(queries)) * 100
	t.Logf("DiskVamana 持久化 roundtrip 重叠率: %.1f%%", avg)
	if avg < 99.0 {
		t.Errorf("持久化后结果不一致, 重叠率 %.1f%%", avg)
	}
}

// ============================================================================
// Test 7: 三引擎结果等价性
// ============================================================================

func TestEngineEquivalence(t *testing.T) {
	dim := migrationDim
	numItems := 1000
	vecs := generateTestVectors(numItems, dim, 42)
	queries := generateTestQueries(5, dim, 99)
	bf := buildBFResults(vecs)

	// 1. HNSW
	hnswCol := NewCollection("equiv-hnsw", dim)
	collectionInsertVectors(hnswCol, vecs)

	// 2. Vamana
	vCfg := vamana.DefaultConfig()
	vCfg.R = 32
	vCfg.L = 100
	vIdx := vamana.New(dim, vCfg)
	vIdx.Build(vecs)

	// 3. DiskVamana
	tmpDir, err := os.MkdirTemp("", "diskvamana-equiv-")
	if err != nil {
		t.Fatalf("temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	buildCfg := vamana.DefaultDiskBuildConfig()
	buildCfg.R = 32
	buildCfg.L = 100
	buildCfg.EnableBBQ = false
	buildCfg.NumWorkers = 2
	basePath := filepath.Join(tmpDir, "test-index")
	_, err = vamana.BuildFromVectors(basePath, vecs, buildCfg)
	if err != nil {
		t.Fatalf("diskvamana build: %v", err)
	}
	dIdx, err := vamana.Open(basePath)
	if err != nil {
		t.Fatalf("diskvamana open: %v", err)
	}
	defer dIdx.Close()

	minRecall := 1.0
	for _, q := range queries {
		bfHits := bf(q, migrationK)
		bfSet := makeBaselineSet(bfHits)

		// HNSW
		hnswR := hnswCol.Search(q, migrationK, migrationEfSearch)
		hnswMapped := make([]searchHit, len(hnswR))
		for i, r := range hnswR {
			did, _ := hnswCol.GetDocID(r.ID)
			hnswMapped[i] = searchHit{id: fmt.Sprintf("bf-%d", did)}
		}
		hr := computeRecall(hnswMapped, bfSet)

		// Vamana
		vR, _ := vIdx.Search(q, migrationK, migrationEfSearch)
		vMapped := make([]searchHit, len(vR))
		for i, r := range vR {
			vMapped[i] = searchHit{id: fmt.Sprintf("bf-%d", r.ID)}
		}
		vr := computeRecall(vMapped, bfSet)

		// DiskVamana
		dR, _ := dIdx.Search(q, migrationK, migrationEfSearch)
		dMapped := make([]searchHit, len(dR))
		for i, r := range dR {
			dMapped[i] = searchHit{id: fmt.Sprintf("bf-%d", r.ID)}
		}
		dr := computeRecall(dMapped, bfSet)

		minRecall = math.Min(minRecall, math.Min(hr, math.Min(vr, dr)))
	}
	t.Logf("三引擎最低召回率基线: %.1f%%", minRecall*100)
	if minRecall < 0.85 {
		t.Errorf("引擎最低召回率 %.1f%% < 85%%, 引擎间差异过大", minRecall*100)
	}
}

// ============================================================================
// Test 8: HNSW 删除回归保护
// ============================================================================

func TestHNSWDeleteMigrationSafe(t *testing.T) {
	col := NewCollection("del-safe", 64)
	for i := 0; i < 20; i++ {
		vec := make([]float32, 64)
		for j := range vec {
			vec[j] = rand.Float32()
		}
		NormalizeVector(vec)
		_ = col.InsertPoint(Point{ID: fmt.Sprintf("item-%d", i), Vector: vec})
	}
	initialCount := col.ItemCount()

	if _, ok := col.GetDocID("item-5"); !ok {
		t.Fatal("item-5 should exist before delete")
	}
	col.DeleteItemWithIndex("item-5")

	if _, ok := col.GetDocID("item-5"); ok {
		t.Error("item-5 should be removed from IDMap")
	}
	if col.ItemCount() != initialCount-1 {
		t.Errorf("count: expected %d, got %d", initialCount-1, col.ItemCount())
	}

	q := make([]float32, 64)
	for j := range q {
		q[j] = rand.Float32()
	}
	for _, r := range col.Search(q, 5, 50) {
		if r.ID == "item-5" {
			t.Error("deleted item-5 should not appear in results")
		}
	}
}

// ============================================================================
// Test 9: HNSW 持久化回归保护
// ============================================================================

func TestHNSWPersistenceMigrationSafe(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "hnsw-persist-")
	if err != nil {
		t.Fatalf("temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	dim := 64
	col := NewCollection("persist-test", dim)
	for i := 0; i < 100; i++ {
		vec := make([]float32, dim)
		for j := range vec {
			vec[j] = rand.Float32()
		}
		NormalizeVector(vec)
		_ = col.InsertPoint(Point{ID: fmt.Sprintf("item-%d", i), Vector: vec})
	}
	if err := SaveCollection(col, tmpDir); err != nil {
		t.Fatalf("save: %v", err)
	}
	loaded, err := LoadCollection(tmpDir, "persist-test")
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if loaded.ItemCount() != col.ItemCount() {
		t.Errorf("count: %d vs %d", loaded.ItemCount(), col.ItemCount())
	}

	// 自身搜索
	id, _ := loaded.GetDocID("item-0")
	vec, _ := loaded.Store.Get(id)
	if vec != nil {
		r := loaded.Search(vec, 10, 100)
		found := false
		for _, hit := range r {
			if hit.ID == "item-0" && hit.Distance < 0.001 {
				found = true
				break
			}
		}
		if !found {
			t.Error("self search should return self after persistence")
		}
	}
}

// ============================================================================
// Test 10: Vamana vs HNSW 交集率
// ============================================================================

func TestVamanaVsHNSWOverlap(t *testing.T) {
	dim := 64
	numItems := 1000
	vecs := generateTestVectors(numItems, dim, 42)
	queries := generateTestQueries(10, dim, 99)

	col := NewCollection("hnsw-overlap", dim)
	collectionInsertVectors(col, vecs)

	cfg := vamana.DefaultConfig()
	cfg.R = 32
	cfg.L = 100
	idx := vamana.New(dim, cfg)
	idx.Build(vecs)

	var totalOverlap float64
	for _, q := range queries {
		hnswR := col.Search(q, migrationK, migrationEfSearch)
		vR, _ := idx.Search(q, migrationK, migrationEfSearch)

		hnswIDs := make(map[uint64]bool)
		for _, r := range hnswR {
			if did, ok := col.GetDocID(r.ID); ok {
				hnswIDs[uint64(did)] = true
			}
		}
		hits := 0
		for _, r := range vR {
			if hnswIDs[r.ID] {
				hits++
			}
		}
		totalOverlap += float64(hits) / float64(migrationK)
	}
	avg := totalOverlap / float64(len(queries)) * 100
	t.Logf("Vamana vs HNSW Top-%d 交集率: %.1f%%", migrationK, avg)
	if avg < 80.0 {
		t.Errorf("引擎间交集率过低: %.1f%%, 期望 >= 80%%", avg)
	}
}

// ============================================================================
// Test 11: Collection 元数据一致性
// ============================================================================

func TestCollectionMetaConsistency(t *testing.T) {
	col := NewCollection("meta-test", 128)
	if col.ColName != "meta-test" {
		t.Errorf("Name: %s", col.ColName)
	}
	if col.Dimension() != 128 {
		t.Errorf("Dim: %d", col.Dimension())
	}
	if col.HNSWIdx == nil {
		t.Error("HNSWIdx is nil")
	}
	if col.Store == nil {
		t.Error("Store is nil")
	}
	if col.IDMap == nil {
		t.Error("IDMap is nil")
	}
	t.Logf("Collection 元数据 OK: name=%s, dim=%d", col.ColName, col.Dimension())
}
