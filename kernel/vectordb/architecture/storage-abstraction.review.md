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

## 结论

现在的重复不仅仅是代码行数的重复，而是**概念模型的重复**。
请考虑将 `store.go` 重构为符合 `storage` 布局（或接口）的内存实现，从而实现架构上的统一。
当内存布局与磁盘布局一致（交织存储）时，持久化将变得异常简单且高效。
