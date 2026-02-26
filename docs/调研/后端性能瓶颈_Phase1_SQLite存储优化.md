# 后端性能瓶颈调研：Phase 1 SQLite 存储优化

## 发现与分析

经过对 `kernel/sql` 目录树（重点文件：`database.go`, `queue.go`, `block_query.go`）的静态抽查，发现以下两处主要性能瓶颈疑似点：

### 1. 事务队列处理 (`queue.go`)
- **现状**：思源在处理异步写入时，使用了内存队列 `operationQueue` 来合并短时间内的多次数据库写操作。虽然有一个 `FlushQueue` 函数进行集中消费，但在遍历 `ops`（操作队列）进行处理时，针对**每一个**具体的操作（`op`）都独立调用了 `beginTx()` 和 `commitTx()`。
- **瓶颈**：这种在同一个 Flush 周期内反复开辟微型事务的方式，完全失去了队列批量提交（Batch Commit）本身用于减少 SQLite I/O 锁开销的设计意义。虽然全局设置了 `_synchronous=OFF` 等在本地存储上比较极端的参数，但大量小事务的开销损耗在长序列或并发频繁时依旧显著。

### 2. 块属性全文扫描 (`block_query.go`)
- **现状**：在检索包含特定属性的块（如 `QueryBookmarkBlocks` 函数）时，SQL 语句直接采用了类似 `SELECT * FROM blocks WHERE ial LIKE '%bookmark=%'` 这种全表前缀模糊匹配或中间匹配模式。
- **瓶颈**：由于 SQLite 的 `LIKE '%...%'` 无法使用 B-Tree 索引，这将导致全表扫描。在笔记库增大（区块数量达数万至数十万计）时，这一查询性能极化衰退。思源虽然建立了 `blocks_fts_case_insensitive`（FTS5全文检索表）和专门的 `attributes` 关联表，但这里的实现却未得到利用。

## 可能解决方案预估

1. **针对长序列写入/并发事务的优化**
   - **重构 `FlushQueue`**：在消费 `operationQueue` 时，改为使用共享的单一事务或大批量多段事务上下文，将（例如）多达 100~500 个 op 打包进同一个 `Tx` 执行后统一 `commitTx()`，以极大减少 SQLite 开启/关闭事务的时间与文件 Lock 次数。
   
2. **针对块属性查询与检索优化的介入**
   - **废弃 LIKE 扫描，强关联从表**：优先利用 `attributes` 表通过 `JOIN` 来执行特定属性的查找任务，而非在主表 `blocks` 上做 `LIKE` 扫描。
   - **JSON1 扩展（可选架构方案**）：对于 `ial` 这种典型的 K-V 字典数据形态，从长远考虑可以将它定义为 SQLite 的内置 JSON 数据，并利用 SQLite built-in 的 `json_extract()` 方法进行基于表达式的索引查询。

*(注：以上均为未触及核心代码重构的静态理论预估点，涉及对事务及索引结构的深度调整需谨慎进行压力测试并验证并发写入争用边界条件。)*
