# HNSW 插入性能根因调查报告

> **调查日期**: 2026-02-09
> **调查范围**: HNSW 索引插入路径全链路分析
> **结论**: 最大瓶颈是 **双向连接维护中的 O(M²·efConstruction) 距离计算**，其次是 **高频锁获取/释放** 和 **VectorStore.Set() 中的 BBQ 量化开销**。

---

## 1. 代码路径分析

### 1.1 插入完整调用链

```
api.go:putPointsHandler()          — HTTP 入口，逐条调用 InsertPoint
  └─ hnsw_proxy.go:InsertPoint()   — Collection 级代理
       ├─ c.Mu.Lock/Unlock         — Collection 全局写锁（ID映射+Meta）
       ├─ c.Store.Set(docID, vec)  — 向量存储 + BBQ量化
       └─ c.HNSWIdx.Insert(docID)  — HNSW 核心插入
            ├─ InitItemNeighbors() — idx.Mu.Lock（分配邻居结构）
            ├─ SelectEntryPoint()  — idx.Mu.RLock
            └─ buildHNSWIndex()    — 核心图构建
                 ├─ greedySearch()          — Phase 1: 顶层贪心下降
                 ├─ searchLevel()           — Phase 2: ef_construction 候选搜索
                 ├─ selectNeighborsHeuristic() — 启发式邻居选择
                 ├─ SetLevelNeighbors()     — idx.Mu.Lock（写入邻居）
                 └─ 双向连接维护循环        — 对每个被选邻居重新裁剪
                      ├─ GetLevelNeighbors()           — 读取邻居的邻居
                      ├─ ComputeBBQDistance() × N       — 重算所有距离
                      ├─ selectNeighborsHeuristic()    — 再次裁剪
                      └─ SetLevelNeighbors()           — idx.Mu.Lock
```

### 1.2 发现的问题

| 问题 | 严重程度 | 说明 |
|------|---------|------|
| 插入路径上存在大量串行距离计算 | **高** | 每次插入触发 searchLevel + 双向连接维护，距离计算次数随图规模增长 |
| `putPointsHandler` 逐条串行插入 | **中** | 批量插入未并行化，但单线程场景下非主要瓶颈 |
| `Store.Set()` 每次插入执行 BBQ 量化 | **低** | 量化本身开销不大，但包含写锁 |

### 1.3 初步优化建议

- 将 `buildHNSWIndex` 中的贪心搜索阶段与图写入阶段分离（Lock-Snapshot-Unlock 模式）
- 批量插入时可考虑并行化 searchLevel 阶段

---

## 2. 锁竞争分析

### 2.1 插入路径上的锁清单

| 锁 | 位置 | 类型 | 持有期间操作 | 频率/次插入 |
|----|------|------|-------------|------------|
| `c.Mu` | `hnsw_proxy.go:47-66` | Write | ID映射查找/分配 + Meta更新 | 1次 |
| `s.mu` | `store.go:94` | Write | 向量存储 + BBQ量化 + 打包 | 1次 |
| `idx.Mu` | `utils.go:40-41` | Write | InitItemNeighbors 分配邻居数组 | 1次 |
| `idx.Mu` | `utils.go:60-61` | Read | GetItemLevel | 1次 |
| `idx.Mu` | `utils.go:161-163` | Read | SelectEntryPoint | 1次 |
| `idx.Mu` | `utils.go:100-101` | Write | SetLevelNeighbors | **1 + M×层数** 次 |
| `idx.Mu` | `build.go:39/53` | Write | 更新 EntryPoint/MaxLayer | 1次 |

### 2.2 发现的问题

| 问题 | 严重程度 | 说明 |
|------|---------|------|
| `SetLevelNeighbors` 在双向连接循环中被高频调用 | **高** | 每个被选邻居都触发一次 `idx.Mu.Lock()`，M=16 时 Level 0 最多 32 次写锁获取 |
| `idx.Mu` 是全局 RWMutex，粒度过粗 | **高** | 所有节点的邻居读写共享同一把锁，参见 `locking-strategy.review.md` 的分析 |
| `GetLevelNeighborIDs` 无锁读取 | **低** | 虽然注释说"调用方不得修改"，但在并发场景下存在数据竞争风险（当前单线程插入暂无问题） |

### 2.3 关键发现：锁获取频率分析

单次插入（Level 0，M=16，efConstruction=200）的锁操作次数估算：

```
InitItemNeighbors:     1 × Write Lock
SelectEntryPoint:      1 × Read Lock
searchLevel:           0 × Lock（距离计算走 Distancer 接口，无锁）
SetLevelNeighbors:     1 × Write Lock（设置自身邻居）
双向连接循环:
  GetLevelNeighbors:   最多 32 × 无锁读（GetLevelNeighborIDs 无锁）
  SetLevelNeighbors:   最多 32 × Write Lock
更新 EntryPoint:       1 × Write Lock
─────────────────────────────────
总计: ~35 次 Write Lock + 1 次 Read Lock / 每次插入
```

### 2.4 初步优化建议

- 将 `idx.Mu` 拆分为元数据锁（保护 EntryPoint/MaxLayer）和节点级锁（保护邻居列表）
- 双向连接维护中的 `SetLevelNeighbors` 可批量化，减少锁获取次数
- 参考内存版 Vamana 的 `nodeLocks` 设计

---

## 3. 距离计算开销分析

### 3.1 每次插入的距离计算次数

以 Level 0 插入、M=16、efConstruction=200 为例：

| 阶段 | 距离计算次数 | 说明 |
|------|-------------|------|
| `greedySearch` (Phase 1) | ~M×层数 ≈ 0（大部分节点 Level=0） | 从高层贪心下降，通常跳过 |
| `searchLevel` (Phase 2) | **~efConstruction × M = ~3200** | 搜索 200 个候选，每个候选检查 M 个邻居 |
| `selectNeighborsHeuristic` (自身) | **最多 M² = ~1024** | 对候选集做启发式裁剪，两两比较 |
| 双向连接维护 | **最多 M × (M+1) = ~544** | 每个被选邻居重算其所有邻居距离 |
| **总计** | **~4800 次/插入** | 随图规模增长，searchLevel 实际访问节点数增加 |

### 3.2 距离函数实现分析

**`distance.go` — 纯 Go 实现，无 SIMD 优化**

- `CosineDistance`: 4路循环展开，但仍是标量运算
- `L2Distance`: 同上
- 无 `math/bits` 或 `unsafe` 的 SIMD intrinsics
- 无 assembly 文件（`_amd64.s`）

**BBQ 量化距离** — 用于 dim ≥ 33 的场景：

- `ComputeBBQDistance` (`store.go:215-240`): 读取打包数据 → `ComputePackedDotProduct` → `ComputeQuantizedDistance`
- `ComputePackedDotProduct` 使用 `math/bits.OnesCount64` (POPCNT)
- 量化距离计算本身较快，但 **每次调用仍有边界检查和函数调用开销**

### 3.3 发现的问题

| 问题 | 严重程度 | 说明 |
|------|---------|------|
| 距离函数无 SIMD 优化 | **中** | 纯 Go 标量运算，128维 cosine 约需 ~500ns（估算），SIMD 可提速 4-8x |
| 每次插入 ~4800 次距离计算 | **高** | 这是 O(efConstruction × M) 的算法固有开销，但可通过降低 efConstruction 或使用更快的距离函数缓解 |
| `selectNeighborsHeuristic` 中的距离重算 | **高** | `build.go:96-103` 对邻居的邻居重新计算距离，即使这些距离可能已经在 searchLevel 中计算过 |
| BBQ 量化距离的函数调用链过长 | **低** | `ComputeBBQDistance` → `ComputePackedDotProduct` → `ComputeQuantizedDistance`，3层调用 |

### 3.4 初步优化建议

- 引入 SIMD 优化的距离函数（Go assembly 或 CGO）
- 缓存已计算的距离，避免 `selectNeighborsHeuristic` 中的重复计算
- 考虑降低 `efConstruction` 从 200 到 100-150（需验证召回率影响）

---

## 4. 图维护开销分析

### 4.1 双向连接维护 — 最大性能瓶颈

`buildHNSWIndex` 的 `build.go:85-117` 是插入路径上最重的操作：

```go
// build.go:85-117 — 对每个被选邻居执行
for i, neighbor := range selected {
    neighborNeighbors := idx.GetLevelNeighbors(selected[i].ID, level)  // 读取邻居的邻居
    candidatesForNeighbor := make([]NeighborRecord, len(neighborNeighbors)+1)
    copy(candidatesForNeighbor, neighborNeighbors)

    // ⚠️ 关键瓶颈：重新计算所有距离
    for j := 0; j < len(neighborNeighbors); j++ {
        nID := candidatesForNeighbor[j].ID
        candidatesForNeighbor[j].Distance = idx.Distancer.ComputeBBQDistance(neighbor.ID, nID)
    }

    candidatesForNeighbor[len(neighborNeighbors)] = NeighborRecord{ID: itemDocID, Distance: neighbor.Distance}
    newNeighbors := idx.selectNeighborsHeuristic(neighbor.ID, candidatesForNeighbor, M, ...)
    idx.SetLevelNeighbors(neighbor.ID, level, newNeighbors)
}
```

### 4.2 复杂度分析

| 操作 | 复杂度 | 说明 |
|------|--------|------|
| 双向连接循环 | O(M) 次迭代 | Level 0 时 M_max = 2M = 32 |
| 每次迭代的距离重算 | O(M) 次距离计算 | 重算邻居的所有现有邻居距离 |
| `selectNeighborsHeuristic` | O(M²) 比较 | 启发式裁剪中的两两距离比较 |
| **单层总计** | **O(M² × 距离计算)** | M=16, Level 0: ~32 × (32+1) ≈ 1056 次距离计算 |

### 4.3 `GetLevelNeighbors` 的内存分配问题

`utils.go:82-96` 每次调用都分配新的 `[]NeighborRecord`：

```go
func (idx *HNSWIndex) GetLevelNeighbors(docID DocID, level int) []NeighborRecord {
    ids := idx.GetLevelNeighborIDs(docID, level)
    records := make([]NeighborRecord, len(ids))  // ⚠️ 每次分配
    for i, id := range ids {
        records[i] = NeighborRecord{ID: id, Distance: 0}
    }
    return records
}
```

在双向连接循环中，这导致每次插入 ~32 次 `[]NeighborRecord` 分配。

### 4.4 邻居列表只存 ID 不存距离

`Neighbors [][][]DocID` 只存储邻居 ID，不存储距离。这意味着：
- 每次双向连接维护都必须**重新计算**所有邻居间距离
- 这是 `build.go:96-103` 距离重算循环存在的根本原因
- 如果存储距离，可以避免大量重复计算

### 4.5 层级分配策略

`RandomLevel` (`utils.go:28-34`) 使用 p=0.5 的几何分布：

```go
func RandomLevel(maxLevel int) int {
    level := 0
    for rand.Float32() < 0.5 && level < maxLevel-1 {
        level++
    }
    return level
}
```

- 标准 HNSW 论文使用 p = 1/M（约 1/16 ≈ 0.0625）
- 当前 p=0.5 导致高层节点过多，增加了不必要的图维护开销
- 期望层级 E[level] = 1（p=0.5）vs E[level] ≈ 0.07（p=1/M）

### 4.6 发现的问题

| 问题 | 严重程度 | 说明 |
|------|---------|------|
| 双向连接维护中的距离重算 | **高** | 邻居列表不存距离，每次必须重算 O(M²) 次距离 |
| `GetLevelNeighbors` 高频内存分配 | **中** | 每次插入 ~32 次 `[]NeighborRecord` 分配，增加 GC 压力 |
| `RandomLevel` 的 p=0.5 过高 | **高** | 标准 HNSW 使用 p=1/M，当前设置导致高层节点过多，图维护开销成倍增加 |
| `selectNeighborsHeuristic` 中的距离计算无缓存 | **中** | 候选间距离可能在 searchLevel 中已计算过 |

### 4.7 初步优化建议

- **P0**: 将 `RandomLevel` 的概率从 0.5 改为 1/M（约 0.0625），这是最小改动最大收益的优化
- **P1**: 在 `Neighbors` 中同时存储距离，避免双向连接维护时的距离重算
- **P2**: 使用对象池或预分配缓冲区减少 `GetLevelNeighbors` 的内存分配
- **P3**: 引入距离缓存，避免 `selectNeighborsHeuristic` 中的重复计算

---

## 5. 性能测试数据

### 5.1 测试环境

- OS: Windows 11
- Go: 1.25.4
- CPU: 12核（具体型号未知）

### 5.2 128维 × 200k 测试 (TestHNSW1MPerformance)

| 数据量区间 | 插入速率 (items/sec) | 衰减比 |
|-----------|---------------------|--------|
| 0 → 20,000 | 1,097 | 基准 |
| 20,000 → 40,000 | 833 | -24% |
| 40,000 → 60,000 | 722 | -34% |
| 60,000 → 80,000 | 688 | -37% |
| 80,000+ | 超时 (2min) | — |

**超时时调用栈**: `searchLevel` → `ComputeBBQDistance` → `ComputeQuantizedDistance`

### 5.3 1024维 × 10k 测试 (TestHNSW1024DimPerformance)

| 指标 | 值 |
|------|-----|
| 总插入时间 | 16.42s |
| 平均插入速率 | **609 items/sec** |
| 搜索延迟 (100 queries, top-10, ef=300) | 1.18 ms/query |
| 搜索 QPS | 849.84 |

### 5.4 衰减分析

128维测试显示明显的 **O(N·log(N))** 衰减特征：
- 随着图规模增长，`searchLevel` 需要访问更多节点
- 双向连接维护中每个邻居的邻居列表更长，距离重算次数增加
- `RandomLevel` p=0.5 导致高层节点过多，加剧了衰减

---

## 6. 根因总结与优先级排序

### 最大瓶颈（按影响排序）

1. **🔴 双向连接维护的 O(M²) 距离重算** — 邻居列表不存距离，每次插入必须重算所有邻居间距离。这是单次插入耗时的主要组成部分（估算占 60-70%）。

2. **🔴 `RandomLevel` p=0.5 导致层级过高** — 标准 HNSW 使用 p=1/M≈0.0625，当前 p=0.5 使平均层级从 0.07 膨胀到 1.0，高层节点数量增加约 14 倍，直接导致 `buildHNSWIndex` 需要在更多层级上执行搜索和连接维护。

3. **🟡 `efConstruction=200` 偏高** — 导致 searchLevel 每次搜索 200 个候选节点，距离计算次数与此参数线性相关。可考虑降至 100-150。

4. **🟡 距离函数无 SIMD 优化** — 纯 Go 标量运算，128维约 500ns/次，SIMD 可提速 4-8x。

5. **🟢 锁粒度过粗** — 单线程插入场景下非主要瓶颈，但在并发场景下会成为阻塞因素。
