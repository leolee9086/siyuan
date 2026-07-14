# VectorDB 与常见向量数据库差距分析报告

> 分析范围：`packages/vectordb/` 所有源代码文件  
> 排除领域：标量属性过滤（Scalar Attribute Filtering）  
> 分析前提：所有结论基于代码阅读，无预设假设  
> 版本：v3（新代码审查后更新，2026-07-13）

---

## 总体概述

`packages/vectordb` 是一个嵌入式的向量存储引擎，提供 HNSW（内存）和 DiskVamana（磁盘）两种图索引引擎。

**从上次分析后新增的关键模块：**
| 模块 | 文件 | 功能 |
|------|------|------|
| **Dataset 层** | [`dataset.go`](packages/vectordb/dataset.go), [`dataset_persistence.go`](packages/vectordb/dataset_persistence.go), [`dataset_write.go`](packages/vectordb/dataset_write.go) | 多嵌入、多索引视图数据集的完整抽象 |
| **RRF 融合查询** | [`dataset.go:386-508`](packages/vectordb/dataset.go:386) | 跨索引并行查询 + 加权 RRF 融合 |
| **泛型 HNSW** | [`generic_hnsw.go`](packages/vectordb/generic_hnsw.go) | 非向量距离（编辑距离等）的 HNSW 搜索 |
| **索引运行时添加** | [`dataset_write.go:177-284`](packages/vectordb/dataset_write.go:177) | 不中断查询的前提下添加新 ANN 视图 |
| **事务写** | [`dataset_write.go:19-146`](packages/vectordb/dataset_write.go:19) | 跨集合原子性 + WAL + 恢复 |

---

## 差距分析和改进状态

### 1. [最大差距] 无查询管道（Query Pipeline）和执行模型

**原始状态：架构级缺失 ❌ → 当前状态：部分改进 ✅🟡**

**新增的能力：**

| 能力 | 实现 | 位置 |
|------|------|------|
| **多路并行融合查询** 🔥 | `Dataset.SearchFusion()` 并行执行多索引搜索 + 加权 RRF 合并 | [`dataset.go:386-508`](packages/vectordb/dataset.go:386) |
| **任意距离搜索** 🔥 | `GenericHNSWCollection.Search(queryDistancer)` 支持编辑距离等非向量距离 | [`generic_hnsw.go:93-111`](packages/vectordb/generic_hnsw.go:93) |
| **实体级 meta 注入** | `Dataset.SearchIndex()` 自动附加实体级 meta 到搜索结果 | [`dataset.go:322-384`](packages/vectordb/dataset.go:322) |
| **搜索 Context 传播** | `Dataset.SearchFusion()` 接收 `context.Context` | [`dataset.go:387`](packages/vectordb/dataset.go:387) |

**RRF 融合的工程意义：** 这是 SiYuan 场景中最直接的"查询管道"——将 title 嵌入和 body 嵌入的搜索结果按实体 ID 做 RRF 融合，相当于一个**混合搜索**（Hybrid Search）的初步实现。

**仍缺失的能力：**

| 能力 | 竞争对手支持 | 影响 |
|------|-------------|------|
| 正式查询管道抽象（planner/executor/post-processor） | 全部支持 | 自定义算子组合仍受限 |
| 排序/分页（offset + limit） | 全部支持 | 无法分页展示 |
| 按 ID 查询近邻（search_by_id） | Milvus | 无法"相似内容推荐"交互 |
| 查询 profiling | 多数提供 | 无法诊断慢查询根因 |
| 组合搜索（Dense + Sparse 原生） | Weaviate `hybrid` | 需外部融合 |

**结论：** RRF 融合查询缩小了差距但未解决架构级缺失。`SearchFusion` 是一个重量级的后处理算子，但不是可组合的管道抽象。

---

### 2. [高影响] 无增量索引管理和在线维护

**原始状态：运维级缺失 ❌ → 当前状态：部分改进 ✅🟡**

**新增的能力：**

| 能力 | 实现 | 位置 |
|------|------|------|
| **运行时添加索引视图** 🔥 | `Dataset.AddIndex()` / `AddIndexContext()` 不中断查询，从已有实体构建新的 ANN 视图 | [`dataset_write.go:177-284`](packages/vectordb/dataset_write.go:177) |
| **批量构建优化** | `datasetHNSWIndexBuildBatchSize` 控制读取批大小，避免 OOM | [`dataset_write.go:375-387`](packages/vectordb/dataset_write.go:375) |
| **BBQ 质心预热** | `buildHNSWIndexView` 累加源数据的质心统计量 | [`dataset_write.go:306-328`](packages/vectordb/dataset_write.go:306) |

**仍缺失的能力：**

| 能力 | 竞争对手支持 | 当前状态 |
|------|-------------|---------|
| 在线/渐进式索引合并 | Qdrant `optimizers`, Milvus `compaction` | HNSW `RebuildIndex` 仍是销毁+重建 |
| 索引参数自动调优 | Weaviate 动态 ef | 完全静态配置 |
| 删除空间回收 | 多数支持 LSM-style compaction | 仅标记删除 |

---

### 3. [高影响] 无事务隔离 —— 已显著改进 ✅

**原始状态：正确性级缺失 ❌ → 当前状态：已解决主要问题 ✅**

**新增的事务架构：**

```
Dataset.UpsertEntities()
  ├── lockForWrite()       // 等待索引构建完成
  ├── saveDatasetTransaction()  // 写 pending.msgpack (WAL 前的崩溃安全)
  ├── applyTransactionLocked()
  │   ├── 对每个 Index View 执行 Write()    // 跨集合原子写入
  │   ├── appendDatasetMetaWAL()            // 持久化 meta 变更
  │   ├── 更新内存 metas
  │   ├── 条件 checkpoint（WAL 过大时）
  │   └── removeDatasetTransaction()        // 清除 pending 标记
  └── 返回 DatasetWriteResult
```

| 特性 | 之前 | 现在 |
|------|------|------|
| 跨集合原子写入 | ❌ | ✅ `datasetTransaction` + WAL |
| 崩溃恢复 | ❌ | ✅ `recoverPendingLocked()` 自动重放 |
| 写序列化（线性化） | ⚠️ 单 collection | ✅ dataset 级 sequence |
| 读隔离 | ❌ RLock | 🟡 仍使用 RLock（最终一致） |

**代码位置：**
- [`dataset_write.go:20-53`](packages/vectordb/dataset_write.go:20) - UpsertEntities 事务
- [`dataset_write.go:93-146`](packages/vectordb/dataset_write.go:93) - applyTransactionLocked
- [`dataset_write.go:159-175`](packages/vectordb/dataset_write.go:159) - recoverPendingLocked

---

### 4. [中影响] ID 系统过于简单

**原始状态：能力约束 ❌ → 当前状态：已改进 ✅**

**改进清单：**

| 措施 | 状态 | 位置 |
|------|------|------|
| `freeDocIDs` O(1) 空洞复用 + 持久化 | ✅ 之前已完成 | [`types.go:88`](packages/vectordb/types.go:88) |
| `ErrPointIDInvalid` 拒绝空 ID | ✅ 之前已完成 | [`public.go:38`](packages/vectordb/public.go:38) |
| `ErrCollectionCapacity` 防溢出 | ✅ 之前已完成 | [`public.go:39`](packages/vectordb/public.go:39) |
| 数据集实体级别的 ID 管理 | ✅ 新增 | [`dataset_write.go:435-458`](packages/vectordb/dataset_write.go:435) |
| 跨引擎 ID 契约测试 | ✅ 之前已完成 | [`id_contract_test.go`](packages/vectordb/id_contract_test.go) |

**仍缺：** UUID/ULID 原生支持、自定义 ID 生成器、复合主键。

---

### 5. [中影响] 搜索多样性控制

**原始状态：完全缺失 ❌ → 当前状态：已解决 ✅**

已通过 `SearchOptions.ExcludeIDs` + `GroupBy` + `MaxPerGroup` 解决。  
优化后新增 Entity 级 GroupBy（`Dataset.SearchIndex` 的 `searchResultGroup` 使用实体 meta 分组）。

---

### 6. [中影响] 元数据零解析架构

**原始状态：盲存盲取 ❌ → 当前状态：显著改进 ✅**

**新增能力：**

| 能力 | 实现 | 位置 |
|------|------|------|
| **实体级结构化 meta** 🔥 | `Entity.Meta` 支持标注 key-value 元数据 | [`dataset.go:43-47`](packages/vectordb/dataset.go:43) |
| **meta WAL 独立持久化** | 实体 meta 变更通过独立 WAL 持久化，与向量索引分离 | [`dataset_persistence.go:486-493`](packages/vectordb/dataset_persistence.go:486) |
| **meta checkpoint** | 条件 checkpoint 控制 WAL 大小 | [`dataset_persistence.go:594-606`](packages/vectordb/dataset_persistence.go:594) |
| **多字段 meta 分隔** | 不同 embedding 共享同一实体 meta | [`dataset_write.go:124-134`](packages/vectordb/dataset_write.go:124) |

**但 meta 在 `Point` 层面仍然是 `json.RawMessage`**（不透明 blob），结构化元数据只在 Dataset 层存在。

---

### 7. [低影响] 无批量导入优化

**原始状态：性能约束 ❌ → 当前状态：部分改进 ✅🟡**

**新增能力：**

| 能力 | 实现 | 位置 |
|------|------|------|
| **数据集级别批量导入** | `CreateDataset` 一次初始化多索引视图 | [`dataset_persistence.go:47-144`](packages/vectordb/dataset_persistence.go:47) |
| **HNSW 分块构建** | `datasetHNSWIndexBuildBatchSize` 控制 I/O 和内存 | [`dataset_write.go:375-387`](packages/vectordb/dataset_write.go:375) |
| **流式预热质心** | 分块读取源数据累加 BBQ 质心 | [`dataset_write.go:315-328`](packages/vectordb/dataset_write.go:315) |

**仍缺：** 通用流式导入 API、预构建索引数据格式导入。

---

### 8. [低影响] 无搜索请求上下文传播

**原始状态：可观测性缺失 ❌ → 当前状态：部分改进 ✅🟡**

- ✅ `Dataset.SearchFusion(ctx, ...)` 和 `Dataset.AddIndexContext(ctx, ...)` 支持 Context
- ✅ 写路径 `Write(ctx, ...)` 和 `Checkpoint(ctx)` 已支持 Context
- ❌ `CollectionHandle.Search()` 仍不接收 Context

---

## 优化前后完整对比

| 排序 | 差距领域 | 优化前（v1） | 本次更新后（v3） | 状态 |
|------|---------|-------------|-----------------|------|
| **1** | **无查询管道/执行模型** | ❌ 完全缺失 | 🟡 Fused RRF + 泛型 HNSW + 多索引 | 显著改进但架构级仍未解决 |
| **2** | 无增量索引生命周期 | ❌ 完全缺失 | 🟡 运行时 AddIndex + 批量预热 | 部分改进 |
| **3** | 无事务隔离 | ❌ 完全缺失 | ✅ transaction + WAL + 恢复 | **已解决核心问题** |
| **4** | ID 系统过于简单 | ❌ O(n) 扫描 | ✅ freeDocIDs + 数据集 ID 管理 | 已解决 |
| **5** | 无搜索多样性控制 | ❌ 完全缺失 | ✅ ExcludeIDs + GroupBy | 已解决 |
| **6** | 元数据零解析架构 | ❌ 完全不解析 | ✅ 实体级结构化 meta + WAL | **显著改进** |
| **7** | 无批量导入优化 | ❌ 完全缺失 | 🟡 数据集批量构建 + 分块导入 | 部分改进 |
| **8** | 无 Context 传播 | ❌ 完全缺失 | 🟡 部分路径支持 | 部分改进 |
| **—** | **多嵌入/多索引混合搜索** | ❌ 不存在 | ✅ **全新 Dataset 层** | **新增能力 🎉** |
| **—** | **非向量距离搜索** | ❌ 不存在 | ✅ **GenericHNSWCollection** | **新增能力 🎉** |
| **—** | **跨集合原子写入** | ❌ 不存在 | ✅ **dataset 级 transaction** | **新增能力 🎉** |

---

## 结论

**本次更新后，最大差距仍然是查询管道和执行模型的架构级缺失**，但有以下关键改进：

1. **RRF 多路融合搜索**（`SearchFusion`）的出现，直接解决了混合搜索场景——这是 SiYuan 最可能实际使用的方式（同时查 title 嵌入和 body 嵌入，按实体融合）
2. **事务写入**（`DatasetTransaction` + WAL + 自动恢复）将 vectordb 从"单集合串行写入"推进到"跨集合原子写入"级别，解决了之前正确性层面的核心问题
3. **实体 meta 的独立持久化**使元数据管理从盲存盲取升级为有结构化的 WAL 生命周期——对标 Qdrant 的 payload 系统
4. **运行时添加索引视图**（`AddIndex`）为在线索引维护提供了基础，虽然没有 LSM compaction，但至少可以新增索引而不中断写入

**当前剩余的最大三个差距（按优先级）：**
1. 查询管道架构（Search 仍是硬编码入口，无正式算子接口）
2. 增量索引生命周期（HNSW RebuildIndex 仍是销毁+重建）
3. Search 的 Context 传播（缺失超时和 tracing）
