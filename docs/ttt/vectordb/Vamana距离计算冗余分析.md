# Vamana Insert 距离计算冗余分析

## 1. Insert 距离计算完整流程

### 1.1 流程概览

```
Insert(vector)
  │
  ├─ Phase 1: greedySearchFast()
  │   ├─ 输入: startIDs=[medoid], query=vector, queryNormSq
  │   ├─ 距离函数: fastDistanceToQuery(nodeID, query, queryNormSq)
  │   ├─ 结果存储: scratch.Best (NeighborPriorityQueue)
  │   │   └─ 每个元素: Neighbor{ID, Distance}  ← 距离已计算
  │   └─ 输出: candidates = scratch.Best.All() → []Neighbor (带距离)
  │
  ├─ Phase 2: robustPruneWithScratch(id, candidates, R, Alpha, scratch)
  │   ├─ 输入: candidates []Neighbor ← 已携带 Distance
  │   ├─ 核心: robustPruneCore()
  │   │   ├─ 使用 cand.Distance (来自 greedySearch) ✅ 无冗余
  │   │   └─ 计算 fastDistance(cand.ID, selectedID) ← 候选间距离 (新计算)
  │   └─ 输出: neighbors []uint32 ← 仅返回 ID，丢弃距离
  │
  └─ Phase 3: addEdgeAndPrune(neighborID, id, scratch) × maxBackedges
      ├─ 快速路径 (95.7%): 度数 < slackMax → 直接 append，无距离计算
      └─ 剪枝路径 (4.3%):
          ├─ 遍历 copyOfNeighbors:
          │   └─ fastDistanceToQuery(nid, nodeVector, nodeNormSq) ← 全部重新计算
          └─ robustPruneWithScratch() → 内部 fastDistance() 候选间距离
```

### 1.2 距离信息的生命周期

| 阶段 | 计算的距离 | 存储位置 | 是否传递给下一阶段 |
|------|-----------|---------|------------------|
| greedySearchFast | dist(query, visited_node) | scratch.Best → []Neighbor | ✅ 传递给 robustPrune |
| robustPruneCore | dist(candidate_i, candidate_j) | 临时变量 distCN | ❌ 不传递 |
| robustPruneCore | cand.Distance (复用 greedySearch 结果) | candidates[].Distance | ✅ 直接复用 |
| addEdgeAndPrune | dist(node, neighbor) | candidates []Neighbor | ❌ 不传递 |

### 1.3 关键发现：robustPrune 不重复计算 greedySearch 的距离

`greedySearchFast()` 返回 `[]Neighbor`，每个元素携带 `Distance` 字段。
`robustPruneWithScratch()` 接收 `candidates []Neighbor`，在 `robustPruneCore()` 中：
- 使用 `cand.Distance`（即 greedySearch 已计算的 query→candidate 距离）进行遮挡判断
- 仅新计算 `fastDistance(cand.ID, selectedID)`（candidate 之间的距离），这是 greedySearch 未计算过的

**结论：Phase 1 → Phase 2 之间不存在冗余距离计算。**

## 2. 冗余计算的具体位置

### 2.1 冗余点 A：robustPrune 输出丢弃距离信息

`robustPruneWithScratch()` 返回 `[]uint32`（仅 ID），丢弃了所有距离信息：

```go
// build.go:518-520 — robustPruneCore 最终输出
result := make([]uint32, len(*resultPos))
for i, pos := range *resultPos {
    result[i] = candidates[pos].ID  // ← 仅保留 ID，Distance 被丢弃
}
```

这意味着 Phase 3 的 `addEdgeAndPrune` 中，当需要为 backedge 节点计算到其邻居的距离时，
无法复用 Phase 2 中已经计算过的任何距离。

### 2.2 冗余点 B：addEdgeAndPrune 剪枝路径的候选列表构建

当 backedge 触发剪枝时（4.3% 的调用），需要重新计算 nodeID 到其所有邻居的距离：

```go
// build.go:326-335 — addEdgeAndPrune Phase 2
for i, nid := range copyOfNeighbors {
    dist := idx.fastDistanceToQuery(nid, nodeVector, nodeNormSq)
    candidates = append(candidates, Neighbor{ID: nid, Distance: dist})
}
```

这里的 `copyOfNeighbors` 包含 nodeID 的现有邻居 + newNeighborID。
其中 `newNeighborID` 就是刚插入的节点 `id`，而 `dist(nodeID, id)` 在 Phase 1 的
greedySearch 中很可能已经计算过（如果 nodeID 在搜索路径上被访问过）。

**但这个距离无法复用**，因为：
1. greedySearch 计算的是 `dist(query=新向量, nodeID)`
2. addEdgeAndPrune 需要的是 `dist(nodeID_vector, neighborID)`，视角不同
3. 对于 `dist(nodeID, newInsertedID)` 这一特定距离，数值上等于 greedySearch 中计算的
   `dist(query, nodeID)`（因为 query 就是新插入节点的向量），但这个值没有被传递过来

### 2.3 冗余点 C：neighbors 列表不携带距离

Vamana 的图结构 `neighbors [][]uint32` 仅存储邻居 ID，不存储距离：

```go
// index.go:57
neighbors [][]uint32  // neighbors[nodeID] = []neighborIDs
```

而 HNSW 的图结构存储 `NeighborRecord{ID, Distance}`：

```go
// hnsw/types.go:57-61
type NeighborRecord struct {
    ID       DocID   `msgpack:"id"`
    Distance float32 `msgpack:"distance"`
}
```

这导致 Vamana 在 addEdgeAndPrune 剪枝时，必须重新计算 nodeID 到其所有现有邻居的距离。

## 3. 与 HNSW 的对比

### 3.1 HNSW 的距离缓存策略

| 特性 | HNSW | Vamana |
|------|------|--------|
| 图边存储 | `NeighborRecord{ID, Distance}` | `[]uint32` (仅 ID) |
| searchLevel 输出 | `[]NeighborRecord` (带距离) | `[]Neighbor` (带距离) |
| 剪枝输入 | 直接使用缓存距离 | 直接使用缓存距离 ✅ |
| 反向边处理 | 利用 `neighbor.Distance` 反转 | 重新计算所有距离 ❌ |
| 反向边剪枝 | 从 `GetLevelNeighborRecords` 获取已缓存距离 | 遍历邻居列表重新计算 ❌ |

### 3.2 HNSW 反向边处理的关键优化

```go
// hnsw/build.go:93-101 — HNSW 双向连接
for _, neighbor := range selected {
    cachedRecords := idx.GetLevelNeighborRecords(neighbor.ID, level)
    // ↑ 已有邻居的距离全部缓存在 NeighborRecord 中

    if len(cachedRecords)+1 <= slackM {
        idx.SetLevelNeighbors(neighbor.ID, level, append(cachedRecords, NeighborRecord{
            ID:       itemDocID,
            Distance: neighbor.Distance,  // ← 直接复用 searchLevel 的距离
        }))
        continue
    }

    // 剪枝路径：cachedRecords 已携带距离，无需重新计算
    candidateBuf = append(candidateBuf, cachedRecords...)
    candidateBuf = append(candidateBuf, NeighborRecord{
        ID:       itemDocID,
        Distance: neighbor.Distance,  // ← 复用
    })
    newNeighbors := idx.selectNeighborsHeuristic(neighbor.ID, candidateBuf, M, ...)
}
```

HNSW 的关键优势：
1. **`neighbor.Distance` 直接复用**：searchLevel 返回的距离 = dist(newNode, neighbor)，
   反向边需要的也是 dist(neighbor, newNode)，对称距离直接可用
2. **已有邻居距离已缓存**：`GetLevelNeighborRecords` 返回的每条边都带距离，
   剪枝时无需重新计算 neighbor 到其现有邻居的距离
3. **selectNeighborsHeuristic 仅计算候选间距离**：与 robustPrune 类似，
   但输入的 candidate.Distance 全部来自缓存

### 3.3 Vamana 反向边处理的问题

```go
// vamana/build.go:326-335 — Vamana addEdgeAndPrune 剪枝路径
nodeVector := idx.vectors[nodeID]
nodeNormSq := idx.normSquares[nodeID]
candidates := make([]Neighbor, 0, len(copyOfNeighbors))

for i, nid := range copyOfNeighbors {
    dist := idx.fastDistanceToQuery(nid, nodeVector, nodeNormSq)
    // ↑ 全部重新计算！包括已有邻居的距离
    candidates = append(candidates, Neighbor{ID: nid, Distance: dist})
}
```

每次触发剪枝时，需要计算 ~83 次 `fastDistanceToQuery`（现有邻居数 ≈ R×SlackFactor ≈ 83）。
其中：
- **已有邻居的距离**：如果图边存储了距离，这些全部可以省略
- **新节点的距离**：`dist(nodeID, newInsertedID)` 可以从 Phase 1 传递

## 4. 冗余计算量估算

基于 10K 规模统计数据：

| 冗余来源 | 计算次数 | 占总距离计算比例 |
|---------|---------|----------------|
| backedge 剪枝时重算已有邻居距离 | 27,530 × ~82 ≈ 2,257,460 | 2.1% |
| backedge 剪枝时重算新节点距离 | 27,530 × 1 ≈ 27,530 | 0.03% |
| **可消除的冗余总计** | **~2,285,000** | **~2.2%** |

注意：backedge 总距离计算 54,953,386 中，大部分来自 `robustPruneCore` 内部的
`fastDistance(cand.ID, selectedID)` 候选间距离计算（约 52,668,000 次），
这部分是算法固有的，无法通过距离缓存消除。

## 5. 可行优化方案

### 方案 A：图边存储距离（推荐）

**改动**：将 `neighbors [][]uint32` 改为 `neighbors [][]Neighbor`（或新类型 `Edge{ID uint32, Distance float32}`）

**收益**：
- 消除 addEdgeAndPrune 剪枝时对已有邻居的距离重算（~2.1% 总距离计算）
- 使 robustPrune 返回 `[]Neighbor` 而非 `[]uint32`，保留距离信息供后续使用
- 为未来更多优化（如增量图维护）奠定基础

**代价**：
- 内存增加：每条边额外 4 字节 (float32)，N=10K, R=64 时约 2.5MB
- 需要修改所有读写 neighbors 的代码路径

**预期性能提升**：~2-3%（距离计算减少 ~2.2%，但距离计算不是唯一瓶颈）

### 方案 B：传递 dist(nodeID, newInsertedID) 到 addEdgeAndPrune

**改动**：`addEdgeAndPrune` 签名增加 `knownDist float32` 参数，
在构建候选列表时跳过 newNeighborID 的距离计算。

**收益**：极小（仅省 27,530 次距离计算 / 10K insert ≈ 0.03%）

**结论**：投入产出比极低，不推荐单独实施。

### 方案 C：robustPrune 返回 []Neighbor（配合方案 A）

**改动**：`robustPruneCore` / `robustPruneWithScratch` 返回 `[]Neighbor` 而非 `[]uint32`

**收益**：
- 与方案 A 配合，setNeighbors 时直接写入带距离的边
- addEdgeAndPrune 中新节点的距离可从 robustPrune 结果中获取

### 综合评估

| 方案 | 距离计算减少 | 实现复杂度 | 推荐度 |
|------|------------|-----------|--------|
| A: 图边存距离 | ~2.2% | 中（需改图结构） | ⭐⭐⭐ |
| B: 传递已知距离 | ~0.03% | 低 | ⭐ |
| C: robustPrune 返回 Neighbor | 配合 A | 低 | ⭐⭐⭐（与 A 捆绑） |
| A+C 组合 | ~2.2% | 中 | ⭐⭐⭐⭐ |

**核心结论**：Vamana Insert 路径中的距离冗余比例较低（~2.2%），
主要瓶颈在于 robustPrune 算法本身的 O(n²) 候选间距离计算，
这是算法固有特性，无法通过缓存消除。
与 HNSW 的性能差距（2.31x）主要来自算法复杂度差异，而非距离缓存策略。

方案 A+C 值得实施，但预期收益有限（2-3%），
更大的性能提升应从减少 robustPrune 调用次数或降低其复杂度入手。
