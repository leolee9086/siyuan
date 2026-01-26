# Embedding模块开发执行跟踪 (TikTocTak)

> **目标**: 完善Embedding模块功能，实现语义搜索与嵌入块能力的全面集成，提供高性能的向量检索体验。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从"近期计划"中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到"已归档/已完成"区域。
> 4. 将"中期计划"中的条目提升到"近期计划"。

---

## 🎯 核心原则

### 设计原则
- **数据兼容性**: S-forge 是 siyuan-note 的功能超集，数据结构必须兼容
- **性能优先**: 向量检索必须高效，避免阻塞主线程
- **渐进增强**: 支持前端和后端嵌入模型的灵活切换
- **用户体验**: 提供清晰的进度反馈和错误提示

### 验证检查清单
- [ ] 语义搜索结果准确性验证
- [ ] 多数据集查询性能测试
- [ ] 前端/后端模型切换测试
- [ ] 嵌入进度显示正确性
- [ ] 与 siyuan-note 数据兼容性验证

---

## ℹ️ 如何维护此文档

1. **完成归档**：任务完成后，**必须**剪切粘贴到【已归档】列表，并打上 `[x]` 和日期。
2. **补充弹药**：当【近期计划】空了，从【中期计划】里挑选任务挪上去。
3. **因地制宜**：如果发现计划不合理，随时修改或删除。
4. **数据驱动**：用数据说话，不凭感觉。

---

## 🟢 近期计划 (立即聚焦，撸起袖子干)

- [ ] **Phase 1: 嵌入进度显示细化 (P0)**
  - **背景**: 当前进度显示是全局的，用户无法了解每个数据集的嵌入状态
  - **行动**:
    1. 修改 EmbeddingDock 进度条，按数据集分离显示
    2. 为每个数据集显示独立的 embedded/pending 计数
    3. 实现按数据集展开/折叠查看详情功能
    4. 添加数据集级别的刷新和暂停控制
  - **验收标准**:
    - 每个数据集有独立的进度条
    - 可以查看每个数据集的详细状态
    - 可以单独控制每个数据集的嵌入过程
  - **参考文档**: [`app/src/components/embeddingDock.vue`](../../app/src/components/embeddingDock.vue)

- [ ] **Phase 2: Protyle 嵌入块能力全对齐 (P0)**
  - **背景**: 嵌入块查询能力需要与搜索面板 (Keywords/Syntax/SQL/Regex/Semantic) 完全对齐
  - **行动**:
    1. 在 `blockRender.ts` 中实现统一语法解析：
       - `{{k:关键词}}` -> Method 0 (Keyword)
       - `{{s:语法}}` -> Method 1 (Query Syntax)
       - `{{r:正则}}` -> Method 3 (Regex)
       - `{{n:语义}}` -> Method 4 (Semantic)
       - `{{SQL}}` -> Method 2 (SQL, 现状)
       - `//!js` -> JS 脚本逻辑 (现状)
    2. 集成 `fullTextSearchBlock` 和 `semanticSearch` 到嵌入块渲染流程
    3. 统一不同搜索 API 的返回结果格式
    4. 确保向后兼容现有 SQL 解析逻辑
  - **验收标准**:
    - 所有搜索方法在嵌入块中可用
    - 语法解析正确无误
    - 结果渲染格式统一
    - 现有嵌入块功能不受影响
  - **参考文档**: [`app/src/protyle/render/blockRender.ts`](../../app/src/protyle/render/blockRender.ts)

- [ ] **Phase 3: 后端 API 改进 - 完整块信息返回 (P0)**
  - **背景**: 当前向量查询 API 只返回块 ID，前端需要二次 SQL 查询获取详情
  - **行动**:
    1. 修改 `/api/embedding/blocks/queryWithVector` 返回完整块信息
    2. 包含字段: content, hpath, type, box, created, updated 等
    3. 添加相似度分数字段到返回结果
    4. 支持单次请求查询多个数据集（datasets[] 参数）
    5. 后端合并多数据集结果，按相似度排序
  - **验收标准**:
    - API 返回完整块信息，无需前端二次查询
    - 相似度分数正确返回
    - 多数据集查询性能优化
    - API 文档更新
  - **参考文档**: [`kernel/api/embedding.go`](../../kernel/api/embedding.go)

---

## 🟡 中期计划 (架构演进，步步为营)

- [ ] **Phase 4: 语义搜索 UI 增强 (P1)**
  - **背景**: 当前语义搜索 UI 缺少相似度分数显示和配置面板
  - **行动**:
    1. 在搜索结果中显示相似度分数（百分比或小数）
    2. 创建语义搜索配置面板组件
    3. 支持数据集多选、TopK 和阈值配置
    4. 添加结果悬停预览功能

- [ ] **Phase 5: 块右键菜单入口 (P1)**
  - **背景**: 用户需要便捷的方式将块添加到数据集
  - **行动**:
    1. 在块右键菜单添加「添加到数据集」选项
    2. 实现数据集选择对话框
    3. 支持多选块批量添加
    4. 添加操作反馈和进度提示

- [ ] **Phase 6: GetPending refresh 参数支持 (P1)**
  - **背景**: 动态数据集需要支持手动刷新范围
  - **行动**:
    1. 后端 `GetPendingBlocksWithDataset` 支持 `refresh` 参数
    2. `refresh=false`: 只检查已嵌入块的 hash 变化
    3. `refresh=true`: 重新执行 SQL 查询获取新范围
    4. 前端添加刷新按钮和状态提示

- [ ] **Phase 7: 统一文本分割模块 (P2)**
  - **背景**: 需要智能的文本分割策略以提高嵌入质量
  - **行动**:
    1. 实现 `kernel/embedding/splitter.go`
    2. 按语义边界 + token 估算的混合策略
    3. 支持中文优化（字符数 × 1.5 估算 token）
    4. 相邻 chunk 10% 重叠
    5. 添加单元测试

- [ ] **Phase 8: Ollama 状态监控 (P2)**
  - **背景**: 需要检测 Ollama 服务状态并提供友好提示
  - **行动**:
    1. 实现 Ollama 服务状态检测
    2. 无 Ollama 时提示使用前端嵌入
    3. 实现模型列表获取功能
    4. 添加模型下载进度显示

---

## 🔴 远期计划 (北极星目标，星辰大海)

- [ ] **Phase 9: 混合检索 (Hybrid Search)**
  - **愿景**: 结合关键词搜索和语义搜索，提供更准确的检索结果
  - **技术方案**: BM25 + 向量检索的加权融合

- [ ] **Phase 10: 增量索引优化**
  - **愿景**: 实现真正的增量索引更新，避免全量重建
  - **技术方案**: HNSW 图的动态插入和删除算法

- [ ] **Phase 11: 多模态嵌入**
  - **愿景**: 支持图片、音频等多模态内容的向量化
  - **技术方案**: CLIP 等多模态模型集成

## 🏁 已归档/已完成

- [x] **Phase 0.1: 后端向量查询 API** [已完成 2025-12-25]
  - **背景**: 实现基础的向量查询能力
  - **完成情况**:
    - 新增 `QueryBlocksWithVector` 函数
    - 新增 `/api/embedding/blocks/queryWithVector` 路由
    - 支持基本的向量相似度查询
  - **成果文件**:
    - [`kernel/api/embedding.go`](../../kernel/api/embedding.go)
    - [`kernel/model/embedding.go`](../../kernel/model/embedding.go)
  - **参考文档**: [API 设计文档](./embedding-api-design.md)

- [x] **Phase 0.2: 前端 API 封装** [已完成 2025-12-25]
  - **背景**: 封装语义搜索前端调用接口
  - **完成情况**:
    - 新增 `semanticSearch.api.ts` 文件
    - 实现 `语义搜索` / `semanticSearch` 函数
    - 支持前端生成查询向量（`isFrontendModel` 判断）
    - 支持后端 Ollama 向量生成（`/api/embedding/embed`）
    - 实现多模型分组查询（按数据集使用的模型分组）
    - 实现 `解析语义查询` 支持 @dataset: 语法
    - 添加 `LOCAL_SEMANTIC_SEARCH` 常量和默认配置初始化
  - **成果文件**:
    - [`app/src/api/semanticSearch.api.ts`](../../app/src/api/semanticSearch.api.ts)
    - [`app/src/constants.ts`](../../app/src/constants.ts)
  - **参考文档**: [前端 API 文档](./frontend-api.md)

- [x] **Phase 0.3: 搜索 UI 集成** [已完成 2025-12-25]
  - **背景**: 在搜索界面集成语义搜索功能
  - **完成情况**:
    - `menu.ts` 中 `queryMenu` 添加 method=4 选项
    - `util.ts` 中 `genQueryHTML` 添加 method=4 图标
    - `inputEvent` 中处理 method=4 分支
    - `onSearch` 支持语义搜索结果格式
    - 通过 SQL 查询获取块详情（临时方案）
  - **成果文件**:
    - [`app/src/search/menu.ts`](../../app/src/search/menu.ts)
    - [`app/src/search/util.ts`](../../app/src/search/util.ts)
  - **待改进**:
    - 使用专用 API 直接返回完整块信息
    - 在 UI 中显示相似度分数
    - 创建语义搜索配置面板

- [x] **Phase 0.4: 核心重启后嵌入块数量显示修复** [已完成 2025-12-25]
  - **背景**: 核心重启后 EmbeddingDock 显示嵌入块数量为零
  - **完成情况**: 修复了数据加载逻辑，确保重启后正确显示
  - **成果文件**: [`app/src/components/embeddingDock.vue`](../../app/src/components/embeddingDock.vue)

## 📋 设计备忘

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

### 多数据集查询语法

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

---

**文档创建**: 2026-01-26
**最后更新**: 2026-01-26
**原始文档**: [`docs/TODO.md`](../TODO.md)
**已完成归档**: [`Done.md`](../../Done.md)
