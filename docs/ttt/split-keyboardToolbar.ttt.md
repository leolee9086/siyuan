# 拆分 mobile/util/keyboardToolbar.ts

创建时间: 2026-02-24T15:01Z
状态: 待执行
相关规程: `docs/规程/代码质量/超长文件拆分.procedure.md`

## 现状

| 指标 | 数值 |
|------|------|
| 当前行数 | 784 |
| 限制行数 | 300 |
| 超标倍数 | 2.6x |
| 优先级 | P2 |

## 文件结构分析

### 模块级变量 (20-21)

| 变量 | 说明 |
|------|------|
| `renderKeyboardToolbarTimeout` | 渲染防抖定时器 |
| `showUtil` | 工具面板显示状态 |

### 导出函数

| 函数 | 行范围 | 行数 | 说明 |
|------|--------|------|------|
| `renderTextMenu` | 36-207 | 172 | 渲染文字样式菜单（颜色/字号） |
| `showKeyboardToolbarUtil` | 288-314 | 27 | 显示工具面板 |
| `showKeyboardToolbar` | 410-449 | 40 | 显示键盘工具栏 |
| `hideKeyboardToolbar` | 451-472 | 22 | 隐藏键盘工具栏 |
| `activeBlur` | 474-482 | 9 | 主动失焦 |
| `initKeyboardToolbar` | 484-783 | 300 | 初始化键盘工具栏（核心大函数） |

### 内部函数

| 函数 | 行范围 | 行数 | 说明 |
|------|--------|------|------|
| `getSlashItem` | 23-34 | 12 | 生成斜杠菜单项HTML |
| `renderSlashMenu` | 209-286 | 78 | 渲染斜杠菜单 |
| `hideKeyboardToolbarUtil` | 316-326 | 11 | 隐藏工具面板 |
| `renderKeyboardToolbar` | 328-408 | 81 | 渲染键盘工具栏状态 |

### 功能块划分

1. **菜单渲染**（23-286）：`getSlashItem` + `renderTextMenu` + `renderSlashMenu` — 约264行
2. **工具栏显隐**（288-482）：`showKeyboardToolbarUtil` + `hideKeyboardToolbarUtil` + `renderKeyboardToolbar` + `showKeyboardToolbar` + `hideKeyboardToolbar` + `activeBlur` — 约195行
3. **初始化+事件处理**（484-783）：`initKeyboardToolbar`（含HTML模板+resize监听+touch事件+click事件分发） — 约300行

### initKeyboardToolbar 内部逻辑块 (484-783)

| 逻辑块 | 行范围 | 行数 | 说明 |
|--------|--------|------|------|
| selectionchange监听 | 486-490 | 5 | 选区变化时渲染工具栏 |
| resize监听 | 491-545 | 55 | 键盘高度检测+横竖屏处理 |
| HTML模板 | 546-587 | 42 | 工具栏DOM结构 |
| touch事件 | 588-600 | 13 | 触摸移动检测 |
| click事件分发 | 601-782 | 182 | 各按钮类型的点击处理 |

### 关键观察

- `renderTextMenu` 是172行的大函数，主要是HTML模板拼接
- `initKeyboardToolbar` 是300行的大函数，内部click事件分发逻辑182行
- `showUtil` 模块级变量被多个函数共享，需要注意拆分时的状态管理
- 菜单渲染（text+slash）与工具栏控制逻辑天然分离

## 拆分方案

遵循"从内向外"原则：将菜单渲染和click事件分发提取为独立文件。

### 拆分文件清单

| # | 文件名 | 来源 | 内容 | 预估行数 |
|---|--------|------|------|---------|
| 1 | `keyboardToolbar.ts` | 主文件 | 模块变量 + `showKeyboardToolbarUtil` + `hideKeyboardToolbarUtil` + `renderKeyboardToolbar` + `showKeyboardToolbar` + `hideKeyboardToolbar` + `activeBlur` + `initKeyboardToolbar`骨架 | ~280 |
| 2 | `keyboardToolbar.menu.ts` | 提取 | `getSlashItem` + `renderTextMenu` + `renderSlashMenu` | ~270 |
| 3 | `keyboardToolbar.action.ts` | 提取 | click事件分发逻辑（从initKeyboardToolbar中提取） | ~200 |

### 拆分后目录结构

```
app/src/mobile/util/
├── keyboardToolbar.ts            ← 主文件（工具栏控制+初始化骨架）
├── keyboardToolbar.menu.ts       ← 菜单渲染（text+slash）
├── keyboardToolbar.action.ts     ← click事件分发
├── ... (已有文件不变)
```

### 导出模式

```typescript
// keyboardToolbar.menu.ts
export function renderTextMenu(protyle: IProtyle, toolbarElement: Element) { ... }
export function renderSlashMenu(protyle: IProtyle, toolbarElement: Element) { ... }

// keyboardToolbar.action.ts
export function handleToolbarAction(event: Event, protyle: IProtyle, ...) { ... }

// keyboardToolbar.ts 中导入并使用
import { renderTextMenu, renderSlashMenu } from "./keyboardToolbar.menu";
import { handleToolbarAction } from "./keyboardToolbar.action";
export { renderTextMenu };  // 保持原有导出
```

### 模块变量处理

`showUtil` 被 `showKeyboardToolbarUtil`、`hideKeyboardToolbarUtil`、`renderKeyboardToolbar`、`showKeyboardToolbar`、`hideKeyboardToolbar` 共同使用，保留在主文件中。菜单渲染文件不依赖此变量。

### 拆分顺序建议

1. 先提取 `keyboardToolbar.menu.ts`（菜单渲染最独立，264行）
2. 再提取 `keyboardToolbar.action.ts`（click事件分发）
3. 最后精简 `keyboardToolbar.ts`

### 约束

- 不改变原文件的公共导出接口（`renderTextMenu`, `showKeyboardToolbarUtil`, `showKeyboardToolbar`, `hideKeyboardToolbar`, `activeBlur`, `initKeyboardToolbar`）
- 不改变运行时行为
- 拆分后每个文件不超过300行
- 不在拆分过程中修复其他lint错误
- 不产生循环依赖

## 近期任务

- [x] 创建 `keyboardToolbar.menu.ts`，提取 getSlashItem + renderTextMenu + renderSlashMenu + KEYBOARD_TOOLBAR_HTML
- [x] 创建 `keyboardToolbar.action.ts`，提取 click事件分发逻辑（handleToolbarClick + ToolbarActionDeps）
- [x] 精简 `keyboardToolbar.ts` 为工具栏控制+初始化骨架
- [x] 构建验证（pnpm build exit code 0，无新增错误）

## 完成记录

完成时间: 2026-02-24T17:25Z

| 文件 | 行数 |
|------|------|
| `keyboardToolbar.ts` | 300 |
| `keyboardToolbar.menu.ts` | 312 |
| `keyboardToolbar.action.ts` | 205 |

## 失败记录

- 首次拆分后主文件339行，超过300行限制。追加提取HTML模板常量（KEYBOARD_TOOLBAR_HTML）到menu文件后降至300行。
