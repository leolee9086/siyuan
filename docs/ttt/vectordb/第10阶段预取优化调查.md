# Phase 10 预取优化调查报告

> 调查时间: 2026-02-10
> 调查目标: HNSW 变量预取优化覆盖范围、真实 distancer 实现、benchDistancer 优化特征

---

## 1. 当前预取覆盖范围

### 1.1 已实施预取的函数（Phase 9 成果）

以下函数已在非 BBQ 路径中实施了 `GetUnsafe` + `ComputeDistanceFromVector` 的"变量预取"模式，即：先获取 query 向量引用，后续循环中复用该引用，避免每次 `ComputeDistance` 都重复查找 queryID 的向量。

| 函数 | 文件:行号 | 预取方式 |
|------|-----------|----------|
| `greedySearch` | `kernel/vectordb/hnsw/build.go:126-155` | 循环外 `GetUnsafe(queryID)` → 循环内 `ComputeDistanceFromVector(queryVec, ...)` |
| `searchLevel` | `kernel/vectordb/hnsw/build.go:181-259` | 循环外 `GetUnsafe(queryID)` → 循环内 `ComputeDistanceFromVector(queryVec, ...)` |
| `selectNeighborsHeuristic` | `kernel/vectordb/hnsw/build.go:262-325` | 外循环每轮 `GetUnsafe(candidate.ID)` → 内循环 `ComputeDistanceFromVector(candidateVec, ...)` |

### 1.2 尚未实施预取的函数

#### 1.2.1 `recomputeNeighbors` — delete.go:85-147

```go
// delete.go:121
dist := idx.Distancer.ComputeDistance(docID, current, config.MetricType)
```

**模式**: BFS 循环中对每个 `current` 节点调用 `ComputeDistance(docID, current, ...)`。`docID` 在整个循环中不变。

**优化机会**: 可在循环外预取 `docID` 的向量，循环内改用 `ComputeDistanceFromVector`。

#### 1.2.2 query.go 中的 Vec 系列函数

`greedySearchVec` (query.go:106-142) 和 `searchLevelVec` (query.go:145-212) 已经接收 `queryVec []float32` 参数，直接使用 `ComputeDistanceFromVector(queryVec, ...)` — **无需额外预取**，已经是最优路径。

### 1.3 预取覆盖总结

| 文件 | 函数 | 状态 | 说明 |
|------|------|------|------|
| build.go | `greedySearch` | ✅ 已优化 | Phase 9 |
| build.go | `searchLevel` | ✅ 已优化 | Phase 9 |
| build.go | `selectNeighborsHeuristic` | ✅ 已优化 | Phase 9 |
| query.go | `greedySearchVec` | ✅ 天然最优 | 参数已是 `queryVec` |
| query.go | `searchLevelVec` | ✅ 天然最优 | 参数已是 `queryVec` |
| delete.go | `recomputeNeighbors` | ❌ 未优化 | 使用 `ComputeDistance(docID, current, ...)` |

---

## 2. 真实 distancer 实现

### 2.1 接口定义

`Distancer` 接口定义于 `kernel/vectordb/hnsw/types.go:77-104`。

### 2.2 生产实现: `VectorStore`

生产环境中 HNSW 使用 `VectorStore`（`kernel/vectordb/store.go`）作为 Distancer 实现。

初始化链路:
- `NewCollection()` (`types.go:113-138`) 创建 `VectorStore`
- 传入 `hnsw.NewHNSWIndex(dimension, hnswConfig, store)` (`types.go:135`)

### 2.3 `ComputeDistance` vs `ComputeDistanceFromVector` 实现差异

#### `ComputeDistance(a, b DocID, metric)` — store.go:191-211

```go
func (s *VectorStore) ComputeDistance(a, b DocID, metric string) float32 {
    offsetA := int(a) * s.Dimension
    offsetB := int(b) * s.Dimension
    vecA := s.vectors[offsetA:endA]
    vecB := s.vectors[offsetB:endB]
    // 调用 L2Distance 或 CosineDistance
}
```

**开销**: 每次调用需要计算两个偏移量 + 两次切片操作 + 边界检查。

#### `ComputeDistanceFromVector(query, id, metric)` — store.go:324-340

```go
func (s *VectorStore) ComputeDistanceFromVector(query []float32, docID DocID, metric string) float32 {
    offset := int(docID) * s.Dimension
    vec := s.vectors[offset:endOffset]
    // 调用 L2Distance 或 CosineDistance
}
```

**开销**: 每次调用只需计算一个偏移量 + 一次切片操作 + 边界检查。query 向量已由调用方持有。

#### `GetUnsafe(docID)` — store.go:176-187

```go
func (s *VectorStore) GetUnsafe(docID DocID) ([]float32, bool) {
    offset := int(docID) * s.Dimension
    endOffset := offset + s.Dimension
    return s.vectors[offset:endOffset:endOffset], true
}
```

**开销**: 一次偏移量计算 + 切片操作。无锁、零拷贝。

### 2.4 预取优化的实际收益分析

在 `VectorStore` 实现中，"预取"优化的收益来自：

1. **消除重复偏移量计算**: `ComputeDistance` 每次调用需要为两个 ID 各计算一次 `id * Dimension`。预取后，query 侧的偏移量计算只做一次。
2. **消除重复边界检查**: `ComputeDistance` 每次检查两个 `endOffset > len(s.vectors)`。预取后 query 侧检查只做一次。
3. **CPU 缓存友好**: 预取的 `queryVec` 切片在循环中被反复访问，更可能驻留在 L1/L2 缓存中。

**注意**: `VectorStore` 使用扁平化连续数组 `[]float32`，偏移量计算本身很轻量（一次乘法）。因此预取优化的主要收益在于**缓存局部性**而非计算节省。

---

## 3. benchDistancer 优化特征

### 3.1 实现位置

`benchDistancer` 定义于 `kernel/vectordb/hnsw_vs_vamana_bench_test.go:54-123`。

### 3.2 存储结构对比

| 特征 | benchDistancer | VectorStore (生产) |
|------|---------------|-------------------|
| 向量存储 | `[][]float32` (切片的切片) | `[]float32` (扁平化连续数组) |
| 向量访问 | `d.vectors[id]` (一次索引) | `s.vectors[id*dim : id*dim+dim]` (偏移量计算+切片) |
| 内存布局 | 每个向量独立分配，不连续 | 所有向量连续存储 |
| visited | `[]uint32` + atomic | `[]uint32` + atomic (相同) |

### 3.3 benchDistancer 的性能特征

#### 优势（相对于 VectorStore）

1. **向量访问零计算**: `d.vectors[id]` 直接索引，无需 `id * Dimension` 偏移量计算
2. **无边界检查开销**: 切片索引的边界检查由 Go 运行时自动处理，比手动 `endOffset > len(s.vectors)` 更简洁

#### 劣势（相对于 VectorStore）

1. **缓存不友好**: `[][]float32` 中每个向量是独立分配的堆对象，内存地址不连续，遍历邻居时 cache miss 率高
2. **GC 压力**: 大量小切片对象增加 GC 扫描负担
3. **距离计算未优化**: 使用朴素循环而非 8 路展开

```go
// benchDistancer 的距离计算 (hnsw_vs_vamana_bench_test.go:75-83)
func (d *benchDistancer) ComputeDistance(a, b hnsw.DocID, _ string) float32 {
    va, vb := d.vectors[a], d.vectors[b]
    var sum float32
    for i := range va {
        diff := va[i] - vb[i]
        sum += diff * diff
    }
    return sum
}
```

对比 VectorStore 使用的 `L2Distance`/`CosineDistance`（8 路展开 + 独立累加器）。

### 3.4 benchDistancer 中可移植到生产的优化

**结论: 无。** benchDistancer 实际上在多个方面**劣于** VectorStore：

- VectorStore 的扁平化连续存储比 `[][]float32` 更缓存友好
- VectorStore 的距离函数使用 8 路展开，benchDistancer 使用朴素循环
- VectorStore 支持零拷贝 `GetUnsafe`，benchDistancer 的 `GetUnsafe` 也是零拷贝但基于不连续内存

benchDistancer 唯一的"优势"是代码简单、无 BBQ 量化开销，但这不是可移植的优化，而是功能缺失。

---

## 4. 对比测试改用真实 distancer 的可行性

### 4.1 当前初始化流程

```go
// hnsw_vs_vamana_bench_test.go:304-320
func runHNSWPhasedInsert(t *testing.T, vectors [][]float32) []phaseResult {
    dist := newBenchDistancer(benchCompTotal)
    cfg := hnsw.Config{
        M: 16, EfConstruction: 200, EfSearch: 64,
        MaxLevel: 16, MetricType: "euclidean",
    }
    idx := hnsw.NewHNSWIndex(benchCompDim, cfg, dist)

    // 预加载所有向量
    for i, v := range vectors {
        dist.AddVector(hnsw.DocID(i), v)
    }
    // 逐条插入
    for i := start; i < end; i++ {
        idx.Insert(hnsw.DocID(i))
    }
}
```

### 4.2 改用 VectorStore 的可行性

**完全可行，且改动极小。**

`VectorStore` 已实现完整的 `Distancer` 接口。替换方案：

```go
func runHNSWPhasedInsert(t *testing.T, vectors [][]float32) []phaseResult {
    store := NewVectorStore(benchCompDim)
    store.Grow(benchCompTotal) // 预分配

    cfg := hnsw.Config{
        M: 16, EfConstruction: 200, EfSearch: 64,
        MaxLevel: 16, MetricType: "l2", // 注意: VectorStore 用 "l2" 而非 "euclidean"
    }
    idx := hnsw.NewHNSWIndex(benchCompDim, cfg, store)

    // 预加载所有向量
    for i, v := range vectors {
        store.Set(DocID(i), v)
    }
    // 逐条插入（与之前完全相同）
}
```

### 4.3 需要注意的适配点

1. **MetricType 字符串**: benchDistancer 忽略 metric 参数（始终用 L2），VectorStore 根据 `metric == "l2"` 分支。当前测试用 `"euclidean"`，需改为 `"l2"`。
2. **Grow 预分配**: VectorStore 需要 `Grow(n)` 预分配空间，否则每次 `Set` 都可能触发扩容。benchDistancer 的 `AddVector` 自动扩容。
3. **距离函数差异**: benchDistancer 用朴素 L2 循环，VectorStore 用 8 路展开 `L2Distance`。结果数值相同，但性能不同——VectorStore 更快。
4. **BBQ 量化开销**: `VectorStore.Set()` 会同时执行 BBQ 量化（`store.go:147-155`），这是 benchDistancer 没有的额外开销。但这只影响数据加载阶段，不影响 Insert 吞吐量测量（向量在 Insert 前已加载完毕）。
5. **包可见性**: `VectorStore` 在 `vectordb` 包中，测试文件也在 `vectordb` 包中（`package vectordb`），因此可直接访问，无需导出额外符号。

### 4.4 改用真实 distancer 的预期影响

- **Insert 吞吐量可能提升**: VectorStore 的连续内存布局比 `[][]float32` 更缓存友好，加上 8 路展开距离函数，实际 Insert 性能应该更好
- **对比更公平**: 使用生产 distancer 测量的吞吐量更能反映真实场景
- **预取优化效果更明显**: VectorStore 中 `ComputeDistance` 需要偏移量计算，预取优化消除了 query 侧的重复计算；而 benchDistancer 中偏移量计算本就不存在，预取优化效果被低估
