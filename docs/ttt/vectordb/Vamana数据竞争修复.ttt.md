# Vamana DATA RACE 修复

## 任务概述

- **任务来源**：并发测试（`disk_concurrent_test.go`）通过 `-race` 检测器发现生产代码中的 DATA RACE
- **适用规程**：`docs/规程/测试与修复/后端Go并发bug修复.procedure.md`

## 问题描述

**核心问题**：`greedySearchForBuild()` 在 `search.go:152` 无锁读取 `idx.neighbors[id]`（slice header），而其他 worker 通过 `addEdgeAndPruneLocked()` 在 `build.go:222/242` 持 nodeLock 写入同一 slice header。

**涉及文件**：

| 文件 | 角色 |
|------|------|
| `kernel/vectordb/vamana/search.go` | `greedySearchForBuild()` 无锁读 |
| `kernel/vectordb/vamana/build.go` | `addEdgeAndPruneLocked()` / `setNeighborsLocked()` 持锁写 |
| `kernel/vectordb/vamana/index.go` | `VamanaIndex` 结构体定义 |

**影响范围**：仅影响 `BuildParallel()` 路径（批量构建阶段），不影响增量 Insert/Delete/Search。

## 任务清单

- [x] 修复 `greedySearchForBuild()` 中 `idx.neighbors[id]` 的无锁读取问题
- [x] 修复 `GetBBQCode()` RWMutex 嵌套读锁死锁（新发现问题）
- [x] 运行 `go test -race` 验证修复
- [x] 运行全量测试确认无回归（并发测试 -race 全部 PASS）

## 进度记录

| 时间 | 状态 | 说明 |
|------|------|------|
| 2026-02-08 | 待开始 | 初始创建 |
| 2026-02-08 | ✅ 已完成 | 全部修复并验证通过 |

### 修复1：DATA RACE — greedySearchForBuild 无锁读 neighbors

- **文件**：`kernel/vectordb/vamana/search.go`
- **策略**：在读取 `idx.neighbors[closest.ID]` 前后添加 `nodeLocks[closest.ID].RLock()/RUnlock()`
- **状态**：✅ 已修复

### 修复2：RWMutex 嵌套读锁死锁 — GetBBQCode

- **文件**：`kernel/vectordb/vamana/disk_index.go`、`kernel/vectordb/vamana/disk_search.go`
- **策略**：将 `GetBBQCode()` 拆分为公共带锁版本 + 内部无锁版本 `getBBQCodeUnlocked()`，搜索路径调用无锁版本
- **状态**：✅ 已修复

### 验证结果

| 测试用例 | 结果 | 耗时 |
|---|---|---|
| TestDiskIndex_ConcurrentInsertAndSearch | ✅ PASS | 50.86s |
| TestDiskIndex_ConcurrentInsertAndDelete | ✅ PASS | 84.67s |
| TestDiskIndex_ConcurrentSearches | ✅ PASS | 22.70s |

全部在 `-race` 标志下通过，无数据竞争检测。

**任务状态：✅ 已完成**
