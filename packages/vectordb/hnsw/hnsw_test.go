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

package hnsw

import (
	"math"
	"math/rand"
	"sort"
	"sync/atomic"
	"testing"
	"time"

	"s-forge.local/vectordb/bbq"
)

// =========================================
// Mock Distancer — 支持多种距离度量
// =========================================

type metricFunc func(a, b []float32) float32

func euclideanDistance(a, b []float32) float32 {
	n := len(a)
	var s0, s1, s2, s3, s4, s5, s6, s7 float32
	i := 0
	for ; i <= n-8; i += 8 {
		d0 := a[i] - b[i]
		d1 := a[i+1] - b[i+1]
		d2 := a[i+2] - b[i+2]
		d3 := a[i+3] - b[i+3]
		d4 := a[i+4] - b[i+4]
		d5 := a[i+5] - b[i+5]
		d6 := a[i+6] - b[i+6]
		d7 := a[i+7] - b[i+7]
		s0 += d0 * d0
		s1 += d1 * d1
		s2 += d2 * d2
		s3 += d3 * d3
		s4 += d4 * d4
		s5 += d5 * d5
		s6 += d6 * d6
		s7 += d7 * d7
	}
	sum := s0 + s1 + s2 + s3 + s4 + s5 + s6 + s7
	for ; i < n; i++ {
		d := a[i] - b[i]
		sum += d * d
	}
	return sum
}

func mockCosineDistance(a, b []float32) float32 {
	var dot, normA, normB float32
	for i := range a {
		dot += a[i] * b[i]
		normA += a[i] * a[i]
		normB += b[i] * b[i]
	}
	if normA == 0 || normB == 0 {
		return 1.0
	}
	sim := dot / (float32(math.Sqrt(float64(normA))) * float32(math.Sqrt(float64(normB))))
	d := 1.0 - sim
	if d < 0 {
		d = 0
	}
	return d
}

func dotProductDistance(a, b []float32) float32 {
	var dot float32
	for i := range a {
		dot += a[i] * b[i]
	}
	return 1.0 - dot
}

type mockDistancer struct {
	flatVectors []float32 // 扁平化存储: flatVectors[docID*dim .. (docID+1)*dim]
	visited     []uint32  // slice 索引即 DocID
	dim         int       // 向量维度 (首次 AddVector 时设置)
	count       int       // 已分配的 DocID 槽位数
	epoch       uint32
	distFunc    metricFunc
}

func newMockDistancer(fn metricFunc) *mockDistancer {
	return &mockDistancer{
		flatVectors: make([]float32, 0),
		visited:     make([]uint32, 0),
		distFunc:    fn,
	}
}

func (d *mockDistancer) AddVector(id DocID, vec []float32) {
	if d.dim == 0 {
		d.dim = len(vec)
	}
	needed := int(id) + 1
	if needed > d.count {
		newLen := needed * d.dim
		if newLen > len(d.flatVectors) {
			grown := make([]float32, newLen, newLen*2)
			copy(grown, d.flatVectors)
			d.flatVectors = grown
		}
		if needed > len(d.visited) {
			grownV := make([]uint32, needed, needed*2)
			copy(grownV, d.visited)
			d.visited = grownV
		}
		d.count = needed
	}
	offset := int(id) * d.dim
	copy(d.flatVectors[offset:offset+d.dim], vec)
}

func (d *mockDistancer) getVec(id DocID) []float32 {
	if int(id) >= d.count {
		return nil
	}
	off := int(id) * d.dim
	return d.flatVectors[off : off+d.dim : off+d.dim]
}

func (d *mockDistancer) ComputeDistance(a, b DocID, _ string) float32 {
	if int(a) >= d.count || int(b) >= d.count {
		return 1e9
	}
	offA := int(a) * d.dim
	offB := int(b) * d.dim
	return d.distFunc(d.flatVectors[offA:offA+d.dim:offA+d.dim], d.flatVectors[offB:offB+d.dim:offB+d.dim])
}

func (d *mockDistancer) ComputeDistanceFromVector(query []float32, id DocID, _ string) float32 {
	if int(id) >= d.count {
		return 1e9
	}
	off := int(id) * d.dim
	return d.distFunc(query, d.flatVectors[off:off+d.dim:off+d.dim])
}

func (d *mockDistancer) ComputeBBQDistance(a, b DocID) float32 {
	return d.ComputeDistance(a, b, "")
}

func (d *mockDistancer) ComputeBBQDistanceFromQuery(_ []byte, _ bbq.QuantizationResult, _ DocID) float32 {
	return 1e9
}

func (d *mockDistancer) QuantizeQuery(_ []float32) ([]byte, bbq.QuantizationResult) {
	return nil, bbq.QuantizationResult{}
}

func (d *mockDistancer) GetUnsafe(id DocID) ([]float32, bool) {
	if int(id) >= d.count {
		return nil, false
	}
	off := int(id) * d.dim
	return d.flatVectors[off : off+d.dim : off+d.dim], true
}

func (d *mockDistancer) NewSearchEpoch() uint32 {
	return atomic.AddUint32(&d.epoch, 1)
}

func (d *mockDistancer) IsVisited(id DocID, epoch uint32) bool {
	if int(id) >= len(d.visited) {
		return false
	}
	return d.visited[id] == epoch
}

func (d *mockDistancer) MarkVisited(id DocID, epoch uint32) {
	for int(id) >= len(d.visited) {
		d.visited = append(d.visited, 0)
	}
	d.visited[id] = epoch
}

// =========================================
// 辅助函数
// =========================================

func normalizeVec(v []float32) {
	var norm float32
	for _, x := range v {
		norm += x * x
	}
	norm = float32(math.Sqrt(float64(norm)))
	if norm > 0 {
		for i := range v {
			v[i] /= norm
		}
	}
}

func randomVec(dim int) []float32 {
	v := make([]float32, dim)
	for i := range v {
		v[i] = rand.Float32()*2 - 1
	}
	return v
}

func randomNormalizedVec(dim int) []float32 {
	v := randomVec(dim)
	normalizeVec(v)
	return v
}

func newTestIndex(dim int, dist *mockDistancer) *HNSWIndex {
	cfg := Config{
		M:              16,
		EfConstruction: 100,
		EfSearch:       64,
		MaxLevel:       8,
		MetricType:     "l2",
	}
	return NewHNSWIndex(dim, cfg, dist)
}

func bruteForceKNN(query []float32, d *mockDistancer, k int, fn metricFunc) []SearchResult {
	type item struct {
		id   DocID
		dist float32
	}
	items := make([]item, 0, d.count)
	for id := 0; id < d.count; id++ {
		v := d.getVec(DocID(id))
		if v == nil {
			continue
		}
		items = append(items, item{id: DocID(id), dist: fn(query, v)})
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].dist < items[j].dist
	})
	if len(items) > k {
		items = items[:k]
	}
	results := make([]SearchResult, len(items))
	for i, it := range items {
		results[i] = SearchResult{ID: it.id, Distance: it.dist}
	}
	return results
}

// =========================================
// MinHeap 测试
// =========================================

func TestMinHeap_PushPopOrder(t *testing.T) {
	h := NewMinHeap()

	distances := []float32{5.0, 1.0, 3.0, 0.5, 4.0, 2.0}
	for i, d := range distances {
		h.Push(HeapItem{ID: DocID(i), Distance: d})
	}

	if h.Len() != len(distances) {
		t.Fatalf("堆大小应为 %d，实际: %d", len(distances), h.Len())
	}

	prev := float32(-1)
	for h.Len() > 0 {
		item := h.Pop()
		if item.Distance < prev {
			t.Errorf("MinHeap 弹出顺序错误: %.2f 出现在 %.2f 之后", item.Distance, prev)
		}
		prev = item.Distance
	}
}

func TestMinHeap_Peek(t *testing.T) {
	h := NewMinHeap()
	if h.Peek() != (HeapItem{}) {
		t.Error("空堆 Peek 应返回零值")
	}

	h.Push(HeapItem{ID: 1, Distance: 3.0})
	h.Push(HeapItem{ID: 2, Distance: 1.0})

	peeked := h.Peek()
	if peeked.Distance != 1.0 {
		t.Errorf("Peek 应返回最小元素 (1.0)，实际: %v", peeked)
	}
	if h.Len() != 2 {
		t.Errorf("Peek 后堆大小应为 2，实际: %d", h.Len())
	}
}

func TestMinHeap_EmptyPop(t *testing.T) {
	h := NewMinHeap()
	if h.Pop() != (HeapItem{}) {
		t.Error("空堆 Pop 应返回零值")
	}
	if !h.IsEmpty() {
		t.Error("空堆 IsEmpty 应返回 true")
	}
}

// =========================================
// MaxHeap 测试
// =========================================

func TestMaxHeap_PushPopOrder(t *testing.T) {
	h := NewMaxHeap(10)

	distances := []float32{5.0, 1.0, 3.0, 0.5, 4.0, 2.0}
	for i, d := range distances {
		h.Push(HeapItem{ID: DocID(i), Distance: d})
	}

	prev := float32(math.MaxFloat32)
	for h.Len() > 0 {
		item := h.Pop()
		if item.Distance > prev {
			t.Errorf("MaxHeap 弹出顺序错误: %.2f 出现在 %.2f 之后", item.Distance, prev)
		}
		prev = item.Distance
	}
}

func TestMaxHeap_Capacity(t *testing.T) {
	cap := 3
	h := NewMaxHeap(cap)

	for i := 0; i < 5; i++ {
		h.Push(HeapItem{ID: DocID(i), Distance: float32(i)})
	}

	if h.Len() != cap {
		t.Errorf("MaxHeap 容量应为 %d，实际: %d", cap, h.Len())
	}
	if !h.IsFull() {
		t.Error("MaxHeap 应已满")
	}
}

func TestMaxHeap_Replace(t *testing.T) {
	h := NewMaxHeap(3)
	h.Push(HeapItem{ID: 1, Distance: 10.0})
	h.Push(HeapItem{ID: 2, Distance: 20.0})
	h.Push(HeapItem{ID: 3, Distance: 30.0})

	old := h.Replace(HeapItem{ID: 4, Distance: 5.0})
	if old.Distance != 30.0 {
		t.Errorf("Replace 应返回旧堆顶 (30.0)，实际: %v", old)
	}

	top := h.Peek()
	if top.Distance != 20.0 {
		t.Errorf("Replace 后堆顶应为 20.0，实际: %v", top)
	}
}

func TestMaxHeap_ToSortedArray(t *testing.T) {
	h := NewMaxHeap(10)
	h.Push(HeapItem{ID: 1, Distance: 3.0})
	h.Push(HeapItem{ID: 2, Distance: 1.0})
	h.Push(HeapItem{ID: 3, Distance: 5.0})
	h.Push(HeapItem{ID: 4, Distance: 2.0})

	sorted := h.ToSortedArray()
	if len(sorted) != 4 {
		t.Fatalf("排序数组长度应为 4，实际: %d", len(sorted))
	}

	for i := 1; i < len(sorted); i++ {
		if sorted[i].Distance < sorted[i-1].Distance {
			t.Errorf("ToSortedArray 应升序: 位置 %d (%.2f) < 位置 %d (%.2f)",
				i, sorted[i].Distance, i-1, sorted[i-1].Distance)
		}
	}

	if h.Len() != 4 {
		t.Errorf("ToSortedArray 不应修改原堆，堆大小: %d", h.Len())
	}
}

func TestMaxHeap_EmptyReplace(t *testing.T) {
	h := NewMaxHeap(3)
	old := h.Replace(HeapItem{ID: 1, Distance: 1.0})
	if old != (HeapItem{}) {
		t.Error("空堆 Replace 应返回零值")
	}
	if h.Len() != 1 {
		t.Errorf("空堆 Replace 后大小应为 1，实际: %d", h.Len())
	}
}

// =========================================
// 工具函数测试
// =========================================

func TestRandomLevel(t *testing.T) {
	maxLevel := 8
	idx := NewHNSWIndex(128, Config{MaxLevel: maxLevel}, nil)
	counts := make(map[int]int)
	trials := 10000

	for i := 0; i < trials; i++ {
		l := idx.RandomLevel()
		if l < 0 || l >= maxLevel {
			t.Fatalf("RandomLevel returned out of bounds: %d (maxLevel=%d)", l, maxLevel)
		}
		counts[l]++
	}

	if counts[0] < trials/4 {
		t.Errorf("level 0 too few: %d/%d", counts[0], trials)
	}
	for l := 1; l < maxLevel-1; l++ {
		if counts[l] > counts[l-1] {
			t.Errorf("level %d (%d) should not exceed level %d (%d)",
				l, counts[l], l-1, counts[l-1])
		}
	}
}

func TestPaperMLQuality(t *testing.T) {
	requireDiagnosticTest(t)

	scales := []struct {
		total int
		dim   int
		label string
	}{
		{5000, 128, "5K×128"},
		{10000, 128, "10K×128"},
	}
	queryCnt := 100
	topK := 10
	efSearch := 64

	for _, s := range scales {
		t.Run(s.label, func(t *testing.T) {
			genVec := func(seed int) []float32 {
				v := make([]float32, s.dim)
				rng := rand.New(rand.NewSource(int64(seed)))
				for j := range v {
					v[j] = float32(rng.Float64()*2 - 1)
				}
				return v
			}
			vectors := make([][]float32, s.total)
			for i := 0; i < s.total; i++ {
				vectors[i] = genVec(i)
			}
			queries := make([][]float32, queryCnt)
			for q := 0; q < queryCnt; q++ {
				queries[q] = genVec(1000000 + q)
			}

			type scored struct {
				idx  int
				dist float32
			}
			groundTruth := make([][]int, queryCnt)
			for q := 0; q < queryCnt; q++ {
				scores := make([]scored, s.total)
				for i := 0; i < s.total; i++ {
					var dist float32
					for j := range vectors[i] {
						d := vectors[i][j] - queries[q][j]
						dist += d * d
					}
					scores[i] = scored{i, dist}
				}
				sort.Slice(scores, func(i, j int) bool { return scores[i].dist < scores[j].dist })
				gt := make([]int, topK)
				for i := 0; i < topK; i++ {
					gt[i] = scores[i].idx
				}
				groundTruth[q] = gt
			}

			type result struct {
				label     string
				buildRate float64
				queryUs   float64
				recall    float64
				levels    [17]int
			}
			var results []result

			for _, lml := range []float64{0, 1.0 / math.Log(16)} {
				label := "default(0.5)"
				if lml > 0 {
					label = "paper(1/lnM)"
				}
				cfg := Config{
					M: 16, EfConstruction: 100, EfSearch: efSearch,
					MaxLevel: 16, MetricType: "l2", LevelML: lml,
				}
				dist := newMockDistancer(euclideanDistance)
				idx := NewHNSWIndex(s.dim, cfg, dist)
				for i, v := range vectors {
					dist.AddVector(DocID(i), v)
				}
				buildStart := time.Now()
				for i := 0; i < s.total; i++ {
					idx.Insert(DocID(i))
				}
				buildDur := time.Since(buildStart)

				var hits int
				var queryTotal time.Duration
				for q := 0; q < queryCnt; q++ {
					tq := time.Now()
					res := idx.Search(queries[q], topK, efSearch)
					queryTotal += time.Since(tq)
					gt := groundTruth[q]
					gtSet := make(map[int]bool, topK)
					for _, g := range gt {
						gtSet[g] = true
					}
					for _, r := range res {
						if gtSet[int(r.ID)] {
							hits++
						}
					}
				}

				var levels [17]int
				for d := DocID(0); d < DocID(s.total); d++ {
					l := idx.GetItemLevel(d)
					if l >= 0 && l < 17 {
						levels[l]++
					}
				}
				results = append(results, result{
					label:     label,
					buildRate: float64(s.total) / buildDur.Seconds(),
					queryUs:   float64(queryTotal.Microseconds()) / float64(queryCnt),
					recall:    float64(hits) / float64(queryCnt*topK),
					levels:    levels,
				})
			}

			for _, r := range results {
				t.Logf("%s: build=%.0f/s, query=%.0fus, recall=%.1f%%, L0=%d L1=%d L2=%d",
					r.label, r.buildRate, r.queryUs, r.recall*100,
					r.levels[0], r.levels[1], r.levels[2])
			}
			if len(results) == 2 {
				paperRecall := results[1].recall
				defRecall := results[0].recall
				if paperRecall < defRecall*0.95 {
					t.Errorf("paper recall %.1f%% < default %.1f%%",
						paperRecall*100, defRecall*100)
				}
			}
		})
	}
}

func TestExpectedNeighborCount(t *testing.T) {
	M := 16
	// level 0 应返回 2*M
	if got := ExpectedNeighborCount(0, M); got != 2*M {
		t.Errorf("level 0: 期望 %d，实际 %d", 2*M, got)
	}
	// level > 0 应返回 M
	for l := 1; l <= 5; l++ {
		if got := ExpectedNeighborCount(l, M); got != M {
			t.Errorf("level %d: 期望 %d，实际 %d", l, M, got)
		}
	}
}

func TestSortNeighborsByDistance(t *testing.T) {
	neighbors := []NeighborRecord{
		{ID: 1, Distance: 5.0},
		{ID: 2, Distance: 1.0},
		{ID: 3, Distance: 3.0},
		{ID: 4, Distance: 0.5},
	}
	sortNeighborsByDistance(neighbors)

	for i := 1; i < len(neighbors); i++ {
		if neighbors[i].Distance < neighbors[i-1].Distance {
			t.Errorf("排序错误: 位置 %d (%.2f) < 位置 %d (%.2f)",
				i, neighbors[i].Distance, i-1, neighbors[i-1].Distance)
		}
	}
}

// =========================================
// InitItemNeighbors / GetItemLevel / SelectEntryPoint 测试
// =========================================

func TestInitItemNeighbors_And_GetItemLevel(t *testing.T) {
	dist := newMockDistancer(euclideanDistance)
	idx := newTestIndex(4, dist)

	dist.AddVector(0, []float32{1, 0, 0, 0})
	level := idx.InitItemNeighbors(0)

	if level < 0 {
		t.Fatalf("InitItemNeighbors 返回负层级: %d", level)
	}

	gotLevel := idx.GetItemLevel(0)
	if gotLevel != level {
		t.Errorf("GetItemLevel 应返回 %d，实际: %d", level, gotLevel)
	}

	// 不存在的 docID
	if idx.GetItemLevel(999) != -1 {
		t.Error("不存在的 docID 应返回 -1")
	}
}

func TestSelectEntryPoint_Empty(t *testing.T) {
	dist := newMockDistancer(euclideanDistance)
	idx := newTestIndex(4, dist)

	_, ok := idx.SelectEntryPoint()
	if ok {
		t.Error("空索引 SelectEntryPoint 应返回 false")
	}
}

// =========================================
// Insert + Search 多度量测试
// =========================================

// testInsertAndSearch 使用指定度量函数测试 Insert + Search 流程
func testInsertAndSearch(t *testing.T, metricName string, fn metricFunc, genVec func(int) []float32) {
	t.Helper()
	dim := 8
	numItems := 200
	k := 5

	dist := newMockDistancer(fn)
	idx := newTestIndex(dim, dist)

	// 插入向量
	for i := 0; i < numItems; i++ {
		vec := genVec(dim)
		dist.AddVector(DocID(i), vec)
		idx.Insert(DocID(i))
	}

	// 验证入口点有效
	ep, ok := idx.SelectEntryPoint()
	if !ok {
		t.Fatalf("[%s] 插入 %d 条后入口点无效", metricName, numItems)
	}
	if idx.Deleted[ep] {
		t.Fatalf("[%s] 入口点 %d 已被标记删除", metricName, ep)
	}

	// 搜索
	queryVec := genVec(dim)
	results := idx.Search(queryVec, k, 100)

	if len(results) == 0 {
		t.Fatalf("[%s] 搜索结果为空", metricName)
	}
	if len(results) > k {
		t.Errorf("[%s] 搜索结果数量 %d 超过 k=%d", metricName, len(results), k)
	}

	// 验证结果按距离升序
	for i := 1; i < len(results); i++ {
		if results[i].Distance < results[i-1].Distance {
			t.Errorf("[%s] 结果未按距离升序: 位置 %d (%.4f) < 位置 %d (%.4f)",
				metricName, i, results[i].Distance, i-1, results[i-1].Distance)
		}
	}

	// 召回率验证：暴力搜索对比
	bruteResults := bruteForceKNN(queryVec, dist, k, fn)
	bruteSet := make(map[DocID]bool)
	for _, r := range bruteResults {
		bruteSet[r.ID] = true
	}

	hits := 0
	for _, r := range results {
		if bruteSet[r.ID] {
			hits++
		}
	}

	recall := float64(hits) / float64(k) * 100
	t.Logf("[%s] 召回率: %.1f%% (%d/%d)", metricName, recall, hits, k)
}

func TestInsertAndSearch_Euclidean(t *testing.T) {
	testInsertAndSearch(t, "euclidean", euclideanDistance, randomVec)
}

func TestInsertAndSearch_Cosine(t *testing.T) {
	testInsertAndSearch(t, "cosine", mockCosineDistance, randomNormalizedVec)
}

func TestInsertAndSearch_DotProduct(t *testing.T) {
	testInsertAndSearch(t, "dotProduct", dotProductDistance, randomNormalizedVec)
}

// =========================================
// Delete 测试（多度量）
// =========================================

func testDelete(t *testing.T, metricName string, fn metricFunc, genVec func(int) []float32) {
	t.Helper()
	dim := 8
	numItems := 50

	dist := newMockDistancer(fn)
	idx := newTestIndex(dim, dist)

	for i := 0; i < numItems; i++ {
		vec := genVec(dim)
		dist.AddVector(DocID(i), vec)
		idx.Insert(DocID(i))
	}

	// 删除若干节点
	deleteIDs := []DocID{5, 10, 20, 30}
	for _, id := range deleteIDs {
		idx.Delete(id)
	}

	// 验证软删除标记
	for _, id := range deleteIDs {
		if !idx.Deleted[id] {
			t.Errorf("[%s] docID %d 应被标记为已删除", metricName, id)
		}
	}

	// 验证搜索结果不包含已删除节点
	queryVec := genVec(dim)
	results := idx.Search(queryVec, 10, 100)

	deletedSet := make(map[DocID]bool)
	for _, id := range deleteIDs {
		deletedSet[id] = true
	}
	for _, r := range results {
		if deletedSet[r.ID] {
			t.Errorf("[%s] 搜索结果包含已删除节点 %d", metricName, r.ID)
		}
	}

	// 验证入口点有效
	ep, ok := idx.SelectEntryPoint()
	if !ok {
		t.Fatalf("[%s] 删除后入口点无效", metricName)
	}
	if idx.Deleted[ep] {
		t.Fatalf("[%s] 入口点 %d 已被删除", metricName, ep)
	}
}

func TestDelete_Euclidean(t *testing.T) {
	testDelete(t, "euclidean", euclideanDistance, randomVec)
}

func TestDelete_Cosine(t *testing.T) {
	testDelete(t, "cosine", mockCosineDistance, randomNormalizedVec)
}

func TestDelete_DotProduct(t *testing.T) {
	testDelete(t, "dotProduct", dotProductDistance, randomNormalizedVec)
}

// TestDelete_EntryPoint 验证删除入口点后索引仍可用
func TestDelete_EntryPoint(t *testing.T) {
	dim := 8
	dist := newMockDistancer(euclideanDistance)
	idx := newTestIndex(dim, dist)

	for i := 0; i < 20; i++ {
		dist.AddVector(DocID(i), randomVec(dim))
		idx.Insert(DocID(i))
	}

	ep, _ := idx.SelectEntryPoint()
	idx.Delete(ep)

	// 删除入口点后应自动选择新入口点
	newEp, ok := idx.SelectEntryPoint()
	if !ok {
		t.Fatal("删除入口点后应有新入口点")
	}
	if newEp == ep {
		t.Error("新入口点不应与已删除的相同")
	}

	// 搜索仍应正常
	results := idx.Search(randomVec(dim), 5, 50)
	if len(results) == 0 {
		t.Error("删除入口点后搜索不应返回空")
	}
}

// TestDelete_AllNodes 验证删除所有节点
func TestDelete_AllNodes(t *testing.T) {
	dim := 4
	dist := newMockDistancer(euclideanDistance)
	idx := newTestIndex(dim, dist)

	n := 10
	for i := 0; i < n; i++ {
		dist.AddVector(DocID(i), randomVec(dim))
		idx.Insert(DocID(i))
	}

	for i := 0; i < n; i++ {
		idx.Delete(DocID(i))
	}

	_, ok := idx.SelectEntryPoint()
	if ok {
		t.Error("全部删除后不应有有效入口点")
	}

	results := idx.Search(randomVec(dim), 5, 50)
	if len(results) != 0 {
		t.Errorf("全部删除后搜索应返回空，实际: %d", len(results))
	}
}

// =========================================
// RebuildIndex 测试（多度量）
// =========================================

func testRebuildIndex(t *testing.T, metricName string, fn metricFunc, genVec func(int) []float32) {
	t.Helper()
	dim := 8
	numItems := 40

	dist := newMockDistancer(fn)
	idx := newTestIndex(dim, dist)

	for i := 0; i < numItems; i++ {
		dist.AddVector(DocID(i), genVec(dim))
		idx.Insert(DocID(i))
	}

	// 删除一半
	for i := 0; i < numItems; i += 2 {
		idx.Delete(DocID(i))
	}

	// 收集有效 ID
	validIDs := make([]DocID, 0)
	for i := 1; i < numItems; i += 2 {
		validIDs = append(validIDs, DocID(i))
	}

	// 重建索引
	idx.RebuildIndex(validIDs)

	// 验证重建后状态
	if len(idx.Deleted) != 0 {
		t.Errorf("[%s] 重建后 Deleted 应为空，实际: %d", metricName, len(idx.Deleted))
	}

	ep, ok := idx.SelectEntryPoint()
	if !ok {
		t.Fatalf("[%s] 重建后入口点无效", metricName)
	}
	if idx.Deleted[ep] {
		t.Fatalf("[%s] 重建后入口点 %d 已删除", metricName, ep)
	}

	// 搜索验证
	queryVec := genVec(dim)
	results := idx.Search(queryVec, 5, 100)
	if len(results) == 0 {
		t.Fatalf("[%s] 重建后搜索结果为空", metricName)
	}

	// 结果不应包含偶数 ID（已删除）
	for _, r := range results {
		if r.ID%2 == 0 {
			t.Errorf("[%s] 重建后结果包含偶数 ID %d", metricName, r.ID)
		}
	}
}

func TestRebuildIndex_Euclidean(t *testing.T) {
	testRebuildIndex(t, "euclidean", euclideanDistance, randomVec)
}

func TestRebuildIndex_Cosine(t *testing.T) {
	testRebuildIndex(t, "cosine", mockCosineDistance, randomNormalizedVec)
}

func TestRebuildIndex_DotProduct(t *testing.T) {
	testRebuildIndex(t, "dotProduct", dotProductDistance, randomNormalizedVec)
}

// =========================================
// 边界条件测试
// =========================================

func TestSearch_EmptyIndex(t *testing.T) {
	dist := newMockDistancer(euclideanDistance)
	idx := newTestIndex(4, dist)

	results := idx.Search([]float32{1, 0, 0, 0}, 5, 50)
	if len(results) != 0 {
		t.Errorf("空索引搜索应返回空，实际: %d", len(results))
	}
}

func TestSearch_SingleItem(t *testing.T) {
	dim := 4
	dist := newMockDistancer(euclideanDistance)
	idx := newTestIndex(dim, dist)

	dist.AddVector(0, []float32{1, 0, 0, 0})
	idx.Insert(0)

	results := idx.Search([]float32{1, 0, 0, 0}, 5, 50)
	if len(results) != 1 {
		t.Fatalf("单元素索引搜索应返回 1 条，实际: %d", len(results))
	}
	if results[0].ID != 0 {
		t.Errorf("结果 ID 应为 0，实际: %d", results[0].ID)
	}
}

func TestInsert_FirstNode(t *testing.T) {
	dim := 4
	dist := newMockDistancer(euclideanDistance)
	idx := newTestIndex(dim, dist)

	dist.AddVector(0, []float32{1, 0, 0, 0})
	ok := idx.Insert(0)
	if !ok {
		t.Error("首次插入应返回 true")
	}

	ep, valid := idx.SelectEntryPoint()
	if !valid {
		t.Fatal("插入首节点后入口点应有效")
	}
	if ep != 0 {
		t.Errorf("首节点应为入口点，实际: %d", ep)
	}
}
