# DiskVamana 应用层热节点缓存实现计划

## 目标

为 DiskVamanaIndex 添加固定容量的应用层节点缓存，缓存搜索热路径中的向量和邻居表，消除 mmap 间接寻址开销，将查询延迟从 ~8ms 降至 ~2-3ms。

## 参考

- IP-DiskANN: `_nhood_cache` + `_coord_cache`，BFS 构建，10% 节点上限
- Rust DiskANN: `CachedDiskVertexProvider` + `Cache<Data>`，BFS 构建，可配置容量

## 一、新增数据结构

**`NodeCache`** (`vamana/node_cache.go`)— 固定容量，BFS 预加载：

```go
type NodeCache struct {
    vectors   [][]float32
    neighbors [][]uint32
    nodeID    []uint64
    index     map[uint64]int
    capacity  int
    size      int
    mu        sync.RWMutex
}
```

**集成到 `DiskVamanaIndex`** — 新增:
- `nodeCache *NodeCache`
- `CacheSizeMB int` 配置

内存: 768 维 + R=64, 每节点 ~3.3 KB。200 MB ≈ 60K 节点, 50万总数 12%。

## 二、缓存预热: BFS + 批量加载

```
WarmupCache(numNodes int):
  1. queue = [medoid], visited = {medoid}
  2. while queue not empty && cache not full:
     a. batch = take min(len(queue), 1024)
     b. readBatchNodes(batch)  // 一次系统调用
     c. for node in batch:
          cache.insert(node, vector, neighbors)
          for nbr in neighbors:
              if nbr not in visited: visited.add(nbr); queue.push(nbr)
```

## 三、搜索热路径改造

只改 `getNeighbors` 和 `getVector`，加缓存查看看:

```
getNeighbors(nodeID):
  1. modifiedNeighbors
  2. appendNeighbors
  3. nodeCache.neighbors[nodeID]  ← 新增
  4. reader.ReadNeighbors(nodeID)

getVector(nodeID):
  1. appendVectors
  2. nodeCache.vectors[nodeID]   ← 新增
  3. reader.ReadVectorRef(nodeID)
```

## 四、批量扇区读

`readBatchNodes` 替代逐节点 mmap:

```
readBatchNodes(nodeIDs):
  1. 计算每个节点的扇区偏移
  2. 按扇区排序
  3. 批量读取所有扇区
  4. 解析返回
```

## 五、测试计划

| 测试 | 目标 | 断言 |
|------|------|------|
| TestNodeCacheCorrectness | 缓存数据 vs mmap 一致 | 完全一致 |
| TestNodeCacheHitRate | 不同缓存容量的命中率 | 5K→>60%, 10K→>80% |
| TestNodeCachePerformance | 有无缓存延迟对比 | 有缓存 < 无缓存 × 0.5 |
| TestNodeCacheScale | 不同规模的加速比 | 加速比不随规模下降 |
| TestNodeCacheColdVsWarm | 冷热收敛曲线 | 10次后稳定 |
| TestNodeCacheConcurrent | 并发安全 | -race 零告警 |
| TestNodeCacheMemoryBudget | 内存精度 | ±10% |
| Regression | 全部现有测试 | 全部通过 |
