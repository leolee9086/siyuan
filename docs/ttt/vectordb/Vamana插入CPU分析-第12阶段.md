# Vamana Insert CPU Profile 分析报告 — Phase 12 基线

## 测试环境

- **OS**: Windows 11
- **测试时间**: 2026-02-11
- **数据规模**: 20,000 条 128 维随机向量，逐条 Insert
- **Vamana 配置**: DefaultConfig (R=64, L=100, Alpha=1.2, MaxBackedges=64)
- **总耗时**: 32.63s
- **平均插入速率**: 613/s
- **Profile 文件**: `kernel/vectordb/vamana/cpu_insert_profile.prof`
- **Profile 采样总量**: 32.93s (100.92%)

## 与 Phase 11 前对比

| 指标 | Phase 11 前 | Phase 12 基线 | 变化 |
|------|------------|--------------|------|
| 总耗时 | 4m14s (254s) | 32.63s | **7.8x 加速** |
| 平均速率 | 79/s | 613/s | **7.8x 提升** |
| dotProduct flat% | 80.93% | 73.28% | 下降 7.65pp |
| greedySearch cum% | 8.24% | 53.20% | **上升 44.96pp** |
| addEdgeAndPrune cum% | 86.98% | 29.49% | **下降 57.49pp** |
| robustPrune cum% | 75.94% | 37.41% | **下降 38.53pp** |

## Top 20 函数 (flat 排序)

| 排名 | flat | flat% | cum | cum% | 函数 |
|------|------|-------|-----|------|------|
| 1 | 24.13s | 73.28% | 24.24s | 73.61% | `dotProduct` |
| 2 | 1.96s | 5.95% | 15.37s | 46.67% | `(*VamanaIndex).fastDistanceToQuery` (inline) |
| 3 | 0.94s | 2.85% | 17.52s | 53.20% | `(*VamanaIndex).greedySearchFast` |
| 4 | 0.65s | 1.97% | 0.88s | 2.67% | `(*NeighborPriorityQueue).Insert` |
| 5 | 0.60s | 1.82% | 11.44s | 34.74% | `(*VamanaIndex).fastDistance` |
| 6 | 0.57s | 1.73% | 12.04s | 36.56% | `(*VamanaIndex).robustPruneCore` |
| 7 | 0.52s | 1.58% | 0.52s | 1.58% | `(*EpochSet).Insert` (inline) |
| 8 | 0.32s | 0.97% | 0.32s | 0.97% | `runtime.memmove` |
| 9 | 0.29s | 0.88% | 0.29s | 0.88% | `runtime.stdcall1` |
| 10 | 0.23s | 0.70% | 0.23s | 0.70% | `(*NeighborPriorityQueue).binarySearchInsertPos` (inline) |
| 11 | 0.20s | 0.61% | 0.20s | 0.61% | `runtime.memclrNoHeapPointers` |
| 12 | 0.13s | 0.39% | 0.18s | 0.55% | `runtime.findObject` |
| 13 | 0.12s | 0.36% | 0.17s | 0.52% | `runtime.lock2` |
| 14 | 0.11s | 0.33% | 0.55s | 1.67% | `runtime.scanobject` |
| 15 | 0.04s | 0.12% | 9.71s | 29.49% | `(*VamanaIndex).addEdgeAndPrune` |
| 16 | 0.03s | 0.09% | 0.46s | 1.40% | `runtime.bgsweep` |
| 17 | 0.03s | 0.09% | 0.22s | 0.67% | `runtime.freeSomeWbufs` |
| 18 | 0.03s | 0.09% | 0.26s | 0.79% | `runtime.schedule` |
| 19 | 0.02s | 0.06% | 0.18s | 0.55% | `runtime.memclrNoHeapPointersChunked` |
| 20 | 0.01s | 0.03% | 0.18s | 0.55% | `runtime.lockWithRank` (inline) |

## 关键调用链分析

### Insert 主路径时间分布 (cum 排序)

```
Insert (31.23s, 94.84% of total)
├── greedySearch (17.52s, 56.10% of Insert)  ← 新的主要瓶颈
│   └── greedySearchFast (17.52s, 100%)
│       ├── fastDistanceToQuery (15.37s, 87.73%)
│       │   └── dotProduct (内联)
│       ├── NeighborPriorityQueue.Insert (0.88s, 5.02%)
│       └── EpochSet.Insert (0.52s, 2.97%)
├── addEdgeAndPrune (9.71s, 31.09% of Insert)  ← 大幅下降（原 89.83%）
│   ├── robustPrune (8.83s, 90.94% of addEdgeAndPrune)
│   │   └── robustPruneCore (12.04s cum)
│   │       └── fastDistance (11.44s, 95.02%)
│   │           └── dotProduct
│   ├── fastDistanceToQuery (0.48s, 4.94%)
│   ├── containsID (0.15s, 1.54%)
│   ├── sync.RWMutex.Lock (0.08s, 0.82%)
│   └── sync.RWMutex.Unlock (0.03s, 0.31%)
├── robustPrune [新节点自身] (3.49s, 11.18% of Insert)
├── runtime.memmove (0.28s, 0.90%)
└── runtime.makeslice (0.23s, 0.74%)
```

### robustPrune 调用来源分解

```
robustPrune (12.32s total)
├── 来自 addEdgeAndPrune:  8.83s  71.67%  ← 反向边剪枝
└── 来自 Insert 直接调用:   3.49s  28.33%  ← 新节点自身剪枝
    └── robustPruneCore (12.04s, 97.73%)
    └── sort.Slice (0.19s, 1.54%)
    └── runtime.makeslice (0.08s, 0.65%)
```

## 瓶颈根因分析

### 1. 核心瓶颈转移：greedySearch 成为新的主要瓶颈 (53.20%)

Phase 11 优化大幅削减了 `addEdgeAndPrune` 的开销（从 86.98% 降至 29.49%），导致瓶颈分布发生根本性转移：

- **greedySearch** 现在占 Insert 的 **56.10%**（原仅 8.51%）
- 其内部 87.73% 时间在 `fastDistanceToQuery` → `dotProduct`
- 这是一个健康的分布变化：greedySearch 是 Vamana 算法的核心搜索路径，其开销与索引规模成正比

### 2. addEdgeAndPrune 仍是第二大开销 (29.49%)

虽然大幅下降，但仍占近 1/3 时间：
- 内部 90.94% 在 `robustPrune`
- 锁开销仅 1.13%（Lock 0.82% + Unlock 0.31%），不是瓶颈

### 3. dotProduct 仍是终极热点 (73.28% flat)

所有距离计算最终汇聚到 `dotProduct`，当前使用纯 Go 8 路循环展开实现。
这是一个计算密集型热点，适合 SIMD 加速。

### 4. 运行时开销极低

- GC 相关（scanobject + bgsweep + freeSomeWbufs）: ~2.74%
- 内存分配（memmove + memclr + makeslice）: ~2.13%
- 调度器（schedule + stdcall1）: ~1.67%
- 锁（lock2 + lockWithRank + RWMutex）: ~1.69%

## 与 HNSW 差距分析

| 指标 | Vamana (Phase 12) | HNSW | 差距 |
|------|-------------------|------|------|
| Insert 速率 | 613/s | 1431/s | 2.3x |

**差距来源**:
- Vamana 的 `addEdgeAndPrune` (9.71s, 31.09%) 在 HNSW 中无对应操作
- 如果去掉 addEdgeAndPrune，Insert 剩余 ~21.52s → 速率约 929/s，仍有 1.54x 差距
- 剩余差距来自 Vamana 的 robustPrune（新节点自身剪枝 3.49s）和更复杂的 greedySearch

## 优化方向建议

### 高优先级：加速 greedySearch (预期收益 ~20-30%)

1. **SIMD 加速 dotProduct**: 73.28% flat 时间在纯 Go dotProduct，AVX2 可提速 4-8x，预期整体提升 20-30%
2. **预取优化**: greedySearchFast 中对邻居节点的访问模式可利用 prefetch 减少 cache miss

### 中优先级：进一步削减 addEdgeAndPrune (预期收益 ~10-15%)

3. **减少 robustPrune 调用频率**: addEdgeAndPrune 中 90.94% 在 robustPrune，可考虑更激进的惰性剪枝策略
4. **距离缓存**: robustPruneCore 中的 fastDistance 调用可能存在重复计算

### 低优先级

5. **NeighborPriorityQueue 优化**: 2.67% cum，已使用二分插入，优化空间有限
6. **EpochSet 优化**: 1.58%，已内联，优化空间有限
