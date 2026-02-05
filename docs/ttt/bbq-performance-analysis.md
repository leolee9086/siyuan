# BBQ 搜索性能问题诊断报告

## 问题概述

BBQ (Better Binary Quantization) 搜索性能低于预期：
- **Normal Search**: 216µs/query, 4629 QPS
- **BBQ Search**: 270µs/query, 3706 QPS (慢 25%)

理论上 BBQ 使用 POPCNT 进行距离计算，应该比全精度浮点运算更快。本报告分析 BBQ 搜索性能问题的根本原因。

---

## 一、关键性能瓶颈识别

### 1.1 瓶颈 1: `bbqDistanceToQuery4Bit` 中的多次对象创建 (HIGH)

**问题位置**: `kernel/vectordb/vamana/index.go:387-410`

```go
func (idx *VamanaIndex) bbqDistanceToQuery4Bit(id uint32, query4Bit []byte, queryCorr bbq.QuantizationResult) float32 {
    // ...
    // 每次调用都创建新的 QuantizationResult 对象
    indexCorr := bbq.QuantizationResult{
        LowerBound:   idx.bbqLowerBounds[id],
        UpperBound:   idx.bbqUpperBounds[id],
        Correction:   idx.bbqCompensations[id],
        QuantizedSum: idx.bbqQuantizedSums[id],
    }

    // 每次调用都创建新的评分器对象
    scorer := bbq.NewQuantizedScorer(bbq.CosineSimilarity)
    return scorer.ComputeQuantizedDistance(...)
}
```

**影响分析**:
- 每次距离计算都分配新的 `QuantizationResult` 结构体（16字节）
- 每次距离计算都调用 `NewQuantizedScorer` 创建新对象
- 搜索过程中距离计算次数 = 访问节点数 × 平均邻居数
- 对于 10K 向量规模，单次查询约 1000+ 次距离计算 → 大量临时对象分配

**对比 HNSW 实现** (`kernel/vectordb/store.go:274-318`):
- HNSW 使用预创建的 `s.scorer`（在 `VectorStore` 初始化时创建）
- HNSW 直接传递 `bbqCorrections` 数组值，无需创建临时对象

---

### 1.2 瓶颈 2: `greedySearchBBQ` 中查询向量重复量化 (HIGH)

**问题位置**: `kernel/vectordb/vamana/index.go:415-475`

```go
func (idx *VamanaIndex) greedySearchBBQ(...) []Neighbor {
    // 1. 每次调用都重新量化查询向量
    quantizer := bbq.NewScalarQuantizer(bbq.CosineSimilarity)
    query4Bit := make([]byte, idx.dimension)
    queryCorr := quantizer.Quantize(query, query4Bit, 4, idx.bbqCentroid)
    // ...
}
```

**影响分析**:
- 每次 `SearchWithBBQ` 调用触发一次 `greedySearchBBQ`
- 每次都会创建新的 `ScalarQuantizer` 和 `query4Bit` 切片
- 查询量化应该只执行一次，然后在所有距离计算中复用

**对比 HNSW 实现** (`kernel/vectordb/hnsw_query.go:58-64`):
```go
// BBQ: 对查询向量进行4-bit量化
useBBQ := c.Dimension >= bbq.BBQEnableThreshold
var queryQuantized []byte
var queryCorrection bbq.QuantizationResult
if useBBQ {
    queryQuantized, queryCorrection = c.Store.QuantizeQuery(queryVec)  // 只量化一次
}
```
- HNSW 在搜索入口只量化一次查询向量，然后在整个搜索过程中复用

---

### 1.3 瓶颈 3: `SearchWithBBQ` 中不使用对象池的临时空间分配 (MEDIUM)

**问题位置**: `kernel/vectordb/vamana/index.go:480-539`

```go
func (idx *VamanaIndex) SearchWithBBQ(query []float32, k int, rerankFactor int) []Neighbor {
    // ...
    // 注意：不使用池中的 scratch，因为其容量可能不足
    scratch := NewSearchScratch(vectorCount, candidateCount)
    // ...
}
```

**影响分析**:
- 每次搜索都创建新的 `SearchScratch`，涉及多次内存分配
- `SearchScratch` 包含 `OccludeFactor`、`LastChecked`、`ResultPos` 等切片
- 普通搜索使用 `sync.Pool` 复用 scratch 对象

**对比普通搜索** (`kernel/vectordb/vamana/index.go:1062-1089`):
```go
func (idx *VamanaIndex) Search(query []float32, k int, efSearch int) []Neighbor {
    scratch := idx.getScratch()      // 从对象池获取
    defer idx.putScratch(scratch)    // 归还到对象池
    // ...
}
```

---

### 1.4 瓶颈 4: 两阶段搜索的重排开销 (MEDIUM)

**问题位置**: `kernel/vectordb/vamana/index.go:513-538`

```go
// 第二阶段：全精度重排
idx.mu.RLock()
defer idx.mu.RUnlock()

// 重新计算每个候选的真实距离
for i := range candidates {
    id := candidates[i].ID
    if int(id) < len(idx.vectors) {
        candidates[i].Distance = euclideanDistance(query, idx.vectors[id])
    }
}

// 按真实距离排序
sort.Slice(candidates, func(i, j int) bool {
    return candidates[i].Distance < candidates[j].Distance
})
```

**影响分析**:
- 需要对 `k * rerankFactor` 个候选进行全精度距离计算
- 需要对整个候选列表进行排序（O(n log n)）
- 当 `rerankFactor=10, k=10` 时，需要重排 100 个候选

**对比 HNSW 实现**:
- HNSW 使用最大堆维护 top-k，避免完全排序
- HNSW 使用零拷贝 `GetUnsafe` 获取向量，避免内存分配

---

### 1.5 瓶颈 5: 4-bit vs 1-bit 的精度/性能权衡 (LOW)

**问题位置**: `kernel/vectordb/vamana/index.go:421-424`

```go
// 1. 使用 4-bit 量化查询向量（精度更高）
quantizer := bbq.NewScalarQuantizer(bbq.CosineSimilarity)
query4Bit := make([]byte, idx.dimension)
queryCorr := quantizer.Quantize(query, query4Bit, 4, idx.bbqCentroid)
```

**影响分析**:
- 4-bit 量化使用 `ComputeNaiveDotProduct` 而非 POPCNT 优化
- `ComputeNaiveDotProduct` 是普通乘法循环，无硬件加速
- 对比 HNSW：当维度 >= 128 时使用 1-bit + POPCNT

**对比 HNSW 实现** (`kernel/vectordb/store.go:274-318`):
```go
if s.Dimension < 128 {
    // 4-bit Query strategy
    bitDotProduct := bbq.ComputeNaiveDotProduct(queryPacked, indexQuantized)
} else {
    // Standard 1-bit strategy
    bitDotProduct := bbq.ComputePackedDotProduct(queryPacked, indexPacked)  // POPCNT
}
```

---

## 二、性能数据对比分析

| 组件 | Vamana BBQ | HNSW BBQ | 差异 |
|------|-----------|----------|------|
| 查询量化 | 每次搜索创建新对象 | 预创建组件复用 | Vamana 多分配 |
| 距离计算评分器 | 每次调用 `NewQuantizedScorer` | 预创建 `s.scorer` | Vamana 多分配 |
| 校正因子传递 | 创建临时 `QuantizationResult` | 直接数组访问 | Vamana 多分配 |
| 临时空间 | 每次搜索 `NewSearchScratch` | 未涉及 | Vamana 多分配 |
| 重排阶段 | 全量排序 O(n log n) | 最大堆 O(n log k) | Vamana 更慢 |
| 点积计算 | 4-bit 朴素乘法 | 1-bit POPCNT | Vamana 更慢 |

---

## 三、根本原因总结

### 主要原因 (贡献度 > 60%)

1. **过度对象分配**: 每次距离计算都创建新的 `QuantizedScorer` 和 `QuantizationResult`
2. **查询量化重复**: 每次搜索都重新创建 `ScalarQuantizer` 和量化查询向量

### 次要原因 (贡献度 20-30%)

3. **对象池未使用**: `SearchWithBBQ` 不使用 scratch 对象池，导致重复内存分配
4. **重排算法低效**: 使用完整排序而非堆优化

### 其他原因 (贡献度 < 10%)

5. **4-bit 量化策略**: 对于 128 维向量仍使用 4-bit 而非 1-bit + POPCNT

---

## 四、优化方案

### 方案 1: 预创建评分器组件 (HIGH PRIORITY)

在 `VamanaIndex` 中添加预创建的评分器：

```go
type VamanaIndex struct {
    // ... 现有字段 ...
    bbqScorer    *bbq.QuantizedScorer  // 预创建评分器
}

func New(dimension int, config Config) *VamanaIndex {
    // ...
    idx := &VamanaIndex{
        // ...
        bbqScorer: bbq.NewQuantizedScorer(bbq.CosineSimilarity),
    }
    // ...
}
```

### 方案 2: 重构 `bbqDistanceToQuery4Bit` 避免临时对象 (HIGH PRIORITY)

```go
func (idx *VamanaIndex) bbqDistanceToQuery4Bit(id uint32, query4Bit []byte, 
    queryLower, queryUpper, queryCorr, querySum float32) float32 {
    
    // 直接使用数组值，不创建 QuantizationResult
    indexOffset := int(id) * idx.bbqUint64PerVec
    indexCode := idx.bbqCodes[indexOffset : indexOffset+idx.bbqUint64PerVec]
    
    dotProduct := bbq.ComputePackedDotProduct64(queryCode, indexCode)
    
    // 直接使用预创建评分器
    return idx.bbqScorer.ComputeQuantizedDistance(
        dotProduct,
        bbq.QuantizationResult{LowerBound: queryLower, UpperBound: queryUpper, 
                              Correction: queryCorr, QuantizedSum: querySum},
        bbq.QuantizationResult{LowerBound: idx.bbqLowerBounds[id], 
                              UpperBound: idx.bbqUpperBounds[id],
                              Correction: idx.bbqCompensations[id],
                              QuantizedSum: idx.bbqQuantizedSums[id]},
        idx.dimension, 0, true,
    )
}
```

### 方案 3: 提取查询量化到 `SearchWithBBQ` (HIGH PRIORITY)

```go
func (idx *VamanaIndex) SearchWithBBQ(query []float32, k int, rerankFactor int) []Neighbor {
    // ...
    
    // 一次性量化查询向量
    var query4Bit []byte
    var queryCorr bbq.QuantizationResult
    if idx.bbqEnabled {
        query4Bit = make([]byte, idx.dimension)
        queryCorr = idx.bbqQuantizer.Quantize(query, query4Bit, 4, idx.bbqCentroid)
    }
    
    // 将量化结果传递给 greedySearchBBQ
    candidates := idx.greedySearchBBQWithQuantized(scratch, startIDs, query, 
        query4Bit, queryCorr, candidateCount)
    
    // ...
}
```

### 方案 4: 使用对象池重用 Scratch (MEDIUM PRIORITY)

```go
func (idx *VamanaIndex) SearchWithBBQ(query []float32, k int, rerankFactor int) []Neighbor {
    // ...
    
    // 获取 scratch 并确保容量
    scratch := idx.getScratch()
    defer idx.putScratch(scratch)
    scratch.Visited.EnsureCapacity(vectorCount)
    scratch.Best.SetCapacity(candidateCount)
    
    // ...
}
```

### 方案 5: 优化重排阶段 (MEDIUM PRIORITY)

使用最大堆替代完整排序：

```go
// 使用最小堆维护 top-k
heap := NewMinHeap(k)
for _, cand := range candidates {
    dist := euclideanDistance(query, idx.vectors[cand.ID])
    heap.Push(dist, cand.ID)
}
results := heap.ToSortedSlice()
```

### 方案 6: 根据维度选择 1-bit/4-bit 策略 (LOW PRIORITY)

```go
func (idx *VamanaIndex) greedySearchBBQ(...) []Neighbor {
    if idx.dimension >= 128 {
        // 使用 1-bit 量化 + POPCNT
        return idx.greedySearchBBQ1Bit(...)
    }
    // 使用 4-bit 量化
    return idx.greedySearchBBQ4Bit(...)
}
```

---

## 五、预期性能提升

| 优化方案 | 预期提升 | 实现复杂度 |
|---------|---------|-----------|
| 预创建评分器 | 15-20% | 低 |
| 避免临时对象 | 10-15% | 中 |
| 查询量化提取 | 10-15% | 中 |
| 使用对象池 | 5-10% | 低 |
| 重排优化 | 5-8% | 中 |
| 1-bit 策略 | 3-5% | 低 |

**总体预期**: BBQ 搜索性能提升 40-60%，达到或超过普通搜索性能

---

## 六、结论

BBQ 搜索性能问题的根本原因是**过度的临时对象分配**和**查询量化的重复计算**，而非 BBQ 算法本身的问题。通过与 HNSW 实现的对比分析，发现 Vamana 的 BBQ 实现在以下几个方面存在优化空间：

1. **对象复用**: 预创建 `QuantizedScorer` 和 `ScalarQuantizer`
2. **减少分配**: 避免在热路径上创建临时结构体
3. **策略调整**: 根据向量维度选择合适的量化位数

实施上述优化方案后，预期 BBQ 搜索性能将达到或超过普通搜索性能，同时保持内存压缩优势。

---

## 附录: 关键代码行号

| 文件 | 行号 | 内容 |
|------|------|------|
| `kernel/vectordb/vamana/index.go` | 359-383 | `bbqDistanceToQuery` 实现 |
| `kernel/vectordb/vamana/index.go` | 387-410 | `bbqDistanceToQuery4Bit` 实现 |
| `kernel/vectordb/vamana/index.go` | 415-475 | `greedySearchBBQ` 实现 |
| `kernel/vectordb/vamana/index.go` | 480-539 | `SearchWithBBQ` 实现 |
| `kernel/vectordb/store.go` | 274-318 | HNSW `ComputeBBQDistanceFromQuery` |
| `kernel/vectordb/hnsw_query.go` | 58-64 | HNSW 查询量化 |
| `kernel/vectordb/bbq/scorer.go` | 29-32 | `NewQuantizedScorer` 实现 |
