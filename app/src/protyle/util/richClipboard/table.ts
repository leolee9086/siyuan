/** 计算表格第一行展开后的逻辑列数。 */
const getRichClipboardTableColumnCount = (tableElement: HTMLTableElement) => {
    const firstRow = tableElement.rows[0];
    if (!firstRow) {
        return 0;
    }
    let count = 0;
    for (const cell of firstRow.cells) {
        count += Math.max(1, parseInt(cell.getAttribute("colspan") || "1"));
    }
    return count;
};

/** 确保表格具有足够的 col 元素，并返回目标列集合。 */
const ensureRichClipboardColgroup = (tableElement: HTMLTableElement, columnCount: number) => {
    let colgroupElement = tableElement.querySelector<HTMLTableColElement>(":scope > colgroup");
    if (!colgroupElement) {
        colgroupElement = document.createElement("colgroup");
        tableElement.prepend(colgroupElement);
    }
    const columnElements = Array.from(colgroupElement.querySelectorAll<HTMLTableColElement>(":scope > col"));
    while (columnElements.length < columnCount) {
        const columnElement = document.createElement("col");
        colgroupElement.append(columnElement);
        columnElements.push(columnElement);
    }
    return columnElements.slice(0, columnCount);
};

/** 读取表格列宽，并为缺失或过小的宽度提供稳定下限。 */
const getRichClipboardColumnWidths = (columnElements: HTMLTableColElement[]) => {
    const widths: number[] = [];
    for (const columnElement of columnElements) {
        const width = parseFloat(columnElement.style.width || columnElement.style.minWidth ||
            columnElement.getAttribute("width") || "");
        widths.push(Math.max(80, Number.isFinite(width) ? width : 80));
    }
    return widths;
};

/** 将归一化列宽写回 col 元素。 */
const applyRichClipboardColumnWidths = (
    columnElements: HTMLTableColElement[],
    normalizedWidths: number[],
) => {
    for (const [index, columnElement] of columnElements.entries()) {
        const width = normalizedWidths[index] || 80;
        columnElement.style.width = `${width}px`;
        columnElement.style.minWidth = "";
        columnElement.setAttribute("width", width.toString());
    }
};

/** 根据 colspan 将归一化列宽写回第一行单元格。 */
const applyRichClipboardCellWidths = (firstRow: HTMLTableRowElement, normalizedWidths: number[]) => {
    let columnIndex = 0;
    for (const cellElement of firstRow.cells) {
        const colspan = Math.max(1, parseInt(cellElement.getAttribute("colspan") || "1"));
        const width = normalizedWidths.slice(columnIndex, columnIndex + colspan)
            .reduce((cellWidth, columnWidth) => cellWidth + columnWidth, 0);
        cellElement.style.width = `${width}px`;
        cellElement.setAttribute("width", width.toString());
        columnIndex += colspan;
    }
};

/** 规范化单个表格的列宽与基础排版，避免外部应用缩放失控。 */
const normalizeRichClipboardTableSize = (tableElement: HTMLTableElement) => {
    const firstRow = tableElement.rows[0];
    const columnCount = getRichClipboardTableColumnCount(tableElement);
    if (!firstRow || columnCount === 0) {
        return;
    }
    const columnElements = ensureRichClipboardColgroup(tableElement, columnCount);
    const columnWidths = getRichClipboardColumnWidths(columnElements);
    const sourceWidth = columnWidths.reduce((width, columnWidth) => width + columnWidth, 0);
    const targetWidth = Math.min(540, Math.max(360, sourceWidth));
    const scale = targetWidth / sourceWidth;
    const normalizedWidths = columnWidths.map(columnWidth => Math.round(columnWidth * scale));
    applyRichClipboardColumnWidths(columnElements, normalizedWidths);
    applyRichClipboardCellWidths(firstRow, normalizedWidths);
    tableElement.setAttribute("width", "100%");
    tableElement.setAttribute("cellpadding", "0");
    tableElement.setAttribute("cellspacing", "0");
    tableElement.style.tableLayout = "fixed";
    tableElement.style.fontSize = "14px";
    tableElement.style.lineHeight = "1.5";
};

/** 统一表格边框、内边距和高度，保证跨应用粘贴时仍可读。 */
/** @同步豁免: 性能考虑 */
export const normalizeRichClipboardTableBorders = (template: HTMLTemplateElement) => {
    let normalized = false;
    for (const tableElement of template.content.querySelectorAll<HTMLTableElement>("table")) {
        normalizeRichClipboardTableSize(tableElement);
        tableElement.setAttribute("border", "1");
        tableElement.style.borderCollapse = "collapse";
        tableElement.style.border = "1px solid #000";
        for (const cellElement of tableElement.querySelectorAll<HTMLElement>("th, td")) {
            cellElement.style.border = "1px solid #000";
            cellElement.style.boxSizing = "border-box";
            cellElement.style.height = "28px";
            cellElement.style.padding = "4px 8px";
            cellElement.style.verticalAlign = "middle";
        }
        normalized = true;
    }
    return normalized;
};
