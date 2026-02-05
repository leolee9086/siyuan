# DiskANN架构设计 执行跟踪 (TikTocTak)

> **目标**: 完成DiskANN Go实现的架构设计，输出清晰的接口定义和数据结构设计文档
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从"近期计划"中认领一个任务。
> 2. 完成设计和评审。
> 3. 将其移动到"已归档/已完成"区域。
> 4. 将"中期计划"中的条目提升到"近期计划"。

---

## 📋 背景信息

### 父计划
[`后端向量数据库超大规模数据支持计划.ttt.md`](后端向量数据库超大规模数据支持计划.ttt.md)

### 技术设计草案
[`后端向量数据库技术设计草案.md`](后端向量数据库技术设计草案.md)

### 待解决的开放问题
1. **Golang I/O**: mmap vs pread 跨平台性能差异
2. **并发控制**: 磁盘IO的并发限制与锁设计
3. **SIMD优化**: Go汇编直接嵌入策略
4. **热更新**: 软删除+后台压缩具体流程

---

## 🎯 核心原则

### 设计原则
1. **磁盘优先**: 原始向量存储在磁盘，仅量化码驻留内存
2. **BBQ继承**: 保持现有BBQ量化算法的精度优势
3. **接口兼容**: 核心内部可变更，上层接口保持稳定
4. **渐进迁移**: 支持从现有HNSW平滑迁移

### 验证检查清单
- [x] 磁盘存储层接口定义完整 *(storage包跨平台I/O实现完成)*
- [x] Vamana图索引数据结构设计完成 *(vamana包已拆分为多个模块)*
- [x] BBQ量化集成方案明确 *(vamana/bbq.go 完整实现)*
- [x] 热更新机制设计可行 *(Delete + DeletedBitmap 已实现)*
- [ ] API兼容层设计完成
- [ ] 通过设计评审

---

## ℹ️ 如何维护此文档

1. **完成归档**：任务完成后，**必须**剪切粘贴到【已归档】列表，并打上 `[x]` 和日期。
2. **补充弹药**：当【近期计划】空了，从【中期计划】里挑选任务挪上去。
3. **因地制宜**：如果发现计划不合理，随时修改或删除。
4. **数据驱动**：用数据说话，不凭感觉。

---

## 🟢 近期计划 (立即聚焦)

- [ ] **Task 5: API兼容层设计 (P1)**
  - **背景**: 保持与现有HNSW接口兼容
  - **行动**:
    1. 分析现有`kernel/vectordb/api.go`接口
    2. 设计适配层结构
    3. 设计迁移方案
  - **验收标准**:
    - 接口映射表完成
    - 迁移方案可行

---

## 🟡 中期计划 (设计细化)

- [ ] **Task 6: SIMD优化方案设计**
  - **背景**: Go汇编优化关键热点函数
  - **行动**: 确定优化函数列表、汇编实现方案

- [ ] **Task 8: 压缩合并(Compact)设计**
  - **背景**: 软删除后的空间回收机制
  - **行动**: 设计原子替换策略、后台压缩流程

---

## 🏁 已归档/已完成

- [x] **Task 1: 磁盘存储层接口设计 (P0)** - 2026-02-06
  - **完成方式**: storage包完整实现并测试
  - **产出物**:
    - [`kernel/vectordb/storage/io.go`](../../kernel/vectordb/storage/io.go) - 接口定义 (282行)
    - [`kernel/vectordb/storage/serialize.go`](../../kernel/vectordb/storage/serialize.go) - 序列化实现 (456行)
    - [`kernel/vectordb/storage/io_mmap_unix.go`](../../kernel/vectordb/storage/io_mmap_unix.go) - Unix mmap实现
    - [`kernel/vectordb/storage/io_mmap_windows.go`](../../kernel/vectordb/storage/io_mmap_windows.go) - Windows mmap实现
    - [`kernel/vectordb/storage/io_buffered_mobile.go`](../../kernel/vectordb/storage/io_buffered_mobile.go) - Mobile缓冲IO
  - **已实现**:
    - `DiskIndexReader` - 只读访问接口 (ReadNode/ReadNeighbors/ReadVector/Warmup)
    - `DiskIndexWriter` - 读写访问接口 (AppendNode/UpdateNeighbors/Sync)
    - `GraphMetadata` - 图索引元数据 (80字节)
    - `GraphHeader` - 文件头 (96字节, 含Magic/Version校验)
    - `DeletedBitmap` - 删除位图 (线程安全)
  - **跨平台方案**:
    - Linux/macOS: mmap零拷贝内存映射
    - Windows: golang.org/x/exp/mmap
    - iOS/Android: 缓冲读取 + LRU缓存

- [x] **Task 2: Vamana图索引结构设计 (P0)** - 2026-02-05
  - **完成方式**: 通过代码实现验证
  - **产出物**:
    - [`kernel/vectordb/vamana/types.go`](../../kernel/vectordb/vamana/types.go) - 核心数据结构
    - [`kernel/vectordb/vamana/index.go`](../../kernel/vectordb/vamana/index.go) - 索引实现
  - **已实现**:
    - `Neighbor` - 邻居节点结构
    - `AdjacencyList` - 定长邻接表 (MaxDegree=128)
    - `EpochSet` - 基于Epoch的访问标记
    - `NeighborPriorityQueue` - 有序数组优先队列
    - `SearchScratch` - 搜索临时空间
    - `Bitset` - 位图实现
    - 图操作接口: `Insert/Delete/Search/Build`

- [x] **Task 3: BBQ量化集成方案设计 (P1)** - 2026-02-05
  - **完成方式**: 设计方案已完成并实现
  - **产出物**:
    - 设计文档: [`docs/设计/Vamana_BBQ集成方案.md`](../设计/Vamana_BBQ集成方案.md)
    - 实现代码: [`kernel/vectordb/vamana/bbq.go`](../../kernel/vectordb/vamana/bbq.go) (470行)
    - 测试代码: [`kernel/vectordb/vamana/bbq_test.go`](../../kernel/vectordb/vamana/bbq_test.go)
  - **已实现功能**:
    - 质心计算 (`computeBBQCentroid`)
    - 并行量化编码 (`computeBBQDataParallel`)
    - BBQ距离计算 (1-bit POPCNT / 4-bit 朴素乘法)
    - 两阶段搜索 (`SearchWithBBQ`)
    - 自动策略选择 (维度≥128使用1-bit)
  - **性能验证**:
    - BBQ召回率: 96-99%
    - SIFT 1M召回率: 99.70%

- [x] **Task 4: 热更新机制设计 (P1)** - 2026-02-05
  - **完成方式**: 软删除机制已实现
  - **产出物**:
    - `Bitset` 位图实现 (types.go)
    - `Delete()` 软删除方法 (index.go)
  - **待后续**: 压缩合并(Compact)功能移至Task 8

- [x] **Task 7: 测试框架设计** - 2026-02-05
  - **完成方式**: 测试已实现并全部通过
  - **产出物**: [`kernel/vectordb/vamana/vamana_test.go`](../../kernel/vectordb/vamana/vamana_test.go)
  - **测试覆盖**:
    - 基本插入搜索、批量构建、召回率验证
    - EpochSet/优先队列/邻接表功能测试
    - 空索引/单点边界测试
    - 距离计算正确性验证
  - **性能验证**: QPS +42%, 构建吞吐量 +12%

---

**文档创建**: 2026-02-05
**最后更新**: 2026-02-06 02:30 (UTC+8)
**父计划**: [`后端向量数据库超大规模数据支持计划.ttt.md`](后端向量数据库超大规模数据支持计划.ttt.md)
