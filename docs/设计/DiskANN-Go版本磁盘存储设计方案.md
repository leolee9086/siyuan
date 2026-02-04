# DiskANN Go版本磁盘存储设计方案

> 设计日期: 2026-02-05  
> 参考实现: `toread/DiskANN/diskann-disk/` (Rust)  
> 目标: 设计适合Go语言特点的**跨平台**磁盘存储格式

---

## 0. 跨平台支持矩阵

> **设计原则**: 必须支持思源笔记的所有目标平台

| 平台 | 构建标签 | I/O策略 | mmap支持 | 备注 |
|------|----------|---------|----------|------|
| **Windows** | `windows` | mmap优先 | ✅ `golang.org/x/exp/mmap` | syscall.Mmap不可用 |
| **Linux** | `linux` | mmap优先 | ✅ `syscall.Mmap` | 直接系统调用 |
| **macOS** | `darwin` | mmap优先 | ✅ `syscall.Mmap` | 同Linux |
| **iOS** | `ios` | 缓冲读取 | ⚠️ 受限 | 沙盒限制，回退普通I/O |
| **Android** | `android` | 缓冲读取 | ⚠️ 受限 | 同iOS |

### 文件结构

```
kernel/vectordb/diskann/
├── io.go                    # 接口定义
├── io_mmap_unix.go          # //go:build darwin || linux
├── io_mmap_windows.go       # //go:build windows  
├── io_buffered_mobile.go    # //go:build ios || android
└── io_fallback.go           # 纯Go实现的通用回退
```

### 1.1 Rust版本文件格式

```
┌────────────────────────────────────────────────────────────┐
│ Block #0: GraphHeader (首个扇区/块)                         │
├────────────────────────────────────────────────────────────┤
│ GraphMetadata (80 bytes)                                   │
│   - num_pts:              u64  (点数量)                     │
│   - dims:                 u64  (向量维度)                   │
│   - medoid:               u64  (入口点ID)                   │
│   - node_len:             u64  (单节点字节长度)             │
│   - num_nodes_per_block:  u64  (每块节点数)                 │
│   - vamana_frozen_num:    u64  (冻结节点数)                 │
│   - vamana_frozen_loc:    u64  (冻结节点位置)               │
│   - append_reorder_data:  u64  (预留，为0)                  │
│   - disk_index_file_size: u64  (索引文件总大小)             │
│   - associated_data_len:  u64  (关联数据长度)               │
├────────────────────────────────────────────────────────────┤
│ BlockSize (8 bytes, u64)                                   │
├────────────────────────────────────────────────────────────┤
│ LayoutVersion (8 bytes = major:u32 + minor:u32)            │
├────────────────────────────────────────────────────────────┤
│ Padding to block_size                                      │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ Block #1..#N: 数据块 (每块 block_size 字节)                  │
├────────────────────────────────────────────────────────────┤
│ Node[0]: [Vector][NumNeighbors][NeighborIDs...][AssocData] │
│ Node[1]: [Vector][NumNeighbors][NeighborIDs...][AssocData] │
│ ...                                                        │
│ Node[num_nodes_per_block-1]                                │
└────────────────────────────────────────────────────────────┘
```

### 1.2 节点内部布局

```
Node (定长 node_len 字节):
┌─────────────────────────────────────────────────────────────┐
│ Vector: float32[dims]                    (dims * 4 bytes)    │
├─────────────────────────────────────────────────────────────┤
│ NumNeighbors: u32                        (4 bytes)           │
├─────────────────────────────────────────────────────────────┤
│ NeighborIDs: u32[max_degree]             (max_degree * 4)    │
├─────────────────────────────────────────────────────────────┤
│ AssociatedData: byte[assoc_len]          (assoc_len bytes)   │
└─────────────────────────────────────────────────────────────┘
```

**max_degree计算公式**:
```
max_degree = (node_len - dims*sizeof(float32) - associated_data_len) / sizeof(u32) - 1
```

---

## 2. Go版本设计

### 2.1 设计原则

| 原则 | 说明 | Go语言考量 |
|------|------|------------|
| **mmap友好** | 块对齐，支持直接内存映射 | 使用`syscall.Mmap`或`golang.org/x/exp/mmap` |
| **GC友好** | mmap区域不含Go指针 | 仅存储原始值类型，避免指针 |
| **零拷贝读取** | 直接从文件读取结构体 | 使用`encoding/binary`小端序 |
| **平台兼容** | Windows/Linux/macOS | 抽象I/O层，同时支持mmap和pread |

### 2.2 Go结构体定义

```go
package diskann

import "encoding/binary"

// 图元数据 (80字节，小端序)
type 图元数据 struct {
    点数量       uint64 // num_pts
    向量维度     uint64 // dims
    入口点ID     uint64 // medoid
    节点字节长度 uint64 // node_len
    每块节点数   uint64 // num_nodes_per_block
    冻结节点数   uint64 // vamana_frozen_num
    冻结节点位置 uint64 // vamana_frozen_loc
    预留字段     uint64 // append_reorder_data (保持兼容)
    索引文件大小 uint64 // disk_index_file_size
    关联数据长度 uint64 // associated_data_length
}

// 布局版本 (8字节)
type 布局版本 struct {
    主版本 uint32 // major
    次版本 uint32 // minor
}

// 图头部 (96字节)
type 图头部 struct {
    元数据   图元数据  // 80 bytes
    块大小   uint64   // 8 bytes
    布局版本 布局版本  // 8 bytes
}

const 图头部大小 = 96
const 当前主版本 = 1
const 当前次版本 = 0
```

### 2.3 磁盘布局常量

```go
const (
    默认块大小     = 4096        // 4KB，SSD扇区对齐
    默认最大出度   = 64          // max_degree
    图松弛因子     = 1.3         // GRAPH_SLACK_FACTOR
)

// 计算节点长度
func 计算节点长度(dims int, maxDegree int, assocDataLen int) int {
    向量字节 := dims * 4                    // float32
    邻居字节 := (1 + maxDegree) * 4          // NumNeighbors + NeighborIDs
    return 向量字节 + 邻居字节 + assocDataLen
}

// 计算每块节点数
func 计算每块节点数(blockSize int, nodeLen int) int {
    return blockSize / nodeLen
}
```

### 2.4 文件结构

```
vamana.index          # 主索引文件 (图头部 + 节点数据块)
vamana.bbq            # BBQ量化码 (内存常驻)
vamana.deleted        # 已删除节点位图
vamana.metadata       # 额外元数据 (JSON格式，可扩展)
```

---

## 3. Go语言特有考量

### 3.1 mmap封装

```go
package diskann

import (
    "os"
    "syscall"
    "unsafe"
)

// 内存映射文件
type 内存映射文件 struct {
    文件     *os.File
    映射数据 []byte
    大小     int64
}

// 打开映射 - 注意Go的mmap使用
func 打开映射(路径 string) (*内存映射文件, error) {
    f, err := os.OpenFile(路径, os.O_RDWR, 0)
    if err != nil {
        return nil, err
    }
    
    stat, _ := f.Stat()
    size := stat.Size()
    
    // Windows: 使用 golang.org/x/exp/mmap
    // Linux/macOS: 使用 syscall.Mmap
    data, err := syscall.Mmap(
        int(f.Fd()),
        0,
        int(size),
        syscall.PROT_READ|syscall.PROT_WRITE,
        syscall.MAP_SHARED,
    )
    if err != nil {
        f.Close()
        return nil, err
    }
    
    return &内存映射文件{文件: f, 映射数据: data, 大小: size}, nil
}

// 读取节点 - 零拷贝
func (m *内存映射文件) 读取节点(nodeID uint64, 元数据 *图元数据) []byte {
    blockID := nodeID / 元数据.每块节点数
    nodeInBlock := nodeID % 元数据.每块节点数
    
    // Block #0 是头部，数据从 Block #1 开始
    blockOffset := (blockID + 1) * uint64(元数据.节点字节长度) * 元数据.每块节点数
    nodeOffset := blockOffset + nodeInBlock*元数据.节点字节长度
    
    return m.映射数据[nodeOffset : nodeOffset+元数据.节点字节长度]
}
```

### 3.2 避免GC扫描mmap区域

```go
// 关键：mmap区域仅存储原始值类型
// 邻居列表在磁盘上是 []uint32，不是 Go slice header

// 从mmap读取邻居列表 (不创建新slice，直接返回子切片)
func 读取邻居(nodeData []byte, dims int) []uint32 {
    向量字节 := dims * 4
    邻居起始 := 向量字节
    
    邻居数 := binary.LittleEndian.Uint32(nodeData[邻居起始:])
    邻居ID起始 := 邻居起始 + 4
    
    // 使用unsafe直接转换，避免复制
    // 注意：这样做需要确保数据对齐
    邻居Slice := (*[1 << 20]uint32)(unsafe.Pointer(&nodeData[邻居ID起始]))[:邻居数:邻居数]
    return 邻居Slice
}
```

### 3.3 并发读取策略

```go
// 使用pread实现并发安全读取 (适合无法mmap的场景)
func (f *磁盘索引文件) 并发读取节点(nodeID uint64, buf []byte) error {
    offset := f.计算节点偏移(nodeID)
    
    // pread是原子操作，不需要锁
    _, err := syscall.Pread(f.fd, buf, offset)
    return err
}
```

---

## 4. 与现有BBQ集成

### 4.1 BBQ量化码存储

```
vamana.bbq 文件格式:
┌─────────────────────────────────────────────┐
│ Header (16 bytes)                           │
│   - magic: uint32 ("BBQ\0")                 │
│   - version: uint32                         │
│   - num_vectors: uint64                     │
├─────────────────────────────────────────────┤
│ QuantCodes[0]: byte[dims/8]  (1-bit量化)     │
│ QuantCodes[1]: byte[dims/8]                 │
│ ...                                         │
│ QuantCodes[num_vectors-1]                   │
└─────────────────────────────────────────────┘
```

### 4.2 搜索时的数据流

```
1. 查询 → BBQ量化 (内存)
2. 从入口点开始贪婪搜索
   ├─ 读取BBQ码 (内存)
   ├─ 计算汉明距离 (内存，快)
   └─ 读取邻居ID (mmap/pread)
3. 候选集确定后
   └─ 读取原始向量 (mmap/pread，慢，只读Top-K的小倍数)
4. 精排返回
```

---

## 5. 热更新支持

### 5.1 删除位图

```go
// 使用位图标记已删除节点，不修改主索引文件
type 删除位图 struct {
    bits []uint64  // 每个bit表示一个节点是否删除
    脏   bool      // 是否有未持久化的修改
}

func (d *删除位图) 标记删除(nodeID uint64) {
    wordIdx := nodeID / 64
    bitIdx := nodeID % 64
    d.bits[wordIdx] |= (1 << bitIdx)
    d.脏 = true
}

func (d *删除位图) 是否删除(nodeID uint64) bool {
    wordIdx := nodeID / 64
    bitIdx := nodeID % 64
    return (d.bits[wordIdx] & (1 << bitIdx)) != 0
}
```

### 5.2 增量插入策略

采用IP-DiskANN风格的原地插入：
1. 追加新节点到文件末尾
2. 更新元数据中的点数量
3. 通过搜索找到新节点的邻居
4. 更新邻居的邻居列表（需要原地更新或追加日志）

---

## 6. 跨平台I/O抽象层 (核心设计)

### 6.1 统一接口定义

```go
// io.go - 所有平台通用

package diskann

import "io"

// 磁盘索引读取器 - 抽象接口
type 磁盘索引读取器 interface {
    // 读取节点数据到缓冲区
    读取节点(nodeID uint64, buf []byte) error
    
    // 读取邻居ID列表 (返回切片，可能是零拷贝或复制)
    读取邻居(nodeID uint64) ([]uint32, error)
    
    // 读取原始向量 (用于rerank)
    读取向量(nodeID uint64, vec []float32) error
    
    // 获取元数据
    元数据() *图元数据
    
    // 预热指定节点到内存/缓存
    预热(nodeIDs []uint64) error
    
    // 关闭并释放资源
    Close() error
}

// 磁盘索引写入器 - 抽象接口
type 磁盘索引写入器 interface {
    磁盘索引读取器  // 嵌入读取器
    
    // 追加新节点
    追加节点(vector []float32, neighbors []uint32, assocData []byte) (nodeID uint64, err error)
    
    // 更新邻居列表 (原地更新，需要预留空间)
    更新邻居(nodeID uint64, neighbors []uint32) error
    
    // 刷新到磁盘
    Sync() error
}

// 创建函数 - 运行时选择最佳实现
func 打开磁盘索引(路径 string, 只读 bool) (磁盘索引读取器, error) {
    // 由平台特定文件实现
    return 平台创建读取器(路径, 只读)
}
```

### 6.2 Unix (Linux/macOS) 实现

```go
// io_mmap_unix.go
//go:build darwin || linux

package diskann

import (
    "os"
    "syscall"
    "unsafe"
)

type mmap读取器 struct {
    文件   *os.File
    映射   []byte
    元数据 图元数据
}

func 平台创建读取器(路径 string, 只读 bool) (磁盘索引读取器, error) {
    flags := os.O_RDONLY
    prot := syscall.PROT_READ
    if !只读 {
        flags = os.O_RDWR
        prot = syscall.PROT_READ | syscall.PROT_WRITE
    }
    
    f, err := os.OpenFile(路径, flags, 0)
    if err != nil {
        return nil, err
    }
    
    stat, _ := f.Stat()
    data, err := syscall.Mmap(
        int(f.Fd()), 0, int(stat.Size()),
        prot, syscall.MAP_SHARED,
    )
    if err != nil {
        f.Close()
        return nil, err
    }
    
    r := &mmap读取器{文件: f, 映射: data}
    if err := r.解析头部(); err != nil {
        r.Close()
        return nil, err
    }
    return r, nil
}

func (r *mmap读取器) 读取节点(nodeID uint64, buf []byte) error {
    offset := r.计算偏移(nodeID)
    copy(buf, r.映射[offset:offset+r.元数据.节点字节长度])
    return nil
}

func (r *mmap读取器) 读取邻居(nodeID uint64) ([]uint32, error) {
    offset := r.计算偏移(nodeID)
    nodeData := r.映射[offset : offset+r.元数据.节点字节长度]
    
    向量字节 := r.元数据.向量维度 * 4
    邻居数 := *(*uint32)(unsafe.Pointer(&nodeData[向量字节]))
    
    // 零拷贝：直接返回mmap区域的切片视图
    邻居起始 := 向量字节 + 4
    邻居Slice := unsafe.Slice(
        (*uint32)(unsafe.Pointer(&nodeData[邻居起始])),
        邻居数,
    )
    return 邻居Slice, nil
}

func (r *mmap读取器) Close() error {
    syscall.Munmap(r.映射)
    return r.文件.Close()
}

func (r *mmap读取器) 计算偏移(nodeID uint64) uint64 {
    // Block #0 是头部(4096字节)，数据从 Block #1 开始
    块大小 := r.元数据.节点字节长度 * r.元数据.每块节点数
    块号 := nodeID / r.元数据.每块节点数
    块内偏移 := (nodeID % r.元数据.每块节点数) * r.元数据.节点字节长度
    return 4096 + 块号*块大小 + 块内偏移
}
```

### 6.3 Windows 实现

```go
// io_mmap_windows.go
//go:build windows

package diskann

import (
    "golang.org/x/exp/mmap"
)

type windows读取器 struct {
    reader *mmap.ReaderAt
    元数据  图元数据
    缓冲    []byte  // 读取缓冲
}

func 平台创建读取器(路径 string, 只读 bool) (磁盘索引读取器, error) {
    // Windows版本的golang.org/x/exp/mmap只支持只读
    // 写入需要回退到标准文件I/O
    if !只读 {
        return 创建缓冲读取器(路径, 只读)  // 回退
    }
    
    reader, err := mmap.Open(路径)
    if err != nil {
        return nil, err
    }
    
    r := &windows读取器{
        reader: reader,
        缓冲:    make([]byte, 4096), // 预分配缓冲
    }
    if err := r.解析头部(); err != nil {
        r.Close()
        return nil, err
    }
    return r, nil
}

func (r *windows读取器) 读取节点(nodeID uint64, buf []byte) error {
    offset := int64(r.计算偏移(nodeID))
    _, err := r.reader.ReadAt(buf, offset)
    return err
}

func (r *windows读取器) 读取邻居(nodeID uint64) ([]uint32, error) {
    // Windows版本需要复制，因为ReaderAt不提供零拷贝
    节点长度 := int(r.元数据.节点字节长度)
    if len(r.缓冲) < 节点长度 {
        r.缓冲 = make([]byte, 节点长度)
    }
    
    if err := r.读取节点(nodeID, r.缓冲[:节点长度]); err != nil {
        return nil, err
    }
    
    return 解析邻居从缓冲(r.缓冲, int(r.元数据.向量维度))
}

func (r *windows读取器) Close() error {
    return r.reader.Close()
}
```

### 6.4 移动端 (iOS/Android) 实现

```go
// io_buffered_mobile.go
//go:build ios || android

package diskann

import (
    "os"
    "sync"
)

// 移动端使用缓冲读取 + LRU缓存，不使用mmap
// 原因：
// 1. iOS沙盒限制mmap行为
// 2. Android上mmap可能导致ANR
// 3. 移动端数据量通常较小，缓冲读取足够

type 移动端读取器 struct {
    文件   *os.File
    元数据 图元数据
    
    // LRU节点缓存
    缓存    map[uint64][]byte
    缓存锁  sync.RWMutex
    缓存容量 int
    
    // 预分配读取缓冲池
    缓冲池 sync.Pool
}

func 平台创建读取器(路径 string, 只读 bool) (磁盘索引读取器, error) {
    flags := os.O_RDONLY
    if !只读 {
        flags = os.O_RDWR
    }
    
    f, err := os.OpenFile(路径, flags, 0)
    if err != nil {
        return nil, err
    }
    
    r := &移动端读取器{
        文件:     f,
        缓存:     make(map[uint64][]byte),
        缓存容量: 1000, // 默认缓存1000个节点
        缓冲池: sync.Pool{
            New: func() interface{} { return make([]byte, 4096) },
        },
    }
    
    if err := r.解析头部(); err != nil {
        r.Close()
        return nil, err
    }
    return r, nil
}

func (r *移动端读取器) 读取节点(nodeID uint64, buf []byte) error {
    // 先检查缓存
    r.缓存锁.RLock()
    if cached, ok := r.缓存[nodeID]; ok {
        copy(buf, cached)
        r.缓存锁.RUnlock()
        return nil
    }
    r.缓存锁.RUnlock()
    
    // 缓存未命中，从磁盘读取
    offset := int64(r.计算偏移(nodeID))
    节点长度 := int(r.元数据.节点字节长度)
    
    _, err := r.文件.ReadAt(buf[:节点长度], offset)
    if err != nil {
        return err
    }
    
    // 加入缓存
    r.加入缓存(nodeID, buf[:节点长度])
    return nil
}

func (r *移动端读取器) 预热(nodeIDs []uint64) error {
    // 移动端预热：批量读取并缓存
    for _, id := range nodeIDs {
        buf := r.缓冲池.Get().([]byte)
        if err := r.读取节点(id, buf); err != nil {
            r.缓冲池.Put(buf)
            return err
        }
        r.缓冲池.Put(buf)
    }
    return nil
}

func (r *移动端读取器) 加入缓存(nodeID uint64, data []byte) {
    r.缓存锁.Lock()
    defer r.缓存锁.Unlock()
    
    // 简单的缓存淘汰：超过容量时清空
    if len(r.缓存) >= r.缓存容量 {
        r.缓存 = make(map[uint64][]byte)
    }
    
    cached := make([]byte, len(data))
    copy(cached, data)
    r.缓存[nodeID] = cached
}

func (r *移动端读取器) Close() error {
    r.缓存 = nil
    return r.文件.Close()
}
```

### 6.5 性能对比预估

| 平台 | 策略 | 随机读延迟 | 内存占用 | 适用场景 |
|------|------|------------|----------|----------|
| Linux/macOS | mmap | ~1μs (热) / ~100μs (冷) | 按需页加载 | 大索引 |
| Windows | mmap.ReaderAt | ~2μs (热) / ~150μs (冷) | 按需 | 大索引 |
| iOS/Android | 缓冲+LRU | ~10μs (缓存命中) | 固定缓存 | 小索引(<100K) |

---

## 7. 序列化与反序列化

### 7.1 头部读写

```go
package diskann

import (
    "encoding/binary"
    "errors"
    "io"
    "math"
)

var (
    ErrInvalidMagic    = errors.New("invalid magic number")
    ErrVersionMismatch = errors.New("unsupported version")
    ErrCorruptedFile   = errors.New("file corrupted")
)

const MagicNumber uint32 = 0x56414D41 // "VAMA"

// 写入图头部
func 写入图头部(w io.Writer, header *图头部) error {
    if err := binary.Write(w, binary.LittleEndian, MagicNumber); err != nil {
        return err
    }
    if err := binary.Write(w, binary.LittleEndian, &header.元数据); err != nil {
        return err
    }
    if err := binary.Write(w, binary.LittleEndian, header.块大小); err != nil {
        return err
    }
    return binary.Write(w, binary.LittleEndian, &header.布局版本)
}

// 读取图头部
func 读取图头部(r io.Reader) (*图头部, error) {
    var magic uint32
    if err := binary.Read(r, binary.LittleEndian, &magic); err != nil {
        return nil, err
    }
    if magic != MagicNumber {
        return nil, ErrInvalidMagic
    }
    
    header := &图头部{}
    if err := binary.Read(r, binary.LittleEndian, &header.元数据); err != nil {
        return nil, err
    }
    if err := binary.Read(r, binary.LittleEndian, &header.块大小); err != nil {
        return nil, err
    }
    if err := binary.Read(r, binary.LittleEndian, &header.布局版本); err != nil {
        return nil, err
    }
    
    if header.布局版本.主版本 > 当前主版本 {
        return nil, ErrVersionMismatch
    }
    return header, nil
}
```

### 7.2 节点解析

```go
// 从字节切片解析邻居列表
func 解析邻居从缓冲(data []byte, dims int) ([]uint32, error) {
    向量字节 := dims * 4
    if len(data) < 向量字节+4 {
        return nil, ErrCorruptedFile
    }
    
    邻居数 := binary.LittleEndian.Uint32(data[向量字节:])
    邻居起始 := 向量字节 + 4
    
    if len(data) < 邻居起始+int(邻居数)*4 {
        return nil, ErrCorruptedFile
    }
    
    邻居 := make([]uint32, 邻居数)
    for i := uint32(0); i < 邻居数; i++ {
        offset := 邻居起始 + int(i)*4
        邻居[i] = binary.LittleEndian.Uint32(data[offset:])
    }
    return 邻居, nil
}

// 序列化节点到字节切片
func 序列化节点(向量 []float32, 邻居 []uint32, maxDegree int) []byte {
    dims := len(向量)
    nodeLen := dims*4 + 4 + maxDegree*4
    data := make([]byte, nodeLen)
    offset := 0
    
    // 写入向量
    for _, v := range 向量 {
        binary.LittleEndian.PutUint32(data[offset:], math.Float32bits(v))
        offset += 4
    }
    
    // 写入邻居数
    binary.LittleEndian.PutUint32(data[offset:], uint32(len(邻居)))
    offset += 4
    
    // 写入邻居ID
    for _, id := range 邻居 {
        binary.LittleEndian.PutUint32(data[offset:], id)
        offset += 4
    }
    
    // 填充未使用槽位
    for i := len(邻居); i < maxDegree; i++ {
        binary.LittleEndian.PutUint32(data[offset:], 0xFFFFFFFF)
        offset += 4
    }
    
    return data
}
```

---

## 8. 错误处理与边界情况

### 8.1 错误类型

```go
var (
    ErrFileNotFound      = errors.New("index file not found")
    ErrNeighborsFull     = errors.New("neighbor list is full")
    ErrIndexFull         = errors.New("index capacity reached")
    ErrDimensionMismatch = errors.New("vector dimension mismatch")
    ErrNodeDeleted       = errors.New("node has been deleted")
    ErrIndexClosed       = errors.New("index is closed")
)
```

### 8.2 邻居列表满时的处理

```go
// 邻居管理器 - 处理邻居列表满的情况
type 邻居管理器 struct {
    maxDegree int
    pruneK    int // 裁剪后保留数量，通常为 maxDegree * 0.8
}

func (m *邻居管理器) 添加邻居(
    当前邻居 []uint32,
    新邻居 uint32,
    距离计算 func(a, b uint32) float32,
) []uint32 {
    // 检查重复
    for _, id := range 当前邻居 {
        if id == 新邻居 {
            return 当前邻居
        }
    }
    
    // 未满直接添加
    if len(当前邻居) < m.maxDegree {
        return append(当前邻居, 新邻居)
    }
    
    // 已满，执行裁剪
    return m.裁剪并添加(当前邻居, 新邻居, 距离计算)
}

func (m *邻居管理器) 裁剪并添加(
    当前邻居 []uint32,
    新邻居 uint32,
    距离计算 func(a, b uint32) float32,
) []uint32 {
    // 构建候选列表并按距离排序
    type candidate struct {
        id   uint32
        dist float32
    }
    candidates := make([]candidate, 0, len(当前邻居)+1)
    
    for _, id := range 当前邻居 {
        candidates = append(candidates, candidate{id, 距离计算(0, id)})
    }
    candidates = append(candidates, candidate{新邻居, 距离计算(0, 新邻居)})
    
    // 排序并保留前 pruneK 个
    sort.Slice(candidates, func(i, j int) bool {
        return candidates[i].dist < candidates[j].dist
    })
    
    result := make([]uint32, m.pruneK)
    for i := 0; i < m.pruneK; i++ {
        result[i] = candidates[i].id
    }
    return result
}
```

### 8.3 文件扩展策略

```go
// 确保文件容量足够
func (idx *磁盘索引) 确保容量(需要节点数 uint64) error {
    当前容量 := idx.header.元数据.点数量
    if 需要节点数 <= 当前容量 {
        return nil
    }
    
    // 扩展因子 1.5
    新容量 := uint64(float64(需要节点数) * 1.5)
    新块数 := (新容量 + idx.header.元数据.每块节点数 - 1) / idx.header.元数据.每块节点数
    新大小 := int64(1+新块数) * int64(idx.header.块大小)
    
    if err := idx.file.Truncate(新大小); err != nil {
        return fmt.Errorf("extend file failed: %w", err)
    }
    
    idx.header.元数据.索引文件大小 = uint64(新大小)
    return nil
}
```

### 8.4 删除位图持久化

```go
const DeletedBitmapMagic uint32 = 0x44454C42 // "DELB"

func 保存删除位图(path string, bitmap *删除位图) error {
    f, err := os.Create(path)
    if err != nil {
        return err
    }
    defer f.Close()
    
    binary.Write(f, binary.LittleEndian, DeletedBitmapMagic)
    binary.Write(f, binary.LittleEndian, uint32(1)) // version
    binary.Write(f, binary.LittleEndian, uint64(len(bitmap.bits)*64))
    
    for _, word := range bitmap.bits {
        binary.Write(f, binary.LittleEndian, word)
    }
    return f.Sync()
}

func 加载删除位图(path string) (*删除位图, error) {
    data, err := os.ReadFile(path)
    if err != nil {
        if os.IsNotExist(err) {
            return &删除位图{bits: make([]uint64, 0)}, nil
        }
        return nil, err
    }
    
    if len(data) < 16 {
        return nil, ErrCorruptedFile
    }
    
    magic := binary.LittleEndian.Uint32(data[0:4])
    if magic != DeletedBitmapMagic {
        return nil, ErrInvalidMagic
    }
    
    count := binary.LittleEndian.Uint64(data[8:16])
    wordCount := (count + 63) / 64
    
    bitmap := &删除位图{bits: make([]uint64, wordCount)}
    for i := uint64(0); i < wordCount && 16+i*8+8 <= uint64(len(data)); i++ {
        bitmap.bits[i] = binary.LittleEndian.Uint64(data[16+i*8:])
    }
    return bitmap, nil
}
```

---

## 9. 与vectordb模块集成

### 9.1 集成架构

```
现有架构:
┌─────────────────────────────────────────────────┐
│ vectordb/api.go (HTTP API)                      │
├─────────────────────────────────────────────────┤
│ vectordb/types.go (Collection, Database)        │
├─────────────────────────────────────────────────┤
│ vectordb/hnsw_*.go (内存HNSW)                   │
├─────────────────────────────────────────────────┤
│ vectordb/persistence.go (msgpack快照)           │
└─────────────────────────────────────────────────┘

扩展后架构:
┌─────────────────────────────────────────────────┐
│ vectordb/api.go (HTTP API)                      │
├─────────────────────────────────────────────────┤
│ vectordb/types.go (Collection, Database)        │
├─────────────────────────────────────────────────┤
│ vectordb/hnsw_*.go │ vectordb/diskann/*.go      │
│   (内存HNSW)       │   (磁盘DiskANN)            │
├─────────────────────────────────────────────────┤
│ vectordb/persistence.go │ diskann/io_*.go       │
│   (msgpack快照)         │   (mmap/缓冲I/O)      │
└─────────────────────────────────────────────────┘
```

### 9.2 统一索引接口

```go
// vectordb/index.go - 新增文件

package vectordb

// VectorIndex 统一向量索引接口
type VectorIndex interface {
    // 插入向量
    Insert(id string, vector []float32) error
    
    // 删除向量
    Delete(id string) error
    
    // 搜索最近邻
    Search(query []float32, topK int, efSearch int) []SearchResult
    
    // 获取统计信息
    Stats() IndexStats
    
    // 关闭索引
    Close() error
}

type IndexStats struct {
    TotalPoints   uint64
    DeletedPoints uint64
    Dimension     int
    IndexType     string // "hnsw" 或 "diskann"
    MemoryUsage   uint64
    DiskUsage     uint64
}

// 现有Collection实现此接口
var _ VectorIndex = (*Collection)(nil)
```

### 9.3 DiskANN索引包装器

```go
// vectordb/diskann_wrapper.go

package vectordb

import "github.com/siyuan-note/siyuan/kernel/vectordb/diskann"

// DiskANNIndex 磁盘索引包装器
type DiskANNIndex struct {
    reader   diskann.磁盘索引读取器
    bbqCodes []byte           // BBQ量化码 (内存常驻)
    deleted  *diskann.删除位图
    idMap    map[string]uint64 // 外部ID -> 内部nodeID
    path     string
}

func OpenDiskANNIndex(path string) (*DiskANNIndex, error) {
    reader, err := diskann.打开磁盘索引(path, true)
    if err != nil {
        return nil, err
    }
    
    // 加载BBQ码到内存
    bbqPath := path + ".bbq"
    bbqCodes, err := os.ReadFile(bbqPath)
    if err != nil {
        reader.Close()
        return nil, err
    }
    
    // 加载删除位图
    deletedPath := path + ".deleted"
    deleted, _ := diskann.加载删除位图(deletedPath)
    
    return &DiskANNIndex{
        reader:   reader,
        bbqCodes: bbqCodes,
        deleted:  deleted,
        idMap:    make(map[string]uint64),
        path:     path,
    }, nil
}

func (idx *DiskANNIndex) Search(query []float32, topK int, efSearch int) []SearchResult {
    // 1. 量化查询向量
    queryBBQ := quantizeBBQ(query)
    
    // 2. 使用BBQ码快速筛选候选
    candidates := idx.bbqSearch(queryBBQ, efSearch)
    
    // 3. 从磁盘读取候选向量进行精排
    results := idx.rerank(query, candidates, topK)
    
    return results
}

func (idx *DiskANNIndex) Stats() IndexStats {
    meta := idx.reader.元数据()
    return IndexStats{
        TotalPoints:   meta.点数量,
        DeletedPoints: idx.deleted.统计删除数(),
        Dimension:     int(meta.向量维度),
        IndexType:     "diskann",
        DiskUsage:     meta.索引文件大小,
    }
}
```

### 9.4 配置参数

```go
// vectordb/config.go

// DiskANNConfig 磁盘索引配置
type DiskANNConfig struct {
    // 构建参数
    MaxDegree      int     // 最大出度，默认64
    BuildEf        int     // 构建时ef，默认128
    PruneK         int     // 裁剪保留数，默认 MaxDegree * 0.8
    
    // 搜索参数
    SearchEf       int     // 搜索时ef，默认64
    RerankK        int     // 精排候选数，默认 topK * 2
    
    // 存储参数
    BlockSize      int     // 块大小，默认4096
    CacheSize      int     // 移动端缓存节点数，默认1000
    
    // 压缩参数
    CompactThreshold float64 // 删除率阈值，默认0.3
}

func DefaultDiskANNConfig() DiskANNConfig {
    return DiskANNConfig{
        MaxDegree:        64,
        BuildEf:          128,
        PruneK:           51,
        SearchEf:         64,
        RerankK:          20,
        BlockSize:        4096,
        CacheSize:        1000,
        CompactThreshold: 0.3,
    }
}
```

---

## 10. 开放问题解决方案

| 问题 | 解决方案 | 状态 |
|------|----------|------|
| Windows mmap | `golang.org/x/exp/mmap` 只读 + 标准I/O写入 | ✅ 已解决 |
| 邻居列表变长 | 预留槽位 + 裁剪策略 | ✅ 已解决 |
| 压缩合并 | 删除率 >30% 时触发 Compact | ✅ 已解决 |

### 10.1 压缩合并实现

```go
func (idx *磁盘索引) 需要压缩() bool {
    删除数 := idx.deleted.统计删除数()
    总数 := idx.header.元数据.点数量
    删除率 := float64(删除数) / float64(总数)
    return 删除率 >= idx.config.CompactThreshold
}

func (idx *磁盘索引) Compact() error {
    // 1. 创建新索引文件
    // 2. 遍历未删除节点，重新分配ID
    // 3. 更新邻居引用
    // 4. 原子替换文件
    // 5. 清空删除位图
    return nil // 详细实现略
}
```

---

## 11. 下一步

### 实现优先级

1. [ ] `diskann/io.go` - 接口定义
2. [ ] `diskann/io_mmap_unix.go` - Linux/macOS实现
3. [ ] `diskann/io_mmap_windows.go` - Windows实现
4. [ ] `diskann/io_buffered_mobile.go` - iOS/Android实现
5. [ ] `diskann/serialize.go` - 序列化/反序列化
6. [ ] `vectordb/index.go` - 统一索引接口
7. [ ] `vectordb/diskann_wrapper.go` - DiskANN包装器
8. [ ] 单元测试 - 各平台基础读写
9. [ ] 集成测试 - 与现有vectordb模块协作

### 验证计划

- **桌面端**: 使用SIFT1M数据集验证mmap读取性能
- **移动端**: 使用SIFT10K小数据集验证缓冲读取
- **兼容性**: 确保Go写入的文件能被Rust版本读取（二进制兼容）

---

**创建时间**: 2026-02-05
**最后更新**: 2026-02-05 (补充实现细节：序列化、错误处理、集成接口)
