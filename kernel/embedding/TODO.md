# Embedding 模块开发计划

## 概述

本计划涵盖思源笔记嵌入模块的完整实现路线，包括**块嵌入**、**素材嵌入（Assets）**和**前端数据集管理**三大部分。

> [!IMPORTANT]
> **核心设计原则**：
> 1. 块嵌入和素材嵌入都需要考虑**文本分割**问题
> 2. 采用**手动订阅**模式，用户完全控制嵌入范围
> 3. 支持**多数据集**，直接复用 CustomLists 的配置模式

---

## 零、数据集范围配置设计

### 0.1 设计原则

> [!CAUTION]
> **不采用自动全量嵌入**，避免隐私泄露和资源浪费。

### 0.2 复用 CustomLists 配置模式

直接复用 `CustomLists.ts` 中的 `ICustomList` 结构：

```typescript
interface ICustomList {
    id: string;
    title: string;
    icon: string;
    type: "dynamic" | "static";
    target: string | string[];  // dynamic: SQL/搜索配置, static: ID列表
}
```

**对应数据集配置**：

| 类型 | target 含义 | 范围更新方式 |
|------|-------------|--------------|
| `static` | `string[]` ID 列表 | 手动添加/移除 |
| `dynamic` | SQL 查询 或 搜索配置 JSON | 手动刷新更新（见 0.6 节）|

### 0.3 后端修改说明

#### 现有问题

`GetPendingBlocksWithModel` 目前从**全量数据**对比：

```go
// 现有逻辑（需修改）
// 1. 查询所有块
// 2. 对比已嵌入集合
// 3. 返回差集
```

#### 需要修改为

`GetPendingBlocksWithDataset(datasetConfig)` 从**指定范围**对比：

```go
// 新逻辑
// 1. 根据 datasetConfig.Type 决定范围：
//    - static: 直接使用 ManualIDs
//    - dynamic: 执行 SQL/搜索查询获取 ID 列表
// 2. 对比已嵌入集合
// 3. 返回差集
```

**需要修改的函数**：
- `kernel/embedding/embedding.go`
  - `GetPendingBlocksWithModel` → `GetPendingBlocksWithDataset`
  - `GetPendingAssets` → `GetPendingAssetsWithDataset`
  - `PushBlocksWithModel` → 需要传入 dataset 信息记录到 meta

### 0.4 范围变更 → 索引重建策略

> [!WARNING]
> 当数据集范围配置变更时，可能需要**强制重建索引**。

#### 场景分析

| 变更类型 | 处理策略 |
|----------|----------|
| static 新增 ID | 增量嵌入新增的 ID |
| static 移除 ID | 从索引中删除对应向量 |
| dynamic 查询变更 | **调用 RebuildIndex()** 重建 HNSW 图，保留向量数据 |
| 切换 static ↔ dynamic | **调用 RebuildIndex()** 重建 HNSW 图 |

#### 实现方案

```go
// DatasetConfig 扩展
type DatasetConfig struct {
    ID          string   `json:"id"`
    Title       string   `json:"title"`
    Type        string   `json:"type"`   // "static" | "dynamic"
    Target      any      `json:"target"` // string[] | string
    Model       string   `json:"model"`
    
    // 范围版本号，每次修改范围配置时递增
    // 用于判断是否需要强制重建
    ScopeVersion int     `json:"scopeVersion"`
}

// 重建判断逻辑
func ShouldRebuildIndex(oldConfig, newConfig DatasetConfig) bool {
    // 1. dynamic 类型的 target 变更 → 重建
    if oldConfig.Type == "dynamic" && newConfig.Type == "dynamic" {
        if oldConfig.Target != newConfig.Target {
            return true
        }
    }
    // 2. 类型切换 → 重建
    if oldConfig.Type != newConfig.Type {
        return true
    }
    // 3. 模型变更 → 重建
    if oldConfig.Model != newConfig.Model {
        return true
    }
    return false
}
```

#### 重建流程

1. 检测到需要重建 → 弹窗确认（可能耗时较长）
2. 调用 `Collection.RebuildIndex()` 重建 HNSW 图索引
   - 收集所有有效向量数据（跳过已删除）
   - 清空 HNSW 图结构
   - 重新插入所有有效数据点
3. 如果有新 pending 块，继续执行嵌入任务

### 0.6 动态数据集 Pending 机制

> [!IMPORTANT]
> 动态数据集**不会实时更新范围**，但**已嵌入块修改后应立刻变为 pending**。

#### 核心行为

| 场景 | 行为 |
|------|------|
| 范围刷新 | **手动触发**：用户点击刷新按钮才执行 SQL 获取新范围 |
| 已嵌入块被修改 | **立刻 pending**：下次获取 pending 列表时应返回 |
| 新块进入查询范围 | **等待刷新**：只有刷新后才会加入 pending 列表 |
| 上一次刷新 | 提供按钮复用上次的查询结果，不重新执行 SQL |

#### GetPendingBlocks 逻辑改造

```
┌─────────────────────────────────────────────────────────┐
│              GetPendingBlocks 改造方案                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  refresh=false（默认）:                                  │
│  1. 从 vectordb 获取该 dataset 已嵌入的所有块 ID        │
│  2. 对比块的当前 content hash 与存储的 hash             │
│  3. hash 不同 → pending (原因: outdated)                │
│                                                         │
│  refresh=true :                                         │
│  1. 执行 datasetConfig.Target 中的 SQL/搜索查询        │
│  2. 查询结果 - 已嵌入 = pending (原因: new)             │
│  3. 同时检查已嵌入块的 hash 变化                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### 需要的后端函数

```go
// GetOutdatedBlocks 获取已嵌入但内容已过期的块
// 无需执行 SQL 查询，直接对比已嵌入数据
func GetOutdatedBlocks(dataset, model string, limit int) ([]PendingBlock, int)

// GetPendingBlocksWithRefresh 支持 refresh 参数
func GetPendingBlocksWithRefresh(
    dataset string, 
    model string, 
    limit int, 
    refresh bool, 
    datasetConfig *DatasetConfig,
) ([]PendingBlock, int)
```

#### API 变化

`/api/embedding/blocks/pending` 新增可选参数：

| 参数 | 类型 | 说明 |
|------|------|------|
| `refresh` | bool | 是否刷新范围（默认 false）|
| `datasetConfig` | object | 数据集配置（refresh=true 时需要）|

### 0.5 素材数据集

素材数据集同样采用 static/dynamic 模式：

- **static**：手动添加素材路径列表
- **dynamic**：按文件夹/文件类型过滤

---

## 一、统一文本分割模块

### 我的建议

采用**按语义边界 + token 估算**的混合策略：

1. **分割策略**：优先在段落/换行符处分割
2. **Token 估算**：中文按字符数 × 1.5 估算
3. **Overlap 重叠**：相邻 chunk 重叠 10%
4. **最大长度**：默认 512 tokens

### 1.1 设计

位置：`kernel/embedding/splitter.go`

```go
type TextChunk struct {
    Index int
    Text  string
    Start int
    End   int
}

type SplitOptions struct {
    MaxTokens   int  // 默认 512
    Overlap     int  // 默认 50
    ByParagraph bool // 默认 true
}

func SplitText(text string, opts SplitOptions) []TextChunk
```

---

## 二、块嵌入（Block Embedding）

### 2.1 现有状态
- [x] 基础 API 已实现
- [x] 支持后端 Ollama / 前端直推
- [x] 脏数据检测
- [ ] 多数据集支持（需改造 GetPending）
- [ ] 长文本分割

### 2.2 后端改造要点

**前置**：数据集配置模块

1. **集合命名**：`blocks_{model}_{datasetID}`
2. **GetPendingBlocksWithDataset**：根据 static/dynamic 配置获取范围内待嵌入块
3. **Meta 记录数据集信息**：`{ datasetId, scopeVersion, ... }`
4. **范围变更检测**：对比 scopeVersion，触发重建

---

## 三、素材嵌入（Assets Embedding）

### 3.1 现有状态
- [x] 基础 API 已实现
- [x] 后端 OCR（Tesseract）
- [ ] 多数据集支持
- [ ] `GetPendingAssets` 需改造

### 3.2 图片嵌入双轨策略

- **后端 OCR**：Tesseract 文本 → Ollama 嵌入
- **前端自选**：CLIP 等模型 → 直推 `/api/vector/add`

---

## 四、前端数据集管理 Dock

### 4.1 复用 CustomLists

数据集面板可以**直接复用 CustomLists 组件**或其变体：

- 每个数据集本质上就是一个 "自定义块列表" + 嵌入状态
- 只需扩展 UI 显示嵌入进度和状态

### 4.2 UI 设计

```
┌─────────────────────────────────────┐
│ 📦 嵌入管理          🔄 ⚙️ ▢     │
├─────────────────────────────────────┤
│ ● Ollama: 已连接                    │
├─────────────────────────────────────┤
│ ▼ 块数据集                          │
│   📁 work-notes [动态]              │
│      SQL: SELECT * FROM blocks...   │
│      ✅ 234 已嵌入 / ⏳ 12 待处理   │
│      [嵌入] [配置]                  │
│   ────────────────────────────────  │
│   � manual-picks [静态]            │
│      手动添加 89 个块               │
│      ✅ 89 已嵌入                   │
│   [+ 新建数据集]                    │
├─────────────────────────────────────┤
│ ▼ 素材数据集                        │
│   ...                               │
└─────────────────────────────────────┘
```

### 4.3 添加入口

1. **块右键菜单**：添加到数据集（静态列表）
2. **Dock 新建**：创建动态数据集（SQL）
3. **从现有 CustomList 转换**：一键转为嵌入数据集

---

## 五、优先级与时间线

| 优先级 | 任务 | 前置 | 预估时间 |
|--------|------|------|----------|
| **P0** | 数据集配置模块（复用 CustomLists） | 无 | 0.5 天 |
| **P0** | 后端 GetPending 改造 | 数据集配置 | 1 天 |
| **P0** | 范围变更 → 重建逻辑 | GetPending 改造 | 0.5 天 |
| P1 | 统一文本分割模块 | 无 | 1 天 |
| P1 | 前端 Dock（复用 CustomLists） | 数据集配置 | 1 天 |
| P1 | 块右键菜单入口 | 数据集配置 | 0.5 天 |
| P2 | 长文本分割集成 | 分割模块 | 0.5 天 |
| P2 | Ollama 状态监控 | 无 | 0.5 天 |

---

## 更新日志

- 2025-12-24: 简化设计
  - **复用 CustomLists 配置模式**（static/dynamic）
  - 新增**后端 GetPending 改造说明**
  - 新增**范围变更 → 索引重建策略**
  - 简化 UI，复用现有组件
- 2025-12-24: 新增多数据集和范围配置设计
- 2025-12-24: 初始版本
