# 思源笔记向量数据库设计文档

## 概述

本文档定义了思源笔记 Go 核心中通用向量数据库的设计方案。

## 核心设计原则

1. **通用性** - 不绑定 block，支持任意业务数据（块、插件、临时数据）
2. **多数据库** - 支持多个独立的数据库实例（public、plugin、temp）
3. **多数据集** - 每个数据库支持多个 Collection
4. **多向量字段** - 一个数据项可以有多个 embedding（不同模型生成的）
5. **混合查询** - 支持向量搜索 + 标量过滤

---

## 算法选型分析

### HNSW vs BBQ 对比

| 维度 | HNSW | BBQ |
|------|------|-----|
| **算法类型** | 图索引（近似最近邻） | 二值量化（暴力搜索） |
| **查询复杂度** | O(log N) | O(N) |
| **内存占用** | 高（原始向量 + 图） | 极低（1 bit/维度） |
| **插入性能** | 中等（更新图结构） | 快（只需量化） |
| **删除支持** | ✅ 软删除成熟 | ⚠️ 质心漂移问题 |
| **动态增删** | ✅ **天然支持** | ⚠️ 需定期重建 |
| **精度** | 高（可调参） | 中等 |

### 推荐方案：HNSW

> [!IMPORTANT]
> 基于笔记数量的动态性（频繁增删），选择 HNSW 作为主方案。

**理由：**

1. **动态场景友好**
   - 增量插入直接更新图，无需重建
   - 软删除只需标记，搜索时跳过
   - 无全局质心依赖，局部更新即可

2. **已有高质量实现**
   - TS 版本 `toread/src/vector.optimized.ts` 已完整实现
   - 包含删除功能、MidiHeap 优化、epoch 访问标记等
   - 可直接移植到 Go

3. **内存可接受**
   - 10 万条 1024 维：约 400-600MB
   - 对于本地笔记软件完全可行

---

## 数据模型

### 邻接表方案

> [!TIP]
> 采用邻接表方案而非数组索引，可以天然支持 ID 直接访问、真删除、以及未来扩展图数据查询。

### 数据库层级

```
VectorStorage (根)
  ├── public   → /data/public/vectorStorage
  ├── plugin   → /data/storage/petal/.../vectorStorage
  └── temp     → /temp/vectorStorage

Database (数据库)
  └── collections: map[string]*Collection

Collection (数据集)
  ├── name: string
  ├── dimension: int
  ├── items: map[string]*Item (ID → Item)
  ├── hnswLevelMap: map[string]map[int][]string (模型名 → 层级 → ID列表)
  └── config: CollectionConfig

Item (数据项)
  ├── id: string (主键，如 "20231201120000-abc1234")
  ├── meta: map[string]interface{} (任意元数据)
  ├── vectors: map[string][]float32 (模型名 → 原始向量)
  └── neighbors: map[string][]LevelData (HNSW邻接表)
```

### HNSW 邻接表结构

```go
// 每个 Item 内嵌的邻接表结构
// neighbors["text-embedding-3-small_hnsw"] = []LevelData

type LevelData struct {
    Type  int              // 层级编号 (0, 1, 2, ...)
    Items []NeighborRecord // 邻居列表
}

type NeighborRecord struct {
    ID       string  // 邻居 ID
    Distance float32 // 预计算的距离（可选）
}
```

### 层级映射结构

```go
// 用于快速查找每个层级有哪些节点
// hnswLevelMap["text-embedding-3-small"][2] = ["id1", "id2", ...]

type HNSWLevelMap map[string]map[int][]string
```

### 邻接表方案优势

| 特性 | 邻接表方案 | 数组索引方案 |
|------|------------|--------------|
| **删除操作** | ✅ 真删除，无墓碑 | ⚠️ 需墓碑标记 |
| **ID 访问** | ✅ 直接用块 ID | ⚠️ 需维护 ID↔索引映射 |
| **邻居重计算** | ✅ 删除后可重连 | ⚠️ 墓碑累积影响性能 |
| **扩展性** | ✅ 可复用于知识图谱 | ❌ 仅限向量搜索 |
| **内存碎片** | ✅ map 自动管理 | ⚠️ 可能产生空洞 |

type HNSWConfig struct {
    M               int     // 每层最大邻居数
    EfConstruction  int     // 构建时候选列表大小
    EfSearch        int     // 搜索时候选列表大小
    MaxLevel        int     // 最大层级数
    MetricType      string  // "cosine" 或 "l2"
}
```

---

## API 设计

### 基础端点

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/vector/collections/build` | POST | 创建数据集 |
| `/api/vector/add` | POST | 添加/更新数据 |
| `/api/vector/delete` | POST | 删除数据 |
| `/api/vector/query` | POST | 向量搜索 |
| `/api/vector/scalarQuery` | POST | 标量查询 |
| `/api/vector/keys` | POST | 获取主键列表 |
| `/api/vector/state` | POST | 获取状态 |
| `/api/vector/rebuild` | POST | 重建索引（清理墓碑） |

### 请求/响应示例

#### 向量查询
```json
POST /api/vector/query
{
    "collection_name": "blocks_embedding",
    "vector_name": "text-embedding-3-small",
    "vector": [0.1, 0.2, ...],
    "limit": 10,
    "ef_search": 100,
    "filter_before": "meta.box == 'notebook1'"
}
```

---

## 文件结构

```
kernel/vectordb/
├── DESIGN.md           # 本文档
├── storage.go          # 存储层（多数据库管理）
├── database.go         # 数据库实现
├── collection.go       # 数据集实现
├── hnsw.go             # HNSW 索引核心算法
├── heap.go             # BinaryHeap + MidiHeap
├── distance.go         # 距离计算（cosine/l2）
├── persistence.go      # msgpack 持久化
└── api.go              # HTTP API 路由
```

---

## 实现计划

### 阶段 1：核心数据结构 (1天)
- [ ] 定义 Go 数据结构（Item, Collection, Database, LevelData, NeighborRecord）
- [ ] 实现 msgpack 序列化/反序列化
- [ ] 参考：`toread/database/localDataBase/collection.js`

### 阶段 2：HNSW 邻接表版移植 (2天)
- [ ] 移植 `hnswlayers/build.js` → `hnsw_build.go`（插入逻辑）
- [ ] 移植 `hnswlayers/query.js` → `hnsw_query.go`（搜索逻辑）
- [ ] 移植 `hnswlayers/utils.js` → `hnsw_utils.go`（层级管理）
- [ ] 移植最小堆实现 → `heap.go`
- [ ] 实现距离计算（余弦距离 + 预计算范数）

### 阶段 3：删除与重建 (1天)
- [ ] 移植 `hnswlayers/build.js` 中的删除逻辑
- [ ] 实现邻居重计算（删除后修复图连通性）
- [ ] 实现层级映射维护

### 阶段 4：存储层 (1天)
- [ ] 实现 Collection CRUD
- [ ] 实现增量数据持久化（分片存储）
- [ ] 参考：`toread/database/localDataBase/workspaceAdapters/`

### 阶段 5：API 层 (1天)
- [ ] 注册 HTTP 路由
- [ ] 实现查询过滤语法解析
- [ ] 添加并发安全

### 阶段 6：测试与验证 (1天)
- [ ] 单元测试（插入、搜索、删除）
- [ ] 与 JS 实现对比验证召回率
- [ ] 性能基准测试

---

## 验证计划

### 单元测试
```bash
cd kernel
go test ./vectordb/... -v
```

### 召回率验证
- 使用相同的测试向量集对比 Go 与 JS 实现
- 目标：Top-10 召回率 > 95%

### 性能基准
- 10 万条 1024 维向量
- 目标：查询延迟 < 5ms

---

## 参考资源

### 邻接表版 HNSW（主要参考）
- 索引构建：`toread/database/localDataBase/hnswlayers/build.js`
- 索引查询：`toread/database/localDataBase/hnswlayers/query.js`
- 层级工具：`toread/database/localDataBase/hnswlayers/utils.js`
- 入口选择：`toread/database/localDataBase/hnswlayers/entry.js`
- 邻接表 CRUD：`toread/database/localDataBase/neighbors/crud.js`

### 高性能 HNSW（性能优化参考）
- 优化版本：`toread/src/vector.optimized.ts`
- 堆实现：`toread/src/binary-heap.ts`, `toread/src/midi-heap.ts`

### 数据库架构
- 路由设计：`toread/database/router.js`
- 数据集实现：`toread/database/localDataBase/collection.js`
- 数据库入口：`toread/database/localDataBase/index.js`

---

## 更新日志

- 2025-12-23: 初稿，基于动态增删需求确定 HNSW 为首选方案
- 2025-12-23: 采用邻接表方案，参考 `localDataBase/hnswlayers/` 实现
