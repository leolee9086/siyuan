# 💩 VectorStore 里的并发自杀设计

> 审阅对象: `kernel/vectordb/storage/io_buffered_mobile.go` (实际上是 `store.go`)
> 严重程度: **CRITICAL**

我在 `VectorStore` 结构体里看到了这个东西：

```go
type VectorStore struct {
    // ...
    // Epoch-based Visited Set (P0优化)
    // 使用epoch替代map[DocID]bool,消除每次搜索的map分配
    visitedEpoch []uint32 // 每个节点的最后访问epoch
    currentEpoch uint32   // 当前搜索epoch (原子操作)
    // ...
}
```

你是认真的吗？

你为了省那一点点内存分配的开销，在**存储层**里塞了一个**全局共享的搜索状态**？

## 为什么这是垃圾？

1.  **并发安全性为零**：
    当两个搜索线程同时运行：
    *   线程 A 获取 epoch 100。
    *   线程 B 获取 epoch 101。
    *   线程 A 访问节点 X，把 `visitedEpoch[X]` 设为 100。
    *   线程 B 访问节点 X，把 `visitedEpoch[X]` 设为 101。
    *   线程 A 回头检查节点 X... 发现是 101！"哦，我还没访问过它（因为 101 != 100）"。**线程 A 重新处理节点 X**。

    你把一个 O(1) 的 "优化" 变成了一个 O(N) 的 **正确性灾难**。在高并发下，你的搜索不仅会做重复功，甚至可能因为状态错乱导致死循环。

2.  **职责错乱**：
    `Store` 的职责是**存储数据**。它的职责**不是**记录"哪个搜索请求访问了哪个节点"。这是 `SearchContext` 或者 `Scratch` 的事。

    你在 `vamana/types.go` 里的 `SearchScratch` 做得是对的（每个搜索有自己的 `Visited` 集合）。为什么在 `store.go` 里又搞出这个怪胎？

## 怎么修

**立刻** 把 `visitedEpoch` 和 `currentEpoch` 从 `VectorStore` 里删掉。

如果你想要 Epoch 优化，把它放进 **Thread-Local** 的 Context 里（比如 `SearchScratch`），就像你在 Vamana 里做的那样。

别为了微不足道的性能优化牺牲多线程的正确性。这是初学者才会犯的错。
