# 磁盘存储层实现 执行跟踪 (TikTocTak)

> **目标**: 实现跨平台磁盘存储层 + 磁盘版Vamana索引，支持mmap/缓冲读取
>
> **父计划**: [`后端向量数据库超大规模数据支持计划.ttt.md`](后端向量数据库超大规模数据支持计划.ttt.md)
>
> **设计TTT**: [`diskann-design.shortterm.ttt.md`](diskann-design.shortterm.ttt.md) (Task 1: 磁盘存储层)
>
> **设计文档**:
> - [`DiskANN-Go版本磁盘存储设计方案.md`](../设计/DiskANN-Go版本磁盘存储设计方案.md)
> - [`DiskANN-Go版本Vamana图索引设计.md`](../设计/DiskANN-Go版本Vamana图索引设计.md)

---

## 📋 项目背景

### 目标平台

| 平台 | I/O策略 | 实现文件 | 状态 |
|------|---------|----------|------|
| Linux/macOS | mmap | `io_mmap_unix.go` | ✅ |
| Windows | mmap | `io_mmap_windows.go` | ✅ |
| iOS/Android | 缓冲读取+LRU | `io_buffered_mobile.go` | ✅ |

### 代码位置

```
kernel/vectordb/
├── storage/
│   ├── io.go                    ✅ 接口定义
│   ├── io_mmap_unix.go          ✅ Unix mmap
│   ├── io_mmap_windows.go       ✅ Windows mmap
│   ├── io_buffered_mobile.go    ✅ Mobile缓冲
│   └── serialize.go             ✅ 序列化 (含DeletedBitmap)
└── vamana/
    ├── index.go                 ✅ 内存版索引
    ├── build.go                 ✅ 内存版构建
    ├── search.go                ✅ 内存版搜索
    ├── bbq.go                   ✅ BBQ量化
    ├── save.go                  ✅ 索引保存 (含BBQ元数据v2)
    ├── disk_index.go            ✅ 磁盘版索引 (含BBQ元数据加载)
    ├── disk_search.go           ✅ 磁盘版搜索 (含BBQ量化校正)
    ├── disk_build.go            ✅ 磁盘版构建 (707行, BuildFromVectors)
    ├── disk_build_test.go       ✅ 构建测试 (3个测试用例通过)
    ├── inplace_delete.go        ❌ 待实现
    └── compact.go               ❌ 待实现
```

---

## 🎯 核心原则

1. **跨平台兼容**: 支持思源笔记所有目标平台
2. **mmap友好**: 块对齐，GC友好（mmap区域不含Go指针）
3. **零拷贝读取**: 使用`encoding/binary`小端序
4. **测试驱动**: 先写测试再实现

---

## 🟢 近期计划 (P0)

### Phase A: 磁盘索引核心 ✅ 2026-02-05
- [x] **vamana/disk_index.go** - 磁盘版索引结构
  - [x] `DiskVamanaIndex` 结构定义
  - [x] `Open()` / `Close()` - 打开/关闭索引
  - [x] 内存常驻: BBQ码 + 邻居列表 + 删除位图
  - [x] BBQ元数据加载 (v2格式: LowerBounds, UpperBounds, Corrections, QuantizedSums)
  - [x] 编写测试 `disk_index_test.go`

### Phase B: 磁盘搜索 ✅ 2026-02-05
- [x] **vamana/disk_search.go** - 两阶段搜索
  - [x] BBQ粗筛 (内存)
  - [x] 磁盘读取候选向量
  - [x] 精确距离rerank
  - [x] BBQ量化校正距离计算 (使用 `QuantizedScorer.ComputeQuantizedDistance`)
  - [x] 编写测试 `disk_search_test.go` / `disk_index_e2e_test.go`

### Phase C: 磁盘构建 ✅ 2026-02-06
- [x] **vamana/disk_build.go** - 索引构建 (707行)
  - [x] `BuildFromVectors()` - 从向量集合构建
  - [x] 流式写入磁盘 (4096字节扇区对齐)
  - [x] 计算medoid并写入Header
  - [x] 并行图构建 + BBQ量化
  - [x] 编写测试 `disk_build_test.go` (3个测试用例通过)

---

## 🟡 中期计划 (P1)

### Phase D: In-Place删除
- [ ] **vamana/inplace_delete.go**
  - [ ] `InplaceDelete()` - 单节点删除
  - [ ] `MultiInplaceDelete()` - 批量删除
  - [ ] OneHop策略 + 边修复逻辑

### Phase E: 压缩合并
- [ ] **vamana/compact.go**
  - [ ] `NeedsCompaction()` - 检查压缩阈值
  - [ ] `Compact()` - 执行压缩合并
  - [ ] 原子文件替换

### Phase F: 统一索引接口
- [ ] **kernel/vectordb/index.go**
  - [ ] 定义`Index`接口
  - [ ] 适配现有HNSW和新Vamana

### Phase G: 集成测试
- [ ] 端到端测试
- [ ] 与现有vectordb API兼容验证

---

## ✅ 验证检查清单

**存储层** (已完成)
- [x] 接口定义完整 ✅ 2026-02-05
- [x] Linux/macOS mmap ✅ 2026-02-05
- [x] Windows mmap ✅ 2026-02-05
- [x] iOS/Android缓冲读取 ✅ 2026-02-05
- [x] 序列化/反序列化 ✅ 2026-02-05

**磁盘索引** (待验证)
- [ ] 所有测试通过 `go test ./kernel/vectordb/...`
- [ ] 100万向量构建 < 10分钟
- [ ] 搜索延迟 < 10ms (Top-10)
- [ ] 内存占用 < 50MB (100万向量)
- [ ] 删除后召回率无明显下降
- [ ] Compact后文件大小正确缩减

---

## 🏁 已归档/已完成

- [x] **Phase 1: 接口定义** ✅ 2026-02-05
  - `kernel/vectordb/storage/io.go` - `DiskIndexReader`/`Writer`接口

- [x] **Phase 2: Linux/macOS mmap** ✅ 2026-02-05
  - `io_mmap_unix.go` - `syscall.Mmap`封装

- [x] **Phase 3: Windows mmap** ✅ 2026-02-05
  - `io_mmap_windows.go` - `golang.org/x/exp/mmap`

- [x] **Phase 4: 移动端缓冲读取** ✅ 2026-02-05
  - `io_buffered_mobile.go` - 缓冲读取+LRU缓存

- [x] **Phase 5: 序列化** ✅ 2026-02-05
  - `serialize.go` - 图头部/节点数据编解码 + `DeletedBitmap`

- [x] **Phase A: 磁盘索引核心** ✅ 2026-02-05
  - `disk_index.go` - 磁盘版索引结构 + BBQ元数据加载

- [x] **Phase B: 磁盘搜索 + BBQ量化校正** ✅ 2026-02-05
  - `disk_search.go` - 两阶段搜索 + BBQ量化校正距离计算
  - `save.go` - BBQ元数据保存 (v2格式)
  - **修复内容**: 磁盘索引BBQ搜索召回率与内存索引一致 (77.00% vs 77.00%, 差异0.00%)
  - **关键改动**:
    - `save.go`: 保存BBQ量化元数据 (LowerBounds, UpperBounds, Corrections, QuantizedSums)
    - `disk_index.go`: 加载BBQ元数据，添加 `HasBBQMeta()` 方法
    - `disk_search.go`: 使用 `QuantizedScorer.ComputeQuantizedDistance()` 计算校正距离
    - `disk_index_e2e_test.go`: 使用 `SearchWithBBQ` 进行公平对比

---

## 📚 参考资料

### 设计文档
- [DiskANN-Go版本磁盘存储设计方案](../设计/DiskANN-Go版本磁盘存储设计方案.md)
- [DiskANN-Go版本Vamana图索引设计](../设计/DiskANN-Go版本Vamana图索引设计.md)
- [Vamana_BBQ集成方案](../设计/Vamana_BBQ集成方案.md)

### 技术笔记
- [DiskANN核心算法-技术笔记](../技术文档/向量数据库/DiskANN核心算法-技术笔记.md)
- [Go语言实现DiskANN风险分析报告](../技术文档/向量数据库/Go语言实现DiskANN风险分析报告.md)

### 参考实现 (toread/)

| 目录 | 语言 | 关键文件 |
|------|------|---------|
| `DiskANN/diskann/src/graph/` | Rust | 图结构实现 |
| `DiskANN/diskann/src/provider.rs` | Rust | 核心provider |
| `IP-DiskANN/include/index.h` | C++ | 索引接口 |
| `IP-DiskANN/include/pq_flash_index.h` | C++ | 磁盘索引 |
| `vamana/src/vamana-index.ts` | TypeScript | 索引实现参考 |

---

**文档创建**: 2026-02-05
**最后更新**: 2026-02-06 02:33 (UTC+8)
