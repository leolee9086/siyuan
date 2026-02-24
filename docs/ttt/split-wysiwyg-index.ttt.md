# 拆分 wysiwyg/index.ts

创建时间: 2026-02-23T06:20Z
状态: 待执行
相关规程: `docs/规程/代码质量/超长文件拆分.procedure.md`

## 现状

| 指标 | 数值 |
|------|------|
| 当前行数 | 3132 |
| 限制行数 | 300 |
| 超标倍数 | 10.4x |
| lint错误数 | 1002 |
| 优先级 | P0（最严重） |

## 文件结构分析

### 类: WYSIWYG (108-3131)

| 成员 | 行范围 | 行数 | 说明 |
|------|--------|------|------|
| 属性定义 | 109-113 | 5 | lastHTMLs, element, preventKeyup, preventClick |
| constructor | 115-136 | 22 | 初始化DOM、绑定事件 |
| renderCustom | 138-140 | 3 | 委托调用 |
| setEmptyOutline | 143-163 | 21 | 设置大纲高亮 |
| emojiToMd | 165-169 | 5 | emoji转markdown |
| **bindCommonEvent** | **171-1702** | **1532** | copy + mousedown |
| **bindEvent** | **1704-3130** | **1427** | 其余所有事件 |

### bindCommonEvent 内部事件 (171-1702)

| 事件 | 行范围 | 行数 |
|------|--------|------|
| copy | 172-418 | 247 |
| mousedown | 420-1701 | 1282 |

### mousedown 内部逻辑块 (420-1701)

| 逻辑块 | 行范围 | 行数 | 说明 |
|--------|--------|------|------|
| shift多选 | 432-566 | 135 | shift+click块选择 |
| ctrl多选 | 568-608 | 41 | ctrl+click块选择 |
| gallery项处理 | 612-623 | 12 | 画廊项拖拽 |
| av列宽调整 | 647-694 | 48 | 属性视图列宽拖拽 |
| av拖拽填充 | 697-769 | 73 | 属性视图拖拽填充 |
| av单元格选择 | 771-841 | 71 | 属性视图单元格框选 |
| 媒体缩放 | 843-916 | 74 | 图片/iframe/video缩放 |
| 表格单元格选择 | 918-937 | 20 | 表格选择初始化 |
| 表格列宽调整 | 939-988 | 50 | 表格列宽拖拽 |
| 多节点拖选 | 991-1283 | 293 | 框选多个块节点 |
| mouseup处理 | 1285-1701 | 417 | 含表格右键菜单(331行) |

### bindEvent 内部事件 (1704-3130)

| 事件 | 行范围 | 行数 |
|------|--------|------|
| ResizeObserver | 1706-1713 | 8 |
| focusout | 1715-1723 | 9 |
| cut | 1725-2009 | 285 |
| contextmenu | 2012-2214 | 203 |
| pointerdown | 2216-2242 | 27 |
| mousewheel | 2245-2295 | 51 |
| paste | 2297-2347 | 51 |
| compositionstart | 2351-2361 | 11 |
| compositionend | 2363-2392 | 30 |
| input | 2395-2441 | 47 |
| keyup | 2443-2516 | 74 |
| dblclick | 2518-2523 | 6 |
| click | 2525-3129 | 605 |

## 拆分方案

遵循"从内向外"原则：提取事件处理器内部逻辑为独立函数，主文件保留类定义和事件绑定骨架。

### 拆分文件清单

| # | 文件名 | 来源 | 预估行数 |
|---|--------|------|---------|
| 1 | `index.ts` | 类定义+构造器+小方法+绑定骨架 | ~120 |
| 2 | `index.copy.ts` | copy事件处理逻辑 | ~250 |
| 3 | `index.mousedown.select.ts` | shift/ctrl多选逻辑 | ~180 |
| 4 | `index.mousedown.av.ts` | av列宽+拖拽填充+单元格选择 | ~200 |
| 5 | `index.mousedown.resize.ts` | 媒体缩放+表格列宽 | ~130 |
| 6 | `index.mousedown.dragSelect.ts` | 多节点框选逻辑 | ~300 |
| 7 | `index.mousedown.tableMenu.ts` | mouseup中的表格右键菜单 | ~300 |
| 8 | `index.cut.ts` | cut事件处理逻辑 | ~285 |
| 9 | `index.contextmenu.ts` | contextmenu事件处理逻辑 | ~200 |
| 10 | `index.click.ts` | click主逻辑+面包屑+表格+通用 | ~300 |
| 11 | `index.click.navigation.ts` | 块引用+链接导航+剩余click | ~300 |
| 12 | `index.input.ts` | input+composition+paste+keyup+小事件 | ~200 |

### 拆分后目录结构

```
app/src/protyle/wysiwyg/
├── index.ts                          ← 主文件（类+骨架）
├── index.copy.ts                     ← copy事件
├── index.mousedown.select.ts         ← shift/ctrl多选
├── index.mousedown.av.ts             ← av操作
├── index.mousedown.resize.ts         ← 媒体/表格缩放
├── index.mousedown.dragSelect.ts     ← 多节点框选
├── index.mousedown.tableMenu.ts      ← 表格右键菜单
├── index.cut.ts                      ← cut事件
├── index.contextmenu.ts              ← contextmenu事件
├── index.click.ts                    ← click主逻辑
├── index.click.navigation.ts         ← 块引用/链接导航
├── index.input.ts                    ← 输入相关事件
├── ... (已有文件不变)
```

### 导出模式

每个拆分文件导出一个或多个命名函数，由 `index.ts` 中的事件监听器调用：

```typescript
// index.mousedown.av.ts
export function handleAvColResize(protyle: IProtyle, ...) { ... }
export function handleAvDragFill(protyle: IProtyle, ...) { ... }
export function handleAvCellSelect(protyle: IProtyle, ...) { ... }

// index.ts 中
this.element.addEventListener("mousedown", (event) => {
    // ... 前置逻辑
    if (target.classList.contains("av__widthdrag")) {
        return handleAvColResize(protyle, ...);
    }
    // ...
});
```

### 约束

- 不改变 WYSIWYG 类的公共导出接口
- 不改变运行时行为
- 拆分后每个文件不超过300行
- 不在拆分过程中修复其他lint错误
- 不产生循环依赖

## 近期任务

- [x] 创建 `index.copy.ts`，提取copy事件处理逻辑
- [x] 创建 `index.mousedown.select.ts`，提取shift/ctrl多选
- [x] 创建 `index.mousedown.av.ts`，提取av操作
- [x] 创建 `index.mousedown.resize.ts`，提取媒体/表格缩放
- [x] 创建 `index.mousedown.dragSelect.ts`，提取多节点框选
- [ ] 创建 `index.mousedown.tableMenu.ts`，提取表格右键菜单（mouseup中的表格右键菜单，尚未拆分）
- [x] 创建 `index.cut.ts`，提取cut事件处理
- [x] 创建 `index.contextmenu.ts`，提取contextmenu处理
- [x] 创建 `index.click.ts`，提取click主逻辑（已拆分为多个子函数）
- [x] 创建 `index.click.navigation.ts`，提取导航逻辑
- [x] 创建 `index.input.ts`，提取输入相关事件（paste/composition/input/keyup/dblclick）
- [x] 创建 `index.scroll.ts`，提取 mousewheel 滚动加载处理（68行）
- [x] 精简 `index.ts` 为绑定骨架（571→284行，≤300目标达成）
- [x] 构建验证（pnpm build 无新增错误，batch4完成）

## 失败记录

### 2026-02-23 规程冲突（已解决）

提取新文件时，继承了原始代码中大量已存在的 lint 违规（嵌套 if、window 访问、forEach 等）。
初次误判为"新代码产生的 lint 错误"而暂停任务。
用户澄清：机械提取的代码不算新代码，无需修复继承的 lint 错误。

### 2026-02-23 batch4 apply_diff Unicode 匹配失败

apply_diff 在99%相似度下因中文引号（`"` `"`）的 Unicode 编码差异导致匹配失败。
改用 write_to_file 重写整个文件绕过。write_to_file 过程中 `= {}` 被截断为 `= ;`，需额外 apply_diff 修复。
