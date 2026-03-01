# 磁盘索引写操作性能优化 (Disk Write Performance Optimization)

> **创建日期**: 2026-02-08
> **状态**: 🟡 进行中
> **优先级**: P0

## 🎯 问题描述

DiskVamanaIndex 增量操作测试中写操作性能异常，具体数据如下：

| 测试用例 | 操作描述 | 总耗时 | 异常点 |
| :--- | :--- | :--- | :--- |
| TestDiskIndex_Insert | 插入 100 个向量 | 2.48s | 相对正常，但对磁盘索引略慢 |
| TestDiskIndex_Delete | 删除 500 个节点 | 24.55s | 极慢 (约 49ms/个) |
| TestDiskIndex_Compact | 整理 (Compact) | 27.12s | 极慢 |
| TestDiskIndex_InsertDeleteCycle | 插入/删除循环 | 25.18s | 受删除操作拖累 |

**推测瓶颈**：
- 图修复代价：全图扫描移除入边 O(N)
- I/O 瓶颈：低效文件重写
- 锁粒度问题（与锁策略审查任务有交集）

## 🟢 任务阶段

- [x] **Task 1: 性能瓶颈诊断** ✅ 2026-02-08
  - profiling 分析 + 代码审查
  - 定位 Delete / Compact 的热点路径
  - 诊断摘要见下方「诊断结果」章节

- [x] **Task 2: 制定优化方案** ✅ 2026-02-08
  - 基于诊断结果设计针对性优化策略
  - 优化方案见下方「优化方案」章节

- [-] **Task 3: 实施优化**（部分完成）
  - [x] A1: Delete 向量缓存 ✅
  - [x] A2: Compact 优化（跳过 BBQ 重量化 + oldToNew slice 化）✅
  - [x] A4/A5: 合并至 A2 一并完成 ✅
  - [ ] A3: ReadVector 零拷贝 — 跳过，profile 显示收益有限（~6%）
  - [ ] B1: Delete 锁降级 — 记录为后续任务

- [x] **Task 4: 验证优化效果** ✅ 2026-02-08
  - CPU profile 验证完成，见下方「验证结果」章节

## 🔍 诊断结果 (Task 1)

### Delete 操作（49ms/个，500个共24.55s）

| 严重度 | 瓶颈 | 说明 |
| :---: | :--- | :--- |
| 🔴 | 全局写锁串行化 | 整个6步算法在 `idx.mu.Lock()` 下执行，阻止并发 |
| 🔴 | GreedySearch 随机读 | 每次删除执行 GreedySearch（深度128），约200+次 mmap 随机读 |
| 🟠 | closestCFromCandidates 向量读取 | 每次删除约4200次向量读取，500次删除共210万次 |
| 🟠 | robustPruneSimple 遮挡检查 | O(R²) 复杂度 |
| 🟡 | getVector 内存分配 | 每次分配新 slice，产生 GC 压力 |
| 🟡 | ReadVector 逐元素解码 | 未用零拷贝方式 |

### Compact 操作（27.12s）

| 严重度 | 瓶颈 | 说明 |
| :---: | :--- | :--- |
| 🔴 | 全量 BBQ 重新量化 | 即使原始 BBQ 数据已存在，仍全量重新读取+量化 |
| 🟠 | oldToNew 使用 map | 640K次哈希查找，应改用 slice（连续ID空间） |
| 🟠 | 两次 fsync | Windows 上可能数秒 |
| 🟡 | serializeNode 逐元素编码 | 未批量处理 |

## 📋 优化方案 (Task 2)

### 批次A：低风险高收益（预期 Delete 提速 3-5x）

| 编号 | 优化项 | 目标 |
| :--- | :--- | :--- |
| A1 | getVector 向量缓存/对象池 | 消除重复 mmap 读取和内存分配 |
| A2 | computeDistanceToQuery 中 query 范数缓存 | 消除重复计算 |
| A3 | ReadVector 零拷贝优化 | 对齐 ReadNeighbors 的实现方式 |
| A4 | Compact 中 oldToNew 改用 slice | 连续ID空间，消除哈希开销 |
| A5 | Compact 跳过不必要的 BBQ 重新量化 | 直接复制已有 BBQ 数据 |

### 批次B：中等风险中等收益（预期 Delete 再提速 2-3x）

| 编号 | 优化项 | 目标 |
| :--- | :--- | :--- |
| B1 | Delete 锁降级为 Lock-Snapshot-Unlock 模式 | 参照 Insert 实现，减少锁持有时间 |
| B2 | 批量删除接口 | 多个删除共享一次 GreedySearch 结果 |

### 批次C：架构级优化（长期）

| 编号 | 优化项 | 目标 |
| :--- | :--- | :--- |
| C1 | 延迟删除（标记删除+后台合并） | 削除实时删除开销 |
| C2 | 反向邻接索引 | 消除入边搜索 |

## 🔬 验证结果 (Task 4)

### 耗时对比

| 测试用例 | 基线 | 优化后 | 提升 |
| :--- | :--- | :--- | :--- |
| TestDiskIndex_Delete | 24.55s | 16.24s | ↓34% |
| TestDiskIndex_Compact | 27.12s | 17.81s | ↓34% |

### CPU 热点分析

- `dotProduct()` 占 63-68% CPU，是当前绝对瓶颈
- `getVector`/`ReadVector` 已降至 ~6%，I/O 不再是瓶颈
- `writeCompactedBBQFile` 已不在热点中

## 📌 后续优化方向

- **dotProduct SIMD 加速**（独立课题，当前绝对瓶颈）
- **robustPruneCore 距离缓存**（减少重复距离计算）
- **Delete 锁降级为 Lock-Snapshot-Unlock**（并发场景优化）
- **延迟删除 + 后台合并**（架构级优化）

## 📎 关联文档

- `docs/规程/性能优化/性能优化.procedure.md` — 适用规程
- `docs/ttt/vectordb/locking-strategy-review.ttt.md` — 锁策略审查（有交集）
- `kernel/vectordb/vamana/disk_incremental.review.md` — 算法正确性审阅
- `kernel/vectordb/vamana/disk_incremental.go` — 核心实现
- `kernel/vectordb/vamana/disk_incremental_test.go` — 测试文件
- `kernel/vectordb/vamana/disk_index.go` — 磁盘索引主文件
