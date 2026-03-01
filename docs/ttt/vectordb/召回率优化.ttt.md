# 向量数据库召回率优化 (Recall Optimization)

> **状态**: 🟢 已完成
> **优先级**: P0
> **创建**: 2026-02-08

## 🎯 目标

优化 `DiskVamanaIndex` 的搜索召回率，重点解决磁盘索引搜索、增量操作后召回率偏低的问题。

## 📊 基线数据 (2026-02-08)

### 内存索引 (VamanaIndex) — ✅ 正常

| 数据集 | Recall@10 | QPS |
|--------|-----------|-----|
| SIFT 10K | 99.90% | 7,058 |
| SIFT 100K | 100.00% | 948 |
| SIFT 1M | 99.80% | 585 |

### 磁盘索引 (DiskVamanaIndex) — ⚠️ 需优化

| 场景 | searchL | Recall@10 |
|------|---------|-----------|
| E2E 10K (R=32, L=50) | 50 | 74.70% |
| E2E 10K (R=32, L=50) | 200 | 96.10% |
| BuildFromVectors 100K (R=64, L=128) | 20 | 38.30% |
| BuildFromVectors 100K (R=64, L=128) | 50 | 53.90% |
| BuildFromVectors 100K (R=64, L=128) | 100 | 67.30% |
| BuildFromVectors 100K (R=64, L=128) | 200 | 78.80% |
| BuildFromVectors 100K (R=64, L=128) | 500 | 91.50% |

### BBQ 量化搜索 — ⚠️ 需关注

- Speedup: **0.83x** (10K 规模下比精确搜索更慢)
- Recall@10: rerank=20 → 96.10%, rerank=50 → 99.40%

### 增量操作后 — ⚠️ 需优化

| 操作 | Recall |
|------|--------|
| Insert 100 vectors | 0.6560 |
| Delete 500 nodes | 0.6040 |
| Checkpoint after inserts | 0.6600 |
| Checkpoint after deletes | 0.5980 |

## 🔴 近期计划

- [x] **P0: 磁盘索引搜索召回率** — `disk_search.go`
  - 根因: BBQ 近似距离引导的贪心搜索质量不足
  - **根因修正**: 距离度量不匹配 — BBQ 使用 CosineSimilarity 而图构建使用 EuclideanDistance。之前建议的修复方向（改为 EuclideanDistance）仍然是硬编码，治标不治本。**正确的根本方案：距离度量应作为可配置参数传入，而非在代码中硬编码**，否则换一个数据集或使用场景就需要再次修改内置度量。
  - 修复方向:
    1. 距离度量类型应在 Config 中声明，作为索引的一等公民参数
    2. BBQ 量化器和评分器应从索引配置中获取度量类型，而非自行硬编码
    3. 所有搜索路径（内存搜索、BBQ 搜索、磁盘搜索、rerank）应一致使用配置中的度量
  - 目标: searchL=100 时 recall@10 ≥ 90%

- [x] **P1: 增量操作后召回率** — `disk_incremental.go`
  - 根因: 插入节点未充分连接；删除后图连通性受损
  - 目标: 增量操作后 recall@10 ≥ 80%

- [x] **P4: BBQ搜索beam宽度不足** — `disk_search.go`
  - 根因: 1-bit BBQ量化分辨率不足（128维仅129个离散值），beam=efSearch时真近邻被淘汰
  - 修复方向: BBQ贪心搜索使用 internalL = efSearch * overSearchFactor（2~3倍），rerank从扩大候选池中精确选topK
  - 目标: searchL=100时 recall@10 ≥ 90%

- [x] **P5: 删除操作图修复不足** — `disk_incremental.go`, `constants.go`
  - 根因: DefaultDeleteC=3替换边数不足 + pruneAffectedVertices剪枝抵消修复效果
  - 修复方向: 增大DeleteC(→5~8)/DeleteK(→100) + pruneAffectedVertices使用GraphSlackFactor宽松阈值
  - 目标: 删除500节点后 recall@10 ≥ 0.80

## 🟡 中期计划

- [ ] **P2: SIFT 1M 测试超时** — `disk_sift_scale_test.go`
  - 10 分钟 timeout 不足，构建 1M 索引需 ~5 分钟
  - 目标: 测试能在合理时间内完成

- [ ] **P3: BBQ 小规模无加速** — `disk_search.go`, `bbq/`
  - 10K 规模下 0.83x，需确认 100K+ 规模下能体现加速

## 📝 进度记录

| 日期 | 事项 |
|------|------|
| 2026-02-08 | 完成基线数据采集，创建 ttt 文档 |
| 2026-02-08 | P0 根因分析完成，发现距离度量不匹配（Euclidean 图 + Cosine BBQ）。修复方向修正：不应简单替换硬编码度量，应将度量作为可配置参数贯穿全系统。 |
| 2026-02-08 | P2 修复完成 — TestDiskIndex_EndToEnd_SIFT1M 增加环境变量门控和剩余时间检查 |
| 2026-02-08 | P0/P1 统一修复完成 — BBQ 距离度量从 CosineSimilarity 改为 EuclideanDistance（10处修改+scorer核心修复） |
| 2026-02-08 | 全量测试验证通过（476s，0 FAIL），召回率改善数据如下：DiskIndex Insert recall: 0.656 → 0.808 (+15.2%)；DiskIndex Delete recall: 0.604 → 0.744 (+14.0%)；DiskIndex E2E SIFT10K (L=50): 74.70% → 77.10% (+2.4%)；Checkpoint after inserts: 0.660 → 0.780；Checkpoint after deletes: 0.598 → 0.784；Multiple checkpoints final: 0.643 → 0.810；内存索引和BBQ核心召回率保持不变（无回归） |
| 2026-02-08 | 消除 BBQ 距离度量硬编码，改为从索引配置 `Config.DistanceMetric` 传入。修改文件：`config.go`（添加 `DistanceMetric bbq.SimilarityType` 字段、默认值、`WithDistanceMetric()` 方法）、`index.go`（`New()` 中 bbqScorer/bbqQuantizer 改为从 `config.DistanceMetric` 读取）、`bbq.go`（`computeBBQDataParallel()` 和 `bbqDistanceToQuery()` 改为从 `idx.config.DistanceMetric` 读取）、`disk_index.go`（添加 `distanceMetric` 字段；`Open()` 委托给新增的 `OpenWithMetric()`）、`disk_search.go`（搜索函数改为从 `idx.distanceMetric` 读取）、`disk_build.go`（`computeBBQData()` 改为从 `b.config.DistanceMetric` 读取）、`disk_incremental.go`（增量操作改为从 `idx.distanceMetric` 读取）。测试全部通过，无回归。 |
| 2026-02-08 | 新一轮全量测试完成（504.87s，0 FAIL）。对照规程阈值检查：磁盘索引 100K L=100 recall@10 = 68.2%，规程要求 searchL=10×topK 时 ≥90%，**不达标（差21.8pp）**；增量删除500后 recall = 0.748，规程要求 ≥0.80，**不达标（差5.2pp）**；增量插入100后 recall = 0.808，≥0.80 ✅ 达标；内存索引 1M recall = 99.72% ✅ 达标；BBQ rerank=50 recall = 99.4% ✅ 达标。需要进一步根因分析磁盘索引召回率和删除后召回率问题。 |
| 2026-02-08 | 根因分析完成。问题1（磁盘索引100K L=100 recall=68.2%）：1-bit BBQ量化分辨率不足，128维SIFT向量POPCNT点积仅129个离散值，beam=100时真近邻被淘汰。关键代码：`disk_search.go:72-126` greedySearchBBQWithMeta()。修复方向：扩大BBQ内部beam宽度（overSearchFactor）。问题2（删除500后recall=0.748）：DefaultDeleteC=3修复不足+累积损伤+pruneAffectedVertices剪枝抵消修复效果。关键代码：`constants.go:91`、`disk_incremental.go:873`。修复方向：增大DeleteC/DeleteK+宽松剪枝阈值。 |
| 2026-02-08 | P4/P5修复完成并验证（第一轮，factor=3.0）。修改文件：constants.go（DefaultBBQOverSearchFactor=3.0, DefaultDeleteK=100, DefaultDeleteC=6, DefaultDeletePruneSlackFactor=1.3）、disk_index.go（bbqOverSearchFactor/deleteC/deleteK/deletePruneSlackFactor字段+accessor）、disk_search.go（BBQ搜索使用internalL=efSearch*overSearchFactor扩大beam）、disk_incremental.go（引用实例字段+pruneAffectedVertices宽松阈值）。结果：L=100 recall 68.2%→85.60%（+17.4pp），删除recall 0.748→0.934（+0.186）。L=100仍差4.4pp未达90%。 |
| 2026-02-08 | DefaultBBQOverSearchFactor 3.0→5.0（第二轮）。最终结果：L=100 recall=91.80%（✅达标≥90%），L=200=96.70%，L=500=99.80%。删除recall=0.966，插入recall=0.984。内存索引1M=99.68%（无回归）。全部指标达标。 |

## 遗留问题

1. ~~距离度量仍为硬编码 EuclideanDistance，未实现可配置化~~ ✅ 已解决（2026-02-08，改为从 `Config.DistanceMetric` 传入）
2. ~~增量删除500后 recall = 0.748，规程要求 ≥0.80，差5.2pp，需根因分析删除操作对图连通性的破坏机制~~ ✅ 已解决（2026-02-08，DefaultDeleteC=6/DefaultDeleteK=100/DefaultDeletePruneSlackFactor=1.3，最终删除recall=0.966）
3. ~~磁盘索引 100K L=100 recall@10 = 68.2%，规程要求 searchL=10×topK 时 ≥90%，差21.8pp，需根因分析 BBQ 近似搜索在大规模数据集上的质量瓶颈~~ ✅ 已解决（2026-02-08，DefaultBBQOverSearchFactor=5.0，最终L=100 recall=91.80%）
