# Vamana Insert 性能优化 执行跟踪 (TikTocTak)

> **目标**: 修复 Vamana Insert 性能严重落后于 HNSW 的问题（258/s vs 1292/s，差距5x）
>
> **流程**: 滚动更新的执行路线图。

## 项目背景

- **现状**: Phase 10 对比测试显示 Vamana Insert 258/s，HNSW Insert 1292/s，差距约5倍。理论上两者作为图索引应该是同等性能级别。
- **基线数据**: Vamana Insert 258/s, Build-1T 454/s, Build-MT 3102/s
- **相关代码**:
  - `kernel/vectordb/vamana/build.go` — Insert/Build/robustPrune
  - `kernel/vectordb/vamana/search.go` — greedySearch
  - `kernel/vectordb/vamana/index.go` — 数据结构定义
  - `kernel/vectordb/vamana/distance.go` — 距离计算
  - `kernel/vectordb/store.go` — HNSW 的 VectorStore（对照参考）

## 🔍 根因分析（初步）

### 1. 内存布局差异（最大瓶颈）
- **HNSW**: VectorStore 使用连续 `[]float32`，`vectors[docID * dim + i]`，缓存友好
- **Vamana**: 使用 `[][]float32`，每个向量独立堆分配，50K向量=50K次独立分配，缓存极不友好
- **影响**: greedySearch 中每次距离计算都可能触发 cache miss

### 2. Insert 路径锁竞争
- `Insert()` 持有全局 `idx.mu.Lock()` 进行分配
- `greedySearch()` 需要 `idx.mu.RLock()` — 与 Insert 的写锁互斥
- `addEdgeAndPrune()` 使用三重锁：`nodeLocks[nodeID].Lock()` + `idx.mu.RLock()` + `idx.mu.Lock()`
- 对比：BuildParallel 使用 `addEdgeAndPruneLocked()` 仅用 `nodeLocks`，无全局锁

### 3. 内存分配无预分配
- `Insert()` 每次调用：
  - `append(idx.vectors, vector)` — 可能触发整个 vectors 切片重新分配
  - `append(idx.neighbors, nil)` — 同上
  - `append(idx.normSquares, ...)` — 同上
  - `idx.nodeLocks` 重新分配（当 id >= len(nodeLocks)）— 创建全新数组并复制

### 4. Insert 使用非优化代码路径
- Insert 用 `addEdgeAndPrune`（三重锁），BuildParallel 用 `addEdgeAndPruneLocked`（单锁）
- Insert 用 `robustPrune`（每次分配新 scratch），BuildParallel 用 `robustPruneWithScratch`（复用）

## 🟢 近期计划 — Phase 14: 算法级深度优化——减少距离计算次数

**基线**: Vamana Insert 658/s, HNSW Insert 1460/s, 差距 2.34x
**目标**: 通过减少冗余距离计算大幅缩小差距

### Phase 14 根因分析

Phase 13 统计数据揭示的关键瓶颈：

1. **距离计算冗余**
   - 20K规模下平均每次Insert 11,672次距离计算
   - greedySearch已计算大量距离，但后续selfPrune和backedge阶段完全重新计算
   - backedge占48%，greedySearch占34%，selfPrune占17%

2. **backedge策略低效**
   - backedge占48%距离计算，但仅4.3%的addEdgeAndPrune调用触发robustPrune
   - 绝大多数backedge检查是无效的全量距离重算

3. **与HNSW的核心差异**
   - HNSW通过缓存NeighborRecord.Distance避免重复计算
   - HNSW在bidirectional connection时直接使用缓存距离进行neighbor选择

### Phase 14 优化计划

- [ ] **14-1**: 距离缓存——greedySearch计算的距离在selfPrune和backedge阶段复用
- [ ] **14-2**: backedge启发式——用廉价判断替代全量robustPrune入口检查
- [ ] **14-3**: 验证 + 召回率回归测试 + 性能对比

## 🔵 中期计划

- [ ] Vamana Insert 衰减率优化（当前0.37 vs HNSW 0.56）
- [x] ~~Vamana 内存布局优化~~ — 已确认先前迭代中已完成（vectorData + sub-slice 视图）

## 🏁 已归档/已完成

- [x] **Phase 13: 算法级优化——预取+距离计算分析 (2026-02-10)** — 完成（+3.9%）
  - **调查结果**: 20K规模下平均每次Insert 11,672次距离计算；backedge占48%，greedySearch占34%，selfPrune占17%；仅4.3%的addEdgeAndPrune调用触发robustPrune
  - **优化内容**: 在5个热路径循环添加prefetch（greedySearchFast、greedySearchForBuild、robustPruneCore、addEdgeAndPruneLocked、addEdgeAndPrune）；添加 `prefetchVector()` helper 到 distance.go
  - **吞吐量**: Vamana Insert 633→658/s (+3.9%)，HNSW/Vamana 差距 2.31x→2.34x（波动范围内）
  - **50K对比**: HNSW 1460/s, Vamana 624/s, 差距 2.34x
  - **修改文件**: `kernel/vectordb/vamana/build.go`, `kernel/vectordb/vamana/distance.go`, `kernel/vectordb/vamana/insert_stats_test.go`
  - **单元测试**: recall无回归
  - **失败记录**: 无
  - **结论**: 预取优化效果有限（~4%），瓶颈已从实现层面转移到算法层面——Vamana的robustPrune（自身+backedge）执行O(n²)距离计算，而HNSW通过缓存NeighborRecord.Distance避免重复计算
  - **遗留问题**: 差距仍为2.34x，需要算法级距离缓存优化

- [x] **Phase 12: Insert 路径深度优化 (2026-02-10)** — 完成（+23.2%）
  - **根因**: Phase 12-1 CPU Profile 显示瓶颈转移：greedySearch 56%，addEdgeAndPrune 31%，dotProduct 73% flat
  - **优化内容**: scratch 复用（robustPrune→robustPruneWithScratch）、预计算 queryNormSq（greedySearch→greedySearchFast）、addEdgeAndPrune 新增 scratch 参数、nodeLocks 2x 扩容预分配
  - **连续内存布局**: 确认先前迭代已完成（vectorData + sub-slice 视图）
  - **吞吐量**: Vamana Insert 517→637/s (+23.2%)，HNSW/Vamana 差距 2.8x→2.31x
  - **分阶段数据**: HNSW 2229→1237/s (衰减0.56), Vamana 1261→470/s (衰减0.37)
  - **全索引数据**: HNSW 1475/s, Vamana Insert 637/s, Build-1T 542/s, Build-MT 3789/s, DiskVamana Build 3672/s
  - **修改文件**: `kernel/vectordb/vamana/build.go`
  - **单元测试**: 全部通过
  - **失败记录**: 无
  - **遗留问题**: Vamana Insert 衰减率 0.37 仍低于 HNSW 的 0.56；差距 2.31x 仍存在

- [x] **Phase 11: addEdgeAndPrune GraphSlackFactor 松弛策略 (2026-02-10)** — 完成（+100%）
  - **根因**: CPU Profile 显示 `addEdgeAndPrune()` 占 Insert 总时间 89.83%，因使用 `R` 阈值（满即剪枝），而 Build 路径使用 `GraphSlackFactor * R`（松弛后才剪枝）
  - **优化内容**: 重写 `addEdgeAndPrune()` 使其与 `addEdgeAndPruneLocked()` 一致：松弛阈值、lock-copy-unlock-prune-lock-write 三阶段锁、移除全局锁、升级 fastDistanceToQuery
  - **吞吐量**: Vamana Insert 258→517/s (+100%)，HNSW/Vamana 差距 5.0x→2.8x
  - **分阶段数据**: HNSW 2065→1215/s (衰减0.59), Vamana 1149→382/s (衰减0.33)
  - **全索引数据**: HNSW 1431/s, Vamana Insert 517/s, Build-1T 549/s, Build-MT 2084/s, DiskVamana Insert 82/s, DiskVamana Build 2226/s
  - **修改文件**: `kernel/vectordb/vamana/build.go`
  - **单元测试**: 20/20 通过，含 100K 并行构建 Recall@10=100%
  - **失败记录**: Profile 测试名不匹配（TestVamanaInsertProfile vs TestInsertCPUProfile）；50K 规模 profile 测试超时，降至 20K 成功
  - **遗留问题**: Vamana Insert 衰减率 0.33 仍显著高于 HNSW 的 0.59

## 失败记录

- Profile 测试 50K 规模超时（10min 内仅完成约 40K），降至 20K 后成功
