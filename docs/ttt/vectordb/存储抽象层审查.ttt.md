# 存储层抽象与架构统一 (Storage Abstraction & Unification)

> **引用**: `kernel/vectordb/architecture/storage-abstraction.review.md`
> **状态**: 🟡 待启动
> **优先级**: P1

## 🎯 目标

通过定义统一的 `GraphStorage` 接口，屏蔽内存 (`[][]T`) 与磁盘 mmap 自定义结构的数据访问差异，使 `VamanaIndex` 能够作为统一的泛型实现，消除 `DiskVamanaIndex` 中的重复算法逻辑。

## ℹ️ 如何维护此文档

1. **完成归档**: 任务完成后,**必须**剪切粘贴到【已归档】列表,并打上 `[x]` 和日期。
2. **补充弹药**: 当【近期计划】空了,从【中期计划】里挑选任务挪上去。
3. **因地制宜**: 如果发现计划不合理,随时修改或删除。
4. **数据驱动**: 用数据说话,不凭感觉。


## 🟢 近期计划 (待锁优化完成后启动)

- [ ] **Task 1: 定义 GraphStorage 接口**
  - 位置: `kernel/vectordb/storage/graph.go`
  - 方法: `GetVector`, `GetNeighbors`, `SetNeighbors`, `NumPoints`

- [ ] **Task 2: 实现 MemoryGraphStorage**
  - 封装现有的 `vectors [][]float32` 和 `neighbors [][]uint32`

## 🟡 中期计划 (架构迁移)

- [ ] **Task 3: 改造 VamanaIndex**
  - 替换内部字段为 `GraphStorage` 接口
  - 适配所有 CRUD 操作

- [ ] **Task 4: 合并 DiskVamanaIndex**
  - 实现 `DiskGraphStorage` (基于现有的 storage.Reader)
  - 废弃 `DiskVamanaIndex` 独立结构体，统一使用 `VamanaIndex`

## 🏁 已归档/已完成

- [x] **可行性评估 (2026-02-08)**
  - 确认在锁策略统一后，存储抽象是消除冗余的最佳路径
  - 决定采用 interface 抽象而非简单的 struct 合并
