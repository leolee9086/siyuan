# IP-DiskANN vs 我们的 Vamana 实现对比分析

## 背景

当前 Vamana Insert 728/s vs HNSW ~1566/s，gap 2.15x。
瓶颈分布：反向边维护 58%，自身 robustPrune 27%，greedySearch 15%。

本文档基于 IP-DiskANN `src/index.cpp` 与我们的 `kernel/vectordb/vamana/` 实现的逐函数对比。

---

## 1. 关键差异列表

### 1.1 候选池来源差异（greedySearch → robustPrune 的数据流）

**IP-DiskANN** (`iterate_to_fixed_point` L898-989 + `search_for_point_and_prune` L993-1068):
- `iterate_to_fixed_point` 在 `search_invocation=false`（构建模式）时，将每个从优先队列弹出的 `closest_unexpanded` 节点收集到 `expanded_nodes`（即 `scratch->pool()`）
- `search_for_point_and_prune` 将整个 `expanded_nodes` 作为候选池传给 `prune_neighbors`
- 候选池包含**所有被展开过的节点**，不仅仅是最终留在优先队列中的 top-L

**我们的实现** (`greedySearchForBuild` search.go L141-192 + `buildNodeWithScratch` build.go L149-172):
- `greedySearchForBuild` 返回 `scratch.Best.All()`，即优先队列的最终状态（最多 L 个）
- 被展开后又被更优候选挤出队列的节点**丢失了**，不会进入 robustPrune 的候选池

**影响评估**: 中等。在搜索过程中，部分早期展开的节点可能被后来发现的更近节点挤出 top-L 队列。这些节点虽然不是最近的，但可能提供方向多样性，对 robustPrune 选择高质量边有价值。实际丢失数量取决于图的结构和 L 的大小，典型场景下丢失比例约 10-30%。

### 1.2 距离计算批处理

**IP-DiskANN** (`iterate_to_fixed_point` L922-988):
```cpp
// 先收集所有未访问邻居 ID
id_scratch.clear();
for (auto id : _graph_store->get_neighbours(n)) {
    if (is_not_visited(id)) {
        id_scratch.push_back(id);
    }
}
// 批量计算距离
compute_dists(id_scratch, dist_scratch);
```
将邻居 ID 收集后一次性批量计算距离，`compute_dists` 内部可利用 SIMD 批量处理和更好的缓存局部性。

**我们的实现** (`greedySearchForBuild` search.go L173-187):
```go
for i, neighborID := range neighbors {
    if scratch.Visited.Insert(neighborID) {
        dist := idx.fastDistanceToQuery(neighborID, query, queryNormSq)
        scratch.Best.Insert(Neighbor{ID: neighborID, Distance: dist})
    }
}
```
逐个计算距离，每次调用 `fastDistanceToQuery`。

**影响评估**: 低。我们已有预取优化（`prefetchVector`），且 Go 的 SIMD 支持有限，批处理的收益主要在 C++ 的 SIMD intrinsics 场景。在纯 Go 实现中，逐个计算与批量计算的差异不大。

### 1.3 occlude_list 实现策略

**IP-DiskANN** (`occlude_list` L1072-1164):
- 对每个被选中的节点 `iter`，扫描**所有**后续候选 `iter2` 更新 `occlude_factor`
- 每轮 alpha 循环都从头扫描整个 pool
- 复杂度：O(|result| × |pool|) 距离计算

**我们的实现** (`robustPruneCore` build.go L437-527):
- 使用 `lastChecked[i]` 数组实现增量式距离计算
- 每个候选 `i` 只检查自上次检查以来新增的 result 条目
- 避免了 O(n²) 的重复距离计算

**影响评估**: 这是**我们的优势**。增量式计算减少了 robustPrune 中的距离计算次数，尤其在候选集较大时效果显著。

### 1.4 反向边维护中的去重

**IP-DiskANN** (`inter_insert` L1251-1268):
```cpp
tsl::robin_set<uint32_t> dummy_visited(0);
for (auto cur_nbr : copy_of_neighbors) {
    if (dummy_visited.find(cur_nbr) == dummy_visited.end() && cur_nbr != des) {
        float dist = _data_store->get_distance(des, cur_nbr);
        dummy_pool.emplace_back(Neighbor(cur_nbr, dist));
        dummy_visited.insert(cur_nbr);
    }
}
```
在构建 `dummy_pool` 时使用 `robin_set` 去重，确保不会有重复候选进入 `prune_neighbors`。

**我们的实现** (`addEdgeAndPruneLocked` build.go L260-269):
```go
for i, nid := range copyOfNeighbors {
    dist := idx.fastDistanceToQuery(nid, nodeVector, nodeNormSq)
    candidates = append(candidates, Neighbor{ID: nid, Distance: dist})
}
```
直接遍历 `copyOfNeighbors` 构建候选，无去重。由于 `copyOfNeighbors` 来自 `idx.neighbors[nodeID]`（已去重）加上一个新 ID，实际不会有重复。

**影响评估**: 无。我们的数据源本身已保证无重复，IP-DiskANN 的去重是防御性编程。

### 1.5 Insert 全局锁策略

**IP-DiskANN** (`insert_point` L2899-3049):
```cpp
std::shared_lock<std::shared_timed_mutex> shared_ul(_update_lock);  // 共享锁
auto location = reserve_location();  // 内部有自己的同步
// ... search + prune + inter_insert 全程持有共享锁
```
整个 insert 操作持有 `_update_lock` 的**共享锁**，允许多个 insert 并发执行。

**我们的实现** (`Insert` build.go L345-428):
```go
idx.mu.Lock()   // 排他锁 — 分配 ID、扩展 vectors/neighbors/nodeLocks
// ...
idx.mu.Unlock()
// greedySearchFast 内部再次 idx.mu.RLock()
```
分配阶段使用**排他锁**，序列化了所有 Insert 的分配操作。搜索阶段使用读锁。

**影响评估**: 低（当前场景）。我们的 Insert 是单线程调用，排他锁不造成竞争。但如果未来需要并发 Insert，这会成为瓶颈。IP-DiskANN 通过 `reserve_location()` 内部的原子操作或细粒度锁实现了并发分配。

### 1.6 MaxBackedges 限制

**IP-DiskANN** (`inter_insert` L1219-1277):
- 遍历 `pruned_list` 中的**所有**邻居添加反向边，无数量限制

**我们的实现** (`buildNodeWithScratch` build.go L165-171):
```go
maxBackedges := len(neighbors)
if maxBackedges > idx.config.MaxBackedges {
    maxBackedges = idx.config.MaxBackedges
}
```
限制为 `MaxBackedges`（默认 R/2=16），跳过部分反向边。

**影响评估**: 这是我们的**吞吐量优化**。减少反向边数量直接减少了 58% 瓶颈（反向边维护）的工作量。代价是图质量略有下降，但参数扫描实验表明 recall 持平。

### 1.7 GraphSlackFactor 差异

| 参数 | IP-DiskANN | 我们 |
|------|-----------|------|
| GRAPH_SLACK_FACTOR | 1.3 | 1.5 |

**影响评估**: 我们的值更高，意味着更少的剪枝触发次数，这是正确的吞吐量优化方向。

---

## 2. 我们已有的优势（相对于 IP-DiskANN）

| 优化 | 说明 |
|------|------|
| 增量式 occlude 计算 | `lastChecked` 数组避免 O(n²) 重复距离计算 |
| 预计算范数 | `fastDistance` 使用 `normSquares[]` 避免重复计算 ||v||² |
| Lock-free 读取 | `atomic.Pointer` 无锁读取邻居快照，优于 IP-DiskANN 的 per-node mutex |
| 候选集截断 | `2×R` 截断在 robustPruneCore 中，减少内循环工作量 |
| MaxBackedges 限制 | 减少反向边维护开销 |
| 更高的 GraphSlackFactor | 1.5 vs 1.3，更少的剪枝触发 |
| 软件预取 | `prefetchVector` 在距离计算前预热缓存 |

---

## 3. 推荐优化方案（按预期收益排序）

### 方案 A: 保留展开节点作为候选池（预期收益: 5-15%）

**问题**: 当前 `greedySearchForBuild` 只返回优先队列最终的 top-L，丢失了被挤出的展开节点。

**方案**: 在 `SearchScratch` 中增加 `ExpandedNodes []Neighbor` 字段，`greedySearchForBuild` 在弹出 `closest_unexpanded` 时同时记录到 `ExpandedNodes`。`robustPruneWithScratch` 使用 `ExpandedNodes` 而非 `Best.All()` 作为候选池。

**机制**: 更丰富的候选池 → robustPrune 选出更高质量的边 → 图导航效率提升 → greedySearch 需要更少的 hops 和距离计算 → 整体构建加速。

**风险**: 候选池变大会增加 robustPrune 的工作量，但已有 `MaxOcclusionSize=750` 和 `2×R` 截断作为上限保护。

**实现复杂度**: 低。仅需修改 `SearchScratch` 结构体和 `greedySearchForBuild` 函数。

### 方案 B: Insert 分配阶段无锁化（预期收益: 2-5%，并发场景更高）

**问题**: `Insert` 的分配阶段使用排他锁，`greedySearchFast` 又需要读锁，存在锁切换开销。

**方案**: 将 `vectors`、`neighbors`、`nodeLocks` 等的扩容改为预分配 + 原子计数器模式。使用 `atomic.AddUint32` 分配 ID，避免排他锁。

**风险**: 需要仔细处理扩容边界条件。

**实现复杂度**: 中。需要重构 Insert 的内存管理。

### 方案 C: greedySearch 中的距离计算批处理（预期收益: 1-3%）

**问题**: 逐个计算距离，缓存利用不如批量计算。

**方案**: 收集未访问邻居 ID 后批量计算距离。在 Go 中主要收益来自减少函数调用开销和改善缓存局部性。

**风险**: Go 缺乏 SIMD intrinsics，收益有限。

**实现复杂度**: 低。

---

## 4. 不推荐的方向

| 方向 | 原因 |
|------|------|
| 移除 MaxBackedges 限制 | 反向边维护占 58%，移除限制会大幅降低吞吐量 |
| 降低 GraphSlackFactor | 会增加剪枝频率，与优化方向相反 |
| PQ 近似距离用于构建 | 实现复杂度极高，且我们的 fastDistance 已经很快 |
| 并发 Insert | 当前是单线程调用场景，优化收益为零 |

---

## 5. 结论

IP-DiskANN 与我们的实现在核心算法上高度一致，我们已经采纳了其大部分优化策略（progressive alpha、GraphSlackFactor、lock-copy-unlock-prune 模式）。

唯一有实质性能差异的是**候选池来源**（方案 A）：IP-DiskANN 保留所有展开节点，我们只保留 top-L。这个差异影响的是图质量而非直接的计算开销，通过提升边质量间接减少后续搜索的距离计算次数。

其余差异要么是我们已有优势（增量 occlude、预计算范数、lock-free 读取），要么影响极小（批量距离计算、去重）。
