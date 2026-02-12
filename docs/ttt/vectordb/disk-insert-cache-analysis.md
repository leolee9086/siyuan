# DiskVamanaIndex Insert 热路径 — 缓存友好性与预取优化分析

## 背景

DiskVamanaIndex Insert 当前吞吐量 425 items/s（50K 规模，dim=128）。本文档分析 Insert 热路径中的缓存访问模式，识别缓存友好性和预取优化机会。

CPU profile 热点分布：
- `findNeighborsForInsert`: 64.71% cum
- `dotProduct`: 42.25% flat
- `getCachedNormSq`: 34.22% cum
- `computeNormSquare`: 24.06%
- GC 相关: ~15%（`mapassign_fast64` 12.83%）
- `robustPruneSimpleWithNorm`: 9.63% cum
- `addBackEdgeForNode`: 3.21% cum

---

## 1. GC 压力：map 缓存导致 ~15% GC 开销

### 现状

`vectorCache`（`map[uint64][]float32`）和 `normSqCache`（`map[uint64]float32`）在每次 Insert 操作中创建：

```go
// disk_incremental.go:242-243
cache := make(vectorCache, DefaultInsertSearchL*3)   // map[uint64][]float32
nsCache := make(normSqCache, DefaultInsertSearchL*3) // map[uint64]float32
```

CPU profile 中 `mapassign_fast64` 占 12.83%，这是 Go runtime 的 map 写入函数。每次 map 写入都可能触发 bucket 扩容和 GC write barrier。

### 问题分析

1. **map 的 GC 扫描开销**：`map[uint64][]float32` 中的 value 是 slice header（包含指针），GC 必须扫描每个 entry 的 value 以追踪指针。50K 规模下，每次 Insert 的 greedy search 约访问 100-200 个节点，每个节点产生 1 次 vectorCache 写入 + 1 次 normSqCache 写入。
2. **map bucket 分配**：Go map 在 load factor 超过 6.5 时触发 rehash，产生新的 bucket 分配。初始容量 `DefaultInsertSearchL*3 = 300`，但实际访问节点数可能超过此值。
3. **每次 Insert 创建新 map**：map 对象本身在堆上分配，Insert 完成后成为垃圾。

### 优化建议

**C-1: 用 slice-based 结构替代 map 缓存**

由于 nodeID 空间是连续的 `[0, totalPoints)`，可以用 `[][]float32` 和 `[]float32` slice 替代 map：

```go
type sliceVectorCache struct {
    vecs    [][]float32  // 索引即 nodeID
    normSq  []float32    // 索引即 nodeID
    valid   []bool       // 标记是否已缓存（或用 NaN 哨兵）
}
```

- 预期收益：消除 `mapassign_fast64` 的 12.83% 开销中的大部分，减少 GC 扫描压力
- 实现复杂度：中等。需要在 Insert 开始时分配 `totalPoints` 大小的 slice，50K 规模下约 50K * 8 bytes（normSq）+ 50K * 24 bytes（slice header）≈ 1.5MB，可接受
- 注意：`[][]float32` 仍含指针，GC 仍需扫描。进一步优化可用 epoch 标记替代 valid 数组

**C-1b: 使用 sync.Pool 复用 slice 缓存**

将 slice 缓存放入 sync.Pool，避免每次 Insert 重新分配：

```go
var insertCachePool = sync.Pool{
    New: func() interface{} {
        return &sliceVectorCache{...}
    },
}
```

- 预期收益：消除每次 Insert 的缓存分配开销
- 实现复杂度：低

---

## 2. mmap 访问模式：随机访问导致 page fault

### 现状

mmap 文件的节点布局（`io_mmap_windows.go:193-204`）：

```
Block #0: header (4096 bytes)
Block #1..N: data blocks, each = NodesPerBlock * NodeLen
```

节点偏移计算：
```go
blockNum := nodeID / r.meta.NodesPerBlock
indexInBlock := nodeID % r.meta.NodesPerBlock
offset := blockSize + blockNum * (NodesPerBlock * NodeLen) + indexInBlock * NodeLen
```

每个节点的数据布局：`[Vector (dims*4)] [NeighborCount (4)] [NeighborIDs (maxDegree*4)]`

dim=128 时，NodeLen = 128*4 + 4 + 64*4 = 772 bytes。

### 问题分析

1. **向量和邻居列表交织存储**：每个节点的向量数据和邻居列表紧邻存储。greedy search 中，访问一个节点需要：
   - 先读邻居列表（`getNeighbors` → `ReadNeighbors`）获取下一跳
   - 再读每个邻居的向量（`getVector` → `ReadVectorRef`）计算距离
   
   这意味着访问模式是：读 node A 的邻居 → 跳到 node B 读向量 → 跳到 node C 读向量 → ...

2. **随机跳跃访问**：greedy search 的邻居 ID 在整个 ID 空间中分布，导致 mmap 访问在文件中随机跳跃。dim=128, NodeLen=772 bytes 时，一个 4KB page 仅容纳 ~5 个节点。50K 节点的索引文件约 38MB，远超 L2 cache（通常 6-12MB）。

3. **向量数据占节点的 66%**：128*4=512 bytes 向量 vs 772 bytes 总节点长度。读邻居列表时，CPU 会将整个 cache line（64 bytes）加载，但邻居列表偏移在 512 bytes 处，与向量数据不在同一 cache line。

### 优化建议

**C-2: 邻居列表预取（Software Prefetch）**

在 greedy search 的邻居遍历循环中，当计算当前邻居距离时，预取下一个邻居的向量数据：

```go
// findNeighborsForInsert 中的邻居遍历循环
for i, neighborID := range neighbors {
    // 预取下一个邻居的向量数据
    if i+1 < len(neighbors) {
        nextVec := idx.getVector(uint64(neighbors[i+1]))
        if nextVec != nil {
            _ = nextVec[0] // 触发 page fault / cache line load
        }
    }
    // 计算当前邻居距离（此时下一个邻居的数据可能已在 cache 中）
    nVec := idx.getCachedVector(uint64(neighborID), cache)
    ...
}
```

内存版 `build.go` 已有此模式（`addEdgeAndPruneLocked` 第 263-265 行）：
```go
if i+1 < len(copyOfNeighbors) {
    idx.prefetchVector(copyOfNeighbors[i+1])
}
```

但磁盘版的 `findNeighborsForInsert` 和 `addBackEdgeForNode` 中完全没有预取。

- 预期收益：减少 mmap page fault 等待时间。对于 dim=128（512 bytes 向量），一次预取可覆盖 8 个 cache line，与距离计算（~100ns for dim=128）重叠
- 实现复杂度：低。仅需在循环中添加预取调用
- 风险：Go 没有原生 prefetch 指令，只能通过访问首元素触发硬件预取器。效果取决于 OS 的 mmap page fault 处理延迟

**C-2b: 分离向量存储和邻居列表存储**

将向量数据和邻居列表分开存储在不同的 mmap 区域，使邻居列表遍历时的内存访问更紧凑：

- 邻居列表文件：每个节点仅存 `[NeighborCount (4)] [NeighborIDs (maxDegree*4)]` = 260 bytes
- 向量文件：每个节点仅存 `[Vector (dims*4)]` = 512 bytes

这样遍历邻居列表时，一个 4KB page 可容纳 ~15 个节点的邻居数据（vs 当前 ~5 个），减少 page fault 次数。

- 预期收益：邻居列表遍历的 cache 命中率提升 ~3x
- 实现复杂度：高。需要修改存储格式、reader 接口、compact 逻辑
- 注意：这是 DiskANN 论文中推荐的布局方式，但当前实现采用了交织布局

---

## 3. 结构体内存布局

### 现状

**Neighbor 结构体**（`types.go:82-85`）：
```go
type Neighbor struct {
    ID       uint32   // 4 bytes
    Distance float32  // 4 bytes
}
```
总计 8 bytes，恰好对齐。两个 Neighbor 占 16 bytes，一个 cache line（64 bytes）可容纳 8 个 Neighbor。

**NeighborPriorityQueue**（`types.go:233-239`）：
```go
type NeighborPriorityQueue struct {
    data         []Neighbor  // 24 bytes (slice header)
    flags        []bool      // 24 bytes
    capacity     int         // 8 bytes
    currentIndex int         // 8 bytes
    count        int         // 8 bytes
}
```

### 问题分析

1. **Neighbor 结构体**：8 bytes 对齐良好，无 padding 浪费。cache line 利用率 100%。无问题。

2. **NeighborPriorityQueue 的 data/flags 分离**：`PopClosestUnvisited` 需要同时访问 `data[i]` 和 `flags[i]`，但它们在不同的内存区域。对于 L=100 的队列，data 占 800 bytes（~13 cache lines），flags 占 100 bytes（~2 cache lines）。由于 flags 很小，通常能完全驻留在 L1 cache 中，影响不大。

3. **无 false sharing 问题**：`nodeLocks []sync.RWMutex` 每个 RWMutex 约 24 bytes，3 个 RWMutex 共享一个 cache line。但 Insert 路径中 nodeLocks 的竞争发生在不同节点上，且 addBackEdgeForNode 是顺序处理每个邻居，不存在并发写同一 cache line 的情况。

### 优化建议

**C-3: 将 NeighborPriorityQueue 的 data 和 flags 合并为 SoA → AoS**

将 `data` 和 `flags` 合并为单一结构体数组：

```go
type FlaggedNeighbor struct {
    Neighbor          // 8 bytes
    Flag     bool     // 1 byte + 7 bytes padding = 16 bytes total
}
```

但这会将每个元素从 8+1=9 bytes 膨胀到 16 bytes（padding），cache line 利用率从 ~100% 降到 50%。**不建议此优化**。

当前分离布局实际上是更优的 SoA（Structure of Arrays）模式，对于顺序扫描更友好。

- 预期收益：无显著收益，可能反而降低性能
- 实现复杂度：低
- 结论：**不推荐**

---

## 4. 预取机会

### 现状

内存版 `build.go` 中已有预取模式：

```go
// build.go:263-265 (addEdgeAndPruneLocked)
if i+1 < len(copyOfNeighbors) {
    idx.prefetchVector(copyOfNeighbors[i+1])
}
```

```go
// distance.go:29-31
func (idx *VamanaIndex) prefetchVector(id uint32) {
    _ = idx.vectorData[int(id)*idx.dimension]
}
```

磁盘版完全没有预取。

### 预取机会识别

**P-1: findNeighborsForInsert 邻居遍历预取**

`findNeighborsForInsert`（`disk_incremental.go:314-336`）是最大热点（64.71% cum）。内循环：

```go
for _, neighborID := range neighbors {
    // ... deleted check, visited check ...
    nVec := idx.getCachedVector(uint64(neighborID), cache)  // mmap read
    nNormSq := getCachedNormSq(uint64(neighborID), nVec, nsCache)  // dotProduct
    dist := euclideanDistanceWithNorms(nVec, vector, nNormSq, queryNormSq)  // dotProduct
    scratch.Best.Insert(Neighbor{ID: neighborID, Distance: dist})
}
```

每个邻居需要：
1. `getCachedVector` → cache miss 时触发 `getVector` → `ReadVectorRef`（mmap 随机访问）
2. `getCachedNormSq` → cache miss 时触发 `computeNormSquare`（dotProduct）
3. `euclideanDistanceWithNorms`（dotProduct）

步骤 1 的 mmap 访问延迟（~1-10μs for page fault, ~100ns for TLB miss）可以与前一个邻居的步骤 2-3 重叠。

优化方案：在处理 `neighbors[i]` 时，预取 `neighbors[i+1]` 的向量数据：

```go
for i, neighborID := range neighbors {
    // 预取下一个邻居
    if i+1 < len(neighbors) {
        nextID := uint64(neighbors[i+1])
        if _, ok := cache[nextID]; !ok {
            // 仅在 cache miss 时预取
            if vec := idx.getVector(nextID); vec != nil {
                cache[nextID] = vec
                _ = vec[0] // 触发 cache line load
            }
        }
    }
    // 处理当前邻居
    ...
}
```

- 预期收益：减少 mmap 访问延迟的串行等待。dim=128 时 dotProduct 约 50-100ns，mmap TLB miss 约 100-500ns，预取可隐藏部分延迟
- 实现复杂度：低
- 注意：预取过于激进可能导致 cache 污染。建议仅预取 1-2 步

**P-2: robustPruneSimpleWithNorm 内循环预取**

`robustPruneSimpleWithNorm`（`disk_incremental.go:469-572`）已经在循环前批量预取了所有向量和 normSq：

```go
// disk_incremental.go:493-501
vecs := make([][]float32, n)
norms := make([]float32, n)
for i := 0; i < n; i++ {
    v := getVec(uint64(candidates[i].ID))
    vecs[i] = v
    if v != nil {
        norms[i] = getNormSq(uint64(candidates[i].ID), v)
    }
}
```

这已经是良好的预取模式。内循环中 `euclideanDistanceWithNorms(candVec, selectedVec, ...)` 访问的 `vecs[resultIdx]` 是已缓存的本地数组，cache 友好。

- 结论：robustPrune 的预取已经做得较好，无需额外优化

**P-3: addBackEdgeForNode 距离计算预取**

`addBackEdgeForNode` Phase 2（`disk_incremental.go:658-687`）中的距离计算循环：

```go
for i, nid := range copyOfNeighbors {
    nVec := idx.getCachedVector(uint64(nid), cache)
    ...
}
```

可以添加与 `build.go:263-265` 相同的预取模式。

- 预期收益：addBackEdgeForNode 仅占 3.21% cum，收益有限
- 实现复杂度：低

---

## 5. 对象分配：热路径中的堆分配

### 现状

**5a. vectorCache/normSqCache map 分配**（已在第 1 节分析）

**5b. robustPruneSimpleWithNorm 中的临时数组**

```go
// disk_incremental.go:493-505
vecs := make([][]float32, n)     // 堆分配
norms := make([]float32, n)      // 堆分配
occludeFactor := make([]float32, n)  // 堆分配
lastChecked := make([]int, n)    // 堆分配
resultPos := make([]int, 0, R)   // 堆分配
```

每次 robustPrune 调用分配 5 个 slice。n 通常为 min(candidates, 2*R) = min(~100, 128) ≈ 100-128。

内存版 `robustPruneWithScratch` 通过 `SearchScratch` 复用了 `occludeFactor`、`lastChecked`、`resultPos`，但磁盘版的 `robustPruneSimpleWithNorm` 是包级函数，没有 scratch 参数。

**5c. findNeighborsForInsert 中 scratch.Best.All() 的分配**

```go
// types.go:373-377
func (pq *NeighborPriorityQueue) All() []Neighbor {
    result := make([]Neighbor, pq.count)
    copy(result, pq.data[:pq.count])
    return result
}
```

每次 greedy search 结束时分配一个新 slice。

**5d. addBackEdgeForNode 中的 candidateNeighbors 分配**

```go
// disk_incremental.go:663
candidateNeighbors := make([]Neighbor, len(copyOfNeighbors))
```

每个反向边添加（需要剪枝时）分配一个 Neighbor slice。

### 优化建议

**C-5a: 为 robustPruneSimpleWithNorm 添加 scratch 复用**

参照内存版 `robustPruneWithScratch`，将 `vecs`、`norms`、`occludeFactor`、`lastChecked`、`resultPos` 放入 `SearchScratch` 或专用的 `PruneScratch` 中：

```go
type PruneScratch struct {
    Vecs          [][]float32
    Norms         []float32
    OccludeFactor []float32
    LastChecked   []int
    ResultPos     []int
}
```

- 预期收益：消除每次 robustPrune 的 5 次堆分配。Insert 路径中 robustPrune 被调用 1 + len(prunedNeighbors) 次（Phase 2 一次 + Phase 4 每个需要剪枝的反向边一次）
- 实现复杂度：中等

**C-5b: 减少 addBackEdgeForNode 中的分配**

`copyOfNeighbors`（`disk_incremental.go:649-651`）和 `candidateNeighbors`（`disk_incremental.go:663`）可以从 pool 中获取预分配的 buffer。

- 预期收益：addBackEdgeForNode 仅占 3.21%，收益有限
- 实现复杂度：低

---

## 6. 数据局部性：mmap 文件布局

### 现状

节点在 mmap 文件中按 nodeID 顺序排列，每个节点包含：
```
[Vector (512 bytes)] [NeighborCount (4 bytes)] [NeighborIDs (256 bytes)]
```

总计 772 bytes/node（dim=128, maxDegree=64）。

### 问题分析

1. **greedy search 的访问模式**：从 medoid 开始，每一跳访问当前节点的邻居列表，然后访问每个邻居的向量。邻居 ID 在整个 ID 空间中分布，导致随机访问。

2. **向量和邻居交织**：读取 node A 的邻居列表时，CPU 加载的 cache line 包含 node A 的向量尾部和邻居数据。但下一步需要读取 node B 的向量（在文件中完全不同的位置），node A 的向量数据白白占用了 cache。

3. **append buffer 的局部性**：append 节点的向量存储在 `appendVectors [][]float32` 中，每个向量是独立的 heap 分配（`disk_incremental.go:225`）：
   ```go
   vectorCopy := make([]float32, len(vector))
   ```
   这些向量在堆上不连续，cache 局部性差。

### 优化建议

**C-6a: append buffer 使用连续内存布局**

参照内存版 `VamanaIndex.initializeForBuild`（`build.go:82-89`）的连续内存布局：

```go
// 内存版使用连续 vectorData
idx.vectorData = make([]float32, n*dim)
idx.vectors[i] = idx.vectorData[offset : offset+dim : offset+dim]
```

磁盘版的 append buffer 可以采用相同策略：

```go
type appendBuffer struct {
    vectorData []float32      // 连续内存块
    vectors    [][]float32    // sub-slice 视图
    neighbors  [][]uint32
}
```

- 预期收益：append 节点的向量访问变为顺序内存访问，cache 命中率提升。对于 Insert 密集场景（大量新节点互相引用），效果显著
- 实现复杂度：中等。需要处理扩容时的 sub-slice 重建（参照 `build.go` 的 `rebuildVectorViews`）

**C-6b: mmap warmup 策略**

利用 `DiskIndexReader.Warmup()` 接口，在 Insert 开始前预热 medoid 附近的节点：

```go
// Insert 开始时预热 medoid 的 1-hop 邻居
warmupIDs := idx.getNeighbors(idx.metadata.Medoid)
idx.reader.Warmup(warmupIDs)
```

- 预期收益：减少首次 greedy search 的 page fault
- 实现复杂度：低
- 注意：对于连续 Insert，medoid 附近的页面通常已在 page cache 中，收益递减

---

## 优化建议汇总

| 编号 | 优化项 | 预期收益 | 实现复杂度 | 优先级 |
|------|--------|---------|-----------|--------|
| C-1 | slice-based 缓存替代 map | 消除 ~12% mapassign_fast64 开销 | 中 | **高** |
| C-1b | sync.Pool 复用缓存 | 消除缓存分配开销 | 低 | **高** |
| P-1 | findNeighborsForInsert 邻居预取 | 隐藏 mmap 访问延迟 | 低 | **高** |
| C-5a | robustPrune scratch 复用 | 消除每次 prune 的 5 次堆分配 | 中 | 中 |
| C-6a | append buffer 连续内存布局 | 提升 append 节点 cache 命中率 | 中 | 中 |
| P-3 | addBackEdgeForNode 预取 | 隐藏反向边距离计算延迟 | 低 | 低 |
| C-6b | mmap warmup | 减少首次 page fault | 低 | 低 |
| C-2b | 分离向量/邻居存储 | 邻居遍历 cache 命中率 ~3x | 高 | 低（ROI 不足） |
| C-3 | PQ data/flags 合并 | 无显著收益 | 低 | **不推荐** |

建议实施顺序：C-1 + C-1b → P-1 → C-5a → C-6a
