# HNSW 构建过程中的最大问题：并发模型崩溃

经过对 `kernel/vectordb/hnsw` 模块的代码审查，发现其构建过程（`Insert`）存在**严重的并发安全问题**，这使得该索引在多线程环境下几乎必然发生数据竞争（Data Races）、Panic 或数据损坏（Lost Updates）。

## 核心问题：错误的锁机制与非原子性更新

HNSW 索引依赖一个全局读写锁 `idx.Mu`，但在关键的构建流程中，锁的使用完全无法保证数据的一致性。

### 1. "检查-即-执行" 竞态 (Check-Then-Act Race) —— 导致邻居丢失

在 `buildHNSWIndex` 方法中，反向连接（双向边）的更新逻辑如下：

```go
// build HNSW Index (Phase 2 loop)
for _, neighbor := range selected {
    // [1] 读取邻居当前的连接列表 (无锁/无保护)
    cachedRecords := idx.GetLevelNeighborRecords(neighbor.ID, level)

    // ... 复制列表并添加当前节点 ...
    
    // [2] 基于旧列表计算新邻居 (耗时操作)
    newNeighbors := idx.selectNeighborsHeuristic(...)
    
    // [3] 写入新列表 (获取全局锁)
    idx.SetLevelNeighbors(neighbor.ID, level, newNeighbors)
}
```

**场景**: 假设线程 A 和线程 B 同时插入节点，且都试图更新同一个节点 `N` 的邻居列表。
1.  线程 A 读取 `N` 的邻居列表（版本 v1）。
2.  线程 B 读取 `N` 的邻居列表（版本 v1）。
3.  线程 A 计算得出新列表 v2（包含 A），并调用 `SetLevelNeighbors` 写入 v2。
4.  线程 B 计算得出新列表 v3（包含 B，但**不包含** A，因为它是基于 v1 计算的），并调用 `SetLevelNeighbors` 写入 v3。

**结果**: 线程 A 的更新被覆盖（Lost Update）。节点 `N` 将无法连接到 A，破坏了图的连通性，严重影响召回率。

### 2. 切片扩容导致的数据竞争 (Slice Resizing Race) —— 导致 Panic

`HNSWIndex` 使用二维切片/三维切片 `[][][]NeighborRecord` 存储图结构。

*   **写操作**: `InitItemNeighbors` 在插入新节点时，会检查容量并对 `idx.Neighbors` 进行 `append` 扩容。
    ```go
    func (idx *HNSWIndex) InitItemNeighbors(docID DocID) int {
        idx.Mu.Lock()
        // ...
        idx.Neighbors = append(idx.Neighbors, nil) // 修改 Slice Header 和底层数组
        idx.Mu.Unlock()
    }
    ```
*   **读操作**: `greedySearch` 和 `searchLevel` 调用 `GetLevelNeighborRecords`，直接读取 `idx.Neighbors`。
    ```go
    func (idx *HNSWIndex) GetLevelNeighborRecords(...) {
        return idx.Neighbors[docID][level] // 没有任何锁保护！
    }
    ```

**场景**: 
1.  线程 A 正在执行 `greedySearch`，读取 `idx.Neighbors`。
2.  线程 B 执行 `InitItemNeighbors`，触发 `append` 导致切片底层数组重新分配（Reallocation）。

**结果**: 典型的 Go Slice Data Race。线程 A 可能读取到旧的底层数组指针（已被回收），或者在切片 Header 更新过程中读取到不一致的状态，直接导致程序 Panic 或读取垃圾内存。

### 3. 全局锁导致的性能瓶颈

即使修复了上述正确性问题，当前的锁策略（`idx.Mu`）也是极度低效的：
*   每次 `SetLevelNeighbors` 都要获取全局锁。
*   一次插入操作需要获取 $L \times M$ 次全局锁。
*   这实际上将并行构建退化为了串行构建，甚至因为锁争用（Lock Contention）导致性能更差。

## 结论

HNSW 实现目前**不支持并发构建**。这是该模块不可用的最大阻碍。

**建议修复方案**:
1.  **细粒度锁**: 废弃全局锁，引入**节点级锁** (Node-level locks)。
    *   `idx.NodeLocks []sync.RWMutex`
    *   在读取或更新特定节点的邻居列表时，仅锁定该节点的锁。
2.  **原子化更新**: 更新邻居列表时，必须在持有写锁的临界区内完成 "读取-计算-写入" 的全过程，或者采用 Copy-On-Write + CAS 策略。
3.  **安全的切片增长**: `idx.Neighbors` 的扩容必须在此期间阻塞所有读取操作，或者预分配足够大的空间以避免运行时扩容。
