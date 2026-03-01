# Vamana Insert CPU Profile 分析报告

## 测试环境

- **OS**: Windows 11
- **测试时间**: 2026-02-10
- **数据规模**: 20,000 条 128 维随机向量，逐条 Insert
- **Vamana 配置**: DefaultConfig (R=64, L=100, Alpha=1.2, MaxBackedges=64)
- **总耗时**: 4m14s
- **平均插入速率**: 79/s
- **Profile 文件**: `kernel/vectordb/vamana/cpu_insert_profile.prof`

## Top 20 函数 (flat 排序)

| 排名 | flat | flat% | cum | cum% | 函数 |
|------|------|-------|-----|------|------|
| 1 | 203.40s | 80.93% | 203.49s | 80.97% | `dotProduct` |
| 2 | 14.92s | 5.94% | 177.79s | 70.74% | `(*VamanaIndex).fastDistance` |
| 3 | 8.97s | 3.57% | 187.29s | 74.52% | `(*VamanaIndex).robustPruneCore` |
| 4 | 3.79s | 1.51% | 3.82s | 1.52% | `runtime.stdcall1` |
| 5 | 3.61s | 1.44% | 18.08s | 7.19% | `(*VamanaIndex).fastDistanceToQuery` |
| 6 | 3.05s | 1.21% | 30.04s | 11.95% | `(*VamanaIndex).distanceToQuery` |
| 7 | 0.76s | 0.30% | 20.70s | 8.24% | `(*VamanaIndex).greedySearchFast` |
| 8 | 0.65s | 0.26% | 0.89s | 0.35% | `(*NeighborPriorityQueue).Insert` |
| 9 | 0.58s | 0.23% | 0.58s | 0.23% | `(*EpochSet).Insert` |
| 10 | 0.45s | 0.18% | 218.60s | 86.98% | `(*VamanaIndex).addEdgeAndPrune` |
| 11 | 0.35s | 0.14% | 21.17s | 8.42% | `euclideanDistanceWithNorm` |
| 12 | 0.31s | 0.12% | 1.27s | 0.51% | `runtime.findRunnable` |
| 13 | 0.18s | 0.07% | 1.79s | 0.71% | `runtime.schedule` |
| 14 | 0.14s | 0.06% | 2.61s | 1.04% | `sort.pdqsort_func` |
| 15 | 0.12s | 0.05% | 26.99s | 10.74% | `euclideanDistance` |
| 16 | 0.10s | 0.04% | 1.69s | 0.67% | `runtime.makeslice` |
| 17 | 0.09s | 0.04% | 6.27s | 2.49% | `runtime.goschedImpl` |
| 18 | 0.08s | 0.03% | 6.31s | 2.51% | `runtime.newstack` |
| 19 | 0.07s | 0.03% | 4.12s | 1.64% | `runtime.startm` |
| 20 | 0.06s | 0.02% | 190.85s | 75.94% | `(*VamanaIndex).robustPrune` |

## 关键调用链分析

### Insert 主路径时间分布 (cum 排序)

```
Insert (243.35s, 96.83%)
├── addEdgeAndPrune (218.60s, 89.83% of Insert)  ← 绝对瓶颈
│   ├── robustPrune (187.39s, 85.72% of addEdgeAndPrune)
│   │   └── robustPruneCore (187.29s)
│   │       └── fastDistance (177.79s, 94.93% of robustPruneCore)
│   │           └── dotProduct (203.40s flat)
│   └── distanceToQuery (30.04s, 13.74% of addEdgeAndPrune)
│       └── euclideanDistance → euclideanDistanceWithNorm → dotProduct
├── greedySearch (20.70s, 8.51% of Insert)
│   └── greedySearchFast → fastDistanceToQuery → dotProduct
└── robustPrune (3.46s, 1.42% of Insert)  ← 新节点自身的剪枝，占比很小
```

### addEdgeAndPrune 内部分解

```
addEdgeAndPrune (218.60s)
├── robustPrune       187.39s  85.72%  ← 反向边触发的剪枝
├── distanceToQuery    30.04s  13.74%  ← 构建候选列表的距离计算
├── containsID          0.27s   0.12%
├── makeslice           0.22s   0.10%
├── sync.RWMutex.Lock   0.14s   0.06%
└── sync.RWMutex.Unlock 0.08s   0.04%
```

**关键发现**: 锁开销仅占 0.1%，不是瓶颈。

## 瓶颈根因分析

### 1. 核心瓶颈：反向边剪枝中的距离计算 (86.98%)

每次 Insert 调用 `addEdgeAndPrune` 最多 MaxBackedges=64 次（即对每个前向邻居都尝试添加反向边）。每次 `addEdgeAndPrune` 在邻居已满时触发 `robustPrune`，其内部 `robustPruneCore` 的 occlude 循环对候选集做 O(n²) 级别的 `fastDistance` 调用。

**时间占比链**:
- `addEdgeAndPrune` cum=218.60s → 其中 `robustPrune` cum=187.39s → 其中 `fastDistance` cum=177.79s
- `fastDistance` 内部 94.93% 时间在 `dotProduct`（纯浮点计算）

### 2. 次要瓶颈：greedySearch (8.24%)

`greedySearch` 占 Insert 的 8.51%，相对合理。其内部同样以距离计算为主。

### 3. dotProduct 是终极热点 (80.93% flat)

所有距离计算最终汇聚到 `dotProduct`，当前使用 8 路循环展开的纯 Go 实现。
128 维向量的 dotProduct 需要 128 次乘法 + 128 次加法。

## 与 HNSW 差距的根因

HNSW Insert 1292/s vs Vamana Insert 79/s（本次测试），差距约 16 倍。

**算法层面差异**:
- HNSW Insert: 每层做一次 greedySearch + 简单的邻居列表维护（无 robustPrune）
- Vamana Insert: greedySearch + robustPrune(新节点) + **最多 64 次 addEdgeAndPrune(反向边)**
- 每次 addEdgeAndPrune 在邻居满时触发完整的 robustPrune（O(candidates² × dim) 距离计算）

**数据佐证**:
- addEdgeAndPrune 占 Insert 的 89.83%
- 如果去掉 addEdgeAndPrune，Insert 剩余时间约 24.75s → 速率约 808/s，接近 HNSW

## 优化方向建议

### 高优先级：减少 addEdgeAndPrune 中的距离计算次数

1. **降低 MaxBackedges**: 当前 MaxBackedges=R=64，每次 Insert 最多触发 64 次反向边更新。可考虑降低到更小值（如 R/2 或更少）
2. **延迟剪枝 / 惰性剪枝**: 反向边添加时不立即触发 robustPrune，而是允许邻居列表临时超限，定期批量剪枝
3. **addEdgeAndPrune 中的 GraphSlackFactor 阈值**: 当前已有 `addEdgeAndPruneLocked` 使用 GraphSlackFactor 延迟剪枝，但 `addEdgeAndPrune`（Insert 路径使用的版本）未使用此优化

### 中优先级：加速 dotProduct

4. **SIMD 加速**: 当前 dotProduct 使用 8 路循环展开的纯 Go 实现，可通过 assembly 或 CGO 使用 AVX2/AVX-512 指令集
5. **减少 robustPruneCore 中的距离计算**: 利用三角不等式或其他剪枝策略提前跳过不必要的 fastDistance 调用

### 低优先级

6. **sort.Slice 优化**: robustPrune 中的排序占 1.04%，可考虑使用 partial sort
7. **内存分配**: makeslice 占 0.67%，可进一步复用缓冲区
