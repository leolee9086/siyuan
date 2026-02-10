# HNSW Phase 7 优化后 CPU Profiling 分析

> **采集时间**: 2026-02-10
> **Profile 文件**: `kernel/vectordb/hnsw/testdata/insert_cpu_phase7.prof`
> **基线对比**: `docs/ttt/vectordb/hnsw-benchmark-baseline.md` (Phase 2)
> **测试函数**: `TestInsertThroughputCurve` with `-cpuprofile`
> **总采样时间**: 152.25s / 154.26s wall (98.69% utilization)

## 1. 分阶段插入吞吐量

| Phase | 数据范围 | Phase 7 耗时 | Phase 7 吞吐量 | Phase 2 吞吐量 | 提升幅度 |
|-------|---------|-------------|---------------|---------------|---------|
| 0 | 0k → 10k | 18.3s | 546.8 | 211.0 | +159% |
| 1 | 10k → 20k | 28.3s | 353.2 | 146.1 | +142% |
| 2 | 20k → 30k | 33.8s | 295.8 | 131.4 | +125% |
| 3 | 30k → 40k | 35.6s | 280.8 | 121.0 | +132% |
| 4 | 40k → 50k | 38.0s | 263.1 | 118.1 | +123% |

**总计**: 50K 条插入耗时 154.1s，整体平均吞吐量 ~324.5 items/sec（Phase 2: ~144 items/sec，+125%）。

**衰减趋势**: 546.8 → 263.1，衰减 51.9%（Phase 2: 44%）。衰减率恶化，但绝对吞吐量在所有阶段均大幅领先。

## 2. Top 10 Flat CPU 消耗函数

| 排名 | 函数 | flat | flat% | cum | cum% |
|------|------|------|-------|-----|------|
| 1 | `euclideanDistance` | 104.09s | 68.37% | 104.27s | 68.49% |
| 2 | `(*mockDistancer).ComputeDistance` | 15.82s | 10.39% | 120.12s | 78.90% |
| 3 | `(*mockDistancer).IsVisited` | 6.75s | 4.43% | 6.75s | 4.43% |
| 4 | `(*HNSWIndex).searchLevel` | 5.36s | 3.52% | 120.89s | 79.40% |
| 5 | `(*HNSWIndex).GetLevelNeighborRecords` | 4.30s | 2.82% | 4.33s | 2.84% |
| 6 | `runtime.stdcall1` | 3.21s | 2.11% | 3.21s | 2.11% |
| 7 | `(*MaxHeap).downHeap` | 2.88s | 1.89% | 2.88s | 1.89% |
| 8 | `(*MinHeap).downHeap` | 1.03s | 0.68% | 1.03s | 0.68% |
| 9 | `(*MinHeap).upHeap` | 0.99s | 0.65% | 0.99s | 0.65% |
| 10 | `(*HNSWIndex).selectNeighborsHeuristic` | 0.50s | 0.33% | 21.37s | 14.04% |

## 3. Top 10 Cumulative CPU 消耗函数

| 排名 | 函数 | cum | cum% | 说明 |
|------|------|-----|------|------|
| 1 | `TestInsertThroughputCurve` | 147.01s | 96.56% | 测试入口 |
| 2 | `(*HNSWIndex).Insert` | 146.94s | 96.51% | 插入入口 |
| 3 | `(*HNSWIndex).buildHNSWIndex` | 146.86s | 96.46% | 插入主流程 |
| 4 | `(*HNSWIndex).searchLevel` | 120.89s | 79.40% | 层级搜索 |
| 5 | `(*mockDistancer).ComputeBBQDistance` | 120.56s | 79.19% | 距离计算入口 |
| 6 | `(*mockDistancer).ComputeDistance` | 120.12s | 78.90% | 实际距离计算 |
| 7 | `euclideanDistance` | 104.27s | 68.49% | 距离函数本体 |
| 8 | `(*HNSWIndex).selectNeighborsHeuristic` | 21.37s | 14.04% | 邻居选择启发式 |
| 9 | `(*mockDistancer).IsVisited` | 6.75s | 4.43% | 访问标记检查 |
| 10 | `runtime.newstack` | 4.63s | 3.04% | 栈增长 |

## 4. 与 Phase 2 基线对比

### 4.1 已消除的瓶颈

Phase 2 中 map 访问开销占 CPU 约 22%：

| Phase 2 函数 | Phase 2 flat% | Phase 7 状态 |
|-------------|--------------|-------------|
| `maps.h2` | 11.83% | **已消除** |
| `maps.(*groupReference).key` | 4.98% | **已消除** |
| `runtime.mapaccess2_fast32` | 2.85% | **已消除** |
| `runtime.memhash32` | 1.28% | **已消除** |
| `maps.ctrlGroup.matchH2` | 1.15% | **已消除** |
| **合计** | **~22%** | **0%** |

这是 Phase 3-7 优化的核心成果：将 map 存储替换为连续内存结构，彻底消除了 map 查找开销。

### 4.2 热点占比变化

| 函数 | Phase 2 flat% | Phase 7 flat% | 变化 |
|------|--------------|--------------|------|
| `euclideanDistance` | 58.98% | 68.37% | +9.39pp（相对占比上升，因 map 开销消除） |
| `(*mockDistancer).ComputeDistance` | 2.67% | 10.39% | +7.72pp（wrapper 开销暴露） |
| `(*mockDistancer).IsVisited` | 不在 top | 4.43% | 新出现 |
| `(*HNSWIndex).searchLevel` | 不在 top | 3.52% | 新出现 |
| `(*HNSWIndex).GetLevelNeighborRecords` | 不在 top (1.23% as GetLevelNeighborIDs) | 2.82% | 新出现 |
| `selectNeighborsHeuristic` | 1.00% | 0.33% | -0.67pp（cum 从 42% 降至 14%） |

### 4.3 关键指标对比

| 指标 | Phase 2 | Phase 7 | 变化 |
|------|---------|---------|------|
| 总耗时 (50K insert) | ~347s | 154.1s | -55.6% |
| 平均吞吐量 | 144 items/s | 324.5 items/s | +125% |
| Phase 0 吞吐量 | 211 items/s | 546.8 items/s | +159% |
| Phase 4 吞吐量 | 118 items/s | 263.1 items/s | +123% |
| 衰减率 | 44% | 51.9% | 恶化 7.9pp |
| 距离计算 flat% | 59% | 68% | +9pp（相对占比） |
| 距离计算 cum% | 79% | 79% | 持平 |
| map 访问 flat% | ~22% | 0% | **已消除** |
| selectNeighborsHeuristic cum% | 42% | 14% | -28pp |

## 5. 下一步优化建议（基于数据）

### 5.1 距离计算优化（flat 68.37%，最高优先级）

`euclideanDistance` 占 flat CPU 的 68.37%，是绝对瓶颈。当前为纯 Go 标量实现。

**可行方向**：
- SIMD 加速（通过 CGo 或汇编实现 128 维 L2 距离）
- 降维/量化：在搜索阶段使用低精度距离近似，减少计算量
- 预计算部分范数：L2 距离可分解为 `||a||² + ||b||² - 2<a,b>`，预存范数可减少计算

### 5.2 ComputeDistance wrapper 开销（flat 10.39%）

`ComputeDistance` 自身 flat 占 10.39%，说明函数调用 + 向量查找开销显著。需检查是否存在不必要的内存拷贝或间接调用。

### 5.3 IsVisited 检查（flat 4.43%）

`IsVisited` 占 4.43%，是新暴露的热点。需检查其实现是否使用了高效的数据结构（如 bitset 而非 map）。

### 5.4 衰减率恶化分析

衰减率从 44% 恶化到 51.9%，说明随着索引增大，搜索路径变长导致距离计算次数增加的问题更加突出。可能的优化方向：
- 动态调整 efConstruction（小索引用较小值）
- 改进入口点选择策略
- 层级搜索的提前终止条件优化

### 5.5 selectNeighborsHeuristic（cum 14.04%）

cum 从 42% 降至 14%，说明松弛因子优化效果显著。但仍有 14% 的累计开销，其中大部分是距离重算，可通过缓存距离值进一步优化。

## 6. 复现命令

```bash
# 吞吐量 + CPU Profile
cd kernel/vectordb/hnsw
go test -run TestInsertThroughputCurve -v -timeout 15m "-cpuprofile=testdata/insert_cpu_phase7.prof"

# 分析 profile
go tool pprof -top testdata/insert_cpu_phase7.prof
go tool pprof -cum -top testdata/insert_cpu_phase7.prof
```
