# table.ts lint修复与文件拆分

## 背景
`app/src/protyle/util/table.ts` 原826行，超过300行限制，且存在大量lint错误需要修复。

## 当前状态（全部完成 ✅）
- `table.ts` = ~176行 ✅ lint通过（保留 getColIndex, setTableAlign, isIncludeCell, clearTableCell）
- `table.row.ts` = ~291行 ✅ lint通过（insertRow, insertRowAbove, deleteRow, moveRowToUp, moveRowToDown）
- `table.row.helpers.ts` = ~155行 ✅ lint通过（buildRowAboveHTML, adjustRowSpanForInsert, insertAboveInThead, replaceTagInRow, swapRowUpToThead, swapRowDownToTbody）
- `table.column.ts` = ~233行 ✅ lint通过（insertColumn, deleteColumn, moveColumnToLeft, moveColumnToRight）
- `table.fix.ts` = ~105行 ✅ lint通过（中间件调度器，原386行334行单函数已拆分）
- `table.fix.types.ts` = ~68行 ✅ lint通过（TableFixContext, RowSpanInfo, StructureContext类型）
- `table.fix.editing.ts` = ~116行 ✅ lint通过（handleBackspaceBrFix, handleShiftEnter）
- `table.fix.navigation.ts` = ~325行 ✅ lint通过（7个导航中间件）
- `table.fix.navigation.helpers.ts` = ~200行 ✅ lint通过（9个导航辅助函数）
- `table.fix.structure.ts` = ~280行 ✅ lint通过（10个结构操作中间件）
- `table.fix.structure.helpers.ts` = ~210行 ✅ lint通过（prepareStructureContext等7个辅助函数）
- `table.title.update.ts` = ~163行 ✅ lint通过（已修复22个lint错误）
- `table.helpers.ts` = 99行 ✅
- `getSiyuanKeymap.environment.ts` = ~23行 ✅ lint通过（getSiyuanEditorTableKeymap）
- `keydown.table.ts` = ~22行 ✅ lint通过（fixTableMiddleware）

## 拆分方案

### table.ts (386行 → ~150行)
保留: `getColIndex`, `setTableAlign`, `isIncludeCell`, `clearTableCell` (~83行 + imports)
移出到 `table.row.ts`: `insertRow`, `insertRowAbove`, `deleteRow`, `moveRowToUp`, `moveRowToDown` (~166行)
移出到 `table.column.ts`: `insertColumn`, `deleteColumn`, `moveColumnToLeft`, `moveColumnToRight` (~112行)

需更新导入路径的文件:
- `app/src/menus/protyle.ts` - 导入了全部行/列操作函数
- `app/src/protyle/util/table.fix.ts` - 导入了全部行/列操作函数

### table.fix.ts (386行 → 中间件链架构，已完成 ✅)
采用 `keydown.ts` 的AbortController中间件模式拆分：
- `table.fix.ts` = 调度器（~105行），构造TableFixContext后依次执行中间件链
- `table.fix.types.ts` = 类型定义（TableFixContext, RowSpanInfo, StructureContext）
- `table.fix.editing.ts` = 编辑中间件（handleBackspaceBrFix, handleShiftEnter）
- `table.fix.navigation.ts` = 导航中间件（7个：Enter/ArrowRight/Tab/ArrowUp/ArrowDown/Backspace/Align）
- `table.fix.navigation.helpers.ts` = 导航辅助函数（9个）
- `table.fix.structure.ts` = 结构操作中间件（10个：行列移动/插入/删除）
- `table.fix.structure.helpers.ts` = 结构辅助函数（prepareStructureContext等7个）

## 任务列表
- [x] 1. 调查文件结构和依赖关系
- [x] 2. 规划文件拆分方案
- [x] 3. 创建 table.row.ts（行操作函数）并从 table.ts 移除
- [x] 4. 创建 table.column.ts（列操作函数）并从 table.ts 移除
- [x] 5. 调研中间件/路由模式，重新设计 table.fix.ts 拆分方案
- [x] 6. 更新所有外部导入路径（protyle.ts, table.fix.ts）
- [x] 7. 修复 table.ts 的 lint 错误
- [x] 8. 修复 table.row.ts + table.row.helpers.ts 的 lint 错误
- [x] 9. 修复 table.column.ts 的 lint 错误
- [x] 10. 实施 table.fix.ts 拆分 + lint修复（125个错误→0个）
- [x] 11. 修复 table.title.update.ts 的 lint 错误（22个→0个）
- [x] 12. 运行 lint 验证全部15个文件（全部通过）

## 调查结果

### 外部依赖关系（从 table.ts 导入的文件）

| 文件 | 导入的符号 |
|------|-----------|
| `menus/protyle.ts` | `deleteColumn`, `deleteRow`, `getColIndex`, `insertColumn`, `insertRow`, `insertRowAbove`, `moveColumnToLeft`, `moveColumnToRight`, `moveRowToDown`, `moveRowToUp`, `setTableAlign` |
| `protyle/util/table.fix.ts` | `getColIndex`, `insertRow`, `setTableAlign`, `moveRowToUp`, `moveRowToDown`, `moveColumnToLeft`, `moveColumnToRight`, `insertRowAbove`, `insertColumn`, `deleteRow`, `deleteColumn` |
| `boot/globalEvent/mousemove.ts` | `getColIndex` |
| `protyle/wysiwyg/keydown.delete.ts` | `clearTableCell` |
| `protyle/wysiwyg/index.mousedown.tableMenu.ts` | `clearTableCell`, `isIncludeCell`, `setTableAlign` |
| `protyle/wysiwyg/index.cut.ts` | `isIncludeCell` |
| `protyle/wysiwyg/index.copy.ts` | `isIncludeCell` |
| `protyle/util/insertHTML.ts` | `isIncludeCell` |
