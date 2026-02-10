# Vamana Insert 距离计算次数统计

## 测试环境

- 维度: 128
- 配置: R=64, L=100, Alpha=1.2, GraphSlackFactor=1.3, MaxBackedges=64
- 数据: 随机 float32 向量 (seed=42)
- 单线程逐个 Insert

## 统计结果

### 10K 规模 (N=10,000)

| 阶段 | 总距离计算次数 | 平均/Insert |
|------|---------------|------------|
| greedySearch | 29,887,592 | 2,989.1 |
| selfPrune (robustPrune 新节点) | 20,262,977 | 2,026.5 |
| backedge (addEdgeAndPrune) | 54,953,386 | 5,495.9 |
| **总计** | **105,103,955** | **10,511.4** |

- addEdgeAndPrune 调用次数: 637,920 (63.8/insert)
- 实际触发 robustPrune: 27,530 (2.8/insert)
- 剪枝触发比例: 4.3%

### 20K 规模 (N=20,000)

| 阶段 | 总距离计算次数 | 平均/Insert |
|------|---------------|------------|
| greedySearch | 79,836,436 | 3,992.0 |
| selfPrune (robustPrune 新节点) | 40,634,587 | 2,031.8 |
| backedge (addEdgeAndPrune) | 112,966,188 | 5,648.6 |
| **总计** | **233,437,211** | **11,672.4** |

- addEdgeAndPrune 调用次数: 1,277,920 (63.9/insert)
- 实际触发 robustPrune: 55,494 (2.8/insert)
- 剪枝触发比例: 4.3%

## 各阶段占比分析

| 阶段 | 10K 占比 | 20K 占比 |
|------|---------|---------|
| greedySearch | 28.4% | 34.2% |
| selfPrune | 19.3% | 17.4% |
| backedge | 52.3% | 48.4% |

## 关键发现

1. **backedge 是距离计算的最大来源**：占总距离计算的 ~50%，每次 Insert 平均 5,500-5,650 次距离计算
2. **greedySearch 随规模增长**：从 10K 的 2,989 增长到 20K 的 3,992（+33.6%），符合 O(log N) 搜索深度增长预期
3. **selfPrune 基本稳定**：~2,030 次/insert，不随规模显著变化（取决于候选列表大小 L=100）
4. **backedge 剪枝触发率极低**：仅 4.3%，说明 GraphSlackFactor=1.3 策略有效避免了大部分剪枝
5. **backedge 距离计算主要来自候选列表构建**：每次 addEdgeAndPrune 调用约 86 次距离计算（5,496/63.8），其中绝大部分来自未触发剪枝时的候选列表距离计算

### backedge 距离计算分解

- addEdgeAndPrune 每次调用时，即使不触发剪枝，也需要计算 `fastDistanceToQuery` 来构建候选列表
- 但实际上，**不触发剪枝时不应有距离计算**（直接 append 返回）
- 距离计算集中在触发剪枝的 4.3% 调用中：每次剪枝约 54,953,386 / 27,530 ≈ **1,996 次距离计算**
- 这包括：候选列表构建（~83 个邻居 × 1 次 fastDistanceToQuery）+ robustPrune 内部的 fastDistance 调用

## 与 HNSW 对比预期

HNSW Insert 1,475/s vs Vamana Insert 637/s（2.31x 差距）。

Vamana 每次 Insert 约 10,500-11,700 次距离计算，其中：
- greedySearch 约 3,000-4,000 次（HNSW 的 searchLayer 类似但多层结构可能更少）
- selfPrune 约 2,000 次（HNSW 无此步骤，直接选 M 个最近邻）
- backedge 约 5,500 次（HNSW 的反向边处理更简单，不需要 robustPrune）

**核心差异**：Vamana 的 robustPrune 算法（包括 selfPrune 和 backedge 中的 prune）引入了大量额外距离计算，这是 HNSW 不需要的。
