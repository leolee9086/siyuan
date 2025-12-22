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
| **查询复杂度** | O(log N) | O(N)（但常数极小） |
| **内存占用** | 高（原始向量 + 图结构） | **极低**（1 bit/维度） |
| **插入性能** | 较慢（需更新图） | **极快**（只需量化） |
| **删除支持** | 软删除（你的实现已有） | 天然支持 |
| **增量更新** | 完整支持 | 完整支持 |
| **精度** | 高（可调参） | 略低（4位查询可提升） |
| **实现复杂度** | 中等 | 较高（量化算法复杂） |

### 推荐方案：BBQ

**理由：**

1. **内存优势极大**
   - 1024 维向量：HNSW 需要 4KB，BBQ 只需 128 字节（32x 压缩）
   - 10 万条数据：HNSW 约 400MB，BBQ 约 12.5MB

2. **思源场景适配**
   - 笔记数据量通常 1-10 万条，BBQ 的 O(N) 完全可接受
   - 位运算在现代 CPU 上极快（SIMD 优化后达 GB/s 级别）

3. **已有高质量实现**
   - Rust BBQ 实现成熟，已有 WASM 接口
   - 可直接移植到 Go（位运算逻辑通用）

4. **更简单的持久化**
   - 无图结构，只需存储量化向量 + 修正项
   - msgpack 序列化直接可用

---

## 数据模型

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
  ├── centroid: []float32 (质心向量)
  ├── items: map[string]*Item
  └── config: CollectionConfig

Item (数据项)
  ├── id: string (主键)
  ├── meta: map[string]interface{} (任意元数据)
  └── vectors: map[string]*QuantizedVector (多模型支持)

QuantizedVector (量化向量)
  ├── packed: []uint8 (打包后的二值向量)
  ├── corrections: QuantizationResult (修正项)
  └── modelName: string
```

### 量化修正项

```go
type QuantizationResult struct {
    LowerInterval          float32 // 下界
    UpperInterval          float32 // 上界
    QuantizedComponentSum  float32 // 量化分量和
    AdditionalCorrection   float32 // 附加修正项
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
| `/api/vector/export/json` | POST | 导出数据 |

### 请求/响应示例

#### 创建数据集
```json
POST /api/vector/collections/build
{
    "database": "public",
    "collection_name": "blocks_embedding",
    "dimension": 1024
}
```

#### 添加数据
```json
POST /api/vector/add
{
    "collection_name": "blocks_embedding",
    "vectors": [
        {
            "id": "20231201120000-abc1234",
            "meta": { "box": "notebook1", "type": "paragraph" },
            "vector": {
                "text-embedding-3-small": [0.1, 0.2, ...]
            }
        }
    ]
}
```

#### 向量查询
```json
POST /api/vector/query
{
    "collection_name": "blocks_embedding",
    "vector_name": "text-embedding-3-small",
    "vector": [0.1, 0.2, ...],
    "limit": 10,
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
├── quantizer.go        # 标量量化器（BBQ 核心）
├── scorer.go           # 二值量化评分器
├── bitwise.go          # 位运算（SIMD 优化）
├── persistence.go      # msgpack 持久化
└── api.go              # HTTP API 路由
```

---

## 实现计划

### 阶段 1：核心数据结构 (1-2天)
- [ ] 定义 Go 数据结构（Item, Collection, Database）
- [ ] 实现 msgpack 序列化/反序列化
- [ ] 参考：`toread/rust-bbq/quantized_index.rs`

### 阶段 2：BBQ 算法移植 (2-3天)
- [ ] 移植 `optimized_scalar_quantizer.rs` → `quantizer.go`
- [ ] 移植 `binary_quantized_scorer.rs` → `scorer.go`
- [ ] 移植 `bitwise_dot_product.rs` → `bitwise.go`
- [ ] 实现 SIMD 优化（可选，使用 Go 汇编或 math/bits）

### 阶段 3：存储与索引 (1-2天)
- [ ] 实现 Collection CRUD
- [ ] 实现质心计算与更新
- [ ] 实现增量数据持久化

### 阶段 4：API 层 (1天)
- [ ] 注册 HTTP 路由
- [ ] 实现查询过滤语法解析
- [ ] 添加并发安全

### 阶段 5：测试与验证 (1天)
- [ ] 单元测试（量化精度、搜索召回率）
- [ ] 性能基准测试
- [ ] 与现有 TS 实现对比验证

---

## 验证计划

### 单元测试

```bash
cd kernel
go test ./vectordb/... -v
```

### 精度验证
- 使用相同的测试向量集
- 对比 Go 实现与 Rust BBQ 的量化结果
- 召回率目标：>95% (Top-10)

### 性能基准
- 10 万条 1024 维向量
- 目标：查询延迟 < 10ms

---

## 参考资源

- TS HNSW 实现：`toread/src/vector.optimized.ts`
- Rust BBQ 实现：`toread/rust-bbq/`
- 现有数据库路由：`toread/database/router.js`
- 现有数据集实现：`toread/database/localDataBase/collection.js`

---

## 更新日志

- 2025-12-23: 初稿，确定 BBQ 为首选方案
