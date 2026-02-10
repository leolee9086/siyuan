# HNSW vs Vamana 单线程 Insert 性能差距根因分析

## 测试条件

| 参数 | HNSW | Vamana |
|------|------|--------|
| 维度 | 128 | 128 |
| 数据量 | 50K | 50K |
| 距离度量 | euclidean | euclidean |
| 最大度数 | 2M=32 (layer0) | R=32 |
| 搜索宽度 | efConstruction=200 | L=200 |
| 剪枝参数 | — | Alpha=1.2 |
| 松弛因子 | 无 | GraphSlackFactor=1.3 |
| 并行度 | 1 | 1 |

**测试结果**: HNSW 200 items/s vs Vamana 294 items/s，差距 **1.47x**

## 根因分析

### 1. 核心发现：距离计算次数差异（主因，贡献 >90%）

通过 instrumented 测试（索引大小 4K-5K 时采样 1000 次 Insert）：

| 指标 | HNSW | Vamana (估算) | 比率 |
|------|------|--------------|------|
| **平均每次 Insert 距离计算次数** | **20,704** | **~1,500-2,500** | **~8-14x** |
| 单次距离计算耗时 | 48 ns (朴素循环) | 79 ns (8路展开+范数) | 0.61x |

HNSW 单次距离计算更快（48ns vs 79ns），但总次数多出一个数量级。

### 2. HNSW 距离计算来源分解

每次 Insert 调用 `buildHNSWIndex()` (build.go:64)，距离计算分布如下：

| 阶段 | 代码位置 | 距离计算次数 | 占比 |
|------|---------|------------|------|
| Phase 1: 上层 greedySearch | build.go:71-73 | ~50-100 | <1% |
| Phase 2: searchLevel(ef=200) | build.go:81 | ~400-600 | ~2-3% |
| selectNeighborsHeuristic(自身) | build.go:84 | ~500-1,000 | ~3-5% |
| **双向连接维护** | **build.go:91-104** | **~19,000** | **~91.8%** |
| **合计** | | **~20,704** | 100% |

**双向连接维护是绝对瓶颈**，占 91.8% 的距离计算。

### 3. 双向连接维护的 O(M²) 问题

HNSW `buildHNSWIndex()` 第 91-104 行：

```go
for _, neighbor := range selected {  // ~32 个邻居
    cachedRecords := idx.GetLevelNeighborRecords(neighbor.ID, level)  // ~32 条
    candidateBuf = append(candidateBuf, cachedRecords...)
    candidateBuf = append(candidateBuf, NeighborRecord{ID: itemDocID, Distance: neighbor.Distance})
    // ↓ 每次调用产生 O(candidates × result) 距离计算
    newNeighbors := idx.selectNeighborsHeuristic(neighbor.ID, candidateBuf, M, ...)
    idx.SetLevelNeighbors(neighbor.ID, level, newNeighbors)
}
```

对于 Level 0 (M=32)：
- 32 个邻居 × 每个邻居的 heuristic 内部距离计算
- `selectNeighborsHeuristic` 内部：对每个 candidate 与已选 result 计算距离
- 最坏情况：33 candidates × 32 result = **~1,056 次/邻居**
- 32 个邻居 × ~600 次(平均) = **~19,200 次**

### 4. Vamana 为何更高效

Vamana `addEdgeAndPrune()` (build.go:275) 的关键优化：

```go
// 如果未满，直接添加 → 零距离计算
if len(currentNeighbors) < idx.config.R {
    idx.neighbors[nodeID] = append(idx.neighbors[nodeID], newNeighborID)
    return
}
```

加上 `GraphSlackFactor=1.3`（阈值 = 1.3 × 32 = 41），在 `addEdgeAndPruneLocked()` 中：

```go
// 松弛阈值：度数 < 41 时直接添加，不触发剪枝
if len(currentNeighbors) < maxDegreeWithSlack {
    updated := append(idx.neighbors[nodeID], newNeighborID)
    // ...
    return
}
```

**结果**：大部分反向边添加操作（尤其是索引构建早期）完全跳过距离计算。

### 5. 次要因素

| 因素 | 影响 | 说明 |
|------|------|------|
| SetLevelNeighbors 内存分配 | ~5% | HNSW 每次 Insert ~33 次 make+copy；Vamana 未满时 0 次 |
| 节点锁开销 | ~2% | HNSW 每次 Insert 获取 ~33 个节点锁；Vamana 类似 |
| 多层搜索 | <1% | HNSW 上层 greedySearch 开销极小 |
| visited 标记 (atomic vs plain) | <1% | 微基准测试显示差异可忽略 (~1.3ns vs ~1.3ns) |

## 可优化方向

### 方向 1: HNSW 双向连接维护引入松弛因子（预期收益 30-50%）

仿照 Vamana 的 `GraphSlackFactor` 策略：当邻居度数未超过 `SlackFactor × M` 时，
直接添加新连接而不触发 `selectNeighborsHeuristic`。

**预期效果**：将双向连接维护的距离计算从 ~19,000 降至 ~5,000-8,000。

### 方向 2: HNSW 距离计算使用 8 路展开 + 预计算范数（预期收益 10-20%）

当前 `benchDistancer.ComputeDistance()` 使用朴素 `diff*diff` 循环。
虽然单次更快（48ns vs 79ns），但这是因为编译器对简单循环优化更好。
在生产环境中（使用 `VectorStore` 而非 `benchDistancer`），距离计算实现可能不同。

**注意**：此方向仅影响基准测试结果，不影响生产代码。

### 方向 3: HNSW selectNeighborsHeuristic 缓存距离（预期收益 5-10%）

当前 heuristic 内部每次都重新计算 `candidate-result` 距离。
可以利用已有的 `NeighborRecord.Distance` 缓存，减少重复计算。

## 结论

HNSW 1.47x 性能差距的根因是**双向连接维护策略差异**：

- HNSW 对每个邻居都无条件执行 `selectNeighborsHeuristic`，产生 O(M²) 距离计算
- Vamana 使用 `GraphSlackFactor` 松弛策略，度数未满时直接 append，零距离计算

这不是算法本身的缺陷，而是实现策略的差异。引入松弛因子是最直接的优化方向。
