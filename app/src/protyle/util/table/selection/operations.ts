import {updateTransaction} from "../../../wysiwyg/transaction/update";
import {focusByRange, getEditorRange, getUndoFocusContext} from "../../selection";
import {removeBlock} from "../../../wysiwyg/remove";
import {scrollToView} from "../table.helpers";
import {buildTableGrid} from "../grid";
import {getProjectedTableHeadRowCount, projectTableCells} from "../../tableSelection";

type TableGridSnapshot = ReturnType<typeof buildTableGrid>;

interface IDeleteTableOptions {
    range: Range;
    row: number;
    column: number;
}

/** 根据物理单元格选区推导逻辑行列索引。 */
export const getTableCellSelectionIndexes = (
    tableElement: HTMLTableElement,
    cellElements: HTMLTableCellElement[],
) => {
    const grid = buildTableGrid(tableElement);
    const selectedCells = new Set(cellElements);
    const rowIndexes = new Set<number>();
    const columnIndexes = new Set<number>();
    grid.cellInfos.forEach(info => {
        if (!selectedCells.has(info.cell)) {
            return;
        }
        for (let row = info.row; row < info.row + info.rowspan; row++) {
            rowIndexes.add(row);
        }
        for (let column = info.col; column < info.col + info.colspan; column++) {
            columnIndexes.add(column);
        }
    });
    return {
        rowIndexes: Array.from(rowIndexes).sort((a, b) => a - b),
        columnIndexes: Array.from(columnIndexes).sort((a, b) => a - b),
        merged: grid.cellInfos.some(info => info.rowspan > 1 || info.colspan > 1),
    };
};

/** 判断当前单元格选区是否完整覆盖若干逻辑行。 */
export const getTableFullRowSelection = (
    tableElement: HTMLTableElement,
    cellElements: HTMLTableCellElement[],
) => {
    const grid = buildTableGrid(tableElement);
    const selectedCells = new Set(cellElements);
    const indexes: number[] = [];
    let hasPartialRow = false;
    for (let row = 0; row < grid.rowCount; row++) {
        const cells = grid.grid[row] || [];
        const selectedSlots = cells.filter(cell => cell && selectedCells.has(cell)).length;
        if (selectedSlots === 0) {
            continue;
        }
        if (cells.length !== grid.columnCount || selectedSlots !== grid.columnCount) {
            hasPartialRow = true;
            break;
        }
        indexes.push(row);
    }
    return {
        indexes: hasPartialRow ? [] : indexes,
        merged: grid.cellInfos.some(info => info.rowspan > 1 || info.colspan > 1),
    };
};

/** 判断当前单元格选区是否完整覆盖若干逻辑列。 */
export const getTableFullColumnSelection = (
    tableElement: HTMLTableElement,
    cellElements: HTMLTableCellElement[],
) => {
    const grid = buildTableGrid(tableElement);
    const selectedCells = new Set(cellElements);
    const indexes: number[] = [];
    let hasPartialColumn = false;
    for (let column = 0; column < grid.columnCount; column++) {
        let slotCount = 0;
        let selectedSlotCount = 0;
        for (let row = 0; row < grid.rowCount; row++) {
            const cell = grid.grid[row]?.[column];
            if (cell) {
                slotCount++;
                if (selectedCells.has(cell)) {
                    selectedSlotCount++;
                }
            }
        }
        if (selectedSlotCount === 0) {
            continue;
        }
        if (slotCount !== grid.rowCount || selectedSlotCount !== grid.rowCount) {
            hasPartialColumn = true;
            break;
        }
        indexes.push(column);
    }
    return {
        indexes: hasPartialColumn ? [] : indexes,
        merged: grid.cellInfos.some(info => info.rowspan > 1 || info.colspan > 1),
    };
};

const cloneTableCell = (sourceCell: HTMLTableCellElement | undefined, tag: "th" | "td") => {
    const cell = document.createElement(tag);
    if (!sourceCell) {
        return cell;
    }
    Array.from(sourceCell.attributes).forEach(attribute => {
        cell.setAttribute(attribute.name, attribute.value);
    });
    Array.from(sourceCell.childNodes).forEach(child => cell.append(child.cloneNode(true)));
    return cell;
};

const rebuildProjectedTable = (
    tableElement: HTMLTableElement,
    grid: TableGridSnapshot,
    retainedRows: number[],
    retainedColumns: number[],
) => {
    const projection = projectTableCells(grid.cellInfos, retainedRows, retainedColumns);
    const headRowCount = getProjectedTableHeadRowCount(projection.cells, projection.rows, grid.sectionOfRow);
    const sourceRows = Array.from(tableElement.rows);
    const sourceCells = sourceRows.map(row => Array.from(row.cells));
    const sourceColumnGroup = Array.from(tableElement.children)
        .find(item => item.tagName === "COLGROUP") as HTMLTableColElement | undefined;
    const sourceColumns = Array.from(sourceColumnGroup?.children || []) as HTMLTableColElement[];
    const outputCells = new Map<string, typeof projection.cells[number]>();
    const coveredSlots = Array.from({length: projection.rows.length},
        () => new Array(projection.columns.length).fill(false));
    projection.cells.forEach(cell => {
        outputCells.set(`${cell.row}:${cell.col}`, cell);
        for (let row = cell.row; row < cell.row + cell.rowspan; row++) {
            const coveredRow = coveredSlots[row];
            if (!coveredRow) {
                continue;
            }
            for (let column = cell.col; column < cell.col + cell.colspan; column++) {
                if (row !== cell.row || column !== cell.col) {
                    coveredRow[column] = true;
                }
            }
        }
    });

    const nextTable = tableElement.cloneNode(false) as HTMLTableElement;
    if (tableElement.caption) {
        nextTable.append(tableElement.caption.cloneNode(true));
    }
    const columnGroup = sourceColumnGroup?.cloneNode(false) as HTMLTableColElement ||
        document.createElement("colgroup");
    projection.columns.forEach(column => {
        const sourceColumn = sourceColumns[column];
        if (sourceColumn) {
            columnGroup.append(sourceColumn.cloneNode(true));
        } else {
            const newColumn = document.createElement("col");
            newColumn.style.minWidth = "60px";
            columnGroup.append(newColumn);
        }
    });
    nextTable.append(columnGroup);
    const head = tableElement.tHead?.cloneNode(false) as HTMLTableSectionElement ||
        document.createElement("thead");
    const body = tableElement.tBodies[0]?.cloneNode(false) as HTMLTableSectionElement ||
        document.createElement("tbody");
    projection.rows.forEach((sourceRow, row) => {
        const rowElement = sourceRows[sourceRow]?.cloneNode(false) as HTMLTableRowElement ||
            document.createElement("tr");
        const tag = row < headRowCount ? "th" : "td";
        projection.columns.forEach((sourceColumn, column) => {
            const outputCell = outputCells.get(`${row}:${column}`);
            const sourcePlaceholder = sourceCells[sourceRow]?.[sourceColumn];
            const isCovered = coveredSlots[row]?.[column] === true;
            const sourceCell = outputCell?.source.cell ||
                (isCovered && sourcePlaceholder?.classList.contains("fn__none") ?
                    sourcePlaceholder : undefined);
            const cell = cloneTableCell(sourceCell, tag);
            if (outputCell) {
                cell.classList.remove("fn__none");
                if (outputCell.rowspan > 1) {
                    cell.setAttribute("rowspan", outputCell.rowspan.toString());
                } else {
                    cell.removeAttribute("rowspan");
                }
                if (outputCell.colspan > 1) {
                    cell.setAttribute("colspan", outputCell.colspan.toString());
                } else {
                    cell.removeAttribute("colspan");
                }
            } else if (isCovered) {
                cell.classList.add("fn__none");
            } else {
                cell.classList.remove("fn__none");
                cell.removeAttribute("rowspan");
                cell.removeAttribute("colspan");
            }
            rowElement.append(cell);
        });
        (row < headRowCount ? head : body).append(rowElement);
    });
    nextTable.append(head, body);
    const scrollTop = tableElement.scrollTop;
    tableElement.replaceWith(nextTable);
    nextTable.scrollTop = scrollTop;
    return {table: nextTable, projection};
};

const getProjectedIndex = (retainedIndexes: number[], sourceIndex: number) => {
    const nextIndex = retainedIndexes.findIndex(index => index >= sourceIndex);
    return nextIndex === -1 ? retainedIndexes.length - 1 : nextIndex;
};

const deleteTableRowsOrColumns = (
    protyle: IProtyle,
    nodeElement: HTMLElement,
    rowIndexes: number[],
    columnIndexes: number[],
    options?: IDeleteTableOptions,
) => {
    const tableElement = nodeElement.querySelector("table");
    if (!tableElement) {
        return false;
    }
    const grid = buildTableGrid(tableElement);
    const deletedRows = Array.from(new Set(rowIndexes))
        .filter(index => index >= 0 && index < grid.rowCount).sort((a, b) => a - b);
    const deletedColumns = Array.from(new Set(columnIndexes))
        .filter(index => index >= 0 && index < grid.columnCount).sort((a, b) => a - b);
    if (deletedRows.length === 0 && deletedColumns.length === 0) {
        return false;
    }
    const deletedRowSet = new Set(deletedRows);
    const deletedColumnSet = new Set(deletedColumns);
    const retainedRows = Array.from({length: grid.rowCount}, (_, index) => index)
        .filter(index => !deletedRowSet.has(index));
    const retainedColumns = Array.from({length: grid.columnCount}, (_, index) => index)
        .filter(index => !deletedColumnSet.has(index));
    if (retainedRows.length === 0 || retainedColumns.length === 0) {
        const range = options?.range || getEditorRange(nodeElement);
        nodeElement.classList.add("protyle-wysiwyg--select");
        removeBlock(protyle, nodeElement, range, "remove");
        return true;
    }

    const oldHTML = nodeElement.outerHTML;
    const undoContext = options ? getUndoFocusContext(protyle.wysiwyg.element, options.range, true) : undefined;
    const {table} = rebuildProjectedTable(tableElement, grid, retainedRows, retainedColumns);
    if (options) {
        const sourceRow = deletedRows[0] ?? options.row;
        const sourceColumn = deletedColumns[0] ?? options.column;
        const row = getProjectedIndex(retainedRows, sourceRow);
        const column = getProjectedIndex(retainedColumns, sourceColumn);
        const focusCell = buildTableGrid(table).grid[row]?.[column];
        if (focusCell) {
            options.range.selectNodeContents(focusCell);
            options.range.collapse(true);
            focusByRange(options.range);
            const rowElement = table.rows[row];
            if (rowElement) {
                scrollToView(nodeElement, rowElement, protyle);
            }
            const scrollElement = nodeElement.firstElementChild as HTMLElement;
            if (scrollElement && focusCell.offsetLeft + focusCell.clientWidth >
                scrollElement.scrollLeft + scrollElement.clientWidth) {
                scrollElement.scrollLeft = focusCell.offsetLeft + focusCell.clientWidth - scrollElement.clientWidth;
            }
        }
    }
    updateTransaction(protyle, nodeElement, oldHTML, undoContext);
    return true;
};

/** 按逻辑索引批量删除完整表格行。 */
export const deleteTableRows = (
    protyle: IProtyle,
    nodeElement: HTMLElement,
    rowIndexes: number[],
    options?: IDeleteTableOptions,
) => {
    return deleteTableRowsOrColumns(protyle, nodeElement, rowIndexes, [], options);
};

/** 按逻辑索引批量删除完整表格列。 */
export const deleteTableColumns = (
    protyle: IProtyle,
    nodeElement: HTMLElement,
    columnIndexes: number[],
    options?: IDeleteTableOptions,
) => {
    return deleteTableRowsOrColumns(protyle, nodeElement, [], columnIndexes, options);
};
