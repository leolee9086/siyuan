# VectorDB API 能力差距分析

> 对比主流向量数据库（Qdrant、Milvus、Pinecone、Weaviate）标准化 API，
> 评估 `packages/vectordb` 当前功能面的完整性。

---

## 1. 当前已覆盖 ✅

| 功能 | 入口 | 对标 Qdrant | 对标 Milvus |
|---|---|---|---|
| 创建集合 | `DB.CreateCollectionWithOptions` | `create_collection` | `create_collection` |
| 删除集合 | `DB.DeleteCollection` | `delete_collection` | `drop_collection` |
| 打开集合 | `DB.OpenCollection` | —（集合即存在） | `load_collection` |
| 列出集合 | `DB.ListCollectionStats` | `list_collections` | `list_collections` |
| 插入/更新 | `CollectionHandle.Upsert` | `upsert_points` | `insert`(upsert) |
| 搜索 | `CollectionHandle.Search` | `search_points` | `search` |
| 删除（按ID） | `CollectionHandle.Delete` | `delete_points` | `delete` |
| 取回点 | `CollectionHandle.FetchPoints` | `retrieve_points` | `get` |
| 迭代所有ID | `VectorCollection.ForEachID` / `ListIDs` | `scroll_points` | `query(expr)` |
| 元数据访问 | `GetMetaByID` / `GetVectorByID` | `retrieve` | `query(primary_keys)` |
| 集合统计 | `CollectionHandle.Stats` | `collection_info` | `describe_collection` |
| 持久化 | `CollectionHandle.Flush` | —（自动持久化） | `flush` |
| 重建索引 | `RebuildIndex` | `recreate_index` | `compact` |
| 刷新到磁盘 | `SaveVamanaCollectionState` / `SaveCollection` | — | — |
| 并发安全 | `go test -race` ✅ | 内置 | 内置 |

---

## 2. 关键缺失 🔴（需在本轮补齐）

### 🔴 M1: 搜索无距离/分数过滤

`SearchOptions` 仅支持 `TopK` 和 `EfSearch`，缺失：

```go
type SearchOptions struct {
    TopK           int
    EfSearch       int
    ScoreThreshold float32  // <-- 缺失：仅返回 score > threshold 的结果
    // DistanceThreshold float32  // 可选：仅返回 distance < threshold 的结果
}
```

**必要性**：搜索后过滤比 TopK 更灵活，允许返回"所有比阈值更近"的结果而非固定 K 个。Qdrant `score_threshold`、Milvus `radius` 均为标准用法。

### 🔴 M2: 元数据过滤（filter）

搜索不支持 `Filter` 参数：
```go
type SearchOptions struct {
    // ... 
    Filter map[string]interface{}  // <-- 缺失
}
```

**必要性**：语义搜索的核心需求之一。当前只能搜索后自行过滤。

**影响**：SiYuan 业务侧的语义搜索需要按文档类型、标签过滤。元数据过滤对独立向量数据集也是必须提供的。

### 🔴 M3: Count API

无 `Count(filter)` 方法。

**必要性**：前端分页、统计面板、数据量感知是基本需求。

### 🔴 M4: Batch Search

无 `SearchBatch(queries []float32, opts SearchOptions) ([]SearchResult, error)`。

**必要性**：批量查询复用内部资源（量化和搜索调度），比 N 次独立调用效率高数倍。

---

## 3. 重要但可延后 🟡

| 编号 | 功能 | 优先级 | 说明 |
|---|---|---|---|
| 🟡 M5 | 部分更新（Update Meta Only） | 中 | `UpdateMeta(id, meta)` — 不改向量只改元数据 |
| 🟡 M6 | Scroll/分页 | 中 | 已可通过 `ForEachID` 变通，但无标准 `Scroll(limit, offset)` |
| 🟡 M7 | 快照/备份 | 低 | `CreateSnapshot` / `RestoreSnapshot` |
| 🟡 M8 | 距离度量可配 | 低 | 当前 HNSW 固定 cosine，DiskVamana 固定 Euclidean |
| 🟡 M9 | Context 传播 | 低 | 大规模搜索不可取消 |

---

## 4. 修复方案

### 先补 M1+M2+M3+M4（本周不迟于Phase 3）

**M1+M2（SearchOptions 扩展）**：
```go
type SearchOptions struct {
    TopK     int
    EfSearch int
    ScoreThreshold float32  // M1: 仅返回 score >= threshold 的结果
    // M2: Filter is a post-search metadata filter applied in CollectionHandle.Search
}
```

实现方式：`CollectionHandle.Search` 在拿到结果后，若 `ScoreThreshold > 0` 则截断；若 `Filter` 非空则调用元数据过滤。

**M3（Count）**：
```go
func (h *CollectionHandle) Count() int  // 当前 ItemCount 已隐含
```

**M4（BatchSearch）**：
```go
func (h *CollectionHandle) SearchBatch(queries [][]float32, opts SearchOptions) ([][]SearchResult, error)
```

### 先写测试，再实现

每个缺失功能都必须先有测试再实现代码，与现有规程一致。

---

## 5. 总结

当前 `packages/vectordb` 的 `CollectionAPI` 满足**基本 CRUD** 需求（对标 Qdrant/Pinecone 的 ~60% 常用 API），但缺少标准化**过滤**和**批量**能力。

**建议本轮先补 M1+M2（搜索阈值过滤+元数据过滤）**，这是语义搜索迁移必须的能力。M4（BatchSearch）可在 Phase 2 基准框架建立后补。
