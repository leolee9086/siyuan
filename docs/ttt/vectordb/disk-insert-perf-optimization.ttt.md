# DiskVamana Insert 性能优化

> 创建日期: 2026-02-12
> 状态: 🟢 Phase A+B 完成
> 优先级: P0

## 问题描述

DiskVamana Insert 吞吐量 ~50-68 items/s，约为内存 Vamana Insert (680/s) 的 1/11。
核心瓶颈：Insert 路径使用全精度 mmap 随机读进行贪心搜索，而 Search 路径已使用 BBQ 加速。

## 基线数据（精确测量 2026-02-12）

测试环境: Windows 11, 12 核 CPU
测试参数: dim=128, total=50000, 每阶段=10000, R=32, L=200, seed=1000

- DiskVamana Insert: 60 items/s（总体），分阶段 68→65→50→56 items/s
- Memory Vamana Insert: 680 items/s（总体）
- HNSW Insert: 1608 items/s（总体）
- DiskVamana Insert 衰减比: 0.83（首阶段 68 → 末阶段 56）

## 瓶颈分析

### Insert 路径三大 mmap 热点

| 热点 | 位置 | 估算读取次数/Insert |
|:---|:---|:---|
| 贪心搜索 | findNeighborsForInsert() | ~3000+ |
| robustPrune 遮挡 | robustPruneSimple() | ~5000 |
| 反向边维护 | addBackEdgeForNode() | ~R²≈1000+ |

### 对比：已有优化

- Search 路径：使用 BBQ 1-bit 量化码进行贪心搜索，零 mmap 读取
- Delete 路径：使用 vectorCache + normSqCache 避免重复 mmap 读取

## 优化计划

- [x] Phase 0: 基线建立 + CPU Profiling
- [x] Phase 1: 向量缓存优化（per-insert vectorCache）
- [x] Phase 1-V: 验证
- [x] Phase 2: BBQ 加速 Insert 贪心搜索
- [x] Phase 2-V: 验证（结果：严重退化，已回滚）
- [x] Phase A: robustPrune 对齐内存版算法
- [x] Phase B: addBackEdgeForNode 引入 SlackFactor
- [x] Phase A+B-V: 综合验证

## 执行记录

### Phase 0: 基线建立 + CPU Profiling (2026-02-12)

**基线数据** (TestHNSWvsVamanaInsertThroughput, 50K vectors, dim=128):

| 索引 | 总体吞吐量 | 分阶段范围 | 衰减比 |
|:---|:---|:---|:---|
| HNSW Insert | 1608 items/s | 2369→1323 | 0.56 |
| Vamana Insert | 680 items/s | 1555→518 | 0.33 |
| DiskVamana Insert | 60 items/s | 68→56 (4阶段) | 0.83 |
| Vamana Build-1T | 632 items/s | - | - |
| Vamana Build-MT (12核) | 3402 items/s | - | - |
| DiskVamana Build (12核) | 3190 items/s | - | - |

**CPU Profile Top 20** (TestDiskInsertCPUProfile, 10K seed + 1K insert, 134.4 items/s):

| 排名 | 函数 | flat% | cum% |
|:---|:---|:---|:---|
| 1 | dotProduct | 84.29% | 84.29% |
| 2 | euclideanDistanceWithNorm | 1.23% | 58.47% |
| 3 | (*EpochSet).Insert | 0.55% | 0.55% |
| 4 | robustPruneSimple | 0.96% | 71.04% |
| 5 | euclideanDistance | 0.55% | 70.49% |
| 6 | (*DiskVamanaIndex).getVector | 1.09% | 3.01% |
| 7 | (*DiskVamanaIndex).addBackEdgeForNode | 0% | 62.43% |
| 8 | (*DiskVamanaIndex).findNeighborsForInsert | 0.27% | 19.54% |
| 9 | (*DiskVamanaIndex).computeDistanceToQuery | 0% | 16.12% |
| 10 | (*DiskVamanaIndex).computeDistance | 0% | 12.57% |
| 11 | computeNormSquare | 0% | 56.42% |
| 12 | storage.(*windowsReader).ReadVectorRef | 1.09% | 1.91% |
| 13 | storage.(*DeletedBitmap).IsDeleted | 0.27% | 1.50% |
| 14 | storage.(*windowsReader).calcOffset | 0.82% | 0.82% |
| 15 | sync/atomic.(*Int32).Add | 1.09% | 1.09% |
| 16 | sync.(*RWMutex).RUnlock | 0.14% | 0.82% |
| 17 | (*DiskVamanaIndex).getNeighbors | 0% | 0.55% |
| 18 | runtime.stdcall1 | 2.46% | 2.46% |
| 19 | runtime.gcDrain | 0% | 1.23% |
| 20 | runtime.mallocgc | 0% | 0.55% |

**关键发现**:
- dotProduct 占 flat 84.29%，是绝对热点（被 euclideanDistance/euclideanDistanceWithNorm 调用）
- robustPruneSimple cum 71.04%，addBackEdgeForNode cum 62.43% — 两者都大量调用距离计算
- findNeighborsForInsert cum 19.54% — 贪心搜索本身占比不高，但其距离计算被内联到上层
- 距离计算几乎全部是全精度向量的 mmap 读取 + dotProduct，BBQ 加速路径未被 Insert 使用

**Profiling 测试文件**: kernel/vectordb/vamana/disk_insert_profile_test.go
**Profile 文件**: kernel/vectordb/vamana/cpu_disk_insert.prof

### Phase 1-V: 验证 (2026-02-12)

**基线对比** (TestHNSWvsVamanaInsertThroughput, dim=128, seed=1000):

| 指标 | 基线 (Phase 0) | 优化后 | 变化 |
|:---|:---|:---|:---|
| DiskVamana Insert 总体 | 60 items/s | 150 items/s | +150% |
| Phase 0 (1k-11k) | 68 items/s | 166 items/s | +144% |
| Phase 1 (11k-21k) | 65 items/s | 147 items/s | +126% |
| Phase 2 (21k-31k) | 50 items/s | 140 items/s | +180% |
| Phase 3 (31k-41k) | 56 items/s | 135 items/s | +141% |
| 衰减比 (末/首) | 0.83 | 0.81 | 基本持平 |

**Recall**: 0.9840 (TestDiskIndex_Insert, 100 vectors inserted, recall@10)

**CPU Profile 变化** (TestDiskInsertCPUProfile, 10K seed + 1K insert):

| 函数 | 基线 flat% | 优化后 flat% | 基线 cum% | 优化后 cum% |
|:---|:---|:---|:---|:---|
| dotProduct | 84.29% | 62.43% | 84.29% | 62.43% |
| robustPruneSimple(WithNorm) | 0.96% | 2.12% | 71.04% | 44.97% |
| addBackEdgeForNode | 0% | 0% | 62.43% | 45.24% |
| computeNormSquare | 0% | 0.26% | 56.42% | 16.14% |
| findNeighborsForInsert | 0.27% | 0.26% | 19.54% | 36.51% |
| getVector | 1.09% | 0.53% | 3.01% | 0.79% |
| getCachedVector (新) | - | 0.53% | - | 7.67% |
| getCachedNormSq (新) | - | 0% | - | 21.16% |
| mapassign_fast64 (缓存开销) | - | 0.53% | - | 7.94% |

**关键变化分析**:
- dotProduct flat 从 84.29% 降至 62.43%，向量缓存减少了重复距离计算
- computeNormSquare cum 从 56.42% 骤降至 16.14%，normSq 缓存效果显著
- addBackEdgeForNode cum 从 62.43% 降至 45.24%，反向边维护中的重复向量读取被缓存命中
- findNeighborsForInsert cum 从 19.54% 升至 36.51%（占比上升因其他部分加速更多）
- 新增 getCachedVector (7.67% cum) 和 getCachedNormSq (21.16% cum) 为缓存层开销
- map 操作 (mapassign_fast64 7.94% cum) 是缓存写入的主要开销

### Phase 2-V: 验证 (2026-02-12) — ❌ 已回滚

**⚠️ 结论：BBQ 加速 Insert 贪心搜索导致 benchmark 严重退化，已回滚**

**Benchmark** (TestHNSWvsVamanaInsertThroughput, dim=128, seed=1000):

| 指标 | Phase 0 | Phase 1 | Phase 2 (BBQ) | 变化 (vs Phase 1) |
|:---|:---|:---|:---|:---|
| DiskVamana Insert 总体 | 60 items/s | 150 items/s | ❌ 超时未完成 | - |
| Phase 0 (1k-11k) | 68 items/s | 166 items/s | 49 items/s | -70% |
| 后续阶段 | - | - | 超时 (10min) | - |

测试在 Phase 0 (1k→11k) 耗时 3m22s 后超时，仅完成 1 个阶段。

**Recall**: 0.9840 (TestDiskIndex_Insert, 100 vectors inserted, recall@10) — 与 Phase 1 持平

**CPU Profile** (TestDiskInsertCPUProfile, 10K seed + 1K insert, 220.9/s):

| 函数 | Phase 0 flat% | Phase 1 flat% | Phase 2 flat% | Phase 0 cum% | Phase 1 cum% | Phase 2 cum% |
|:---|:---|:---|:---|:---|:---|:---|
| dotProduct | 84.29% | 62.43% | 35.64% | 84.29% | 62.43% | 35.64% |
| findNeighborsForInsert | 0.27% | 0.26% | 0% | 19.54% | 36.51% | 44.71% |
| addBackEdgeForNode | 0% | 0% | 0% | 62.43% | 45.24% | 38.88% |
| robustPruneSimple(WithNorm) | 0.96% | 2.12% | 0.86% | 71.04% | 44.97% | 36.29% |
| ScalarQuantizer.Quantize (新) | - | - | 4.97% | - | - | 30.67% |
| ScalarQuantizer.OptimizeInterval (新) | - | - | 12.74% | - | - | 25.70% |
| ScalarQuantizer.ComputeLoss (新) | - | - | 8.64% | - | - | 10.80% |
| PackBinary (新) | - | - | 4.54% | - | - | 4.54% |
| euclideanDistanceWithNorms | 1.23% | - | 1.51% | 58.47% | - | 34.99% |
| appendBBQCorrectedDistance (新) | - | - | 0.43% | - | - | 35.42% |

**关键发现**:

1. **BBQ 量化开销巨大**: ScalarQuantizer 相关函数（Quantize 30.67% cum + OptimizeInterval 25.70% cum + ComputeLoss 10.80% cum）成为新的主要热点，BBQ 量化本身的计算成本抵消了减少 mmap 读取的收益
2. **Profiling vs Benchmark 巨大差异**: Profiling (10K seed + 1K insert) 显示 220.9/s（比 Phase 1 的 134.4/s 提升 64%），但 Benchmark (1K seed + 10K insert/phase) 仅 49/s（退化 70%）。说明 BBQ 在小种子索引上性能极差，随着索引增长 BBQ 码本质量改善后才有效
3. **dotProduct flat 持续下降**: 84.29% → 62.43% → 35.64%，BBQ 确实减少了全精度距离计算次数
4. **findNeighborsForInsert cum 持续上升**: 19.54% → 36.51% → 44.71%，BBQ 贪心搜索路径本身开销增大

**根因分析**:
- BBQ 的 `fusedBBQDistance` 路径在每次距离计算时都需要执行 `ScalarQuantizer.Quantize`（含 `OptimizeInterval` 迭代优化），这是一个 O(dim) 的迭代算法
- 对于 Insert 路径，每次 Insert 的贪心搜索需要计算数百到数千次距离，每次都触发完整的 BBQ 量化流程
- 当种子索引很小时（1K），贪心搜索路径更长，BBQ 量化开销被放大

### Phase A: robustPrune 对齐内存版 (2026-02-12)

**修改文件**: kernel/vectordb/vamana/disk_incremental.go
**修改函数**: `robustPruneSimple`, `robustPruneSimpleWithNorm`

**变更内容**:
- 引入 progressive alpha 多轮扫描（与内存版 Vamana 算法对齐）
- 增量式 `occludeFactor[]float32` + `lastChecked[]int` 数组
- 候选集截断至 2×R

### Phase B: addBackEdgeForNode 引入 SlackFactor (2026-02-12)

**修改文件**: kernel/vectordb/vamana/disk_incremental.go, disk_index.go, constants.go

**变更内容**:
- 新增 `DefaultInsertGraphSlackFactor = 1.5`
- `addBackEdgeForNode` 剪枝阈值从 `len >= R` 改为 `len >= int(slackFactor * R)`
- 减少不必要的剪枝调用

**测试**: 三个核心测试全部通过

### Phase A+B-V: 综合验证 (2026-02-12)

**吞吐量** (TestHNSWvsVamanaInsertThroughput, dim=128):

| 阶段 | Phase 0 基线 | Phase 1 | Phase A+B | 变化 vs 基线 |
|:---|:---|:---|:---|:---|
| 总体 | 60 items/s | 150 items/s | 425 items/s | +608% |
| Phase 0 | 68 | 166 | 623 | +816% |
| Phase 1 | 65 | 147 | 417 | +542% |
| Phase 2 | 50 | 140 | 370 | +640% |
| Phase 3 | 56 | 135 | 340 | +507% |
| 衰减比 | 0.83 | 0.81 | 0.55 | 优于内存版 0.32 |

**Recall**: Insert 0.984, Delete 0.966，无退化

**CPU Profile 变化**:

| 函数 | Phase A+B cum% | 说明 |
|:---|:---|:---|
| findNeighborsForInsert | 64.71% | 当前主要瓶颈 |
| dotProduct | 42.25% flat | 仍为计算热点 |
| GC 相关 (mapassign_fast64) | ~15% (12.83%) | map 操作触发 |
| robustPruneSimpleWithNorm | 9.63% | 从主要瓶颈大幅下降 |
| addBackEdgeForNode | 3.21% | SlackFactor 有效减少不必要剪枝 |

## 失败记录

1. **Phase 2 BBQ 加速**: 严重回退 150→49 items/s (-67%)。根因：`ScalarQuantizer.Quantize` 每次距离计算执行完整迭代优化，开销远超 mmap 节省。已回滚。
2. **Phase A+B-V 子任务测试函数名不匹配**: 指令写 `TestDiskInsertProfile`，实际为 `TestDiskInsertCPUProfile`。

## 后续潜在方向

- GC 压力优化（map 操作 ~15%）
- `findNeighborsForInsert` 优化（当前 64.71% cum，主要瓶颈）
- 批量 Insert API
- 算法进一步统一（磁盘/内存共享更多代码）

## 关联文档

- docs/规程/性能优化/性能优化.procedure.md — 适用规程
- docs/ttt/vectordb/disk-write-perf-optimization.ttt.md — 已完成的 DiskIndex 写操作优化
- docs/ttt/vectordb/vamana-insert-performance.ttt.md — 内存索引优化（已暂停）
- kernel/vectordb/vamana/disk_incremental.go — 核心实现
- kernel/vectordb/vamana/disk_search.go — BBQ 搜索参考实现
- kernel/vectordb/hnsw_vs_vamana_bench_test.go — 基准测试
