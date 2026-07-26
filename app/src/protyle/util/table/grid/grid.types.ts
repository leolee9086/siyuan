/** 用途：描述物理表格单元格在逻辑网格中的位置与跨度；使用场景：网格构建、范围求交和 HTML 投影。 */
export interface TableGridCell {
    cell: HTMLTableCellElement;
    row: number;
    col: number;
    rowspan: number;
    colspan: number;
}

/** 用途：描述表格的完整逻辑网格快照；使用场景：范围坐标和独立表格重建；关联类型：由 `TableGridCell` 集合构成。 */
export interface TableGrid {
    cellInfos: TableGridCell[];
    sectionOfRow: string[];
    rowCount: number;
}

/** 用途：描述逻辑网格构建期间的完整可变状态；使用场景：逐行登记物理单元格及其跨度；关联类型：最终投影为 `TableGrid`。 */
export interface TableGridBuildState {
    occupiedCells: (HTMLTableCellElement | null)[][];
    sectionOfRow: string[];
    cellInfos: TableGridCell[];
}

/** 用途：描述选区矩形在逻辑网格中的闭区间边界；使用场景：单元格投影与 HTML 重建。 */
export interface TableRangeBounds {
    rowStart: number;
    rowEnd: number;
    colStart: number;
    colEnd: number;
}

/** 用途：描述实际可编辑单元格相对选区左上角的坐标；使用场景：表格内容粘贴映射。 */
export interface TableRangeCell {
    cell: HTMLTableCellElement;
    row: number;
    col: number;
}
