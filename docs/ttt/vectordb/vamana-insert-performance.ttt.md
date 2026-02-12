# Vamana Insert 性能优化 执行跟踪 (TikTocTak)

> **目标**: 修复 Vamana Insert 性能严重落后于 HNSW 的问题（258/s vs 1292/s，差距5x）
>
> **流程**: 滚动更新的执行路线图。
>
> **状态**: ⏸️ 暂停 — 用户指令暂停内存索引优化，转向 DiskIndex 优化

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

## ⏸️ 近期计划 — Phase 18: 新方向探索（已暂停）

**基线**: Vamana Insert 728/s, HNSW Insert ~1566/s（Phase 16-V 基线，Phase 17 全部失败后恢复）
**Gap**: 2.15x
**瓶颈**: 距离计算次数（dotProduct 占 73.67% flat）

> ⏸️ **暂停说明**: 用户指令暂停内存索引优化，转向 DiskIndex 优化。当前基线：Vamana Insert 728/s, HNSW Insert ~1566/s, gap 2.15x。后续 DiskIndex 优化跟踪见 `docs/ttt/vectordb/disk-insert-perf-optimization.ttt.md`。

### 已排除的方向

- 距离计算实现优化（两者完全一致）
- 原子计数器（已移除，效果不显著）
- GSF 增大（使截断失效）
- alpha 简化（破坏算法正确性）
- 展开节点候选池（内存开销过大）
- 反向边距离缓存（收益过低，变更范围过大）

### Phase 18 可能方向

- [ ] **18-1**: 减少 greedySearch 的 L 参数（L=200→L=100），减少搜索阶段距离计算
- [ ] **18-2**: 减少反向边维护中的 robustPrune 触发次数（不通过 GSF，而是通过更智能的策略）
- [ ] **18-3**: 内存布局优化——将邻居列表从 `[][]uint32` 改为连续内存块
- [ ] **18-4**: SIMD/向量化距离计算（需要 CGo 或汇编）
- [ ] **18-5**: 接受 2.15x 差距作为算法固有差异（Vamana 的 robustPrune 本质上比 HNSW 的 selectNeighborsHeuristic 更昂贵）

## 🔵 中期计划

- [ ] Vamana Insert 衰减率优化（当前0.37 vs HNSW 0.56）
- [x] ~~Vamana 内存布局优化~~ — 已确认先前迭代中已完成（vectorData + sub-slice 视图）

## 🏁 已归档/已完成

- [x] **Phase 17: 多方向优化尝试 (2026-02-11)** — 全部失败，恢复 Phase 16 基线（728/s）
  - **17-0 反向边距离缓存调查**: 收益仅 4.3%（~235次/Insert），变更范围大（~15文件，~30+函数），放弃。重新分析截断后开销分布：反向边维护 58%，自身 robustPrune 27%，greedySearch 15%
  - **17-1+V GSF 1.5→2.0 + progressive alpha 消除**: 性能回归 -2.5%（728→710/s），已回滚。原因：GSF 2.0 使截断阈值(2×R)等于 GSF×R，截断失效；alpha 简化破坏算法正确性（progressive alpha 是 Vamana 核心设计）
  - **17-2 IP-DiskANN 源码对比**: 发现候选池来源差异：IP-DiskANN 保留所有展开节点(expanded_nodes)作为 robustPrune 候选池，我们只返回 top-L
  - **17-3+V2 实现展开节点候选池**: 严重退化 -35.4%（728→470/s），已回滚。原因：每次距离计算都追加到 ExpandedNodes 切片的内存分配和复制开销远超候选池质量提升的收益
  - **失败记录**: GSF 2.0 使截断失效（2×R = GSF×R = 64）；alpha 简化破坏算法正确性，永久排除此方向；展开节点候选池的内存分配开销（append 到切片）远超预期；反向边距离缓存收益过低不值得实现
  - **分析文档**: `docs/ttt/vectordb/vamana-neighbor-cache-scope.md`（反向边距离缓存分析）、`docs/ttt/vectordb/vamana-phase17-analysis.md`（Phase 17 开销分析）、`docs/ttt/vectordb/vamana-ipdiskann-comparison.md`（IP-DiskANN 对比分析）
  - **结论**: Phase 17 三个方向全部失败。当前状态恢复到 Phase 16 基线（728/s，gap 2.15x）

- [x] **Phase 16: robustPrune 候选集截断优化 (2026-02-11)** — 完成（+11.8%）
  - **16-0 距离计算次数对比调查**: robustPrune 是最大差距来源（26倍：~2,600次 vs HNSW ~100次），反向边无距离缓存是第二来源（3.2倍）。总计 HNSW ~1,200次/Insert vs Vamana ~5,500次/Insert。分析文档：`docs/ttt/vectordb/vamana-dist-count-analysis.md`
  - **16-1 候选集截断**: 在 `robustPruneCore` 主循环前添加候选集截断逻辑，当候选数超过 `2×R` 时截断为最近的 2R 个候选
  - **16-V 50K 验证**: Vamana 651→728/s (+11.8%), HNSW ~1566/s, Gap 2.30x→2.15x, Recall 100%
  - **16-R SIFT 100K recall 验证**: recall@10=100%（串行和并行构建均通过），截断对图质量无影响
  - **吞吐量**: Vamana Insert 651→728/s (+11.8%)，HNSW/Vamana 差距 2.30x→2.15x
  - **失败记录**: DiskVamana Insert 测试超时（~65/s），与内存 Vamana 优化无关
  - **结论**: 候选集截断有效减少 robustPrune 距离计算次数，且不影响图质量。剩余差距主要来自反向边距离缓存缺失

- [x] **Phase 15: 原子计数器清理与距离计算瓶颈确认 (2026-02-11)** — 完成（代码清理，性能无显著变化）
  - **15-0 CPU profile 分析**: dotProduct 73.67% flat，greedySearchFast 72.65% cum，addEdgeAndPrune 9.50% cum，零锁竞争
  - **15-1 对比调查**: HNSW 与 Vamana 的 dotProduct 实现完全一致（8路展开），发现 Phase 13-1 残留的原子统计计数器（distPhase, StatsGreedyDist 等）在每次距离计算热路径中
  - **15-2 原子计数器移除**: 移除 6 个 atomic stat 字段、fastDistance/fastDistanceToQuery 中的 switch-case 统计代码、build.go 中的 distPhase.Store() 和 Stats*.Add(1) 调用、删除 insert_stats_test.go
  - **15-V 50K 验证**: 效果不显著（环境噪声内），Vamana ~529/s, HNSW ~1329/s（环境负载高于基线），Recall 100%
  - **修改文件**: `kernel/vectordb/vamana/build.go`, `kernel/vectordb/vamana/distance.go`；删除 `kernel/vectordb/vamana/insert_stats_test.go`
  - **结论**: 代码清理有价值（移除调试残留），但原子操作开销在距离计算中占比极小。瓶颈 100% 在距离计算次数本身
  - **失败记录**: 原子计数器移除未带来可测量性能提升——每次距离计算仅一次 atomic.Add，开销在系统噪声中不可区分；DiskVamana 测试超时（63-66 items/s），600s timeout 不足

- [x] **Phase 14: 数据结构+参数优化 (2026-02-11)** — 完成（+4.3%）
  - **14-1 距离缓存可行性调查**: 距离冗余仅 2.2%，缓存预期收益 2-3%，不值得实施。调查报告：`docs/ttt/vectordb/vamana-dist-cache-analysis.md`
  - **14-2 双堆搜索队列优化（失败，已回滚）**: 将 NeighborPriorityQueue（有序数组）改为 MinHeap+MaxHeap，20K 仅 +2.6%，50K gap 从 2.34x 扩大到 2.51x。原因：有序数组的 O(1) 拒绝路径在大规模下更高效（大部分邻居距离 > 队列最差值被直接拒绝）
  - **14-P 参数扫描实验**: 测试 MaxBackedges=[8,16,32] × GraphSlackFactor=[1.3,1.5,2.0] 共 9 种组合，最优配置 MB=16, GSF=1.5（20K: 1061/s, recall 93.4%，比基线 622/s 提升 70%）。测试文件：`kernel/vectordb/vamana/param_sweep_test.go`
  - **14-C 应用最优参数**: DefaultConfig: GraphSlackFactor 1.3→1.5, MaxBackedges R→R/2，Benchmark 参数同步更新
  - **14-V2 50K 验证**: Vamana Insert 624→651/s (+4.3%), HNSW ~1497/s, Gap 2.34x→2.30x, Recall 100%
  - **吞吐量**: Vamana Insert 624→651/s (+4.3%)，HNSW/Vamana 差距 2.34x→2.30x
  - **失败记录**: 14-2 双堆优化失败——数据结构理论复杂度不等于实际性能，需考虑实际访问模式（有序数组在大规模下的 O(1) 拒绝路径优于堆的 O(log n) 操作）
  - **结论**: 参数优化在 20K 规模效果显著（+70%），但 50K 规模收益被稀释（+4.3%），50K 后期阶段瓶颈已从 backedge 转移到 greedySearch 本身

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

## 性能历史

| Phase | HNSW | Vamana | Gap | 备注 |
|-------|------|--------|-----|------|
| Phase 11 | 1292/s | 517/s | 2.50x | |
| Phase 12 | ~1460/s | 637/s | 2.31x | |
| Phase 13 | 1460/s | 624-658/s | 2.34x | |
| Phase 14 | 1497/s | 651/s | 2.30x | |
| Phase 15 | ~1329/s | ~529/s | ~2.51x* | |
| Phase 16 | ~1566/s | 728/s | 2.15x | |
| Phase 17 | — | — | — | 全部失败，恢复 Phase 16 基线 |

\* Phase 15 测试环境负载高于基线，绝对值不可直接对比，代码变更本身无显著性能影响

## 失败记录

- Profile 测试 50K 规模超时（10min 内仅完成约 40K），降至 20K 后成功
- Phase 14-2 双堆搜索队列优化失败并回滚：理论上 MinHeap+MaxHeap 应优于有序数组，但实际测试 50K gap 从 2.34x 扩大到 2.51x，原因是有序数组的 O(1) 拒绝路径在大规模下更高效
- Phase 14 参数优化 20K→50K 收益稀释：20K 参数扫描预期 +70%，但 50K 仅 +4.3%，50K 后期阶段被 greedySearch 成本主导
- Phase 15 原子计数器移除未带来可测量性能提升：每次距离计算仅一次 atomic.Add，开销在系统噪声中不可区分，优化方向判断错误
- Phase 15 DiskVamana 测试超时：63-66 items/s 下 600s timeout 不足以完成测试
- Phase 16 DiskVamana Insert 测试超时（~65/s），与内存 Vamana 优化无关
- Phase 17-1+V GSF 2.0 使截断失效（2×R = GSF×R = 64），性能回归 -2.5%，已回滚
- Phase 17-1+V alpha 简化破坏 Vamana 算法正确性（progressive alpha 是核心设计），永久排除此方向
- Phase 17-3+V2 展开节点候选池严重退化 -35.4%（728→470/s）：append 到切片的内存分配和复制开销远超候选池质量提升收益，已回滚
- Phase 17-0 反向边距离缓存收益仅 4.3%（~235次/Insert），变更范围过大（~15文件，~30+函数），不值得实现
