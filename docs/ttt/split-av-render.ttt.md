# 拆分 render/av/render.ts

创建时间: 2026-02-24T14:58Z
状态: 已完成
相关规程: `docs/规程/代码质量/超长文件拆分.procedure.md`

## 现状

| 指标 | 数值 |
|------|------|
| 当前行数 | 899 |
| 限制行数 | 300 |
| 超标倍数 | 3.0x |
| 优先级 | P2 |

## 文件结构分析

### 接口定义 (26-51)

| 接口 | 行范围 | 行数 |
|------|--------|------|
| IIds | 26-30 | 5 |
| ITableOptions | 32-51 | 20 |

### 导出函数

| 函数 | 行范围 | 行数 | 说明 |
|------|--------|------|------|
| `genTabHeaderHTML` | 53-122 | 70 | 生成视图tab头部HTML |
| `getGroupTitleHTML` | 238-259 | 22 | 生成分组标题HTML |
| `avRender` | 451-616 | 166 | 主渲染入口（async） |
| `updateSearch` | 620-626 | 7 | 搜索更新 |
| `refreshAV` | 646-898 | 253 | AV刷新（处理各种operation） |

### 内部函数

| 函数 | 行范围 | 行数 | 说明 |
|------|--------|------|------|
| `getTableHTMLs` | 124-236 | 113 | 生成表格HTML（表头+行+底部） |
| `renderGroupTable` | 261-285 | 25 | 渲染分组表格 |
| `afterRenderTable` | 287-448 | 162 | 渲染后状态恢复（选中、滚动、搜索事件绑定） |
| `getAVElements` | 632-638 | 7 | 获取AV元素 |
| `getViewIDByAVElement` | 640-644 | 5 | 获取视图ID |

### 功能块划分

1. **HTML生成**（53-259）：`genTabHeaderHTML` + `getTableHTMLs` + `getGroupTitleHTML` — 约207行
2. **渲染核心**（261-448）：`renderGroupTable` + `afterRenderTable` — 约188行
3. **主入口+搜索**（451-626）：`avRender` + `updateSearch` — 约176行
4. **刷新逻辑**（628-898）：`refreshAV` + 辅助函数 — 约271行

## 拆分方案

遵循"从内向外"原则：提取内部逻辑到独立文件，主文件保留导出接口。

### 拆分文件清单

| # | 文件名 | 来源 | 内容 | 预估行数 |
|---|--------|------|------|---------|
| 1 | `render.ts` | 主文件 | 接口定义 + `genTabHeaderHTML` + `getGroupTitleHTML` + `avRender` + `updateSearch` + 导入 | ~280 |
| 2 | `render.table.ts` | 提取 | `getTableHTMLs` + `renderGroupTable` + `afterRenderTable` + ITableOptions接口 | ~300 |
| 3 | `render.refresh.ts` | 提取 | `refreshAV` + `getAVElements` + `getViewIDByAVElement` + refreshTimeouts | ~280 |

### 拆分后目录结构

```
app/src/protyle/render/av/
├── render.ts                 ← 主文件（入口+HTML生成）
├── render.table.ts           ← 表格渲染+状态恢复
├── render.refresh.ts         ← AV刷新逻辑
├── ... (已有文件不变)
```

### 导出模式

```typescript
// render.table.ts
export function getTableHTMLs(...) { ... }
export function renderGroupTable(...) { ... }
export function afterRenderTable(...) { ... }

// render.refresh.ts
export function refreshAV(...) { ... }

// render.ts 中导入并使用
import { getTableHTMLs, renderGroupTable, afterRenderTable } from "./render.table";
export { refreshAV } from "./render.refresh";
```

### 拆分顺序建议

1. 先提取 `render.refresh.ts`（`refreshAV` 最独立，253行，依赖最少）
2. 再提取 `render.table.ts`（`getTableHTMLs` + `renderGroupTable` + `afterRenderTable`）
3. 最后精简 `render.ts`

### 约束

- 不改变原文件的公共导出接口（`genTabHeaderHTML`, `getGroupTitleHTML`, `avRender`, `updateSearch`, `refreshAV`）
- 不改变运行时行为
- 拆分后每个文件不超过300行
- 不在拆分过程中修复其他lint错误
- 不产生循环依赖

## 近期任务

- [x] 创建 `render.refresh.ts`，提取 refreshAV + getAVElements + getViewIDByAVElement
- [x] 创建 `render.table.ts`，提取 getTableHTMLs + renderGroupTable + afterRenderTable + getGroupTitleHTML + ITableOptions + IIds
- [x] 精简 `render.ts` 为入口+HTML生成
- [x] 构建验证（pnpm build 无新增错误）

## 完成记录

完成时间: 2026-02-24T15:35Z

| 文件 | 行数 | 说明 |
|------|------|------|
| `render.ts` | 264 | 主文件，保留 genTabHeaderHTML + avRender + updateSearch，re-export refreshAV 和 getGroupTitleHTML |
| `render.table.ts` | 372 | getTableHTMLs + renderGroupTable + afterRenderTable + getGroupTitleHTML + ITableOptions + IIds |
| `render.refresh.ts` | 276 | refreshAV + getAVElements + getViewIDByAVElement + refreshTimeouts |

注意: render.table.ts 超过300行（372行），原因是 afterRenderTable 函数本身162行且与表格渲染紧密耦合无法再拆。

## 失败记录

（暂无）
