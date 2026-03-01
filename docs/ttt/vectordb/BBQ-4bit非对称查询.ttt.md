# BBQ 4-bit 非对称量化查询

> **状态**: 🟢 已完成
> **优先级**: P1
> **创建**: 2026-02-08
> **前置**: recall-optimization.ttt.md（已完成）

## 🎯 目标

验证 4-bit 非对称量化查询（查询向量 4-bit，索引向量 1-bit）对磁盘索引搜索召回率和性能的影响。核心假设：4-bit 查询提高 BBQ 粗筛精度 → 可降低 OverSearchFactor → 减少 rerank 候选数 → 提升搜索速度。

## 📊 基线数据

来自 recall-optimization.ttt.md 最终结果（OverSearchFactor=5.0）：

| 指标 | 值 |
|------|-----|
| 磁盘索引 100K L=100 recall@10 | 91.80% |
| 磁盘索引 100K L=200 recall@10 | 96.70% |
| 磁盘索引 100K L=500 recall@10 | 99.80% |
| 内存索引 1M recall@10 | 99.72% |
| 当前 OverSearchFactor | 5.0 |

## 🔧 技术方案

### 原理

当前 1-bit 对称量化：query 和 index 都量化为 {0,1}，128维仅 129 个离散距离值。
4-bit 非对称量化：query 量化为 {0..15}，index 保持 {0,1}，距离计算使用 `ComputeNaiveDotProduct`（逐字节乘加），精度从 2 级提升到 16 级。

代价：无 POPCNT 硬件加速，单次距离计算更慢。但若精度提升足以降低 OverSearchFactor（如 5.0→2.0），总候选数减少，净效果可能为正。

### 已有基础设施

- `bbq.Quantize(bits=4)` — 4-bit 量化已实现
- `bbq.ComputeNaiveDotProduct()` — 4-bit×1-bit 点积已实现
- `VamanaIndex.greedySearchBBQ4Bit()` — 内存索引 4-bit 路径已实现（dim<128 时启用）
- `VamanaIndex.bbqUnpacked` — 内存索引已有 unpacked 1-bit 数据

### 修改范围

#### 1. 配置层：`constants.go` + `disk_index.go`

新增 `bbqQueryBits` 字段（uint8，取值 1 或 4），默认值待实验确定。

- `constants.go`: 新增 `DefaultBBQQueryBits`
- `disk_index.go`: `DiskVamanaIndex` 新增 `bbqQueryBits` 字段 + accessor

#### 2. 数据层：`disk_index.go`

加载 BBQ codes 时从 packed 解包生成 unpacked 数据（运行时完成，无需改文件格式）。

- `loadBBQData()` / `loadBBQDataV2()` 末尾：从 `bbqCodes`（packed）解包为 `bbqUnpacked`（每维1字节）
- 新增字段 `bbqUnpacked []byte`
- 解包逻辑：遍历 packed bytes，每 bit 展开为 0x00/0x01
- 内存开销：100K×128维 = 12.8MB（可接受）

#### 3. 搜索层：`disk_search.go`

`greedySearchBBQWithMeta()` 根据 `bbqQueryBits` 分支：

- `bbqQueryBits=1`（当前路径）：`Quantize(query, ..., 1)` → `PackBinary` → POPCNT
- `bbqQueryBits=4`（新路径）：`Quantize(query, ..., 4)` → `ComputeNaiveDotProduct` with unpacked

新增 `fusedBBQDistance4Bit()` 对应 4-bit 查询的距离计算。

#### 4. 内存索引：`bbq.go`

`greedySearchBBQ()` 的策略选择改为可配置（而非仅按 dim 判断）。

- 新增 `Config.BBQQueryBits` 字段
- `greedySearchBBQ()` 根据配置选择 1-bit 或 4-bit 路径

#### 5. 增量路径：`disk_incremental.go`

append 节点也需要 unpacked 数据。

- `appendNode()` 时同步生成 unpacked BBQ 数据
- `fusedBBQDistance4Bit()` 需处理 append 节点

### 数据流对比

```
当前 1-bit 路径:
  query → Quantize(1bit) → PackBinary → POPCNT(queryPacked, bbqCodes[node]) → corrected distance

新增 4-bit 路径:
  query → Quantize(4bit) → NaiveDotProduct(query4Bit, bbqUnpacked[node]) → corrected distance
```

## 📋 任务分解

- [x] S1: 配置层 — `constants.go` 新增 `DefaultBBQQueryBits`；`disk_index.go` 新增 `bbqQueryBits` 字段和 accessor
- [x] S2: 数据层 — `disk_index.go` 加载时从 packed 解包生成 `bbqUnpacked`
- [x] S3: 搜索层 — `disk_search.go` 新增 4-bit 查询路径（`greedySearchBBQWithMeta` 分支 + `fusedBBQDistance4Bit`）
- [x] S4: 增量路径 — `disk_incremental.go` append 节点生成 unpacked 数据
- [x] S5: 内存索引 — `bbq.go` 策略选择改为可配置
- [x] S6: 实验验证 — 对比 1-bit vs 4-bit 在不同 OverSearchFactor 下的 recall@10 和搜索延迟
- [x] S7: 参数调优 — 确定最优 OverSearchFactor 和默认 bbqQueryBits

## 📊 S6 实验结果

### 回归测试

| 测试 | 结果 |
|------|------|
| TestSIFT100K (内存索引, 1-bit默认) | PASS, Recall@10=100.00% |
| TestDiskIndex_EndToEnd_SIFT100K (磁盘索引, 1-bit默认) | PASS |

### 1-bit vs 4-bit 对比 (SIFT 100K, searchL=100, k=10, 100 queries)

| 配置 | Recall@10 | AvgLatency | vs 基线 recall | vs 基线 latency |
|------|-----------|------------|----------------|-----------------|
| 1-bit, OSF=5.0 (基线) | 91.80% | 3115 µs | — | — |
| 4-bit, OSF=5.0 | 98.20% | 4244 µs | +6.40% | 1.36x |
| 4-bit, OSF=3.0 | 96.10% | 2973 µs | +4.30% | 0.95x |
| 4-bit, OSF=2.0 | 92.50% | 2058 µs | +0.70% | 0.66x |
| 4-bit, OSF=1.0 | 83.30% | 1275 µs | -8.50% | 0.41x |

### 关键发现

1. **4-bit OSF=3.0 是最优平衡点**：recall 96.10%（比基线高 4.3%），延迟 0.95x（几乎持平）
2. **4-bit OSF=2.0 达到等效召回**：recall 92.50%（≈基线 91.80%），延迟仅 0.66x（提速 34%）
3. **4-bit OSF=5.0 召回率最高**：98.20%，但延迟增加 36%（无 POPCNT 加速的代价）
4. **4-bit OSF=1.0 召回率不足**：83.30%，低于基线，不推荐

### 结论

核心假设验证成功：4-bit 查询提高 BBQ 粗筛精度 → 可降低 OverSearchFactor → 减少 rerank 候选数 → 提升搜索速度。

推荐默认配置：`bbqQueryBits=4, OverSearchFactor=3.0`（召回率 +4.3%，延迟持平）。
若追求速度：`bbqQueryBits=4, OverSearchFactor=2.0`（召回率持平，延迟 -34%）。

## ⚠️ 失败记录

### S1-S3 首次代码子任务失败

- **现象**: `apply_diff` 工具在 `disk_index.go` 上连续失败 4+ 次
- **子任务归因**: "中文编码匹配问题"（错误归因）
- **实际原因**: 上下文质量下降导致工具调用参数不准确（违反了"不得臆断工具失败原因"的规则）
- **解决方式**: 拆分为更小的子任务，每个只修改一个文件
- **教训**: 大范围多文件修改应拆分为单文件子任务，避免上下文膨胀

## 📁 修改文件清单

| 文件 | 变更 |
|------|------|
| `kernel/vectordb/vamana/constants.go` | 新增 `DefaultBBQQueryBits = 1` |
| `kernel/vectordb/vamana/disk_index.go` | 新增 `bbqQueryBits`/`bbqUnpacked` 字段、getter/setter、解包逻辑 |
| `kernel/vectordb/vamana/disk_search.go` | 新增 4-bit 搜索路径（`bbqCorrectedDistance4Bit`/`fusedBBQDistance4Bit`/`appendBBQCorrectedDistance4Bit`） |
| `kernel/vectordb/vamana/index.go` | 内存索引新增 `bbqQueryBits` 字段和 getter/setter |
| `kernel/vectordb/vamana/bbq.go` | `greedySearchBBQ()` 策略选择改为基于配置 |
| `kernel/vectordb/vamana/bbq_4bit_comparison_test.go` | 新增 1-bit vs 4-bit 对比测试 |

## 📝 进度记录

| 日期 | 事项 |
|------|------|
| 2026-02-08 | 创建 ttt 文档，完成技术方案设计 |
| 2026-02-08 | S1-S3 首次子任务失败（apply_diff 连续失败），拆分为单文件子任务后成功 |
| 2026-02-08 | S1-S5 实现完成 |
| 2026-02-08 | S6 实验验证完成，4-bit OSF=3.0 为最优平衡点 |
| 2026-02-08 | S7 参数调优完成，任务关闭 |
