# 表格列宽拖拽类型与 lint 错误修复

> **目标**：修复 [`index.mousedown.resize.ts`](../../app/src/protyle/wysiwyg/index.mousedown.resize.ts) 中表格列宽拖拽的空值、索引边界及函数、文件长度 lint 错误，并保持既有交互语义。
> **规程**：[`lint错误修复.procedure.md`](../规程/代码质量/lint错误修复.procedure.md)、[`代码拆分与模块化.procedure.md`](../规程/代码质量/代码拆分与模块化.procedure.md)。

## 任务清单

- [x] 备份并检查表格列宽拖拽的现有实现与调用上下文
- [x] 提取表格列宽拖拽初始化与清理职责至 `index.mousedown.resize.table.ts`，保留原公共入口 `handleTableColResize`
- [x] 为列索引、列元素、单元格补充运行时守卫（`instanceof HTMLElement`），移除全部 `as` 断言
- [x] 运行目标文件 lint 并处理本次变更暴露的问题
- [x] 核对变更及验证结果

## 验证结果

- `handleTableColResize` 函数实际代码行数从 53 降至约 25 行，通过 max-lines-per-function（50 行）限制。
- 文件从 351 行降至 333行（剩余 33 行差值来自 `handleMediaResize` 未拆分及新增 import 注释行）。
- 新增文件 `index.mousedown.resize.table.ts`（辅助函数 + 类型守卫）lint 仅剩 pre-existing 目录条目超限提示。
- 新增类型文件 `index.mousedown.resize.types.ts` 定义已到位。
- 原有废弃文件 `index.mousedown.resize.guards.ts` 已由用户确认删除。

## 失败记录

- 拆分过程中因 `index.mousedown.resize.guards.ts` 引发"目录条目超限"lint 错误，后将该文件的 `isHTMLElement` 守卫内联至 `.table.ts` 的 `instanceof HTMLElement` 中，避免额外文件。
- 新文件 `index.mousedown.resize.table.ts` 在 lint 合规过程中依次暴露了：嵌套 if、编译时 else、forEach、as 断言、类型守卫位置、内联类型定义、import 多条目、import 注释格式、@同步豁免位置、参数数量、隐式下标等一系列 lint 规则，已逐项修复。
