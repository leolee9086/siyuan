/**
 * 墓碑：本文件原有的综合表格实现已完成职责拆分，不再承载运行时逻辑。
 *
 * - `getColIndex`、`setTableAlign`、`clearTableCell`：使用 `./table/table`。
 * - `insertRow`、`insertRowAbove`、`deleteRow`、`moveRowToUp`、`moveRowToDown`：使用 `./table/table.row`。
 * - `insertColumn`、`deleteColumn`、`moveColumnToLeft`、`moveColumnToRight`：使用 `./table/column`。
 * - `fixTable`：使用 `./table/table.fix`。
 * - `updateTableTitle`：使用 `./table/table.title.update`。
 * - 表格网格、范围和 HTML 投影：使用 `./table/grid` 与 `./table/grid/html`。
 * - 框选几何：使用 `./table/selection/geometry`。
 *
 * 保留本文件用于源码与 Git 历史查询；不重新导出替代实现，以便旧导入在编译期显式暴露并迁移到真实所有者。
 */
export {};
