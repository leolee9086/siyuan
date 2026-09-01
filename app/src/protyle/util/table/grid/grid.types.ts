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
    /** 用途：物理单元格在逻辑网格中的占用矩阵；使用场景：表格控制面板的行列边界、对齐与重建；关联类型：每个槽位指向所属物理单元格。 */
    grid: (HTMLTableCellElement | null)[][];
    /** 用途：逻辑网格的最大列数；使用场景：表格控制面板插入/删除列与尺寸计算。 */
    columnCount: number;
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

/** 用途：描述选区与物理单元格相交后生成的输出单元格；使用场景：独立表格 HTML 重建。 */
export interface OutputTableCell {
    newCell: HTMLTableCellElement;
    newRow: number;
    newCol: number;
    newRowspan: number;
    newColspan: number;
}

/** 用途：描述独立表格序列化所需的完整输出网格；使用场景：占位补齐与逐行渲染；关联类型：由 `OutputTableCell` 集合构建。 */
export interface OutputTableGrid {
    cells: (OutputTableCell | null)[][];
    coveredSlots: boolean[][];
    maxRow: number;
    maxCol: number;
}
