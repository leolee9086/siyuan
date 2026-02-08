# 💩 数据存储的双重人格

> 审阅对象: `kernel/vectordb/vamana/index.go` vs `kernel/vectordb/store.go`
> 严重程度: **Major**

你们有两个完全独立的向量存储实现，而且就在同一个模块里。

1. **`VamanaIndex` (vamana/index.go)**:
   ```go
   type VamanaIndex struct {
       vectors   [][]float32
       // ...
   }
   ```
   这是 `slice of slices`。

2. **`VectorStore` (store.go)**:
   ```go
   type VectorStore struct {
       vectors []float32
       // ...
   }
   ```
   这是 `flattened slice`。

## 为什么这是垃圾？

*   **所有的优化都要写两遍**。你想做 SIMD 优化？写两遍。你想做 quantization？写两遍。
*   **内存浪费**。如果你先把数据加载到 `VectorStore`，然后构建 `VamanaIndex`，你是不是要把数据拷两份？或者你们根本就是两套平行的系统？
*   **API 精神分裂**。HNSW 用 `VectorStore`，Vamana 用自己的 `[][]float32`。这意味着我不能轻易地替换底层的存储引擎。

## 怎么修

选一个，然后坚持用它。

*   如果是内存图，`[][]float32` 更容易扩展（resize），但 `[]float32` (flattened) 缓存更友好且内存碎片更少。
*   鉴于 `store.go` 已经在尝试做 BBQ 量化和扁平化存储，**让 VamanaIndex 使用 VectorStore**。

把 `VamanaIndex.vectors` 删了。换成 `store *VectorStore`。
