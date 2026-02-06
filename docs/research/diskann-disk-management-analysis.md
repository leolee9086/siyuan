# DiskANN 磁盘管理策略分析报告

## 概述

本报告分析了两个DiskANN实现的磁盘管理策略：
- **IP-DiskANN** (C++实现): `toread/IP-DiskANN/`
- **DiskANN** (Rust实现): `toread/DiskANN/`

## 1. 磁盘文件布局设计

### 1.1 扇区对齐与页面大小

#### IP-DiskANN (C++)

**关键常量** ([`defaults.h:24-25`](toread/IP-DiskANN/include/defaults.h:24)):
```cpp
const uint64_t SECTOR_LEN = 4096;           // 默认扇区大小 4KB
const uint64_t MAX_N_SECTOR_READS = 128;    // 最大批量读取扇区数
```

**对齐要求** ([`aligned_file_reader.h:73-91`](toread/IP-DiskANN/include/aligned_file_reader.h:73)):
```cpp
// 所有3个字段必须512字节对齐
struct AlignedRead {
    uint64_t offset;  // 读取偏移量
    uint64_t len;     // 读取长度
    void *buf;        // 读取缓冲区
};
```

#### DiskANN (Rust)

**对齐常量** ([`aligned_read.rs:8`](toread/DiskANN/diskann-disk/src/utils/aligned_file_reader/aligned_read.rs:8)):
```rust
pub const DISK_IO_ALIGNMENT: usize = 512;
```

**默认扇区大小** ([`disk_sector_graph.rs:18`](toread/DiskANN/diskann-disk/src/search/provider/disk_sector_graph.rs:18)):
```rust
const DEFAULT_DISK_SECTOR_LEN: usize = 4096;
```

### 1.2 节点布局策略

#### 多节点扇区 vs 多扇区节点

两个实现都支持两种布局模式：

**IP-DiskANN** ([`pq_flash_index.h:139-151`](toread/IP-DiskANN/include/pq_flash_index.h:139)):
```cpp
// 多节点扇区模式 (nnodes_per_sector > 0)
// 节点i所在扇区: [i / nnodes_per_sector]
// 扇区内偏移: [(i % nnodes_per_sector) * max_node_len]

// 多扇区节点模式 (nnodes_per_sector == 0)
// 节点i所在扇区: [i * DIV_ROUND_UP(_max_node_len, SECTOR_LEN)]
// 扇区内偏移: [0]
```

**DiskANN (Rust)** ([`disk_sector_graph.rs:154-162`](toread/DiskANN/diskann-disk/src/search/provider/disk_sector_graph.rs:154)):
```rust
fn get_node_offset(&self, vertex_id: u32) -> usize {
    if self.num_nodes_per_sector == 0 {
        // 多扇区节点
        0
    } else {
        // 多节点扇区
        (vertex_id as u64 % self.num_nodes_per_sector * self.node_len) as usize
    }
}
```

### 1.3 文件头结构

#### GraphMetadata (Rust) ([`graph_metadata.rs:14-41`](toread/DiskANN/diskann-disk/src/data_model/graph_metadata.rs:14))

```rust
pub struct GraphMetadata {
    pub num_pts: u64,              // 点数量
    pub dims: usize,               // 数据维度
    pub medoid: u64,               // 中心点索引
    pub node_len: u64,             // 节点长度
    pub num_nodes_per_block: u64,  // 每扇区节点数
    pub vamana_frozen_num: u64,    // 冻结节点数
    pub vamana_frozen_loc: u64,    // 冻结节点位置
    pub disk_index_file_size: u64, // 磁盘索引文件大小
    pub associated_data_length: usize, // 关联数据长度
}
```

**序列化布局** (80字节):
```
| num_pts (8B) | dims (8B) | medoid (8B) | node_len (8B) | 
| num_nodes_per_sector (8B) | vamana_frozen_num (8B) | vamana_frozen_loc (8B) |
| append_reorder_data (8B) | disk_index_file_size (8B) | associated_data_length (8B) |
```

#### GraphHeader (Rust) ([`graph_header.rs:15-24`](toread/DiskANN/diskann-disk/src/data_model/graph_header.rs:15))

```rust
pub struct GraphHeader {
    metadata: GraphMetadata,           // 图元数据
    block_size: u64,                   // 块大小
    layout_version: GraphLayoutVersion, // 布局版本
}
```

**序列化布局** (96字节):
```
| GraphMetadata (80B) | BlockSize (8B) | GraphLayoutVersion (8B) |
```

## 2. 缓存策略

### 2.1 静态节点缓存

#### IP-DiskANN 缓存结构 ([`pq_flash_index.h:208-214`](toread/IP-DiskANN/include/pq_flash_index.h:208))

```cpp
// 邻居缓存
unsigned *_nhood_cache_buf = nullptr;
tsl::robin_map<uint32_t, std::pair<uint32_t, uint32_t *>> _nhood_cache;

// 坐标缓存
T *_coord_cache_buf = nullptr;
tsl::robin_map<uint32_t, T *> _coord_cache;
```

#### DiskANN (Rust) 缓存结构 ([`cache.rs:16-34`](toread/DiskANN/diskann-disk/src/data_model/cache.rs:16))

```rust
pub struct Cache<Data: GraphDataType<VectorIdType = u32>> {
    mapping: HashMap<Data::VectorIdType, usize>,  // ID到索引映射
    vectors: AlignedBoxWithSlice<Data::VectorDataType>, // 向量缓存
    adjacency_lists: Vec<AdjacencyList<Data::VectorIdType>>, // 邻接表缓存
    associated_data: Vec<Data::AssociatedDataType>, // 关联数据缓存
    dimension: usize,
    capacity: usize,
}
```

### 2.2 缓存策略类型

**DiskANN (Rust)** ([`cache.rs:146-150`](toread/DiskANN/diskann-disk/src/data_model/cache.rs:146)):
```rust
pub enum CachingStrategy {
    None,                           // 无缓存
    StaticCacheWithBfsNodes(usize), // BFS静态缓存
}
```

### 2.3 缓存预热策略

#### BFS层级缓存 ([`pq_flash_index.cpp:380-490`](toread/IP-DiskANN/src/pq_flash_index.cpp:380))

从medoid开始进行BFS遍历，缓存最近的N个节点：
1. 从medoid开始
2. 逐层扩展邻居
3. 直到达到目标缓存数量

#### 基于样本查询的缓存 ([`pq_flash_index.cpp:264-279`](toread/IP-DiskANN/src/pq_flash_index.cpp:264))

统计查询访问频率，缓存最热门的节点。

### 2.4 缓存命中处理

**CachedDiskVertexProvider** ([`cached_disk_vertex_provider.rs:44-72`](toread/DiskANN/diskann-disk/src/search/provider/cached_disk_vertex_provider.rs:44)):

```rust
fn get_vector(&self, vertex_id: &Data::VectorIdType) -> ANNResult<&[...]> {
    match self.cache.get_vector(vertex_id) {
        Some(vector) => Ok(vector),  // 缓存命中
        None => self.vector_provider.get_vector(vertex_id), // 回退到磁盘
    }
}
```

## 3. I/O优化技术

### 3.1 对齐I/O读取

#### IP-DiskANN Linux实现

使用Linux AIO (libaio) 进行异步对齐读取：
- 最大I/O深度: 128 ([`aligned_file_reader.h:6`](toread/IP-DiskANN/include/aligned_file_reader.h:6))
- 所有读取必须512字节对齐

#### DiskANN (Rust) 对齐读取 ([`aligned_read.rs:11-57`](toread/DiskANN/diskann-disk/src/utils/aligned_file_reader/aligned_read.rs:11))

```rust
pub struct AlignedRead<'a, T> {
    offset: u64,           // 必须512对齐
    aligned_buf: &'a mut [T], // 缓冲区必须512对齐
}

impl<'a, T> AlignedRead<'a, T> {
    fn assert_is_aligned(val: usize) -> ANNResult<()> {
        match val % DISK_IO_ALIGNMENT {
            0 => Ok(()),
            _ => Err(ANNError::log_disk_io_request_alignment_error(...))
        }
    }
}
```

### 3.2 批量扇区读取

**DiskSectorGraph** ([`disk_sector_graph.rs:107-134`](toread/DiskANN/diskann-disk/src/search/provider/disk_sector_graph.rs:107)):

```rust
pub fn read_graph(&mut self, sectors_to_fetch: &[u64]) -> ANNResult<()> {
    // 批量读取多个扇区
    let mut read_requests = Vec::with_capacity(sector_slices.len());
    for (local_sector_idx, slice) in sector_slices.iter_mut().enumerate() {
        let sector_id = sectors_to_fetch[local_sector_idx];
        read_requests.push(AlignedRead::new(sector_id * self.block_size as u64, slice)?);
    }
    self.sector_reader.read(&mut read_requests)?;
}
```

### 3.3 顺序缓存I/O

**cached_io.h** ([`cached_io.h:14-217`](toread/IP-DiskANN/include/cached_io.h:14)):

```cpp
class cached_ifstream {
    char *cache_buf = nullptr;  // 缓存缓冲区
    uint64_t cache_size = 0;    // 缓存大小
    uint64_t cur_off = 0;       // 当前偏移

    void read(char *read_buf, uint64_t n_bytes) {
        if (n_bytes <= (cache_size - cur_off)) {
            // 情况1: 缓存包含所有数据
            memcpy(read_buf, cache_buf + cur_off, n_bytes);
        } else {
            // 情况2: 需要从磁盘读取更多数据
            // 先复制缓存中的数据，再从磁盘读取剩余部分
        }
    }
};
```

## 4. 删除与压缩机制

### 4.1 当前状态

两个实现目前都**不支持**原地删除和压缩。主要原因：
- 磁盘布局是静态的，节点位置固定
- 删除需要重建索引或使用标记删除

### 4.2 可能的实现策略

1. **标记删除**: 维护删除位图，查询时跳过已删除节点
2. **延迟压缩**: 累积足够删除后重建索引
3. **分片管理**: 将索引分片，单独管理每个分片的生命周期

## 5. 热更新支持

### 5.1 当前状态

两个实现都**不直接支持**热更新。索引构建后是只读的。

### 5.2 IP-DiskANN的分片合并策略

**merge_shards** ([`disk_utils.cpp:241-284`](toread/IP-DiskANN/src/disk_utils.cpp:241)):

支持将多个分片索引合并为一个：
1. 读取各分片的ID映射
2. 计算全局节点ID
3. 合并邻居列表
4. 生成统一的磁盘布局

### 5.3 可能的热更新策略

1. **双缓冲索引**: 维护两个索引，交替更新
2. **增量分片**: 新数据写入新分片，定期合并
3. **内存缓冲层**: 新数据先在内存中，批量写入磁盘

## 6. Go实现建议

### 6.1 磁盘布局设计

```go
const (
    SectorLen       = 4096  // 扇区大小
    DiskIOAlignment = 512   // I/O对齐
)

type GraphMetadata struct {
    NumPts            uint64
    Dims              uint64
    Medoid            uint64
    NodeLen           uint64
    NumNodesPerSector uint64
    VamanaFrozenNum   uint64
    VamanaFrozenLoc   uint64
    DiskIndexFileSize uint64
    AssociatedDataLen uint64
}

type GraphHeader struct {
    Metadata      GraphMetadata
    BlockSize     uint64
    LayoutVersion GraphLayoutVersion
}
```

### 6.2 对齐读取实现

```go
type AlignedRead struct {
    Offset uint64
    Len    uint64
    Buf    []byte // 必须对齐分配
}

func NewAlignedRead(offset, len uint64, buf []byte) (*AlignedRead, error) {
    if offset%DiskIOAlignment != 0 {
        return nil, ErrNotAligned
    }
    if len%DiskIOAlignment != 0 {
        return nil, ErrNotAligned
    }
    if uintptr(unsafe.Pointer(&buf[0]))%DiskIOAlignment != 0 {
        return nil, ErrNotAligned
    }
    return &AlignedRead{Offset: offset, Len: len, Buf: buf}, nil
}
```

### 6.3 缓存策略实现

```go
type Cache struct {
    mapping        map[uint32]int
    vectors        []float32  // 对齐分配
    adjacencyLists [][]uint32
    dimension      int
    capacity       int
    mu             sync.RWMutex
}

func (c *Cache) Get(id uint32) (vector []float32, neighbors []uint32, ok bool) {
    c.mu.RLock()
    defer c.mu.RUnlock()
    
    idx, exists := c.mapping[id]
    if !exists {
        return nil, nil, false
    }
    
    start := idx * c.dimension
    end := start + c.dimension
    return c.vectors[start:end], c.adjacencyLists[idx], true
}
```

### 6.4 扇区图读取

```go
type DiskSectorGraph struct {
    reader            *os.File
    sectorsData       []byte
    numNodesPerSector uint64
    nodeLen           uint64
    blockSize         int
}

func (g *DiskSectorGraph) NodeSectorIndex(vertexID uint32) uint64 {
    if g.numNodesPerSector > 0 {
        return 1 + uint64(vertexID)/g.numNodesPerSector
    }
    return 1 + uint64(vertexID)*g.numSectorsPerNode()
}

func (g *DiskSectorGraph) GetNodeOffset(vertexID uint32) int {
    if g.numNodesPerSector == 0 {
        return 0
    }
    return int(uint64(vertexID) % g.numNodesPerSector * g.nodeLen)
}
```

### 6.5 关键优化点

1. **使用mmap**: Go的`syscall.Mmap`可以实现内存映射
2. **对齐内存分配**: 使用`unsafe`包或cgo分配对齐内存
3. **批量I/O**: 使用`preadv`系统调用进行批量读取
4. **并发安全缓存**: 使用`sync.RWMutex`保护缓存访问

## 7. 总结

### 7.1 核心设计要点

| 特性 | IP-DiskANN (C++) | DiskANN (Rust) |
|------|------------------|----------------|
| 扇区大小 | 4096字节 | 4096字节 |
| I/O对齐 | 512字节 | 512字节 |
| 缓存策略 | BFS/查询统计 | BFS静态缓存 |
| 异步I/O | Linux AIO | 同步读取 |
| 删除支持 | 无 | 无 |
| 热更新 | 分片合并 | 无 |

### 7.2 Go实现优先级

1. **高优先级**:
   - 扇区对齐的磁盘布局
   - 512字节对齐的I/O操作
   - 静态节点缓存

2. **中优先级**:
   - BFS缓存预热
   - 批量扇区读取
   - 内存映射支持

3. **低优先级**:
   - 异步I/O
   - 删除/压缩
   - 热更新

---

*报告生成时间: 2026-02-06*
*分析代码版本: IP-DiskANN (C++), DiskANN (Rust)*
