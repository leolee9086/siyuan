# DiskANN 磁盘索引内存优化修复

## 任务背景

当前 DiskANN 磁盘索引实现中，`disk_index.go` 将整个图结构（邻居列表）加载到内存，违反了设计文档中"仅量化码驻留内存"的原则。

## 问题位置

- 文件：`kernel/vectordb/vamana/disk_index.go`
- 问题字段：`neighbors [][]uint32` (第107行)
- 问题函数：`loadNeighbors()` (第397-421行)
- 问题访问：`GetNeighbors()` (第490-499行) 直接从内存返回

## 设计原则（来自设计文档）

- 内存常驻：仅 BBQ 量化码
- 磁盘访问：邻居列表（通过 mmap/pread 按需读取）
- 磁盘访问：原始向量（仅精排时读取）

## 修复目标

1. 移除 `neighbors [][]uint32` 字段
2. 移除 `loadNeighbors()` 函数调用
3. 修改 `GetNeighbors()` 改为调用 `idx.reader.ReadNeighbors(nodeID)` 从磁盘按需读取
4. 可选：添加 LRU 缓存层优化热点访问

## 任务状态

- [x] 修改 DiskVamanaIndex 结构体
- [x] 修改 Open 函数
- [x] 修改 GetNeighbors 函数
- [x] 运行测试验证

## 完成摘要

### 内存优化成果

- **磁盘索引内存占用**: 25.06 MB
- **内存索引内存占用**: 1.16 GB
- **内存降低比例**: 97.8%

### 测试验证

- 基础测试全部通过（14个测试）
- 1M 数据规模测试内存优化验证通过

## 下一阶段任务

### 任务：参数调优

**问题**: 默认 efSearch=100 时召回率 47.65%，未达到 70% 阈值

**发现**: efSearch=500 时可达 74.70%

**待决策**:
1. 调整测试阈值（降低召回率要求）
2. 调整默认 efSearch 参数（提高搜索质量）

## 参考文档

### 项目设计文档
- `docs/设计/DiskANN-Go版本磁盘存储设计方案.md`
- `docs/ttt/diskann-design.shortterm.ttt.md`

### Rust 参考实现 (toread/DiskANN/)
- `toread/DiskANN/diskann-disk/src/search/provider/disk_vertex_provider.rs` - 磁盘顶点提供器，按需从磁盘读取节点
- `toread/DiskANN/diskann-disk/src/search/provider/cached_disk_vertex_provider.rs` - 带缓存的磁盘顶点提供器
- `toread/DiskANN/diskann-disk/src/storage/disk_index_reader.rs` - 磁盘索引读取器

### C++ 原始实现 (toread/IP-DiskANN/)
- `toread/IP-DiskANN/include/pq_flash_index.h` - PQ Flash索引类，磁盘搜索主接口
- `toread/IP-DiskANN/src/pq_flash_index.cpp` - 磁盘搜索实现，包含 cached_beam_search

## 内存影响估算

假设 100万向量，MaxDegree=64：
- 当前邻居列表内存占用: `1,000,000 × 64 × 4 bytes = 256 MB`
- 修复后: 仅按需读取，内存占用接近 0（或缓存大小）

## 完成日期

2026-02-06
