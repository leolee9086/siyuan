/** 用途：逻辑网格快照；使用范围：网格构建和范围查询；解耦评估：同域纯类型直达声明。 */
import type {TableGrid} from "./grid.types";
/** 用途：网格构建完整状态；使用范围：逐行登记；解耦评估：同域纯类型直达声明。 */
import type {TableGridBuildState} from "./grid.types";
/** 用途：物理单元格坐标；使用范围：网格构建；解耦评估：同域纯类型直达声明。 */
import type {TableGridCell} from "./grid.types";
/** 用途：范围边界；使用范围：范围求交；解耦评估：同域纯类型直达声明。 */
/** 用途：相对范围单元格；使用范围：粘贴映射结果；解耦评估：同域纯类型直达声明。 */
import type {TableRangeCell} from "./grid.types";

/** 读取 rowspan/colspan，并把缺失或非法历史值规范化为 1。 */
const getCellSpan = (cell: HTMLTableCellElement, attribute: "rowspan" | "colspan") => {
    const value = cell.getAttribute(attribute);
    if (!value) {
        return 1;
    }
    const parsedValue = Number.parseInt(value, 10);
    return Number.isNaN(parsedValue) || parsedValue < 1 ? 1 : parsedValue;
};

/** 确保占用网格与 section 数组包含指定行。 */
const ensureGridRow = (state: TableGridBuildState, row: number) => {
    while (state.occupiedCells.length <= row) {
        state.occupiedCells.push([]);
        state.sectionOfRow.push("");
    }
    const occupiedRow = state.occupiedCells[row];
    if (!occupiedRow) {
        throw new Error(`table grid row ${row} was not initialized`);
    }
    return occupiedRow;
};

/** 将物理单元格跨度写入占用网格。 */
const occupyGrid = (state: TableGridBuildState, info: TableGridCell) => {
    for (let rowOffset = 0; rowOffset < info.rowspan; rowOffset++) {
        const targetRow = info.row + rowOffset;
        const occupiedRow = ensureGridRow(state, targetRow);
        for (let columnOffset = 0; columnOffset < info.colspan; columnOffset++) {
            occupiedRow[info.col + columnOffset] = info.cell;
        }
    }
};

/** 把一行中的实际单元格登记到逻辑网格，忽略合并占位。 */
const collectRowCells = (
    rowElement: HTMLTableRowElement,
    row: number,
    state: TableGridBuildState
) => {
    let column = 0;
    const occupiedRow = ensureGridRow(state, row);
    for (const cell of rowElement.querySelectorAll<HTMLTableCellElement>("th, td")) {
        // `fn__none` 是合并单元格占位，不代表可编辑的物理单元格。
        if (cell.classList.contains("fn__none")) {
            continue;
        }
        while (occupiedRow[column]) {
            column++;
        }
        const info = {
            cell,
            row,
            col: column,
            rowspan: getCellSpan(cell, "rowspan"),
            colspan: getCellSpan(cell, "colspan"),
        };
        state.cellInfos.push(info);
        occupyGrid(state, info);
        column += info.colspan;
    }
};

/** 构造包含合并跨度和 section 信息的完整逻辑网格快照。 @同步豁免: 需要绝对同步的DOM访问 - 复制、剪切和粘贴必须在当前 Range 与表格 DOM 尚未变化时取得同一快照。 */
export const buildTableGrid = (tableElement: HTMLElement) => {
    const state: TableGridBuildState = {cellInfos: [], sectionOfRow: [], occupiedCells: []};
    const rowElements = Array.from(tableElement.querySelectorAll<HTMLTableRowElement>("tr"));
    for (const [row, rowElement] of rowElements.entries()) {
        ensureGridRow(state, row);
        state.sectionOfRow[row] = rowElement.parentElement?.tagName === "THEAD" ? "thead" : "tbody";
        collectRowCells(rowElement, row, state);
    }
    return {
        cellInfos: state.cellInfos,
        sectionOfRow: state.sectionOfRow,
        rowCount: rowElements.length,
        grid: state.occupiedCells,
        columnCount: state.occupiedCells.reduce((count, row) => Math.max(count, row.length), 0),
    };
};

/** 计算两个物理单元格覆盖范围形成的闭区间矩形。 @同步豁免: 需要绝对同步的DOM访问 - 调用方在同一复制或粘贴栈内立即使用当前单元格身份。 */
export const getTableRangeBounds = (
    tableGrid: TableGrid,
    startCell: HTMLElement,
    endCell: HTMLElement
) => {
    const startInfo = tableGrid.cellInfos.find(info => info.cell === startCell);
    const endInfo = tableGrid.cellInfos.find(info => info.cell === endCell);
    // 任一端点不属于该表格时，范围没有确定含义。
    if (!startInfo || !endInfo) {
        return undefined;
    }
    return {
        rowStart: Math.min(startInfo.row, endInfo.row),
        // 历史数据可能存在超出表格末行的 rowspan，不能为其生成虚拟尾行。
        rowEnd: Math.min(tableGrid.rowCount - 1,
            Math.max(startInfo.row + startInfo.rowspan - 1, endInfo.row + endInfo.rowspan - 1)),
        colStart: Math.min(startInfo.col, endInfo.col),
        colEnd: Math.max(startInfo.col + startInfo.colspan - 1, endInfo.col + endInfo.colspan - 1),
    };
};

/** 返回范围内实际可编辑的物理单元格及其相对逻辑坐标。 @同步豁免: 需要绝对同步的DOM访问 - 粘贴映射必须在写入目标单元格前同步固定源与目标坐标。 */
export const getTableRangeCells = (
    tableElement: HTMLElement,
    startCell?: HTMLElement,
    endCell?: HTMLElement
) => {
    const tableGrid = buildTableGrid(tableElement);
    // 没有完整端点时沿用全表投影语义。
    if (!startCell || !endCell) {
        return tableGrid.cellInfos.map(info => ({cell: info.cell, row: info.row, col: info.col}));
    }
    const bounds = getTableRangeBounds(tableGrid, startCell, endCell);
    if (!bounds) {
        return [];
    }
    const result: TableRangeCell[] = [];
    for (const info of tableGrid.cellInfos) {
        const row = Math.max(info.row, bounds.rowStart);
        const rowEnd = Math.min(info.row + info.rowspan - 1, bounds.rowEnd);
        const col = Math.max(info.col, bounds.colStart);
        const colEnd = Math.min(info.col + info.colspan - 1, bounds.colEnd);
        // 只有与选区矩形相交的物理单元格进入结果。
        if (row <= rowEnd && col <= colEnd) {
            result.push({cell: info.cell, row: row - bounds.rowStart, col: col - bounds.colStart});
        }
    }
    return result;
};
