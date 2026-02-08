# ♻️ 存储层抽象缺失与架构割裂 (Storage Abstraction Fragmentation)

> 审阅对象: `kernel/vectordb/vamana/index.go`, `store.go`, `storage/` package
> 严重程度: **Major**

目前的 `vectordb` 模块在"如何存储和访问向量与图数据"这个问题上，存在三种截然不同的实现，导致了严重的架构割裂：

1.  **`VamanaIndex` (内存)**: 使用 `vectors [][]float32` 和 `neighbors [][]uint32`。
2.  **`VectorStore` (store.go)**: 使用 `vectors []float32` (flat) 和 BBQ 字段。仅存向量，不存图。
3.  **`DiskVamanaIndex` (磁盘)**: 使用 `storage` 包的 mmap reader，基于**交织存储 (Interleaved Layout)** `[Vector][Neighbors]`。

## 问题分析

之前的审阅觉得应该"删除 `VamanaIndex.vectors` 用 `VectorStore` 代替"，这虽然减少了代码，但**没有解决根本架构问题**。

正如你所指出的（User Input）：**内存全量加载实际上是部分加载（Disk/Mmap）的一个特例**。

目前的架构错失了一个统一抽象的机会：

*   **所有的实现做的都是同一件事**：给定 ID，给我向量；给定 ID，给我邻居。
*   **实现细节却完全隔离**：内存版用 slice of slices，磁盘版用 mmap pointer arithmetic。这导致任何针对一种存储的优化（比如 SIMD 距离计算、BBQ）都很难移植到另一种。
*   **`VectorStore` 的定位尴尬**：它目前是一个"简单的内存向量容器"，但它的 API 和 `DiskIndex` 完全不兼容。

## 改进建议：统一存储抽象

不要仅仅是合并字段，而是应该定义统一的 **Storage Layer** 接口，让"内存模式"和"磁盘模式"互为特例/替代。

### 1. 定义 `GraphStorage` 接口

```go
type GraphStorage interface {
    GetVector(id uint32) []float32
    GetNeighbors(id uint32) []uint32
    NumPoints() uint64
    // ... BBQ 方法 ...
}
```

### 2. 重构实现

*   **`DiskGraphStorage`**: 现有的 `storage.Reader` 适配实现。
*   **`MemoryGraphStorage`**: 
    *   这就是 `VectorStore` 应该演变成的样子。
    *   **关键点**：它可以参考 `storage` 的**交织存储**设计。如果在内存中也使用 `[Vector][Neighbors]` 的扁平布局（哪怕是用 `[]byte` 模拟），那么它就变成了 `DiskGraphStorage` 的一个"Fully Loaded"版本。
    *   这样做的好处是：**序列化/反序列化变成零拷贝**（直接 dump 内存 block 到磁盘）。

### 3. VamanaIndex 的瘦身

`VamanaIndex` 不应该持有数据。它应该持有 `GraphStorage`。

```go
type VamanaIndex struct {
    storage GraphStorage // 既可以是内存的，也可以是 mmap 的
    // ... 算法逻辑 ...
}
```


## 4. 并发与统一 (Concurrency & Unification)

最近关于 **锁策略 (Locking Strategy)** 的研究进一步证实了统一抽象的必要性。

*   **现状**: 内存版 `VamanaIndex` 已经实现了细粒度锁和无锁搜索；磁盘版 `DiskVamanaIndex` 还是全局大锁。
*   **目标**: 我们计划将磁盘版也改造为类似的 "Lock-Snapshot-Unlock" 模式。
*   **合流**: 一旦磁盘版完成了锁改造，两者的逻辑流程（Search -> Prune -> Lock -> Update）将高度趋同。唯一的区别仅在于 **数据访问方式** (Slice vs Mmap)。

此时，引入 `GraphStorage` 接口将水到渠成：

```go
type VamanaIndex struct {
    storage GraphStorage // 屏蔽了 Slice/Mmap 的区别
    // 统一的并发控制逻辑 (LockManager)
}
```

这不仅解决了代码重复，还保证了性能优化（如锁策略、SIMD）能同时惠及内存和磁盘版本。

## 结论

现在的重复不仅仅是代码行数的重复，而是**概念模型的重复**。
请考虑将 `store.go` 重构为符合 `storage` 布局（或接口）的内存实现，从而实现架构上的统一。
当内存布局与磁盘布局一致（交织存储）时，持久化将变得异常简单且高效。

---

## 评审回复 (2026-02-08)

**决定: 部分接受 — 方向正确但时机不对，且存在过度设计风险**

### 事实验证

审阅意见中的核心声明经代码验证：

| 声明 | 验证结果 |
|------|---------|
| `VamanaIndex` 使用 `[][]float32` + `[][]uint32` | ✅ 确认 (`index.go:39,43`) |
| `VectorStore` 使用 flat `[]float32` | ✅ 确认 (`store.go:18`) |
| `DiskVamanaIndex` 使用 mmap reader | ✅ 确认 (`disk_index.go:98`) |
| `VectorStore` 的 API 与 `DiskIndex` 不兼容 | ✅ 确认 |
| `VectorStore` 被 Vamana 使用 | ❌ **错误** — Vamana 包中零引用 |

**关键发现**: `VectorStore` 仅服务于 HNSW 索引（通过 `hnsw_proxy.go:170`），与 Vamana 完全无关。审阅意见将三者并列讨论存在误导。

### 认可的部分

1. **"给定 ID，给我向量/邻居" 是统一抽象的正确切入点** — `DiskIndexReader` 接口 (`storage/io.go:134`) 已经体现了这一思路
2. **内存版与磁盘版 Vamana 的逻辑趋同** — 锁策略审阅已确认两者的 Insert 流程可以统一
3. **`DiskVamanaIndex` 的 `getVector()`/`getNeighbors()` 已经是事实上的内部接口** — 它们透明处理磁盘节点和追加缓冲区

### 不接受的部分

#### 1. 时机不对

审阅意见建议的 `GraphStorage` 接口统一是一个**架构级重构**，但当前有更高优先级的工作：

- **锁策略优化**（已接受）：将 `DiskVamanaIndex.Insert()` 改造为 Lock-Snapshot-Unlock 模式
- 在锁改造完成之前引入存储抽象层，会增加重构的复杂度和风险
- 正确的顺序是：先完成锁改造 → 两版逻辑趋同 → 再提取接口

#### 2. `VectorStore` 不应纳入统一范围

`VectorStore` 服务于 HNSW 索引，与 Vamana 是完全独立的索引实现。将它纳入 `GraphStorage` 统一：

- 会强制 HNSW 和 Vamana 共享存储抽象，但两者的数据访问模式不同（HNSW 无图邻居概念）
- `VectorStore` 的 `ComputeDistance`/`ComputeBBQDistance` 等方法是 HNSW 特有的，不属于图存储抽象

#### 3. 交织存储内存版的收益被高估

审阅建议内存版也使用 `[Vector][Neighbors]` 交织布局以实现"零拷贝序列化"。但：

- 内存版 `VamanaIndex` 的主要用途是**构建阶段**（`Build()`），需要频繁追加和修改邻居列表
- 交织布局下修改邻居列表需要重新分配整个节点块，性能远差于 `[][]uint32`
- "零拷贝序列化"的收益仅在持久化时体现，而构建完成后已有 `SaveToDisk()` 将内存版转为磁盘格式

### 结论

1. **接受** "给定 ID 返回向量/邻居" 作为统一抽象方向
2. **不接受** 现在就实施 `GraphStorage` 接口重构 — 应在锁改造完成后再评估
3. **不接受** 将 `VectorStore` 纳入统一范围 — 它属于 HNSW，不属于图存储
4. **建议** 锁改造完成后，从 `DiskVamanaIndex` 的 `getVector()`/`getNeighbors()` 自然演化出接口，而非自顶向下设计
