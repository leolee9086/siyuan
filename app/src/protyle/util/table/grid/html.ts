/** 用途：网格构建与范围边界唯一实现；使用范围：独立 HTML 投影；解耦评估：同域运行时直达真实实现。 */
import {buildTableGrid} from "./index";
/** 用途：范围边界唯一实现；使用范围：确定投影矩形；解耦评估：同域运行时直达真实实现。 */
import {getTableRangeBounds} from "./index";
/** 用途：输出物理单元格；使用范围：范围求交和输出网格；解耦评估：同域纯类型直达声明。 */
import type {OutputTableCell} from "./grid.types";
/** 用途：输出逻辑网格；使用范围：序列化；解耦评估：同域纯类型直达声明。 */
import type {OutputTableGrid} from "./grid.types";
/** 用途：输入网格单元格；使用范围：范围求交；解耦评估：同域纯类型直达声明。 */
import type {TableGridCell} from "./grid.types";
/** 用途：输入范围边界；使用范围：范围求交；解耦评估：同域纯类型直达声明。 */
import type {TableRangeBounds} from "./grid.types";

/** 克隆一个与选区相交的物理单元格，并按交集重算输出跨度。 */
const createOutputCell = (info: TableGridCell, bounds: TableRangeBounds) => {
    const rowStart = Math.max(info.row, bounds.rowStart);
    const rowEnd = Math.min(info.row + info.rowspan - 1, bounds.rowEnd);
    const colStart = Math.max(info.col, bounds.colStart);
    const colEnd = Math.min(info.col + info.colspan - 1, bounds.colEnd);
    // 与选区矩形没有交集的物理单元格不进入输出。
    if (rowStart > rowEnd || colStart > colEnd) {
        return undefined;
    }
    const clonedCell = info.cell.cloneNode(true);
    if (!(clonedCell instanceof HTMLTableCellElement)) {
        throw new Error("table grid cell clone did not preserve HTMLTableCellElement identity");
    }
    const outputCell: OutputTableCell = {
        newCell: clonedCell,
        newRow: rowStart - bounds.rowStart,
        newCol: colStart - bounds.colStart,
        newRowspan: rowEnd - rowStart + 1,
        newColspan: colEnd - colStart + 1,
    };
    clonedCell.classList.remove("fn__none");
    clonedCell.removeAttribute("rowspan");
    clonedCell.removeAttribute("colspan");
    // 只有跨行输出单元格保留 rowspan。
    if (outputCell.newRowspan > 1) {
        clonedCell.setAttribute("rowspan", String(outputCell.newRowspan));
    }
    // 只有跨列输出单元格保留 colspan。
    if (outputCell.newColspan > 1) {
        clonedCell.setAttribute("colspan", String(outputCell.newColspan));
    }
    return outputCell;
};

/** 收集范围内全部输出单元格。 */
const collectOutputCells = (cellInfos: TableGridCell[], bounds: TableRangeBounds) => {
    const outputCells: OutputTableCell[] = [];
    for (const info of cellInfos) {
        const outputCell = createOutputCell(info, bounds);
        if (outputCell) {
            outputCells.push(outputCell);
        }
    }
    return outputCells;
};

/** 标记一个输出单元格覆盖的非起始网格位置。 */
const markCoveredSlots = (outputGrid: OutputTableGrid, outputCell: OutputTableCell) => {
    for (let rowOffset = 0; rowOffset < outputCell.newRowspan; rowOffset++) {
        const row = outputCell.newRow + rowOffset;
        const coveredRow = outputGrid.coveredSlots[row];
        if (!coveredRow) {
            throw new Error(`table output coverage row ${row} was not initialized`);
        }
        for (let colOffset = 0; colOffset < outputCell.newColspan; colOffset++) {
            if (rowOffset === 0 && colOffset === 0) {
                continue;
            }
            coveredRow[outputCell.newCol + colOffset] = true;
        }
    }
};

/** 构建输出单元格与合并占位的二维网格。 */
const buildOutputGrid = (outputCells: OutputTableCell[]) => {
    const maxRow = outputCells.reduce((max, cell) => Math.max(max, cell.newRow + cell.newRowspan - 1), 0);
    const maxCol = outputCells.reduce((max, cell) => Math.max(max, cell.newCol + cell.newColspan - 1), 0);
    const cells: (OutputTableCell | null)[][] = [];
    const coveredSlots: boolean[][] = [];
    for (let row = 0; row <= maxRow; row++) {
        cells.push(Array<OutputTableCell | null>(maxCol + 1).fill(null));
        coveredSlots.push(Array<boolean>(maxCol + 1).fill(false));
    }
    const outputGrid = {cells, coveredSlots, maxRow, maxCol};
    outputCells.sort((left, right) => left.newRow - right.newRow || left.newCol - right.newCol);
    for (const outputCell of outputCells) {
        const outputRow = cells[outputCell.newRow];
        if (!outputRow) {
            throw new Error(`table output cell row ${outputCell.newRow} was not initialized`);
        }
        outputRow[outputCell.newCol] = outputCell;
        markCoveredSlots(outputGrid, outputCell);
    }
    return outputGrid;
};

/** 计算独立输出中需要归入 thead 的行数。 */
const getHeadRowCount = (
    outputCells: OutputTableCell[],
    sectionOfRow: string[],
    sourceStartRow: number
) => {
    const maxOutputRow = outputCells.reduce((max, cell) => Math.max(max, cell.newRow + cell.newRowspan - 1), 0);
    let originalHeadRows = 0;
    while (originalHeadRows <= maxOutputRow && sectionOfRow[sourceStartRow + originalHeadRows] === "thead") {
        originalHeadRows++;
    }
    const mergedHeadRows = outputCells.reduce((max, cell) =>
        cell.newRow === 0 ? Math.max(max, cell.newRowspan) : max, 1);
    return Math.min(maxOutputRow + 1, Math.max(originalHeadRows, mergedHeadRows));
};

/** 按输出 section 规范化 th/td 标签，同时保留全部属性与内容。 */
const getCellHTML = (cell: HTMLTableCellElement, section: "thead" | "tbody") => {
    const tagName = section === "thead" ? "th" : "td";
    if (cell.tagName.toLowerCase() === tagName) {
        return cell.outerHTML;
    }
    const outputCell = document.createElement(tagName);
    for (const attribute of Array.from(cell.attributes)) {
        outputCell.setAttribute(attribute.name, attribute.value);
    }
    outputCell.innerHTML = cell.innerHTML;
    return outputCell.outerHTML;
};

/** 序列化输出网格中的一行。 */
const renderOutputRow = (outputGrid: OutputTableGrid, row: number, section: "thead" | "tbody") => {
    let html = "<tr>";
    const cellRow = outputGrid.cells[row];
    const coveredRow = outputGrid.coveredSlots[row];
    if (!cellRow || !coveredRow) {
        throw new Error(`table output row ${row} was not initialized`);
    }
    for (let col = 0; col <= outputGrid.maxCol; col++) {
        const outputCell = cellRow[col];
        if (outputCell) {
            html += getCellHTML(outputCell.newCell, section);
            continue;
        }
        const tagName = section === "thead" ? "th" : "td";
        // 被 rowspan/colspan 覆盖的位置必须输出思源约定的占位单元格，以维持后续行列映射。
        if (coveredRow[col]) {
            html += `<${tagName} class="fn__none"></${tagName}>`;
            continue;
        }
        html += `<${tagName}></${tagName}>`;
    }
    return `${html}</tr>`;
};

/** 以源表格列组重建独立表格的 colgroup，保持粘贴后列宽与菜单宽度判断一致。 */
const buildColgroupHTML = (tableElement: HTMLElement, bounds: TableRangeBounds) => {
    const sourceColGroup = Array.from(tableElement.children).find(item => item.tagName === "COLGROUP");
    const sourceColElements = sourceColGroup?.children;
    let html = "<colgroup>";
    for (let c = bounds.colStart; c <= bounds.colEnd; c++) {
        const colElement = sourceColElements?.item(c);
        // 仅当源表格存在且该索引对应真实 col 元素时复用其 outerHTML，否则回退到默认宽度，保证粘贴后列宽正确且菜单不崩溃
        if (colElement instanceof Element) {
            html += colElement.outerHTML;
            continue;
        }
        html += "<col style='min-width: 60px;'>";
    }
    html += "</colgroup>";
    return html;
};

/** 以单一 thead 和可选 tbody 序列化完整独立表格。 */
const renderOutputTable = (outputGrid: OutputTableGrid, headRows: number, colgroupHTML: string) => {
    let headHTML = "";
    let bodyHTML = "";
    for (let row = 0; row <= outputGrid.maxRow; row++) {
        // 原表头以及首个合并单元格覆盖的行统一进入独立表格的 thead。
        if (row < headRows) {
            headHTML += renderOutputRow(outputGrid, row, "thead");
            continue;
        }
        bodyHTML += renderOutputRow(outputGrid, row, "tbody");
    }
    const bodySection = bodyHTML ? `<tbody>${bodyHTML}</tbody>` : "";
    return `<table>${colgroupHTML}<thead>${headHTML}</thead>${bodySection}</table>`;
};

/**
 * 把起止单元格覆盖的矩形范围重建为合法独立表格 HTML。
 * @同步豁免: 需要绝对同步的DOM访问 - 复制和剪切必须在当前 Range 及源表格尚未变化时完成克隆和序列化。
 */
export const getTableRangeHTML = (tableElement: HTMLElement, startCell: HTMLElement, endCell: HTMLElement) => {
    const tableGrid = buildTableGrid(tableElement);
    const bounds = getTableRangeBounds(tableGrid, startCell, endCell);
    if (!bounds) {
        return "";
    }
    const outputCells = collectOutputCells(tableGrid.cellInfos, bounds);
    if (outputCells.length === 0) {
        return "";
    }
    const outputGrid = buildOutputGrid(outputCells);
    const headRows = getHeadRowCount(outputCells, tableGrid.sectionOfRow, bounds.rowStart);
    const colgroupHTML = buildColgroupHTML(tableElement, bounds);
    return renderOutputTable(outputGrid, headRows, colgroupHTML);
};
