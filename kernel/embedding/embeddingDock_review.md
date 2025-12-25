# Embedding 前后端接口审查报告

**审查日期**: 2025-12-25
**审查范围**: 
- `app/src/layout/dock/embeddingDock/`
- `app/src/util/embedding/`
- `kernel/embedding/embedding.go`
- `kernel/api/embedding.go`

---

## 一、应该暴露但尚未暴露的接口

### 1.1 `ListDatasets` - 列出所有数据集 ⚠️ 高优先级

| 状态 | 描述 |
|------|------|
| **后端** | ✅ 已实现 `embedding.ListDatasets()` 返回 `[]DatasetInfo` |
| **API** | ❌ 未暴露 `/api/embedding/datasets` 端点 |
| **前端** | ❌ 未调用 |

**影响**: 前端 `embeddingDock.api.ts` 使用 `localStorage` 存储数据集配置，无法获取后端实际的集合状态（如已嵌入数量）。

**建议**: 添加 `/api/embedding/datasets` 端点，返回后端所有 embedding 集合及其状态。

---

### 1.2 `GetEmbeddedBlocksWithModel` - 获取已嵌入块列表 ⚠️ 高优先级

| 状态 | 描述 |
|------|------|
| **后端** | ✅ 已实现 `embedding.GetEmbeddedBlocksWithModel(dataset, model, limit, offset)` |
| **API** | ❌ 未暴露 `/api/embedding/blocks/embedded` 端点 |
| **前端** | ❌ 无法获取已嵌入数量 |

**影响**: 
- `embeddingDock.api.ts` 第 136-140 行 `获取嵌入状态` 中 `embedded: 0` 是硬编码的
- `EmbeddingDock.ts` 第 250 行有 `// TODO: 需要后端 API 直接返回已嵌入数量`

**建议**: 添加 `/api/embedding/blocks/embedded` 端点。

---

### 1.3 `PushAssetsWithVectors` - 前端直推素材向量

| 状态 | 描述 |
|------|------|
| **后端** | ✅ 已实现 `embedding.PushAssetsWithVectors(assets, dataset, model, dimension, force)` |
| **API** | ❌ 未暴露 `/api/embedding/assets/pushWithVectors` 端点 |
| **前端** | ❌ 无法直推素材向量 |

**影响**: 已有 `/api/embedding/blocks/pushWithVectors`，但缺少对应的素材版本。

**建议**: 添加 `/api/embedding/assets/pushWithVectors` 端点，保持一致性。

---

### 1.4 `RequestDeleteCollection` - 删除数据集（两阶段确认）

| 状态 | 描述 |
|------|------|
| **后端** | ✅ 已实现 `embedding.RequestDeleteCollection(collectionType, model)` |
| **API** | ❌ 未暴露 |
| **前端** | ❌ 无法删除后端集合 |

**影响**: 前端只能删除 localStorage 中的配置，无法清理后端向量数据。

**建议**: 添加 `/api/embedding/collections/delete` 端点。

---

## 二、前后端未对齐的情况

### 2.1 `vectorApi.ts` 缺少部分后端接口封装

| 后端 API | vectorApi.ts | 状态 |
|----------|--------------|------|
| `/api/vector/collections/build` | `创建集合` | ✅ |
| `/api/vector/add` | `添加向量` | ✅ |
| `/api/vector/query` | `查询向量` | ✅ |
| `/api/vector/delete` | `删除向量` | ✅ |
| `/api/vector/keys` | `获取所有键` | ✅ |
| `/api/vector/state` | `获取集合状态` | ✅ |
| `/api/vector/rebuild` | `重建索引` | ✅ |
| `/api/vector/collections/delete` | ❌ 缺失 | ⚠️ |

---

### 2.2 `embeddingDock.api.ts` 与后端接口对齐问题

| 功能 | 前端实现 | 后端实现 | 问题 |
|------|----------|----------|------|
| 数据集配置存储 | localStorage | 无持久化接口 | ❌ 不一致：配置无法同步 |
| 获取嵌入状态 | 通过 pending 接口推算 | 有 `ListDatasets` | ❌ 未使用后端接口 |
| 已嵌入数量 | 硬编码 `0` | `GetEmbeddedBlocksWithModel` | ❌ 后端已实现但未暴露 |

---

### 2.3 类型定义不一致

**前端 `IPendingBlock`**:
```typescript
interface IPendingBlock {
    id: string;
    content: string;
    reason: "new" | "outdated";
}
```

**后端 `PendingBlock`**:
```go
type PendingBlock map[string]interface{}  // 包含 SQL 行所有属性
```

**问题**: 后端返回完整的 SQL 行属性（包括 `id`, `content`, `type`, `box`, `path` 等），前端只定义了 3 个字段。虽然 TypeScript 不会报错，但存在类型安全隐患。

**建议**: 前端类型定义应与后端返回结构对齐，或明确说明仅使用部分字段。

---

## 三、其他改进建议

### 3.1 模型信息获取

**当前问题**: 前端硬编码了模型信息：
```typescript
// EmbeddingDock.ts 第 22-23 行
const 默认模型名 = "leolee9086/text2vec-base-chinese";
const 默认模型维度 = 768;
```

**建议**: 
- 调用 `/api/embedding/models` 获取可用模型列表
- 或从 `transformer.ts` 导出模型元信息

---

### 3.2 transformer.ts 每次重新初始化

**当前问题**: `embeddingText` 每次调用都执行 `initTransformerEnv()`，重新加载模型。

```typescript
// transformer.ts 第 227-229 行
let extractor;
try {
    extractor = await initTransformerEnv();  // 每次都初始化
```

**建议**: 缓存已初始化的 `extractor`，避免重复加载模型：
```typescript
let cachedExtractor: any = null;
const getExtractor = async () => {
    if (!cachedExtractor) {
        cachedExtractor = await initTransformerEnv();
    }
    return cachedExtractor;
};
```

---

### 3.3 vectorApi.ts 与 embeddingDock.api.ts 功能重叠

**问题**: 两个文件都有向量/嵌入相关的 API 封装，职责边界不清晰。

**建议**:
- `vectorApi.ts`: 专注于通用向量数据库操作 (`/api/vector/*`)
- `embeddingDock.api.ts`: 专注于嵌入业务逻辑 (`/api/embedding/*`)
- 从 `embeddingDock.api.ts` 中复用 `vectorApi.ts` 的类型和基础方法

---

### 3.4 TODO.md 中标记的待办事项状态

| 待办事项 | 当前状态 |
|----------|----------|
| 添加 `/api/embedding/datasets` 端点 | ❌ 未完成 |
| 添加 `/api/embedding/blocks/embedded` 端点 | ❌ 未完成 |
| 数据集状态显示修复 | ❌ 未完成 |

---

## 四、优先级建议

| 优先级 | 任务 | 预估工作量 |
|--------|------|-----------|
| **P0** | 添加 `/api/embedding/datasets` 端点 | 0.5h |
| **P0** | 添加 `/api/embedding/blocks/embedded` 端点 | 0.5h |
| **P1** | 修复前端 `获取嵌入状态` 使用后端接口 | 1h |
| **P1** | 添加 `/api/embedding/assets/pushWithVectors` 端点 | 0.5h |
| **P2** | 缓存 transformer extractor | 0.5h |
| **P2** | 添加 `/api/embedding/collections/delete` 端点 | 0.5h |
| **P3** | 统一前端类型定义 | 0.5h |
