# Vamana 反向边距离缓存变更范围分析

> Phase 17-0 调查产出。基于代码阅读的变更范围分析。

## 1. 当前邻居存储结构

### 1.1 VamanaIndex（内存索引）

定义位置：[`index.go:47`](kernel/vectordb/vamana/index.go:47)

```go
neighbors    [][]uint32                 // neighbors[nodeID] = []neighborIDs
neighborPtrs []atomic.Pointer[[]uint32] // 构建专用：无锁原子邻居指针
```

只存储节点 ID，不缓存距离。

### 1.2 DiskVamanaIndex（磁盘索引）

磁盘格式中邻居同样只存 `[]uint32`（通过 `ReadNeighbors` 返回 `[]uint32`）。增量操作中的邻居存储：

- `appendNeighbors [][]uint32` — 追加缓冲区
- `modifiedNeighbors sync.Map` — 值类型为 `[]uint32`

### 1.3 diskBuilder（磁盘构建器）

定义位置：[`disk_build.go:192`](kernel/vectordb/vamana/disk_build.go:192)

```go
neighbors   [][]uint32
```

通过 `idx.GetNeighbors()` 从内存索引拷贝，同样只有 ID。

## 2. addEdgeAndPrune 中的距离重算分析

### 2.1 触发条件

[`build.go:224-280`](kernel/vectordb/vamana/build.go:224)（`addEdgeAndPruneLocked`）和 [`build.go:286-342`](kernel/vectordb/vamana/build.go:286)（`addEdgeAndPrune`）逻辑一致：

1. Phase 1（持锁）：检查是否已存在 + 松弛判断。若 `len(currentNeighbors) < GraphSlackFactor * R`（即 < 1.5×32 = 48），直接 append，**零距离计算**。
2. Phase 2（无锁）：**仅当超过松弛阈值时触发**。此时必须：
   - 对 `copyOfNeighbors`（~49 个 ID）中每个邻居重新计算到 `nodeID` 的距离 → **~49 次 `fastDistanceToQuery`**
   - 然后调用 `robustPrune`，内部 `robustPruneCore` 再计算候选间距离

### 2.2 具体可避免的距离计算

Phase 2 中的距离重算循环（[`build.go:261-269`](kernel/vectordb/vamana/build.go:261)）：

```go
for i, nid := range copyOfNeighbors {
    dist := idx.fastDistanceToQuery(nid, nodeVector, nodeNormSq)
    candidates = append(candidates, Neighbor{ID: nid, Distance: dist})
}
```

这里 `copyOfNeighbors` 中除了新加入的 `newNeighborID` 外，其余都是 `nodeID` 的**已有邻居**。如果邻居存储中缓存了距离，这些已有邻居的距离可以直接读取，只需计算 1 次新邻居的距离。

**可节省**：每次剪枝触发时 ~48 次距离计算 → 1 次。

### 2.3 robustPruneCore 中的距离计算

[`build.go:437-536`](kernel/vectordb/vamana/build.go:437) 中 `fastDistance(cand.ID, selectedID)` 计算的是**候选间**距离，这些距离无法通过邻居缓存避免（缓存的是节点到其邻居的距离，不是邻居之间的距离）。

**结论**：距离缓存只能消除 Phase 2 的邻居→节点距离重算，不能消除 robustPruneCore 内部的候选间距离计算。

## 3. HNSW 的 NeighborRecord 参考

### 3.1 结构定义

[`hnsw/types.go:58-61`](kernel/vectordb/hnsw/types.go:58)：

```go
type NeighborRecord struct {
    ID       DocID   `msgpack:"id"`
    Distance float32 `msgpack:"distance"`
}
```

### 3.2 HNSW 反向边维护中的利用方式

[`hnsw/build.go:88-121`](kernel/vectordb/hnsw/build.go:88)：

```go
cachedRecords := idx.GetLevelNeighborRecords(neighbor.ID, level)

// 松弛判断：直接 append，零距离计算
if len(cachedRecords)+1 <= slackM {
    idx.SetLevelNeighbors(neighbor.ID, level, append(cachedRecords, NeighborRecord{
        ID:       itemDocID,
        Distance: neighbor.Distance, // 直接使用搜索阶段已计算的距离
    }))
    continue
}

// 超过松弛阈值：candidateBuf 中所有距离已缓存
candidateBuf = append(candidateBuf, cachedRecords...)  // 已有邻居距离已缓存
candidateBuf = append(candidateBuf, NeighborRecord{
    ID:       itemDocID,
    Distance: neighbor.Distance,  // 新节点距离也已知
})
// selectNeighborsHeuristic 输入的候选到 query 的距离全部已知
// 只有候选间的两两比较需要实时计算
```

**关键差异**：HNSW 在触发 heuristic 剪枝时，输入候选的"到节点的距离"全部已缓存，无需重算。Vamana 的 addEdgeAndPrune 必须重算全部邻居距离。

## 4. 需要修改的文件和函数

### 4.1 方案 A：全局结构变更（将 `[][]uint32` 改为 `[][]NeighborEdge`）

需要修改的文件：

| 文件 | 函数/位置 | 变更类型 |
|------|-----------|----------|
| `index.go` | `neighbors` 字段定义 (L47) | 类型变更 |
| `index.go` | `neighborPtrs` 字段定义 (L48) | 类型变更 |
| `index.go` | `GetNeighbors` (L249-257) | 返回类型变更 |
| `build.go` | `initializeForBuild` (L75-107) | 初始化变更 |
| `build.go` | `buildNodeWithScratch` (L148-172) | 设置邻居时附带距离 |
| `build.go` | `setNeighborsLocked` (L206-213) | 参数类型变更 |
| `build.go` | `addEdgeAndPruneLocked` (L224-280) | 利用缓存距离 |
| `build.go` | `addEdgeAndPrune` (L286-342) | 利用缓存距离 |
| `build.go` | `Insert` (L344-428) | 设置邻居时附带距离 |
| `build.go` | `robustPrune` / `robustPruneWithScratch` | 返回类型变更 |
| `build.go` | `robustPruneCore` (L437-536) | 返回类型变更 |
| `search.go` | `greedySearch` / `greedySearchFast` (L65-129) | 读取邻居时提取 ID |
| `search.go` | `greedySearchForBuild` (L141-192) | 读取邻居时提取 ID |
| `delete.go` | 全部函数 | 读写邻居类型变更 |
| `save.go` | `saveIndexFile` (L73+) | 序列化时只写 ID |
| `bbq.go` | BBQ 搜索中读取邻居 (L329, L383) | 读取邻居时提取 ID |
| `disk_build.go` | `diskBuilder.neighbors` (L192) | 类型变更或转换 |
| `disk_incremental.go` | `getNeighbors` / `storeNeighbors` | 类型变更 |
| `disk_incremental.go` | `addBackEdgeForNode` (L487-562) | 利用缓存距离 |
| `disk_incremental.go` | `Compact` 相关 | 序列化变更 |

**影响范围**：~15 个文件中的 ~30+ 个函数。

### 4.2 方案 B：仅在 addEdgeAndPrune 路径中局部缓存

不改变全局 `neighbors [][]uint32` 结构，仅在 addEdgeAndPrune 的 Phase 2 中，利用已有邻居的距离信息。

**实现方式**：在 `addEdgeAndPruneLocked` / `addEdgeAndPrune` 的 Phase 1 中，拷贝邻居列表时同时计算并缓存距离（或在 Phase 2 中跳过已有邻居的距离重算）。

**问题**：Phase 1 中只拷贝了 `[]uint32`，没有距离信息。要避免重算，必须在某处存储距离。如果不改全局结构，就需要在 Phase 1 持锁期间计算距离（增加锁持有时间），或者接受 Phase 2 的重算。

**结论**：局部缓存方案无法在不改变全局结构的前提下有效工作，因为距离信息必须在某处持久化才能跨操作复用。

## 5. 推荐方案

### 5.1 推荐：全局结构变更（方案 A）

引入新类型：

```go
type NeighborEdge struct {
    ID       uint32
    Distance float32
}
```

将 `neighbors [][]uint32` 改为 `neighbors [][]NeighborEdge`。

**理由**：
1. 这是 HNSW 已验证的成熟模式
2. 一次性变更，所有路径（Build、Insert、Delete）都受益
3. 距离缓存在 addEdgeAndPrune 和 delete.pruneAffectedVertices 中都能消除重算
4. 磁盘格式不需要变更（序列化时仍只写 ID，距离是运行时缓存）

### 5.2 不推荐：局部缓存（方案 B）

**理由**：
1. 无法在不增加锁持有时间的前提下避免距离重算
2. 只能优化 addEdgeAndPrune 一个路径，delete.pruneAffectedVertices 无法受益
3. 实现复杂度与方案 A 相当，但收益更小

## 6. 内存开销估算

### 6.1 每条边的额外开销

- 当前：每条边 4 bytes（`uint32`）
- 变更后：每条边 8 bytes（`uint32` + `float32`）
- 增量：每条边 +4 bytes

### 6.2 总内存增量

以 50K 节点、平均度数 ~40（GSF=1.5 下的典型值）为例：

- 总边数：50,000 × 40 = 2,000,000 条
- 额外内存：2,000,000 × 4 bytes = **8 MB**

以 1M 节点为例：

- 总边数：1,000,000 × 40 = 40,000,000 条
- 额外内存：40,000,000 × 4 bytes = **160 MB**

### 6.3 评估

对于 50K 规模（当前主要使用场景），8 MB 额外内存完全可接受。对于 1M 规模，160 MB 需要权衡，但考虑到向量数据本身（1M × 128dim × 4bytes = 512 MB）已占大头，额外 160 MB（~31% 增量）在可接受范围内。

## 7. 序列化/持久化影响

### 7.1 磁盘格式

[`save.go`](kernel/vectordb/vamana/save.go) 中 `saveIndexFile` 序列化节点时只写入邻居 ID（`uint32`），不写距离。磁盘格式定义在 [`storage/`](kernel/vectordb/storage/) 中，`ReadNeighbors` 返回 `[]uint32`。

**结论**：磁盘格式无需变更。距离是运行时缓存，加载时需要重新计算。加载后首次使用时可以懒计算距离，或在加载阶段批量预计算。

### 7.2 DiskVamanaIndex 影响

[`disk_incremental.go`](kernel/vectordb/vamana/disk_incremental.go) 中 `getNeighbors` 返回 `[]uint32`，`storeNeighbors` 接受 `[]uint32`。

DiskVamanaIndex 的邻居存储在磁盘上（通过 mmap 读取），运行时修改存储在 `modifiedNeighbors sync.Map`（值类型 `[]uint32`）和 `appendNeighbors [][]uint32`。

**变更选项**：
- 选项 1：DiskVamanaIndex 保持 `[]uint32`，不引入距离缓存。DiskVamana 的 `addBackEdgeForNode` 已经在 Phase 2 中重算距离，与当前行为一致。
- 选项 2：DiskVamanaIndex 的 `modifiedNeighbors` 和 `appendNeighbors` 也改为 `[]NeighborEdge`。需要在 `getNeighbors` 从磁盘读取时补充距离（懒计算）。

**推荐**：先只改 VamanaIndex（内存索引），DiskVamanaIndex 作为后续独立任务。两者代码路径独立，不存在耦合。

## 8. 风险评估

| 风险 | 等级 | 说明 |
|------|------|------|
| 回归风险 | 中 | 涉及 ~30 个函数的类型变更，需要全面测试 |
| 内存增长 | 低 | 50K 规模仅增加 ~8 MB |
| 性能回归 | 低 | `NeighborEdge` 比 `uint32` 大一倍，可能影响缓存行利用率，但距离计算节省远大于此 |
| 并发安全 | 低 | `neighborPtrs` 的 atomic 操作只需改泛型参数，语义不变 |
| 磁盘兼容性 | 无 | 磁盘格式不变 |
| DiskVamana 耦合 | 无 | DiskVamanaIndex 使用独立的邻居存储路径，不受影响 |

## 9. 预期收益

根据 [`vamana-dist-count-analysis.md`](docs/ttt/vectordb/vamana-dist-count-analysis.md) 的分析：

- addEdgeAndPrune 反向边维护：~2,500 次距离计算/Insert
- 其中 Phase 2 邻居→节点距离重算：~49 次/次剪枝 × ~4.8 次剪枝 ≈ ~235 次
- robustPruneCore 内部候选间距离：~470 次/次剪枝 × ~4.8 次 ≈ ~2,256 次（**无法通过缓存消除**）

**可消除的距离计算**：~235 次/Insert（占反向边维护的 ~9.4%，占总计的 ~4.3%）

**注意**：这个收益看起来不大，但实际场景中：
1. 构建后期节点度数更高，剪枝更频繁，每次剪枝重算的邻居更多
2. Delete 操作的 `pruneAffectedVertices` 也有类似的距离重算（[`delete.go:279-297`](kernel/vectordb/vamana/delete.go:279)），缓存同样可以消除
3. 距离缓存的真正价值在于为后续优化（如更激进的松弛策略）提供基础设施
