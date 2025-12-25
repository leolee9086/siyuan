# Embedding 模块 - 待办事项

> 已完成的工作已归档到 [Done.md](file:///d:/dev/siyuan-note/Done.md)

---

## 当前阶段：搜索界面集成语义搜索

> [!IMPORTANT]
> **核心目标**：在现有搜索对话框中集成语义搜索能力，支持多数据集查询。

### 1. 多数据集查询语法设计

#### 1.1 问题分析

- 块专用数据集有多个，每个数据集可能使用不同模型
- 用户需要指定查询目标：一个或多个数据集
- 需要兼顾易用性和灵活性
- **兼容性要求**：S-forge 是 siyuan-note 的功能超集，数据结构必须兼容

#### 1.2 语法方案对比

| 方案 | 语法示例 | 优点 | 缺点 |
|------|----------|------|------|
| A. 前缀指定 | `@work-notes: 向量数据库原理` | 直观，类似现有搜索语法 | 多数据集时较长 |
| B. 数据集选择器 | UI 下拉多选 + 文本输入 | 易发现，无需记忆语法 | 占用界面空间 |
| C. 混合模式 | 默认 UI 选择，支持 @ 覆盖 | 兼顾两者 | 规则复杂 |
| D. method=4 模式 | 新增搜索方式，独立配置存储 | 与现有体系一致，数据兼容 | 需独立 UI |

#### 1.3 推荐方案：D. 新增 method=4 + 独立配置存储

**理由**：
1. 与现有 method 0/1/2/3 体系一致
2. **独立存储语义搜索配置**，不修改 `IUILayoutTabSearchConfig`
3. 保持与 siyuan-note 完全数据兼容
4. UI 上只需在搜索方式菜单新增一项

**配置存储方案**（类似 `LOCAL_SEARCHASSET`）：

```typescript
// constants.ts 新增
public static readonly LOCAL_SEMANTIC_SEARCH = "local-semanticsearch";

// 独立的语义搜索配置接口（不修改现有类型）
interface ISemanticSearchConfig {
    datasets: string[];      // 数据集 ID 列表（空数组=全部）
    model?: string;          // 嵌入模型名（默认使用数据集配置的模型）
    topK: number;            // 返回结果数（默认 10）
    threshold: number;       // 相似度阈值（0-1，默认 0）
    lastQuery?: string;      // 上次查询内容
}

// 使用方式
window.siyuan.storage[Constants.LOCAL_SEMANTIC_SEARCH] = {
    datasets: ['work-notes', 'dev-docs'],
    topK: 10,
    threshold: 0.7
};
```

**method=4 判断**：
- 现有 `IUILayoutTabSearchConfig.method` 仍只存 0-3
- 语义搜索通过独立 UI 入口触发，不修改 method 字段
- 或者允许 method=4 但 siyuan-note 会忽略（优雅降级）

#### 1.4 查询语法（method=4 下的输入框）

**输入格式**：直接输入自然语言查询

```
向量数据库的工作原理是什么
如何优化 HNSW 算法性能
思源笔记的插件开发指南
```

**可选前缀语法**（覆盖 UI 选择）：

```
@work-notes: 向量数据库原理      # 指定单个数据集
@[work-notes,dev-docs]: HNSW     # 指定多个数据集
@*: 所有笔记                      # 查询所有数据集
```

**语法解析规则**：

```typescript
function parseSemanticQuery(input: string): {
    datasets: string[] | null;  // null 表示使用 UI 配置
    query: string;
} {
    // 匹配 @dataset: 或 @[d1,d2]: 或 @*:
    const prefixMatch = input.match(/^@(\*|\[[\w,\-]+\]|[\w\-]+):\s*/);
    if (!prefixMatch) {
        return { datasets: null, query: input };
    }
    
    const datasetStr = prefixMatch[1];
    const query = input.slice(prefixMatch[0].length);
    
    if (datasetStr === '*') {
        return { datasets: [], query };  // 空数组表示全部
    }
    if (datasetStr.startsWith('[')) {
        const datasets = datasetStr.slice(1, -1).split(',').map(s => s.trim());
        return { datasets, query };
    }
    return { datasets: [datasetStr], query };
}
```

### 2. UI 设计

#### 2.1 搜索方式菜单扩展

在 `genQueryHTML` 和 `queryMenu` 中新增 method=4：

```typescript
case 4:
    methodTip = "语义搜索";  // 或 siyuanI18n.semanticSearch
    methodIcon = "Embedding";  // 需要新图标
    break;
```

#### 2.2 语义搜索配置面板

当 method=4 时，在搜索框下方显示专用配置区：

```
┌─────────────────────────────────────────────────────────┐
│ 🧠 语义搜索                                      ⚙️    │
├─────────────────────────────────────────────────────────┤
│ 数据集: [✓ work-notes] [✓ dev-docs] [  personal]       │
│ TopK: [10 ▼]    阈值: [0.7 ▼]                          │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 输入查询内容...                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                            [搜索]      │
├─────────────────────────────────────────────────────────┤
│ 结果 (按相似度排序)                                     │
│ 0.95  📄 向量数据库笔记                                │
│ 0.87  📄 HNSW 算法实现                                 │
└─────────────────────────────────────────────────────────┘
```

#### 2.3 结果显示

- 显示相似度分数（百分比或小数）
- 按相似度降序排列
- 点击结果项跳转到块
- 悬停显示块内容预览

### 3. 实现步骤

#### 3.1 Phase 1: 后端 API ✅ 已完成基础版
- [x] 新增 `/api/embedding/blocks/queryWithVector` 端点（向量直查）
- [ ] **改进**: 返回完整块信息（content, hpath, type, box 等），避免前端二次查询
- [ ] **改进**: 结果包含相似度分数字段
- [ ] 支持跨数据集合并搜索结果

#### 3.2 Phase 2: 前端 API 封装 ✅ 已完成
- [x] `semanticSearch.api.ts` 新增 `语义搜索` / `semanticSearch` 函数
- [x] 支持前端生成查询向量（`isFrontendModel` 判断）
- [x] 支持后端 Ollama 向量生成（`/api/embedding/embed`）
- [x] 多模型分组查询（按数据集使用的模型分组）
- [x] `解析语义查询` 支持 @dataset: 语法
- [x] `LOCAL_SEMANTIC_SEARCH` 常量和默认配置初始化

#### 3.3 Phase 3: 搜索 UI 改造 ✅ 已完成
- [x] `menu.ts` 中 `queryMenu` 添加 method=4 选项
- [x] `util.ts` 中 `genQueryHTML` 添加 method=4 图标
- [x] `inputEvent` 中处理 method=4 分支（调用语义搜索 API，结果转换为标准格式）
- [ ] 创建语义搜索配置面板组件（可选增强）

#### 3.4 Phase 4: 结果渲染
- [x] `onSearch` 已支持语义搜索结果格式
- [x] 通过 SQL 查询获取块详情（临时方案）
- [ ] **改进**: 使用专用 API 直接返回完整块信息（取消 SQL 查询）
- [ ] **改进**: 在 UI 中显示相似度分数
- [ ] 高亮匹配内容（语义匹配可能无法精确高亮，可选增强）

### 4. 技术细节

#### 4.1 查询向量生成策略

```typescript
async function generateQueryVector(query: string, model: string): Promise<Float32Array> {
    // 优先使用后端 Ollama
    try {
        const response = await fetchPost('/api/embedding/embed', { text: query, model });
        if (response.code === 0) {
            return new Float32Array(response.data.vector);
        }
    } catch (e) {}
    
    // 回退到前端 Transformer.js
    return await embeddingText(query);
}
```

#### 4.2 跨数据集搜索

```go
// 跨数据集搜索实现
func SearchAcrossDatasets(query []float32, datasets []string, topK int) []SearchResult {
    var allResults []SearchResult
    
    for _, dataset := range datasets {
        collectionName := GetBlocksCollectionNameWithDataset(model, dataset)
        results := vectordb.Query(collectionName, query, topK)
        for _, r := range results {
            allResults = append(allResults, SearchResult{
                Dataset: dataset,
                BlockID: r.ID,
                Score:   r.Score,
            })
        }
    }
    
    // 按分数排序，取 topK
    sort.Slice(allResults, func(i, j int) bool {
        return allResults[i].Score > allResults[j].Score
    })
    
    if len(allResults) > topK {
        allResults = allResults[:topK]
    }
    
    return allResults
}
```

#### 4.3 前端配置初始化

```typescript
// protyle/util/compatibility.ts 中添加默认值
defaultStorage[Constants.LOCAL_SEMANTIC_SEARCH] = {
    datasets: [],      // 空数组表示查询所有数据集
    topK: 10,
    threshold: 0,
    lastQuery: ""
};
```


---

## 后续任务队列

### P1 优先级

#### 块右键菜单入口（0.5 天）
- [ ] 在块右键菜单添加「添加到数据集」选项
- [ ] 弹出数据集选择对话框
- [ ] 支持多选块批量添加

#### GetPending refresh 参数支持（0.5 天）
- [ ] 后端 `GetPendingBlocksWithDataset` 支持 `refresh` 参数
- [ ] `refresh=false`：只检查已嵌入块的 hash 变化
- [ ] `refresh=true`：重新执行 SQL 查询获取新范围

### P2 优先级

#### 统一文本分割模块（1 天）
- [ ] `kernel/embedding/splitter.go` 实现
- [ ] 按语义边界 + token 估算的混合策略
- [ ] 支持中文优化（字符数 × 1.5 估算 token）
- [ ] 相邻 chunk 10% 重叠

#### Ollama 状态监控（0.5 天）
- [ ] 检测 Ollama 服务状态
- [ ] 无 Ollama 时提示使用前端嵌入
- [ ] 模型列表获取

---

## 设计备忘

### 数据集配置（复用 ICustomList）

```typescript
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
```

### 范围变更策略

| 变更类型 | 处理策略 |
|----------|----------|
| static 新增 ID | 增量嵌入新增的 ID |
| static 移除 ID | 从索引中删除对应向量 |
| dynamic 查询变更 | 调用 `RebuildIndex()` 重建 HNSW 图 |
| 切换 static ↔ dynamic | 调用 `RebuildIndex()` 重建 HNSW 图 |
| 模型变更 | 调用 `RebuildIndex()` 重建 HNSW 图 |

### 动态数据集 Pending 机制

| 场景 | 行为 |
|------|------|
| 范围刷新 | 手动触发：用户点击刷新按钮才执行 SQL |
| 已嵌入块被修改 | 立刻变为 pending |
| 新块进入查询范围 | 等待刷新后才加入 pending |

---

## 更新日志

- 2025-12-25 18:47: 语义搜索向量查询 API 完成
  - 后端: 新增 `QueryBlocksWithVector` 函数 + `/api/embedding/blocks/queryWithVector` 路由
  - 前端: 新增 `使用向量查询块` 客户端 (`embeddingDock.api.ts`)
  - 搜索: `util.ts` 改用 `/api/query/sql` 获取块详情
  - **下一步改进**:
    1. 块查询接口直接返回完整块信息（避免二次 SQL 查询）
    2. 结果包含相似度分数供 UI 显示
- 2025-12-25 18:02: 深化语义搜索集成设计
  - 新增 method=4 语义搜索模式设计
  - 设计多数据集查询语法（@ 前缀 + UI 选择）
  - 规划语义搜索配置面板 UI
  - 定义后端 `/api/embedding/search` API
  - 分 4 个 Phase 规划实现步骤
- 2025-12-25 18:00: 精简 TODO，已完成内容归档到 Done.md
