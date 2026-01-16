# 思源笔记 Search (搜索与资产管理) 模块

`app/src/search` 目录统一管理思源笔记中的全文检索、资源搜索、面板过滤以及历史记录逻辑。

## 目录结构与功能说明

### 1. 核心搜索逻辑
- **[index.ts](file:///d:/dev/siyuan-note/app/src/search/index.ts)**
  搜索界面的主控制器。协调搜索输入、结果列表展示及面板的显示/隐藏。
- **[menu.ts](file:///d:/dev/siyuan-note/app/src/search/menu.ts)**
  搜索相关的右键菜单和快捷操作，包含对搜索结果的批量处理逻辑。
- **[toggleHistory.ts](file:///d:/dev/siyuan-note/app/src/search/toggleHistory.ts)**
  管理搜索历史记录的持久化。

### 2. 资产（Asset）管理
- **[assets.ts](file:///d:/dev/siyuan-note/app/src/search/assets.ts)**
  资源文件搜索的核心实现。支持对图片、PDF、附件等按类型和时间进行检索。
- **[assetFilterPanel.ts](file:///d:/dev/siyuan-note/app/src/search/assetFilterPanel.ts)**
  资产管理器的过滤面板 UI 逻辑。

### 3. 特殊检索
- **[unRef.ts](file:///d:/dev/siyuan-note/app/src/search/unRef.ts)**
  专门用于查询并列出“未引用”的资产或块。

### 4. 交互处理
- **[inputEvent.ts](file:///d:/dev/siyuan-note/app/src/search/inputEvent.ts)**
  高度优化的搜索框输入流处理，包含防抖（Debounce）及高级搜索语法解析。

---

## 注意事项
- 搜索请求通常直接发送至内核的 SQL 接口（`/api/search/fullTextSearch`），前端主要负责结果的虚拟滚动列表渲染及高亮分发。
- 修改 `assetFilterPanel` 时需注意与底层 CSS 变量（`--b3-theme-surface`）的适配，以确保在不同主题下的对比度。
