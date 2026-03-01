# Vamana Insert 剩余优化空间精确分析 (Phase 17)

> 基于截断后代码的精确分析。当前 Vamana ~728/s vs HNSW ~1566/s，gap 2.15x。

## 1. robustPruneCore 多轮 alpha 扫描分析

### 1.1 当前实现逻辑

代码位置：[`build.go:437-536`](kernel/vectordb/vamana/build.go:437)

```
currentAlpha := float32(1.0)
incrementFactor := float32(1.2)   // = min(1.2, alpha=1.2)
```

alpha=1.2 时的扫描轮次：
- 第 1 轮：currentAlpha=1.0，扫描全部候选
- 第 1 轮结束：currentAlpha(1.0) < alpha(1.2)，继续
- currentAlpha = 1.0 × 1.2 = 1.2，clamp 到 alpha=1.2
- 第 2 轮：currentAlpha=1.2，扫描全部候选
- 第 2 轮结束：currentAlpha(1.2) >= alpha(1.2)，break

**确认：恰好 2 轮扫描。**

### 1.2 截断后的候选集大小

截断逻辑（L444-448）：`maxCandidates = 2 × maxDegree = 2 × 32 = 64`

greedySearchFast 返回最多 L=200 个候选，经 robustPruneWithScratch 排序后截断到 64。

### 1.3 每轮距离计算次数分析（n=64, R=32）

距离计算发生在内循环 `fastDistance(cand.ID, selectedID)`（L486）。

**第 1 轮 (alpha=1.0)**：
- 遍历 64 个候选，对每个未淘汰候选与已选 result 成员计算距离
- alpha=1.0 意味着遮挡条件更严格：只要 distCN < cand.Distance 就淘汰
- 选出 k1 个结果（k1 < 32，因为 alpha=1.0 更严格）
- 增量式 lastChecked 避免重复：候选 i 只与 lastChecked[i] 之后新增的 result 成员计算
- 关键约束：`resultIdx >= i` 时 skip（L481-483），即只与索引更小的已选结果比较
- 估算 k1 ≈ 20-25（alpha=1.0 下 128 维随机数据的典型值）
- 距离计算 ≈ Σ(j=0..k1-1) (活跃候选中 index > resultPos[j] 的数量)
- 粗估：平均每个新 result 成员触发 ~20 次距离计算 → 25 × 20 = **~500 次**

**第 2 轮 (alpha=1.2)**：
- 第 1 轮被淘汰的候选（occludeFactor 在 1.0~1.2 之间的）重新激活
- 需要选出剩余 32-k1 ≈ 7-12 个
- lastChecked 是增量的，但第 2 轮开始时 resultPos 已有 k1 个元素
- 重新激活的候选需要与第 1 轮新增的 result 成员计算距离
- 估算：~10 个新 result × ~15 次距离计算 = **~150 次**

**自身 robustPrune 总计：~650 次距离计算**

### 1.4 对比 HNSW selectNeighborsHeuristic

代码位置：[`hnsw/build.go:262-325`](kernel/vectordb/hnsw/build.go:262)

HNSW 的 heuristic 是单轮扫描，alpha 隐含为 1.0（`distToRes < candidate.Distance` 即淘汰）：
- 输入：searchLevel 返回的 ~200 个候选（已排序），选出 M=32 个
- 对每个候选，与已选 result 逐个比较，early break
- 距离计算：`ComputeDistanceFromVector(candidateVec, res.ID, metricType)`
- 平均每个候选检查 ~2-3 个已选结果后 break 或通过
- 估算：~60 个候选被检查（前 32 个通过 + ~28 个被淘汰）× ~3 = **~180 次**

**差距：650 vs 180 = 3.6x**（Phase 16-0 估算的 26x 是截断前的数据，截断到 64 后大幅缩小）

### 1.5 去掉 alpha=1.0 轮直接用 alpha=1.2 的可行性

**代码层面**：将 `currentAlpha := float32(1.0)` 改为 `currentAlpha := alpha` 即可跳过第 1 轮。

**对图质量的影响**：
- alpha=1.0 轮的作用是优先选择"无遮挡"的近邻（严格的多样性保证）
- alpha=1.2 轮放松遮挡条件，允许轻微遮挡的候选入选
- 直接用 alpha=1.2 意味着第一批选出的邻居可能包含轻微遮挡的候选
- DiskANN 原始论文中 alpha=1.2 是推荐值，多轮扫描是 IP-DiskANN 的实现细节
- **结论：可行，但需要 recall 回归测试验证**。预期 recall 影响 < 1%。

**预期收益**：消除第 1 轮的 ~500 次距离计算，自身 robustPrune 从 ~650 降到 ~150，节省 ~77%。但自身 robustPrune 在总开销中占比有限（见第 4 节）。

## 2. greedySearch vs HNSW searchLevel 对比

### 2.1 Vamana greedySearchFast

代码位置：[`search.go:74-129`](kernel/vectordb/vamana/search.go:74)

- 数据结构：NeighborPriorityQueue（有序数组，容量 L=200）
- 起点：medoid（1 个）
- 展开：每次弹出最近未访问节点，展开其邻居
- 邻居数：R=32，但 GSF=1.5 允许最多 48 个（实际平均 ~35-40）
- 去重：Visited bitset，每个节点最多计算 1 次距离
- 终止：无未访问节点（HasUnvisited 返回 false）
- Insert 路径使用 `greedySearchFast`（持 mu.RLock 全程）

**Insert 路径的额外开销**：`greedySearchFast` 持有 `idx.mu.RLock()` 全程（L78-79），这意味着 Insert 的搜索阶段与其他 Insert 的写操作互斥。但 benchmark 是单线程，所以锁竞争不是当前瓶颈。

**NeighborPriorityQueue 的 Insert 开销**：O(log n) 二分查找 + O(n) 元素移动（n ≤ L=200）。每次插入最多移动 200 个 Neighbor 结构体（8 字节）。这是纯 CPU 开销，不涉及距离计算。

### 2.2 HNSW searchLevel

代码位置：[`hnsw/build.go:181-259`](kernel/vectordb/hnsw/build.go:181)

- 数据结构：MinHeap（candidates）+ MaxHeap（results，容量 ef=200）
- 起点：上层 greedySearch 的结果（1 个，但质量更好）
- 展开：每次从 candidates 弹出最近节点，展开其邻居
- 邻居数：layer 0 最多 2M=32（无松弛因子影响，GSF=1.3 仅影响反向边维护）
- 去重：epoch-based visited 标记
- 终止：candidates 为空，或 current.Distance > results.Peek().Distance

**关键差异**：
1. HNSW 有明确的早停条件（current > results 最差），Vamana 依赖 HasUnvisited
2. HNSW 的 results 是 MaxHeap（容量 ef），满后用 Replace 替换最差；Vamana 的 Best 是有序数组（容量 L），满后丢弃最远
3. HNSW 起点经过上层贪心搜索，质量更好；Vamana 从 medoid 开始

### 2.3 Benchmark 参数

| 参数 | HNSW | Vamana |
|------|------|--------|
| 搜索宽度 | efConstruction=200 | L=200 |
| 邻居数 (layer 0) | 2M=32 | R=32 (实际可达 ~48) |
| 起点质量 | 上层贪心搜索结果 | medoid |
| 早停 | current > results.worst | 无显式早停 |
| 数据结构 | MinHeap + MaxHeap | 有序数组 |

### 2.4 搜索终止条件差异

**HNSW**（L213-215）：
```go
if results.IsFull() && current.Distance > results.Peek().Distance {
    break
}
```
当 results 满（200 个）且当前候选比最差结果还远时，立即终止。

**Vamana**（L100-105）：
```go
for scratch.Best.HasUnvisited() {
    closest, ok := scratch.Best.PopClosestUnvisited()
    if !ok { break }
```
HasUnvisited 遍历 currentIndex 到 count，找到 flag=true 的节点。PopClosestUnvisited 返回最近的未访问节点。当所有节点都已访问时终止。

**Vamana 的隐式早停**：NeighborPriorityQueue 容量为 L=200，满后新插入的节点如果比最远的还远会被丢弃（L303-320）。但已在队列中的未访问节点仍会被展开，即使它们比当前最佳结果远。

**结论**：两者搜索行为在 L=ef=200 时基本等价，访问节点数差异不大。Vamana 可能略多（因为缺少显式早停），但差距在 10-20% 以内。

**估算距离计算次数**：两者都约 **~300-400 次**。

## 3. addEdgeAndPrune 触发频率分析

### 3.1 当前参数

- MaxBackedges = 16（DefaultR/2 = 64/2 = 32，但 benchmark 中显式设为 16）
- GraphSlackFactor = 1.5
- R = 32
- slackR = int(1.5 × 32) = 48

### 3.2 每次 Insert 的反向边处理

代码位置：[`build.go:419-427`](kernel/vectordb/vamana/build.go:419)

每次 Insert 处理 min(len(neighbors), MaxBackedges) = min(32, 16) = **16 个反向边**。

### 3.3 剪枝触发条件

代码位置：[`build.go:299-300`](kernel/vectordb/vamana/build.go:299)

```go
if len(currentNeighbors) < maxDegreeWithSlack {  // < 48
    // 直接 append，零距离计算
    return
}
```

只有当目标节点的邻居数 >= 48 时才触发剪枝。

**触发频率估算**：
- 构建早期（<10K）：大多数节点度数 < 48，触发率极低（~5%）
- 构建中期（10K-30K）：部分热点节点度数达到 48，触发率 ~15-25%
- 构建后期（30K-50K）：更多节点度数饱和，触发率 ~30-40%
- 50K 规模加权平均：**~20-25%**

### 3.4 触发剪枝时的开销

当触发剪枝时（L250-279）：

**Phase 2 距离重算**：
- copyOfNeighbors 大小 = 48+1 = 49
- 对每个邻居计算 `fastDistanceToQuery(nid, nodeVector, nodeNormSq)` → 49 次距离计算
- 这是 node-to-neighbor 距离，使用预计算范数

**Phase 2 robustPrune**：
- 输入：49 个候选，R=32
- 截断：2×32=64 > 49，不截断
- 多轮 alpha 扫描（同第 1 节分析）
- n=49, R=32 的 robustPrune 距离计算 ≈ **~300 次**（比自身的 n=64 少，因为候选更少）

**每次触发的总开销**：49 + 300 = **~350 次距离计算**

### 3.5 反向边总开销

- 16 个反向边 × 25% 触发率 × 350 次 = **~1,400 次距离计算**
- 未触发的：16 × 75% × 0 = 0

### 3.6 对比 HNSW 反向边维护

HNSW（[`build.go:88-121`](kernel/vectordb/hnsw/build.go:88)）：

- 对 selected 中每个邻居（≤32 个）添加反向边
- 松弛判断：`len(cachedRecords)+1 <= slackM`（slackM = 1.3 × 32 ≈ 41）
- 未超过松弛阈值：直接 append `NeighborRecord{ID, Distance}`，**零距离计算**（距离已在 searchLevel 中缓存）
- 超过松弛阈值：执行 selectNeighborsHeuristic，但输入的 candidateBuf 中所有距离已缓存在 NeighborRecord.Distance 中
- heuristic 内部的距离计算是候选间两两比较（`ComputeDistanceFromVector`），无法避免

**HNSW 反向边距离计算估算**：
- 32 个反向边中，~20% 触发 heuristic（度数超过 41）
- 每次 heuristic：~41 个候选 × ~3 次平均检查 = ~123 次
- 总计：32 × 0.2 × 123 = **~790 次**

**差距**：1,400 vs 790 = **1.8x**

**关键差异**：
1. HNSW 处理 32 个反向边，Vamana 只处理 16 个（MaxBackedges=16），但 Vamana 每次触发的开销更大
2. HNSW 的 NeighborRecord 缓存距离，松弛范围内零距离计算
3. Vamana 触发剪枝时必须重算所有邻居到 nodeID 的距离（Phase 2 的 for 循环）

## 4. Vamana Insert 各环节时间占比估算

基于截断后代码的距离计算次数：

| 环节 | 距离计算次数 | 占比 | 说明 |
|------|-------------|------|------|
| greedySearchFast | ~350 | **14%** | L=200, 邻居数 ~35-40 |
| robustPruneCore (自身) | ~650 | **27%** | n=64 (截断后), R=32, 2 轮 alpha |
| addEdgeAndPrune (反向边) | ~1,400 | **58%** | 16 条, ~25% 触发剪枝 |
| 其他 (sort, containsID 等) | ~30 | ~1% | 非距离计算开销 |
| **总计** | **~2,430** | 100% | |

对比 HNSW：

| 环节 | HNSW | Vamana | 倍数 |
|------|------|--------|------|
| 搜索 | ~300 | ~350 | 1.2x |
| 自身剪枝 | ~180 | ~650 | 3.6x |
| 反向边 | ~790 | ~1,400 | 1.8x |
| **总计** | **~1,270** | **~2,430** | **1.9x** |

**注**：1.9x 的距离计算倍数与实测 2.15x 的吞吐量差距基本吻合。剩余差距来自：
- Vamana 的 `sort.Slice` 对 200 个候选排序（robustPrune 前）
- NeighborPriorityQueue 的 O(n) 元素移动开销
- Vamana Insert 的 mu.Lock/Unlock 开销（扩容检查等）
- HNSW 的 `ComputeDistanceFromVector` 比 Vamana 的 `fastDistanceToQuery` 略慢（前者需要 metric 分发）

## 5. 可行优化方案排序

### 方案 A：消除 alpha=1.0 轮，直接用 alpha=1.2（预期收益：~10-15%）

- **原理**：将 `currentAlpha := float32(1.0)` 改为 `currentAlpha := alpha`，消除第 1 轮扫描
- **节省**：自身 robustPrune 从 ~650 降到 ~150（节省 ~500 次），反向边 robustPrune 类似比例节省
- **总节省**：~500 + ~200 = ~700 次，占总量 2430 的 ~29%
- **但**：距离计算只是总时间的一部分，实际吞吐量提升 ~10-15%
- **风险**：可能影响图质量（recall），需要回归测试
- **复杂度**：极低，改 1 行代码
- **推荐度**：★★★★☆

### 方案 B：反向边距离缓存（预期收益：~15-20%）

- **原理**：将 `neighbors [][]uint32` 改为存储 `{ID uint32, Distance float32}`，反向边维护时复用缓存距离
- **节省**：消除 addEdgeAndPrune Phase 2 的距离重算（每次触发 ~49 次），并减少 robustPrune 输入的距离计算
- **总节省**：~400-600 次距离计算
- **但**：需要修改核心数据结构，影响面广（search、delete、persistence 等）
- **风险**：中等，数据结构变更需要全面回归
- **复杂度**：高，涉及多个文件
- **推荐度**：★★★☆☆

### 方案 C：增大 GraphSlackFactor 到 2.0（预期收益：~10-15%）

- **原理**：slackR 从 48 增到 64，大幅减少反向边剪枝触发频率
- **节省**：触发率从 ~25% 降到 ~5-10%，反向边开销从 ~1400 降到 ~300-600
- **总节省**：~800-1100 次距离计算
- **但**：节点度数可能长期维持在 48-64，增加搜索时展开的邻居数
- **风险**：低，参数调整，可通过 benchmark 验证
- **复杂度**：极低，改 1 个配置值
- **推荐度**：★★★★★

### 方案 D：robustPrune 候选集进一步截断（预期收益：~5-8%）

- **原理**：当前截断到 2×R=64，可以尝试 1.5×R=48
- **节省**：减少内循环迭代次数，自身 robustPrune 从 ~650 降到 ~450
- **风险**：候选集过小可能影响图质量
- **复杂度**：极低
- **推荐度**：★★★☆☆

### 方案 E：greedySearchFast 添加显式早停（预期收益：~3-5%）

- **原理**：当 Best 队列满且最近未访问节点距离 > Best 最远距离时终止
- **节省**：减少搜索阶段 ~50-100 次距离计算
- **风险**：极低
- **复杂度**：低
- **推荐度**：★★★☆☆

### 方案 F：NeighborPriorityQueue 替换为 MinHeap+MaxHeap（预期收益：~3-5%）

- **原理**：当前有序数组 Insert 是 O(n) 移动，改用堆结构可降到 O(log n)
- **节省**：非距离计算开销，纯 CPU 优化
- **风险**：低
- **复杂度**：中等
- **推荐度**：★★☆☆☆

### 推荐实施顺序

1. **方案 C**（GSF=2.0）— 最简单，预期收益最大，风险最低
2. **方案 A**（消除 alpha=1.0 轮）— 简单，收益明确，需要 recall 验证
3. **方案 E**（显式早停）— 简单，低风险
4. **方案 D**（候选集截断到 1.5×R）— 简单，需要 recall 验证
5. **方案 B**（距离缓存）— 收益大但复杂度高，作为长期优化
6. **方案 F**（数据结构替换）— 收益小，优先级最低

**组合预期**：方案 C + A + E 组合实施，预期总吞吐量提升 ~25-35%，将 gap 从 2.15x 缩小到 ~1.5-1.7x。
