# HNSW 插入性能基线数据

> **采集时间**: 2026-02-10
> **测试代码**: `kernel/vectordb/hnsw/bench_insert_test.go`
> **CPU Profile**: `kernel/vectordb/hnsw/testdata/insert_cpu.prof`

## 测试环境

- **OS**: Windows 11
- **向量维度**: 128
- **距离函数**: L2 (euclidean)
- **HNSW 配置**: DefaultConfig() — M=16, EfConstruction=200, EfSearch=64, MaxLevel=16
- **数据源**: 固定种子(42)随机向量，mockDistancer (纯内存 map 存储)

## 1. 分阶段插入吞吐量

| Phase | 数据范围 | 耗时 | 吞吐量 (items/sec) |
|-------|---------|------|-------------------|
| 0 | 0k → 10k | 47.4s | 211.0 |
| 1 | 10k → 20k | 1m8.5s | 146.1 |
| 2 | 20k → 30k | 1m16.1s | 131.4 |
| 3 | 30k → 40k | 1m22.7s | 121.0 |
| 4 | 40k → 50k | 1m24.7s | 118.1 |

**总计**: 50K 条插入耗时约 5m47s，整体平均吞吐量约 144 items/sec。

**衰减趋势**: 从 Phase 0 的 211 items/sec 衰减到 Phase 4 的 118 items/sec，衰减约 44%。

## 2. CPU Profile 热点分析 (Top 10 by flat)

| 排名 | 函数 | flat | flat% | cum | cum% |
|------|------|------|-------|-----|------|
| 1 | `euclideanDistance` | 203.0s | 58.98% | 203.1s | 59.01% |
| 2 | `internal/runtime/maps.h2` | 40.7s | 11.83% | 40.7s | 11.83% |
| 3 | `internal/runtime/maps.(*groupReference).key` | 17.1s | 4.98% | 17.1s | 4.98% |
| 4 | `runtime.mapaccess2_fast32` | 9.8s | 2.85% | 60.5s | 17.59% |
| 5 | `(*mockDistancer).ComputeDistance` | 9.2s | 2.67% | 272.9s | 79.27% |
| 6 | `runtime.stdcall1` | 6.6s | 1.91% | 6.6s | 1.91% |
| 7 | `runtime.memhash32` | 4.4s | 1.28% | 4.4s | 1.28% |
| 8 | `(*HNSWIndex).GetLevelNeighborIDs` | 4.2s | 1.23% | 4.2s | 1.23% |
| 9 | `internal/runtime/maps.ctrlGroup.matchH2` | 4.0s | 1.15% | 4.0s | 1.15% |
| 10 | `(*HNSWIndex).selectNeighborsHeuristic` | 3.4s | 1.00% | 144.5s | 41.98% |

## 3. CPU Profile 热点分析 (Top by cumulative)

| 排名 | 函数 | cum | cum% | 说明 |
|------|------|-----|------|------|
| 1 | `(*HNSWIndex).buildHNSWIndex` | 332.2s | 96.50% | 插入主流程 |
| 2 | `(*mockDistancer).ComputeBBQDistance` | 274.3s | 79.68% | 距离计算入口 |
| 3 | `(*mockDistancer).ComputeDistance` | 272.9s | 79.27% | 实际距离计算 |
| 4 | `euclideanDistance` | 203.1s | 59.01% | 距离函数本体 |
| 5 | `(*HNSWIndex).searchLevel` | 159.6s | 46.37% | 层级搜索 |
| 6 | `(*HNSWIndex).selectNeighborsHeuristic` | 144.5s | 41.98% | 邻居选择启发式 |
| 7 | `runtime.mapaccess2_fast32` | 60.5s | 17.59% | map 查找开销 |

## 4. 关键发现

1. **距离计算是绝对瓶颈**: `euclideanDistance` 占 flat 时间的 59%，累计 79% 的时间花在距离计算调用链上。
2. **map 访问开销显著**: `mapaccess2_fast32` + `maps.h2` + `maps.(*groupReference).key` 合计约 67.6s (19.6%)，这是 mockDistancer 使用 `map[DocID][]float32` 存储向量的代价。
3. **selectNeighborsHeuristic 累计占比高**: 41.98% 的累计时间，其中大部分是距离重算。
4. **searchLevel 累计占比高**: 46.37% 的累计时间，同样主要是距离计算。

## 5. 注意事项

- 本测试使用 `mockDistancer`（基于 Go map），map 查找开销（约 20%）在生产环境中可能不同（生产使用不同的存储后端）。
- `euclideanDistance` 是纯 Go 标量实现，无 SIMD 优化。生产环境如果使用 SIMD 距离函数，该比例会大幅降低。
- 本数据仅作为优化前的基线参考，优化后需重新运行同一测试进行对比。

## 6. 复现命令

```bash
# 吞吐量衰减曲线
cd kernel && go test -run TestInsertThroughputCurve -v -timeout 30m ./vectordb/hnsw/

# CPU Profile
cd kernel && go test -run TestInsertCPUProfile -v -timeout 30m ./vectordb/hnsw/

# 分析 profile
cd kernel && go tool pprof -top vectordb/hnsw/testdata/insert_cpu.prof
cd kernel && go tool pprof -top -cum vectordb/hnsw/testdata/insert_cpu.prof
```
