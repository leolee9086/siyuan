# HNSW vs Vamana 距离计算次数对比分析

> Phase 16-0 调查产出。基于代码阅读的定量分析。

## 1. Benchmark 参数对照

| 参数 | HNSW | Vamana |
|------|------|--------|
| 最大出度 (layer 0) | 2×M = 32 | R = 32 |
| 最大出度 (上层) | M = 16 | — (单层图) |
| 搜索列表大小 | efConstruction = 200 | L = 200 |
| 剪枝阈值 | — | Alpha = 1.2 |
| 松弛因子 | GraphSlackFactor = 1.3 | GraphSlackFactor = 1.5 |
| 反向边上限 | 全部 selected (≤32) | MaxBackedges = 16 |
| MaxOcclusionSize | — | 750 |

来源：[`hnsw_vs_vamana_bench_test.go`](kernel/vectordb/hnsw_vs_vamana_bench_test.go) L311-318, L366-373

## 2. HNSW Insert 距离计算分析

### 2.1 Phase 1: greedySearch (上层贪心)

代码位置：[`build.go:126-177`](kernel/vectordb/hnsw/build.go:126)

对于每一层（从 entryLevel 到 itemLevel+1），执行贪心搜索。每轮展开当前最佳节点的所有邻居，计算距离。

- 上层邻居数 ≤ M = 16
- 每轮展开 1 个节点，计算 ≤16 次距离
- 收敛通常需要 ~3-5 轮（对数级）
- 大多数节点 level=0（概率 50%），不进入此阶段

**估算**：平均 ~0 层（50% 节点 level=0），少数节点 1-2 层。
平均每次 Insert 的上层距离计算：**~8 次**（加权平均）

### 2.2 Phase 2: searchLevel (layer 0)

代码位置：[`build.go:181-259`](kernel/vectordb/hnsw/build.go:181)

标准 beam search，ef=200，在 layer 0 搜索。

- 使用 MinHeap（candidates）+ MaxHeap（results, 容量 ef=200）
- 每次从 candidates 弹出最近节点，展开其邻居（layer 0 最多 2M=32 个）
- 对每个未访问邻居计算 1 次距离
- 终止条件：candidates 为空，或当前候选距离 > results 最差距离

**关键观察**：每个被访问的节点只计算 1 次距离（epoch 标记去重）。

总距离计算次数 = 被访问的唯一节点数。在 50K 规模下，beam search 通常访问 ~200-400 个节点（受 ef=200 约束，results 满后拒绝率逐渐升高）。

**估算**：**~300 次距离计算**（layer 0 searchLevel）

### 2.3 selectNeighborsHeuristic (自身剪枝)

代码位置：[`build.go:262-325`](kernel/vectordb/hnsw/build.go:262)

输入：searchLevel 返回的 candidates（已排序），选出 M=32 个。

对每个候选 c，与已选结果集 result 中的每个节点计算距离，判断是否被遮挡。

- 最坏情况：对 candidates 中前 k 个，每个与 result 中已有的 j 个比较 → Σ(j=0..M-1) j = M×(M-1)/2
- 但有 early break：一旦发现 distToRes < candidate.Distance 就跳过
- 实际上大部分候选在检查 1-3 个已选节点后就被判定

**估算**：~M × avgChecks ≈ 32 × 3 ≈ **~100 次距离计算**

### 2.4 反向边维护

代码位置：[`build.go:88-121`](kernel/vectordb/hnsw/build.go:88)

对 selected 中每个邻居（≤32 个），检查是否需要剪枝：

**关键优化**：HNSW 使用 `NeighborRecord` 缓存距离。反向边维护时：
- 读取 `cachedRecords = GetLevelNeighborRecords(neighbor.ID, level)` — 这些记录已包含距离
- 松弛判断：`len(cachedRecords)+1 <= slackM` 时直接 append，**零距离计算**
- 仅当超过 slackM（= 1.3 × 32 ≈ 41）时才触发 heuristic 剪枝

heuristic 剪枝时，输入是 `candidateBuf`（已有邻居 + 新节点），所有距离已缓存在 `NeighborRecord.Distance` 中。`selectNeighborsHeuristic` 内部的距离计算是候选间的两两比较（非候选到 query 的距离），这部分无法避免。

**但在构建早期**（50K 规模），大多数节点度数 < slackM=41，因此大部分反向边操作是零距离计算的直接 append。

**估算**：
- 32 个反向边中，假设 ~20% 触发剪枝（度数超过 41 的节点比例）
- 每次剪枝：~41 个候选 × ~3 次平均检查 ≈ 123 次
- 平均：32 × 0.2 × 123 ≈ **~790 次距离计算**
- 构建早期（<20K）几乎为 0；后期（40K-50K）可能更高

### 2.5 HNSW 总计

| 环节 | 距离计算次数 | 占比 |
|------|-------------|------|
| greedySearch (上层) | ~8 | ~0.7% |
| searchLevel (layer 0) | ~300 | ~25% |
| selectNeighborsHeuristic (自身) | ~100 | ~8% |
| 反向边维护 | ~790 | ~66% |
| **总计** | **~1,200** | 100% |

## 3. Vamana Insert 距离计算分析

### 3.1 greedySearchFast

代码位置：[`search.go:74-129`](kernel/vectordb/vamana/search.go:74)

使用 NeighborPriorityQueue（有序数组，容量 L=200）。

- 从 medoid 开始，每次弹出最近未访问节点，展开其邻居
- 每个邻居最多 R=32 个（但受 GraphSlackFactor=1.5 影响，实际可达 ~48）
- 每个未访问节点计算 1 次距离（Visited bitset 去重）
- 终止条件：无未访问节点，或 `PopClosestUnvisited` 返回 false（早停）

**与 HNSW searchLevel 的关键差异**：
1. Vamana 是单层图，所有节点都在同一层，邻居数更多（实际可达 ~48 vs HNSW layer 0 的 ~32）
2. 搜索起点是 medoid（全局质心最近点），HNSW 从上层贪心搜索的结果开始
3. 两者 ef/L 都是 200，搜索行为类似

**估算**：与 HNSW searchLevel 类似，**~300-400 次距离计算**。
但由于邻居数更多（GSF=1.5 允许最多 48 个邻居），展开时访问更多节点。

**修正估算**：**~400 次距离计算**

### 3.2 robustPruneCore (自身剪枝)

代码位置：[`build.go:437-527`](kernel/vectordb/vamana/build.go:437)

输入：greedySearch 返回的 candidates（排序后截断到 MaxOcclusionSize=750），选出 R=32 个。

**关键差异 vs HNSW selectNeighborsHeuristic**：

1. **多轮 alpha 扫描**：currentAlpha 从 1.0 开始，每轮乘以 incrementFactor（= min(1.2, alpha) = 1.2），直到 >= alpha=1.2。所以实际是 **2 轮**：alpha=1.0 和 alpha=1.2。

2. **增量式距离计算**：使用 `lastChecked[i]` 数组，每个候选只与新增的 result 成员计算距离，避免重复。

3. **距离计算类型不同**：`fastDistance(cand.ID, selectedID)` 是节点间距离（1 次 dotProduct），而非候选到 query 的距离。

距离计算发生在内层循环 `for lastChecked[i] < len(*resultPos)` 中：
- 每当 result 新增一个成员，所有未被淘汰的候选都需要与新成员计算距离
- 最坏情况：n 个候选，选出 R 个 → Σ(k=0..R-1)(n-k) ≈ n×R
- 但 occludeFactor 淘汰机制会快速减少活跃候选数

**实际分析**（n = min(len(candidates), 750), R=32）：

greedySearch 返回 L=200 个候选，所以 n ≈ 200。

第一轮 (alpha=1.0)：
- 选出 k1 个结果（k1 < 32，因为 alpha=1.0 更严格）
- 距离计算 ≈ Σ(j=0..k1-1) active_candidates_j
- 估算 k1 ≈ 20，平均活跃候选 ~100 → ~2,000 次

第二轮 (alpha=1.2)：
- 继续选出剩余 32-k1 ≈ 12 个
- 但 lastChecked 是增量的，只计算新增 result 成员的距离
- 估算 ~600 次

**估算**：**~2,600 次距离计算**

### 3.3 addEdgeAndPrune (反向边)

代码位置：[`build.go:286-342`](kernel/vectordb/vamana/build.go:286)

对 neighbors 中前 MaxBackedges=16 个执行反向边添加。

每次 addEdgeAndPrune：
1. **Phase 1**：检查是否已存在 + 松弛判断（零距离计算）
2. **Phase 2**（仅当超过 GSF×R = 1.5×32 = 48 时触发）：
   - 对 copyOfNeighbors（~49 个）每个计算到 nodeID 的距离 → ~49 次
   - 然后执行 robustPrune → 与自身剪枝类似但 n 更小（~49）

**关键差异 vs HNSW**：
- HNSW 反向边使用缓存距离，大部分情况零距离计算
- Vamana 反向边触发剪枝时，必须重新计算所有邻居到 nodeID 的距离（无缓存）

**估算**：
- 16 个反向边中，假设 ~30% 触发剪枝（度数超过 48）
- 每次剪枝：49 次距离计算（Phase 2 重算）+ robustPrune（n=49, R=32）
  - robustPrune(n=49, R=32)：~49 × 32 × 0.3（淘汰率）≈ ~470 次
  - 总计每次剪枝：49 + 470 ≈ ~520 次
- 平均：16 × 0.3 × 520 ≈ **~2,500 次距离计算**
- 未触发剪枝的：16 × 0.7 × 0 = 0

### 3.4 Vamana 总计

| 环节 | 距离计算次数 | 占比 |
|------|-------------|------|
| greedySearchFast | ~400 | ~7% |
| robustPruneCore (自身) | ~2,600 | ~47% |
| addEdgeAndPrune (反向边) | ~2,500 | ~46% |
| **总计** | **~5,500** | 100% |

## 4. 定量对比

| 环节 | HNSW | Vamana | 倍数 |
|------|------|--------|------|
| 搜索 (searchLevel / greedySearch) | ~300 | ~400 | 1.3x |
| 自身剪枝 (heuristic / robustPrune) | ~100 | ~2,600 | **26x** |
| 反向边维护 | ~790 | ~2,500 | **3.2x** |
| **总计** | **~1,200** | **~5,500** | **~4.6x** |

**注**：实际 benchmark 差距 ~2.3x 而非 4.6x，因为：
1. 上述是理论最坏估算，实际 occlude 淘汰更快
2. Phase 13 的 20K 实测数据为 11,672 次/Insert，但那是 20K 规模且参数不同
3. HNSW 的 `ComputeDistanceFromVector` 路径比 Vamana 的 `fastDistance` 略慢（前者每次需要 1 次 dotProduct + 向量查找，后者使用预计算范数只需 1 次 dotProduct）

## 5. 最大差异来源

### 5.1 robustPruneCore 的多轮扫描 + O(n×R) 距离计算（最大瓶颈）

HNSW 的 `selectNeighborsHeuristic` 对每个候选只需与已选结果比较，early break 后跳过。平均每个候选 ~3 次比较。

Vamana 的 `robustPruneCore` 使用增量式 lastChecked，但本质上每个候选需要与所有已选结果计算距离（直到被淘汰）。且有 2 轮 alpha 扫描（1.0 → 1.2），第一轮淘汰的候选在第二轮可能重新激活。

**差距**：~100 vs ~2,600 = **26 倍**

### 5.2 反向边无距离缓存

HNSW 的 `NeighborRecord` 结构体缓存了 `Distance` 字段。反向边维护时：
- 读取已有邻居的缓存距离（零计算）
- 松弛范围内直接 append（零计算）
- 仅超过松弛阈值时才触发 heuristic，且输入距离已缓存

Vamana 的 `neighbors [][]uint32` 只存储 ID，不缓存距离。反向边触发剪枝时：
- 必须重新计算所有邻居到 nodeID 的距离（Phase 2 的 for 循环）
- 然后 robustPrune 内部再次计算候选间距离

**差距**：~790 vs ~2,500 = **3.2 倍**

## 6. 优化方向建议

### 6.1 robustPruneCore 优化（预期收益最大）

**方向 A：减少候选数量**
- 当前 robustPrune 输入 = greedySearch 全部返回（≤L=200 个）
- HNSW 的 searchLevel 也返回 ~200 个，但 heuristic 处理更轻量
- 可考虑在 robustPrune 前先截断到更小的候选集（如 2×R=64）

**方向 B：消除多轮 alpha 扫描**
- 当前 alpha=1.2，incrementFactor=1.2，实际 2 轮（1.0 和 1.2）
- 如果直接使用 alpha=1.0（单轮），距离计算减半，但可能影响图质量
- 或者将 incrementFactor 设为 alpha（跳过中间轮次），当前已经是这样（min(1.2, 1.2)=1.2），所以只有 2 轮

**方向 C：引入 early termination**
- 当已选出 R 个结果后立即退出（当前已有此逻辑）
- 但可以在 occludeFactor 更新时更积极地淘汰候选

### 6.2 反向边距离缓存（预期收益中等）

**方向 D：在 neighbors 中缓存距离**
- 将 `neighbors [][]uint32` 改为类似 HNSW 的 `[][]NeighborRecord{ID, Distance}`
- 反向边维护时直接使用缓存距离，避免 Phase 2 的重算
- 代价：内存增加 ~2x（每个边额外存 4 字节 float32）

**方向 E：松弛因子调大**
- 当前 GSF=1.5，slackR=48。增大到 2.0（slackR=64）可减少剪枝触发频率
- 但会增加内存和搜索时展开的邻居数

### 6.3 greedySearch 优化（预期收益小）

搜索阶段差距仅 1.3x，优化空间有限。可能的方向：
- 减少 L 值（但会影响召回率）
- 多起点搜索（增加距离计算，不推荐）
