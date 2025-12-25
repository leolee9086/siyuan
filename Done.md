# Embedding 模块 - 已完成工作

> 本文档记录思源笔记嵌入模块已完成的开发工作，从 [TODO.md](file:///d:/dev/siyuan-note/TODO.md) 归档。

---

## 一、前端 EmbeddingDock 实现

### 1.1 基本框架 ✅

**文件结构已创建**：

```
app/src/layout/dock/embeddingDock/
├── EmbeddingDock.ts       # 主组件
├── DatasetItem.ts         # 数据集列表项
├── embeddingDock.api.ts   # API 封装
└── embeddingDock.util.ts  # 工具函数
```

**核心接口定义**：

```typescript
// 数据集配置
interface IEmbeddingDataset {
    id: string;
    title: string;
    icon: string;
    type: "dynamic" | "static";
    target: string | string[];  // SQL 或 ID 列表
    model: string;
    scopeVersion: number;
    embedMode?: "incremental" | "full";
}

// 数据集状态
interface IDatasetStatus {
    embedded: number;
    pending: number;
    lastRefresh?: Date;
}
```

### 1.2 已解决的问题

| 问题 | 解决方案 |
|------|----------|
| Dock 图标不显示 | 更新 `dock.guard.ts` 和 `dock.button.ts` 类型白名单 |
| DOM 结构/样式异常 | 重构 `EmbeddingDock.ts` 并注入内联 CSS |
| 嵌入模式选择 | 嵌入按钮改为 Split Button，支持增量/全量模式 |
| 数据集状态显示 | 连接后端 `/api/embedding/blocks/embedded` 接口 |

---

## 二、后端 API 端点

### 2.1 已实现的端点

| API 端点 | 功能 | 文件位置 |
|---------|------|----------|
| `/api/embedding/datasets` | 获取所有数据集列表及状态 | `kernel/api/embedding.go` |
| `/api/embedding/blocks/embedded` | 获取已嵌入块列表 | `kernel/api/embedding.go` |
| `/api/embedding/blocks/pending` | 获取待嵌入块（支持 `force` 参数） | `kernel/api/embedding.go` |
| `/api/embedding/assets/pushWithVectors` | 前端直推素材向量 | `kernel/api/embedding.go` |
| `/api/embedding/collections/delete` | 删除集合（两阶段确认） | `kernel/api/embedding.go` |

### 2.2 已实现的核心函数

| 函数 | 位置 | 功能 |
|------|------|------|
| `GetBlocksCollectionNameWithDataset` | `kernel/embedding/embedding.go` | 生成专用数据集集合名 |
| `GetAssetsCollectionNameWithDataset` | `kernel/embedding/embedding.go` | 生成素材数据集集合名 |
| `ListDatasets` | `kernel/embedding/embedding.go` | 列出所有 embedding 专用数据集 |
| `GetEmbeddedBlocksWithModel` | `kernel/embedding/embedding.go` | 获取已嵌入块列表 |
| `GetPendingBlocksWithModel` | `kernel/embedding/embedding.go` | 支持 `force` 参数强制重新嵌入 |
| `determineBlockPendingReason` | `kernel/embedding/embedding.go` | 判断块 pending 原因（重构自深层 if-else） |
| `EnsureCollectionWithMeta` | `kernel/embedding/embedding.go` | 创建集合时自动设置元数据 |

### 2.3 集合级别元数据

`CollectionMeta` 结构：

```go
type CollectionMeta struct {
    Model   string `json:"model"`
    Dataset string `json:"dataset"`
    Type    string `json:"type"`    // "blocks" | "assets"
    Created string `json:"created"`
    Updated string `json:"updated"`
}
```

---

## 三、前端嵌入支持（Transformer.js）

### 3.1 已实现

- **模型**：`leolee9086/text2vec-base-chinese`（768 维）
- **加速**：WebGPU（自动回退 WASM）
- **量化**：使用 `model_quantized` 减小体积
- **缓存**：extractor 单例缓存，避免重复加载模型

**使用方式**：

```typescript
import { embeddingText } from "./transformer";
const vector = await embeddingText("你好世界"); // Float32Array[768]
```

---

## 四、VectorDB 基础能力

### 4.1 已有 API

`app/src/util/embedding/vectorApi.ts` 提供：

- `创建集合` / `createCollection`
- `添加向量` / `addVectors`
- `查询向量` / `queryVectors`
- `获取集合状态` / `getCollectionState`
- `重建索引` / `rebuildIndex`
- `删除集合` / `deleteCollection`
- `获取待嵌入块` / `getPendingBlocks`
- `获取已嵌入块` / `getEmbeddedBlocks`
- `列出数据集` / `listDatasets`

---

## 更新日志

- 2025-12-25 18:00: 从 TODO.md 归档已完成内容
- 2025-12-25 17:42: 实现重新嵌入功能（Split Button + force 参数）
- 2025-12-25 17:10: 前后端接口完善（4 个新 API 端点）
- 2025-12-24 18:42: 后端核心函数实现（ListDatasets、GetEmbedded 等）
- 2025-12-24 01:21: 修复 Dock 图标与视觉样式
- 2025-12-24 01:03: EmbeddingDock 初步实现
