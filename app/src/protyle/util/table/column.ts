import {updateTransaction} from "../../wysiwyg/transaction/update";
import {
    focusByWbr,
    focusByRange,
} from "../selection";
import {getColIndex} from "./table";
import {removeBlock} from "../../wysiwyg/remove";

/**
 * 在指定列的前方或后方插入新列
 *
 * 作用：在表格中指定单元格所在列的前方或后方插入一列或多列空列
 * 意图：提供表格列追加能力，支持右键菜单和快捷键插入列操作
 * 调用时机：用户通过右键菜单或快捷键触发"插入列"操作时（通过 fixTable 分发或 menus/protyle.ts）
 * 问题/改进：需要同步更新 col 元素以保持列宽定义一致
 *
 * @param protyle - 编辑器实例
 * @param nodeElement - 表格所在的块级节点元素
 * @param cellElement - 当前单元格元素
 * @param type - 插入位置（beforebegin 或 afterend）
 * @param range - 当前选区
 * @param count - 插入列数，默认1
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 表格列插入需要同步修改每行DOM结构、更新col元素和滚动位置，异步会导致DOM状态不一致 */
export const insertColumn = (protyle: IProtyle, nodeElement: Element, cellElement: HTMLElement, type: InsertPosition, range: Range, count = 1) => {
    const wbrElement = document.createElement("wbr");
    range.insertNode(wbrElement);
    const oldHtml = nodeElement.outerHTML;
    wbrElement.remove();
    const index = getColIndex(cellElement);
    const tableElement = nodeElement.querySelector("table");
    // 表格元素不存在时无法操作
    if (!tableElement) {
        return;
    }
    for (let i = 0; i < tableElement.rows.length; i++) {
        const row = tableElement.rows[i];
        const colCellElement = row?.cells[index];
        // 跳过不存在的单元格（防御性检查）
        if (!colCellElement) {
            continue;
        }
        const tag = colCellElement.tagName.toLowerCase();
        // 当前单元格所在列插入时带 wbr 标记以便后续聚焦
        const cellHtml = colCellElement === cellElement
            ? `<${tag}><wbr></${tag}>` + `<${tag}></${tag}>`.repeat(count - 1)
            : `<${tag}></${tag}>`.repeat(count);
        colCellElement.insertAdjacentHTML(type, cellHtml);
    }
    const scrollContainer = nodeElement.firstElementChild;
    // 滚动条横向定位：插入在右侧且超出可视区域时向右滚动
    if (scrollContainer && type === "afterend" && cellElement.offsetLeft + cellElement.clientWidth + 60 >
        scrollContainer.scrollLeft + scrollContainer.clientWidth) {
        scrollContainer.scrollLeft = cellElement.offsetLeft + cellElement.clientWidth + 60 - scrollContainer.clientWidth;
    }
    // 滚动条横向定位：插入在左侧且超出可视区域时向左滚动
    if (scrollContainer && type === "beforebegin" && cellElement.offsetLeft - 60 * count < scrollContainer.scrollLeft) {
        scrollContainer.scrollLeft = cellElement.offsetLeft - 60 * count;
    }
    const colElements = nodeElement.querySelectorAll("col");
    const colEl = colElements[index];
    // 同步插入 col 元素以保持列宽定义
    if (colEl) {
        colEl.insertAdjacentHTML(type, "<col style='min-width: 60px;'>".repeat(count));
    }
    focusByWbr(nodeElement, range);
    const nodeId = nodeElement.getAttribute("data-node-id");
    // 提交事务记录操作
    if (nodeId) {
        updateTransaction(protyle, nodeId, nodeElement.outerHTML, oldHtml);
    }
};

/**
 * 删除指定列
 *
 * 作用：删除表格中指定单元格所在的列，并将光标移动到相邻列
 * 意图：提供表格列删除能力，处理仅剩一列时整表删除的边界情况
 * 调用时机：用户通过右键菜单或快捷键触发"删除列"操作时（通过 fixTable 分发或 menus/protyle.ts）
 * 问题/改进：仅剩一列时会删除整个表格块
 *
 * @param protyle - 编辑器实例
 * @param range - 当前选区
 * @param nodeElement - 表格所在的块级节点元素
 * @param cellElement - 当前单元格元素
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 删除列后需要同步移动光标到相邻列，异步会导致光标位置错误 */
export const deleteColumn = (protyle: IProtyle, range: Range, nodeElement: Element, cellElement: HTMLElement) => {
    const wbrElement = document.createElement("wbr");
    range.insertNode(wbrElement);
    const oldHtml = nodeElement.outerHTML;
    wbrElement.remove();
    const index = getColIndex(cellElement);
    const sideEl = cellElement.previousElementSibling ?? cellElement.nextElementSibling;
    const sideCellElement = sideEl instanceof HTMLElement ? sideEl : undefined;
    // 无相邻列时说明仅剩一列，删除整个表格块
    if (!sideCellElement) {
        nodeElement.classList.add("protyle-wysiwyg--select");
        removeBlock(protyle, nodeElement, range, "remove");
        return;
    }
    range.selectNodeContents(sideCellElement);
    range.collapse(true);
    const scrollContainer = nodeElement.firstElementChild;
    // 滚动条横向定位：相邻单元格超出右侧可视区域时向右滚动
    if (scrollContainer && sideCellElement.offsetLeft + sideCellElement.clientWidth > scrollContainer.scrollLeft + scrollContainer.clientWidth) {
        scrollContainer.scrollLeft = sideCellElement.offsetLeft + sideCellElement.clientWidth - scrollContainer.clientWidth;
    }
    const tableElement = nodeElement.querySelector("table");
    // 表格元素不存在时无法继续
    if (!tableElement) {
        return;
    }
    for (let i = 0; i < tableElement.rows.length; i++) {
        const row = tableElement.rows[i];
        // 行不存在时跳过
        if (!row) {
            continue;
        }
        const cells = row.cells;
        // 仅剩一列时删除整个 table 元素
        if (cells.length === 1) {
            tableElement.remove();
            break;
        }
        const targetCell = cells[index];
        targetCell?.remove();
    }
    const allCols = nodeElement.querySelectorAll("col");
    const targetCol = allCols[index];
    targetCol?.remove();
    const nodeId = nodeElement.getAttribute("data-node-id");
    // 提交事务记录操作
    if (nodeId) {
        updateTransaction(protyle, nodeId, nodeElement.outerHTML, oldHtml);
    }
    focusByRange(range);
};

/**
 * 将当前列左移一列
 *
 * 作用：将表格中指定单元格所在列与左侧列交换位置
 * 意图：提供表格列排序能力，同时同步更新 col 元素顺序
 * 调用时机：用户通过右键菜单或快捷键触发"左移列"操作时（通过 fixTable 分发或 menus/protyle.ts）
 *
 * @param protyle - 编辑器实例
 * @param range - 当前选区
 * @param cellElement - 当前单元格元素
 * @param nodeElement - 表格所在的块级节点元素
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 列移动涉及每行多个DOM节点的同步重排，必须原子性完成 */
export const moveColumnToLeft = (protyle: IProtyle, range: Range, cellElement: HTMLElement, nodeElement: Element) => {
    // 已在最左列时无法左移
    if (!cellElement.previousElementSibling) {
        return;
    }
    range.insertNode(document.createElement("wbr"));
    const oldHtml = nodeElement.outerHTML;
    const cellIndex = getColIndex(cellElement);
    for (const trElement of nodeElement.querySelectorAll("tr")) {
        const currentCell = trElement.cells[cellIndex];
        const leftCell = trElement.cells[cellIndex - 1];
        // 两个单元格都存在时交换位置
        if (currentCell && leftCell) {
            currentCell.after(leftCell);
        }
    }
    const scrollContainer = nodeElement.firstElementChild;
    // 滚动条横向定位：交换后单元格超出左侧可视区域时向左滚动
    if (scrollContainer && cellElement.offsetLeft < scrollContainer.scrollLeft) {
        scrollContainer.scrollLeft = cellElement.offsetLeft;
    }
    const colElements = nodeElement.querySelectorAll("col");
    const currentCol = colElements[cellIndex];
    const leftCol = colElements[cellIndex - 1];
    // 同步交换 col 元素顺序
    if (currentCol && leftCol) {
        currentCol.after(leftCol);
    }
    const nodeId = nodeElement.getAttribute("data-node-id");
    // 提交事务记录操作
    if (nodeId) {
        updateTransaction(protyle, nodeId, nodeElement.outerHTML, oldHtml);
    }
    focusByWbr(nodeElement, range);
};

/**
 * 将当前列右移一列
 *
 * 作用：将表格中指定单元格所在列与右侧列交换位置
 * 意图：提供表格列排序能力，同时同步更新 col 元素顺序
 * 调用时机：用户通过右键菜单或快捷键触发"右移列"操作时（通过 fixTable 分发或 menus/protyle.ts）
 *
 * @param protyle - 编辑器实例
 * @param range - 当前选区
 * @param cellElement - 当前单元格元素
 * @param nodeElement - 表格所在的块级节点元素
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 列移动涉及每行多个DOM节点的同步重排，必须原子性完成 */
export const moveColumnToRight = (protyle: IProtyle, range: Range, cellElement: HTMLElement, nodeElement: Element) => {
    // 已在最右列时无法右移
    if (!cellElement.nextElementSibling) {
        return;
    }
    range.insertNode(document.createElement("wbr"));
    const oldHtml = nodeElement.outerHTML;
    const cellIndex = getColIndex(cellElement);
    for (const trElement of nodeElement.querySelectorAll("tr")) {
        const currentCell = trElement.cells[cellIndex];
        const rightCell = trElement.cells[cellIndex + 1];
        // 两个单元格都存在时交换位置
        if (currentCell && rightCell) {
            currentCell.before(rightCell);
        }
    }
    const scrollContainer = nodeElement.firstElementChild;
    // 滚动条横向定位：交换后单元格超出右侧可视区域时向右滚动
    if (scrollContainer && cellElement.offsetLeft + cellElement.clientWidth > scrollContainer.scrollLeft + scrollContainer.clientWidth) {
        scrollContainer.scrollLeft = cellElement.offsetLeft + cellElement.clientWidth - scrollContainer.clientWidth;
    }
    const colElements = nodeElement.querySelectorAll("col");
    const currentCol = colElements[cellIndex];
    const rightCol = colElements[cellIndex + 1];
    // 同步交换 col 元素顺序
    if (currentCol && rightCol) {
        currentCol.before(rightCol);
    }
    const nodeId = nodeElement.getAttribute("data-node-id");
    // 提交事务记录操作
    if (nodeId) {
        updateTransaction(protyle, nodeId, nodeElement.outerHTML, oldHtml);
    }
    focusByWbr(nodeElement, range);
};
