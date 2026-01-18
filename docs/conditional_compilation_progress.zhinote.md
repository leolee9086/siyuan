# 条件编译警告修复进度记录

## 任务背景
为了解决移动端构建时的编译警告，我们需要为桌面端特有的代码（特别是引用 `getAllModels`, `getAllTabs`, `getAllWnds`, `getAllDocks` 等函数的代码）添加 `/// #if !MOBILE` 和 `/// #endif` 条件编译保护。

## 当前状态
已完成大部分文件的修复，目前正在处理 `src/layout` 目录下的文件。

### 已完成文件
以下文件已添加条件编译保护或进行了逻辑重构：
1. `src/asset/assetDialog.ts` (重构逻辑，移除了不必要的条件编译)
2. `src/util/focusStack.ts` (全文件包裹)
3. `src/search/util.ts` (部分包裹)
4. `src/layout/utils/addResize.ts` (部分包裹)
5. `src/components/panels/dockPanel.vue` (部分包裹)
6. `src/editor/util.getUnInitTab.ts` (部分包裹，调整返回值)
7. `src/editor/util.ts` (部分包裹)
8. `src/editor/util.updatePanelByEditor.ts` (部分包裹)
9. `src/layout/Wnd.ts` (包裹了 `removeTabAction` 中的 desktop 逻辑及 import)
10. `src/layout/util.ts` (包裹了 `getWndByLayout`, `exportLayout`, `getAllLayout`, `JSONToLayout` 中的 desktop 逻辑及 imports)

## 待处理文件及分析

### 1. `src/layout/tabUtil.ts` (待实施)
已完成分析，需要进行以下修改：
- **Imports**: 包裹 `import { getAllModels, getAllTabs } from "./getAll";`。
- **getActiveTab**: 包裹内部对 `getAllTabs()` 的调用。
- **switchTabByIndex**: 整个函数主要涉及桌面 Dock 和 Tab 切换，建议**全函数包裹**或内部全包裹。
- **resizeTabs**: 内部大量使用 `getAllModels()`，涉及多窗口 resize，建议**全函数包裹**或内部全包裹。
- **getDockByType**: 依赖 `window.siyuan.layout` (Desktop Layout)，建议**全函数包裹**。
- **newCenterEmptyTab**: 创建桌面空 Tab (Logo/Slogan页)，建议**全函数包裹**。
- **copyTab**: 复制 Tab 逻辑，涉及各类型 Model 的新建，建议**全函数包裹**。

### 2. `src/layout/dock/util.ts` (待实施)
已完成分析，该文件包含 `openBacklink`, `openGraph`, `openOutline`, `clearOBG`, `resetFloatDockSize`, `toggleDockBar`, `selectOpenTab` 等函数，全部依然桌面布局 (`getAllModels`, `window.siyuan.layout`)。
- **计划**: 添加 `/// #if !MOBILE` 到文件头部，`/// #endif` 到文件尾部（包住所有 imports 和 exports）。

### 3. 其他待检查文件
以下文件尚未分析，推测为桌面端特有逻辑，需要进一步检查并处理：
- `src/layout/dock/dock.focus.ts`
- `src/layout/dock/dock.init.ts`
- `src/layout/dock/outline/Outline.contextMenu.edit.ts`
- `src/layout/dock/outline/Outline.header.ts`
- `src/layout/dock/outline/Outline.sort.ts`
- `src/layout/tabUtil.ts` (如上所述)

## 下一步行动建议
1. 优先完成 `src/layout/tabUtil.ts` 的修改。
2. 完成 `src/layout/dock/util.ts` 的全文件包裹。
3. 批量检查并处理剩余的 `src/layout/dock/` 目录文件。
4. 验证移动端构建（如可行）或检查是否有新的 TypeScript 错误。

## 备注
- 注意 `Tab` 类可能在移动端不可用，引用 `Tab` 的地方也需要注意保护。
- 保持处理 Lint 错误的克制，优先解决条件编译问题。
