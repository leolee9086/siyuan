# DiskANN / IP-DiskANN 磁盘 Insert 架构调研

## 1. IP-DiskANN 磁盘 Insert 架构总结

### 1.1 核心发现：IP-DiskANN 没有真正的磁盘 Insert

IP-DiskANN 的 `Index` 类（`index.h` / `index.cpp`）是**纯内存索引**。所有 insert/delete/search 操作都在内存中完成：

- `_data_store`（`InMemDataStore`）：向量数据全量驻留内存
- `_graph_store`（`InMemGraphStore`）：邻接表全量驻留内存
- `_locks`：每节点一把 `non_recursive_mutex`

`PQFlashIndex`（`pq_flash_index.h`）是磁盘搜索专用类，**只支持只读搜索**，不支持 insert/delete。

### 1.2 DiskANN 的磁盘索引构建流程

DiskANN 的磁盘索引通过 `build_disk_index`（`disk_utils.h`）构建，流程为：

1. **内存中构建完整 Vamana 图**（分片 + 合并策略处理大数据集）
2. **一次性序列化到磁盘**：`create_disk_layout`（`disk_utils.cpp` L917-1063）
3. 磁盘文件为只读，搜索通过 `PQFlashIndex::cached_beam_search` 完成

**结论：DiskANN/IP-DiskANN 不存在"磁盘上的增量 Insert"，当前项目的 `DiskVamanaIndex.Insert()` 是自研设计。**

### 1.3 IP-DiskANN 内存 Insert 流程

`insert_point()`（`index.cpp` L2898-3047）：

```
1. shared_lock(_update_lock) + unique_lock(_tag_lock, _delete_lock)
2. reserve_location() → 分配槽位
3. _data_store->set_vector(location, point)
4. search_for_point_and_prune(location, L, pruned_list, scratch)
   → iterate_to_fixed_point() [贪心搜索]
   → prune_neighbors() → occlude_list() [RobustPrune]
5. _graph_store->set_neighbours(location, pruned_list)
6. inter_insert(location, pruned_list, scratch) [添加反向边]
```

`inter_insert()`（L1215-1278）采用 lock-copy-unlock-prune-lock-write 模式：
- 邻居数 < `GRAPH_SLACK_FACTOR * R` → 直接追加
- 否则 → 拷贝邻居列表 → 释放锁 → 计算距离 + prune → 重新加锁写入

### 1.4 IP-DiskANN inplace_delete 流程

`inplace_delete()`（`index.cpp` L3130-3303）：

```
1. GreedySearch(G, x_p, k, l_d) → Visited + Candidates
2. N'_in(p) = {z ∈ Visited : p ∈ N_out(z)}
3. 修复入边：z 的邻居中移除 p，添加 closest-c from Candidates
4. 修复出边：对 w ∈ N_out(p)，从 Candidates 中选 y，添加 y→w
5. 标记删除，清空邻居
6. 对超度数节点执行 RobustPrune
```

## 2. 内存/磁盘索引代码复用模式

### 2.1 IP-DiskANN 的复用模式

IP-DiskANN 中内存索引和磁盘索引**完全不共享核心算法**：

| 组件 | 内存 Index | 磁盘 PQFlashIndex |
|------|-----------|-------------------|
| 搜索 | `iterate_to_fixed_point` | `cached_beam_search` |
| 距离 | 全精度 / PQ 估算 | PQ 压缩 + 全精度 rerank |
| 剪枝 | `occlude_list` / `prune_neighbors` | 不适用（只读） |
| 数据访问 | 内存直接指针 | sector-aligned 磁盘读取 |

搜索时 `iterate_to_fixed_point` 使用 PQ 距离估算（`_pq_data_store->get_distance`），这是内存中的 PQ 码，不涉及磁盘 I/O。

### 2.2 当前 Go 实现的复用情况

| 算法 | VamanaIndex (build.go) | DiskVamanaIndex (disk_incremental.go) |
|------|----------------------|--------------------------------------|
| 贪心搜索 | `greedySearchForBuild` / `greedySearchFast` | `findNeighborsForInsert` / `deleteGreedySearch` |
| RobustPrune | `robustPruneCore` (增量式 occlude) | `robustPruneSimpleWithNorm` (布尔 occlude) |
| 反向边 | `addEdgeAndPruneLocked` | `addBackEdgeForNode` |
| 距离计算 | `fastDistanceToQuery` (预计算 normSq) | `euclideanDistanceWithNorms` (缓存 normSq) |

**核心算法存在两套独立实现**，主要差异：
- 内存版 `robustPruneCore` 使用增量式 `lastChecked` 数组 + progressive alpha 多轮扫描
- 磁盘版 `robustPruneSimpleWithNorm` 使用简单布尔 `occluded` 数组 + 单轮扫描
- 内存版通过 `neighborPtrs` 原子指针实现无锁读
- 磁盘版通过 `sync.Map` + `vectorCache` 实现

## 3. 数据局部性和磁盘访问优化策略

### 3.1 DiskANN 磁盘布局（参考实现）

**Sector-aligned 节点打包**（`disk_utils.cpp` L917-1063）：

```
每个节点 = [向量数据 (dims * sizeof(T))] [邻居数 (uint32)] [邻居ID列表 (maxDegree * uint32)]
max_node_len = (maxDegree + 1) * 4 + dims * sizeof(T)
nnodes_per_sector = SECTOR_LEN(4096) / max_node_len
```

- 向量和邻居列表**共存于同一 sector**，一次磁盘读取获取两者
- 多节点打包到单个 sector（小节点）或单节点跨多个 sector（大节点）
- 所有读取 sector-aligned（4096 字节对齐），适配 Direct I/O

**PQ 压缩搜索**（`pq_flash_index.cpp`）：
- 搜索时使用内存中的 PQ 码估算距离（`_pq_data_store`），不读磁盘
- 仅对 beam 中的候选节点读取磁盘 sector 获取全精度向量 + 邻居列表
- 支持 reorder：搜索完成后对 top-K 用全精度向量重排序

**缓存策略**：
- `_nhood_cache` / `_coord_cache`：热点节点的邻居和坐标缓存
- `cache_bfs_levels`：BFS 预热缓存入口点附近节点

### 3.2 当前 Go 实现的磁盘布局

当前实现（`disk_index.go` + `storage/`）采用相同的 sector-aligned 布局：

```
节点 = [向量 (dims * 4B)] [邻居数 (4B)] [邻居列表 (maxDegree * 4B)]
nodesPerBlock = blockSize / nodeLen
```

与 DiskANN 一致的设计：
- 向量和邻居共存于同一节点块
- 通过 mmap 实现零拷贝读取（`ReadVectorRef` 返回 `unsafe.Slice`）

### 3.3 BBQ vs PQ

当前实现使用 BBQ（Binary Quantization）替代 PQ：
- BBQ：1-bit 量化 + POPCNT 硬件加速，内存占用极低（dims/8 bytes/vector）
- PQ：多 bit 量化，精度更高但内存占用和计算成本更高
- BBQ 适合当前规模（<100万向量），PQ 适合更大规模

## 4. 当前实现与参考实现的差异分析

### 4.1 架构差异（最关键）

| 方面 | DiskANN/IP-DiskANN | 当前 Go 实现 |
|------|-------------------|-------------|
| 磁盘 Insert | **不存在**（内存构建 → 序列化） | 直接在磁盘图上增量操作 |
| 新向量存储 | 内存 `_data_store` | `appendVectors` 内存缓冲 |
| 邻居修改 | 内存 `_graph_store` | `modifiedNeighbors` (sync.Map) |
| 持久化 | 全量 save | `Compact` 合并写入 |

当前实现的 append buffer + modifiedNeighbors + Compact 模式是**自研的 LSM-tree 风格设计**，DiskANN 中没有对应物。

### 4.2 算法差异

**RobustPrune 实现差异**：
- IP-DiskANN：progressive alpha 多轮扫描（`curAlpha *= 1.2`），增量式 occlude factor
- 当前磁盘版：单轮布尔 occlude，无 progressive alpha
- 当前内存版（`build.go`）：已实现 progressive alpha，与 IP-DiskANN 一致

**GraphSlackFactor 策略**：
- IP-DiskANN：`GRAPH_SLACK_FACTOR`（默认 1.3）控制反向边剪枝触发阈值
- 当前内存版：已实现（`config.GraphSlackFactor`）
- 当前磁盘版 Insert：`addBackEdgeForNode` 中 `len(currentNeighbors) >= R` 即触发剪枝，**未使用 SlackFactor**
- 当前磁盘版 Delete：`pruneAffectedVertices` 使用 `deletePruneSlackFactor`

**距离计算优化**：
- IP-DiskANN 搜索时使用 PQ 距离估算，剪枝时用全精度
- 当前实现搜索时使用全精度 + normSq 缓存，无量化估算加速

### 4.3 并发模型差异

- IP-DiskANN：`shared_timed_mutex`（_update_lock, _tag_lock, _delete_lock）+ 每节点 `non_recursive_mutex`
- 当前实现：`sync.RWMutex`（idx.mu）+ 每节点 `sync.RWMutex` + `sync.Map`（modifiedNeighbors）

当前实现的 4 阶段锁策略（Phase 1-4）比 IP-DiskANN 更精细，但 `sync.Map` 在高并发写入时可能有性能问题。

## 5. 优化建议（按优先级排序）

### P0: 磁盘版 RobustPrune 对齐内存版

`robustPruneSimpleWithNorm` 缺少 progressive alpha 多轮扫描，这会导致图质量下降。应复用 `robustPruneCore` 的逻辑或将其抽象为通用实现。

### P1: Insert 反向边添加 SlackFactor

`addBackEdgeForNode` 中 `len(currentNeighbors) >= R` 应改为 `>= int(GraphSlackFactor * R)`，与内存版 `addEdgeAndPruneLocked` 一致，减少不必要的剪枝。

### P2: 统一核心算法

内存版和磁盘版的 greedySearch、robustPrune、inter_insert 存在大量重复。可抽象为接口：

```go
type GraphAccessor interface {
    GetVector(id uint64) []float32
    GetNeighbors(id uint64) []uint32
    Distance(a, b uint64) float32
}
```

### P3: Insert 搜索路径使用 BBQ 距离估算

当前 `findNeighborsForInsert` 使用全精度距离。可参考 IP-DiskANN 的 `iterate_to_fixed_point` 使用 PQ 距离估算搜索路径，仅在剪枝时使用全精度，减少 mmap 读取。

### P4: 批量 Insert 优化

当前逐点 Insert 每次都执行完整的 greedy search + prune + back-edge。可参考 IP-DiskANN 的 `link()` 批量构建模式，对批量插入使用分块并行策略。

## 6. IP-DiskANN Rust 实现补充调研

### 6.1 disk_graph 数据结构

Rust 版 `DiskGraph`（`rust/diskann/src/model/graph/disk_graph.rs`）是一个**只读磁盘搜索**的图访问层，不是可写的磁盘索引。其核心结构：

```rust
pub struct DiskGraph {
    dim: usize,                      // 全精度向量维度
    num_nodes_per_sector: u64,       // 每个 sector 包含的节点数
    max_node_len: u64,               // 节点最大字节长度
    fp_vector_len: u64,              // 全精度向量字节长度
    nodes_to_fetch: Vec<u32>,        // 待从磁盘获取的节点 ID 列表
    sector_graph: SectorGraph,       // 底层 sector 读取器
}
```

存储层级关系：

```
DiskGraph
  └── SectorGraph
        ├── sectors_data: AlignedBoxWithSlice<u8>   // sector 对齐的内存缓冲区
        ├── graph_storage: DiskGraphStorage          // 磁盘 I/O 抽象
        └── cur_sector_idx: u64                      // 当前读取位置
              └── DiskGraphStorage
                    ├── disk_graph_reader: Arc<WindowsAlignedFileReader>  // 对齐文件读取器
                    └── ctx: Arc<IOContext>                                // 线程级 I/O 上下文
```

磁盘节点布局与 C++ 版完全一致：

```
每个节点 = [全精度向量: T * dim] [邻居数: u32] [邻居ID列表: u32 * num_nbrs]
每个 sector = 4096 字节，包含 num_nodes_per_sector 个节点
sector #0 = 元数据，sector #1+ = 节点数据
```

节点定位公式：`sector_index = vertex_id / num_nodes_per_sector + 1`，sector 内偏移 = `(vertex_id % num_nodes_per_sector) * max_node_len`。

### 6.2 增量操作支持

**结论：Rust 版 `DiskGraph` 不支持任何增量操作（Insert/Delete）。**

`DiskGraph` 的全部公开方法：

| 方法 | 功能 | 读/写 |
|------|------|-------|
| `new()` | 构造，接收预计算的布局参数 | — |
| `add_vertex(id)` | 将节点 ID 加入待获取列表 | 内存写（仅 `nodes_to_fetch`） |
| `fetch_nodes()` | 批量从磁盘读取 sector | 磁盘读 |
| `copy_fp_vector_to_disk_scratch_dataset()` | 将磁盘向量拷贝到对齐内存 | 内存读 |
| `reset()` | 清空待获取列表和 sector 缓冲 | 内存写 |
| `into_iter()` | 迭代已获取节点的邻居列表 | 内存读 |

没有任何写磁盘的方法。`DiskGraphStorage.read()` 是唯一的 I/O 操作，且只有 `read` 方法。

磁盘索引的构建流程在 `DiskIndexStorage::create_disk_layout()`（`storage/disk_index_storage.rs`）中实现，与 C++ 版 `create_disk_layout` 完全对应：

1. 读取内存中已构建完成的 Vamana 图文件（`_mem.index`）
2. 读取原始数据集文件
3. 按 sector 对齐格式一次性写出 `_disk.index` 文件

**这进一步确认了之前的结论：DiskANN（无论 C++ 还是 Rust 实现）的磁盘索引都是"内存构建 → 一次性序列化"模式，不存在磁盘上的增量 Insert。**

### 6.3 内存/磁盘图代码复用模式

Rust 版的 `InMemoryGraph` 和 `DiskGraph` **不共享任何 trait 或接口**，是完全独立的两套实现。

#### InMemoryGraph

```rust
pub struct InMemoryGraph {
    pub final_graph: Vec<RwLock<VertexAndNeighbors>>,  // 每节点一把读写锁
}
```

- 支持并发读写：`read_vertex_and_neighbors()` / `write_vertex_and_neighbors()` 返回 `RwLockReadGuard` / `RwLockWriteGuard`
- 支持动态扩展：`extend(size, max_degree)` 追加新节点
- 邻居列表可变：通过 `VertexAndNeighbors::add_to_neighbors()` / `set_neighbors()` 修改
- 用于内存索引的构建和搜索

#### DiskGraph

- 只读：无写磁盘方法
- 无并发控制：无锁，每个线程持有独立的 `DiskGraphStorage`（注释："One thread has one storage instance"）
- 批量读取模式：先 `add_vertex()` 收集节点 ID → `fetch_nodes()` 批量读 sector → 迭代处理
- 用于磁盘索引的搜索（`cached_beam_search` 的 Rust 对应物）

#### 共享的基础类型

两者共享 `VertexAndNeighbors` 和 `AdjacencyList` 作为数据表示：

- `VertexAndNeighbors`：节点 ID + 邻居列表，支持 `add_to_neighbors()`（带 `GRAPH_SLACK_FACTOR` 容量控制）
- `AdjacencyList`：`Vec<u32>` 的 newtype wrapper，实现 `Deref<Target=Vec<u32>>`

但这只是数据结构层面的复用，算法层面（搜索、剪枝、插入）完全独立。

#### mod.rs 导出结构

```rust
// graph/mod.rs
pub use inmem_graph::InMemoryGraph;
pub use vertex_and_neighbors::VertexAndNeighbors;
pub use adjacency_list::AdjacencyList;
pub use sector_graph::*;   // SectorGraph
pub use disk_graph::*;     // DiskGraph, DiskGraphIntoIterator
```

`model/mod.rs` 只导出了 `InMemoryGraph` 和 `VertexAndNeighbors`，`DiskGraph` 需要通过 `model::graph::DiskGraph` 访问，说明磁盘图在整体架构中是次要组件。

### 6.4 与当前 Go 实现的对比和启示

#### 磁盘访问模式对比

| 方面 | Rust DiskGraph | Go DiskVamanaIndex |
|------|---------------|-------------------|
| I/O 方式 | `WindowsAlignedFileReader`（对齐直接 I/O） | mmap（Unix/Windows）/ 缓冲读+LRU（移动端） |
| 读取粒度 | sector（4096B），批量读多个 sector | 单节点，通过 mmap 按需加载 |
| 零拷贝 | 否，需 `memcpy` 到对齐缓冲区 | 是，`ReadVectorRef` / `ReadNeighbors` 直接返回 mmap 切片 |
| 写入能力 | 无 | 有（`appendVectors` + `modifiedNeighbors` + `Compact`） |
| 并发模型 | 每线程独立 `DiskGraphStorage` 实例 | 共享 mmap + `sync.RWMutex` + `sync.Map` |
| 缓存 | `SectorGraph.sectors_data` 固定大小缓冲 | OS 页缓存（mmap）/ LRU 缓存（移动端） |

#### 架构差异的核心启示

1. **Rust/C++ 的 DiskGraph 是纯搜索组件**：它的设计目标是在 `cached_beam_search` 中高效读取磁盘节点，不涉及任何图修改操作。当前 Go 实现的 `DiskVamanaIndex` 将搜索和增量修改合并在同一结构中，这是 DiskANN 原始设计中不存在的。

2. **对齐 I/O vs mmap 的取舍**：Rust 版使用显式的 sector-aligned 直接 I/O（`WindowsAlignedFileReader`），需要手动管理缓冲区和对齐。Go 版使用 mmap 将这些复杂性交给 OS，代价是失去了对 I/O 调度的精细控制。对于只读搜索场景，两种方式性能相当；但对于增量写入场景，mmap 的 `readOnly=false` 模式提供了更自然的读写混合支持。

3. **批量 vs 逐节点读取**：Rust 版的 `add_vertex()` → `fetch_nodes()` 模式天然支持 I/O 合并（多个节点可能在同一 sector），减少磁盘寻道。Go 版的 mmap 依赖 OS 预读策略，对随机访问模式（图搜索的典型模式）可能不如显式批量读取高效。

4. **代码复用模式的确认**：Rust 版和 C++ 版一样，内存图和磁盘图不共享算法实现。这验证了当前 Go 实现中两套独立算法（`greedySearchForBuild` vs `findNeighborsForInsert`、`robustPruneCore` vs `robustPruneSimpleWithNorm`）的存在是合理的架构选择，而非技术债务。但仍建议统一 RobustPrune 的质量（见第 5 节 P0）。
