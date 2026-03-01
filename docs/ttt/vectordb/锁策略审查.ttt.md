# 锁策略优化 (Locking Strategy Optimization)

> **引用**: `kernel/vectordb/architecture/locking-strategy.review.md`
> **状态**: 🟢 进行中
> **优先级**: P0

## 🎯 目标

将 `DiskVamanaIndex` (磁盘版) 的低效全局锁并发模型改造为与 `VamanaIndex` (内存版) 一致的 **Fine-grained locking (细粒度锁)** + **Lock-Snapshot-Unlock** 模式，以解决高并发写入下的性能瓶颈，并为存储层统一铺平道路。

## 🟢 近期计划 (立即执行)

- [ ] **Task 1: 引入节点锁基础设施**
  - 在 `DiskVamanaIndex` 结构体中添加 `nodeLocks []sync.RWMutex`
  - 在 `Open` 和 `initializeForBuild` 中初始化锁数组(与 `NumPoints` 对齐)

- [ ] **Task 2: 改造 Insert 流程 (去全局锁)**
  - 移除 `Insert` 入口处的 `idx.mu.Lock()`
  - 将 `greedySearch` 移出临界区 (无锁读取)
  - 仅在 `appendVectors` 时持有全局锁

- [ ] **Task 3: 改造 addBackEdges (细粒度锁)**
  - 替换 `idx.mu.Lock()` 为 `idx.nodeLocks[neighborID].Lock()`
  - 实现 "Lock -> Read -> Unlock -> Prune -> Lock -> Update" 模式

## 🟡 中期计划 (后续优化)

- [ ] **死锁检测与预防**
  - 引入 Lock Ordering (按 ID 从小到大获取锁)
- [ ] **基准测试回归**
  - 运行真实负载测试验证性能提升

## 🏁 已归档/已完成

- [x] **基准测试与分析 (2026-02-08)**
  - 完成合成基准测试，证实全局锁是主要瓶颈 (Speedup > 3x)
  - 对比 IP-DiskANN 源码，确立 Lock-Snapshot-Unlock 模式的可行性
  - 确认内存版 VamanaIndex 已实现该模式
