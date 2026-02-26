# 拆分 protyle/util/selection.ts

创建时间: 2026-02-24T14:59Z
完成时间: 2026-02-24T16:39Z
状态: 已完成
相关规程: `docs/规程/代码质量/超长文件拆分.procedure.md`

## 现状

| 指标 | 数值 |
|------|------|
| 当前行数 | 804 |
| 限制行数 | 300 |
| 超标倍数 | 2.7x |
| 优先级 | P2 |

## 文件结构分析

### 导出函数

| 函数 | 行范围 | 行数 | 说明 |
|------|--------|------|------|
| `fixTableRange` | 31-49 | 19 | 修正表格选区 |
| `selectAll` | 51-129 | 79 | 全选处理 |
| `getRangeByPoint` | 132-140 | 9 | 根据坐标获取Range |
| `getEditorRange` | 142-211 | 70 | 获取编辑器Range |
| `getSelectionPosition` | 213-334 | 122 | 获取光标位置坐标 |
| `getSelectionOffset` | 336-363 | 28 | 获取选区偏移量 |
| `setLastNodeRange` | 402-433 | 32 | 设置Range到最后节点 |
| `setFirstNodeRange` | 435-457 | 23 | 设置Range到第一个节点 |
| `focusByOffset` | 459-539 | 81 | 按偏移量聚焦 |
| `setInsertWbrHTML` | 541-553 | 13 | 插入wbr标记 |
| `focusByWbr` | 555-610 | 56 | 按wbr标记聚焦 |
| `focusByRange` | 612-627 | 16 | 按Range聚焦 |
| `focusToolbarRange` | 633-638 | 6 | 聚焦工具栏范围 |
| `focusBlock` | 641-772 | 132 | 聚焦到块元素 |
| `focusSideBlock` | 774-802 | 29 | 聚焦到相邻块 |

### 内部函数

| 函数 | 行范围 | 行数 | 说明 |
|------|--------|------|------|
| `selectIsEditor` | 17-28 | 12 | 判断选区是否在编辑器内 |
| `searchNode` | 365-400 | 36 | 递归搜索节点（被focusByOffset使用） |

### 功能块划分

1. **Range获取与修正**（17-211）：`selectIsEditor` + `fixTableRange` + `selectAll` + `getRangeByPoint` + `getEditorRange` — 约195行
2. **位置与偏移**（213-400）：`getSelectionPosition` + `getSelectionOffset` + `searchNode` — 约188行
3. **Range设置与聚焦**（402-539）：`setLastNodeRange` + `setFirstNodeRange` + `focusByOffset` — 约138行
4. **Wbr与焦点管理**（541-802）：`setInsertWbrHTML` + `focusByWbr` + `focusByRange` + `focusToolbarRange` + `focusBlock` + `focusSideBlock` — 约262行

### 关键观察

- 文件是纯函数集合，无类定义，函数间耦合度低
- `focusBlock` 是最大的单个函数（132行），内部按块类型分支处理
- `getSelectionPosition` 也较大（122行），处理各种光标位置边界情况
- 多数函数是独立的工具函数，天然适合按职责拆分

## 拆分方案

按职责将函数分组到不同文件。

### 拆分文件清单（实际结果）

| # | 文件名 | 内容 | 实际行数 |
|---|--------|------|---------|
| 1 | `selection.ts` | `selectIsEditor` + `fixTableRange` + `selectAll` + `getRangeByPoint` + `getEditorRange` + `getSelectionOffset` + 重导出 | 241 |
| 2 | `selection.range.ts` | `searchNode` + `setLastNodeRange` + `setFirstNodeRange` + `focusByOffset` + `setInsertWbrHTML` + `focusByWbr` | 255 |
| 3 | `selection.focus.ts` | `focusByRange` + `focusToolbarRange` + `聚焦工具栏范围` + `focusBlock` + `focusSideBlock` | ~175 |
| 4 | `selection.position.ts` | `getSelectionPosition` | ~125 |

### 拆分后目录结构

```
app/src/protyle/util/
├── selection.ts              ← 主文件（Range获取+位置计算）
├── selection.range.ts        ← Range设置+偏移聚焦+wbr
├── selection.focus.ts        ← 块聚焦相关
├── ... (已有文件不变)
```

### 导出模式

```typescript
// selection.range.ts
export function setLastNodeRange(...) { ... }
export function setFirstNodeRange(...) { ... }
export function focusByOffset(...) { ... }
export function setInsertWbrHTML(...) { ... }
export function focusByWbr(...) { ... }

// selection.focus.ts
export function focusByRange(...) { ... }
export function focusToolbarRange(...) { ... }
export { focusToolbarRange as 聚焦工具栏范围 };
export function focusBlock(...) { ... }
export function focusSideBlock(...) { ... }

// selection.ts 保留原有导出，部分从拆分文件重导出
export { setLastNodeRange, setFirstNodeRange, focusByOffset, setInsertWbrHTML, focusByWbr } from "./selection.range";
export { focusByRange, focusToolbarRange, 聚焦工具栏范围, focusBlock, focusSideBlock } from "./selection.focus";
```

### 注意：循环依赖风险

- `focusByOffset` 调用 `focusByRange`、`setLastNodeRange`、`focusBlock`
- `focusBlock` 调用 `setFirstNodeRange`、`getEditorRange`、`focusByRange`、`setLastNodeRange`
- 需要确保依赖方向：`selection.ts` → `selection.range.ts` → `selection.focus.ts` 不形成环
- 实际上 `focusByOffset` 依赖 `focusByRange` 和 `focusBlock`，而 `focusBlock` 依赖 `setFirstNodeRange` 和 `setLastNodeRange`
- 解决方案：将 `focusByRange` 放在 `selection.focus.ts`，`selection.range.ts` 从 `selection.focus.ts` 导入 `focusByRange` 和 `focusBlock`
- 依赖方向：`selection.ts` ← `selection.range.ts` ← `selection.focus.ts`（无环）

### 拆分顺序建议

1. 先提取 `selection.focus.ts`（`focusByRange` + `focusBlock` + `focusSideBlock` + `focusToolbarRange`，底层依赖）
2. 再提取 `selection.range.ts`（依赖 selection.focus.ts）
3. 最后精简 `selection.ts`，添加重导出

### 约束

- 不改变原文件的公共导出接口
- 不改变运行时行为
- 拆分后每个文件不超过300行
- 不在拆分过程中修复其他lint错误
- 不产生循环依赖

## 近期任务

- [x] 创建 `selection.focus.ts`，提取 focusByRange + focusToolbarRange + focusBlock + focusSideBlock
- [x] 创建 `selection.range.ts`，提取 searchNode + setLastNodeRange + setFirstNodeRange + focusByOffset + setInsertWbrHTML + focusByWbr
- [x] 精简 `selection.ts`，添加重导出
- [x] 额外创建 `selection.position.ts`，提取 getSelectionPosition（原计划留在主文件，但主文件仍超300行）
- [x] 构建验证（pnpm build 通过，exit code 0）

## 失败记录

- import/export 冲突：同一符号不能同时 `import { X } from "Y"` 和 `export { X } from "Y"`，需改为 `import` + `export { X }`（不带 from）
- 原计划3文件拆分后主文件仍有367行（超300行限制），需额外提取 `getSelectionPosition`（122行）到第4个文件
