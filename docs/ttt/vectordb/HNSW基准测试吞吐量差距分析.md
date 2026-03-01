# HNSW 基准测试吞吐量差距100倍根因分析

## 问题

- **Phase 2** (`kernel/vectordb/hnsw/bench_insert_test.go`)：128维50K，~144–208 items/sec
- **Phase 6** (`kernel/vectordb/hnsw_vs_vamana_bench_test.go`)：128维50K，~13,241 items/sec
- 差距约 **65–92倍**

## 根因

**Phase 6 的 `benchDistancer.ComputeBBQDistance()` 返回常量 `0`，导致 HNSW 插入几乎不做有效工作。**

### 触发条件

`bbq.BBQEnableThreshold = 33`，两个测试均使用 `dim = 128`。

HNSW 的 `build.go` 中，当 `idx.Dimension >= bbq.BBQEnableThreshold` 时，`greedySearch()`、`searchLevel()`、`selectNeighborsHeuristic()` 全部走 BBQ 路径，调用 `ComputeBBQDistance()` 而非 `ComputeDistance()`。

### 两个 Distancer 的 BBQ 实现对比

| 方法 | Phase 2 `mockDistancer` | Phase 6 `benchDistancer` |
|------|------------------------|--------------------------|
| `ComputeBBQDistance(a, b)` | 回退到真实欧氏距离 `ComputeDistance(a, b, "")` | **返回常量 `0`** |
| `ComputeDistance(a, b, _)` | 真实欧氏距离 | 真实欧氏距离 |

### 后果链

1. `greedySearch()` 中所有 BBQ 距离 = 0，`dist < currentDist` 永远为 false → 贪心搜索**立即终止**
2. `searchLevel()` 中所有 BBQ 距离 = 0，候选集无法有效扩展 → 搜索**退化**
3. `selectNeighborsHeuristic()` 中 `distToRes = 0 < candidate.Distance` 几乎总为 true → 启发式裁剪**过度激进**，邻居列表极短
4. 综合效果：每次 Insert 几乎不遍历图、不做有效距离计算 → 吞吐量虚高

### 配置差异（次要因素）

| 参数 | Phase 2 (`DefaultConfig`) | Phase 6 (手动配置) |
|------|--------------------------|-------------------|
| `MetricType` | `"cosine"` | `"euclidean"` |
| `MaxLevel` | 16 | 16 |
| `M` | 16 | 16 |
| `EfConstruction` | 200 | 200 |

MetricType 差异在此场景下无影响，因为 BBQ 路径完全绕过了 `ComputeDistance`。

### 向量数据差异

两个测试均使用相同的随机向量生成方式（`rand.Float32()*2 - 1`，种子42），无显著差异。

## 结论

Phase 6 的 HNSW 吞吐量数据 **无效**，不能用于与 Vamana 的对比。`benchDistancer` 的 `ComputeBBQDistance()` 必须实现真实距离计算（如回退到欧氏距离），才能产生有意义的基准测试结果。

## 修复建议

将 `hnsw_vs_vamana_bench_test.go` 第88行：

```go
func (d *benchDistancer) ComputeBBQDistance(_, _ hnsw.DocID) float32 { return 0 }
```

改为与 Phase 2 的 `mockDistancer` 一致的回退实现：

```go
func (d *benchDistancer) ComputeBBQDistance(a, b hnsw.DocID) float32 {
    return d.ComputeDistance(a, b, "")
}
```
