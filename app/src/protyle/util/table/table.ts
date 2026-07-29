/**
 * 替代关系：本模块是原 `protyle/util/table.ts` 中列索引、对齐和单元格清理动作的唯一现行所有者。
 */
import {updateTransaction} from "../../wysiwyg/transaction/update";
import {focusByWbr} from "../selection";
import * as dayjs from "dayjs";
import {isIncludeCell} from "./selection/geometry";

/**
 * 获取单元格在所在行中的列索引
 *
 * 作用：通过遍历前驱兄弟元素计算单元格的列位置
 * 意图：表格行/列操作中定位单元格列号的基础工具函数
 * 调用时机：insertRow/insertRowAbove/deleteRow/insertColumn/deleteColumn/moveColumn 等操作中定位列
 *
 * @param cellElement - 目标单元格元素
 * @returns 列索引（从0开始）
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 遍历DOM兄弟节点计算索引，纯DOM读取操作 */
export const getColIndex = (cellElement: HTMLElement) => {
    let previousElement = cellElement.previousElementSibling;
    let index = 0;
    while (previousElement) {
        index++;
        previousElement = previousElement.previousElementSibling;
    }
    return index;
};

/**
 * 设置表格列对齐方式
 *
 * 作用：将选中单元格所在列的所有单元格设置为指定对齐方式（left/center/right）
 * 意图：提供表格列对齐能力，支持右键菜单和快捷键操作
 * 调用时机：用户通过右键菜单或快捷键触发"设置对齐"操作时
 *
 * @param protyle - 编辑器实例
 * @param cellElements - 选中的单元格元素数组
 * @param nodeElement - 表格所在的块级节点元素
 * @param type - 对齐类型（left/center/right）
 * @param range - 当前选区
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 批量修改表格单元格align属性并提交事务，必须同步完成 */
export const setTableAlign = (protyle: IProtyle, cellElements: HTMLElement[], nodeElement: Element, type: string, range: Range) => {
    range.insertNode(document.createElement("wbr"));
    const html = nodeElement.outerHTML;

    const tableElement = nodeElement.querySelector("table");
    // 表格元素不存在时无法操作
    if (!tableElement) {
        return;
    }
    const firstRow = tableElement.rows[0];
    // 表格无行时无法操作
    if (!firstRow) {
        return;
    }
    const columnCnt = firstRow.cells.length;
    const rowCnt = tableElement.rows.length;
    const currentColumns: number[] = [];

    for (let i = 0; i < rowCnt; i++) {
        const row = tableElement.rows[i];
        // 行不存在时跳过
        if (!row) {
            continue;
        }
        for (let j = 0; j < columnCnt; j++) {
            // 当前单元格与选中单元格匹配时，记录该列索引
            if (row.cells[j] === cellElements[currentColumns.length]) {
                currentColumns.push(j);
            }
        }
        // 已找到所有选中列后停止搜索
        if (currentColumns.length > 0) {
            break;
        }
    }
    for (let k = 0; k < rowCnt; k++) {
        const row = tableElement.rows[k];
        // 行不存在时跳过
        if (!row) {
            continue;
        }
        for (const colIdx of currentColumns) {
            const cell = row.cells[colIdx];
            cell?.setAttribute("align", type);
        }
    }
    updateTransaction(protyle, nodeElement, html);
    focusByWbr(tableElement, range);
};

/**
 * 清空表格选区内所有单元格的内容
 *
 * 作用：遍历表格中被框选的单元格，清空其 innerHTML
 * 意图：提供表格批量清空能力，配合框选操作使用
 * 调用时机：用户框选表格单元格后按 Delete/Backspace 键时（通过 keydown.delete.ts 或 index.mousedown.tableMenu.ts）
 *
 * @param protyle - 编辑器实例
 * @param tableBlockElement - 表格块级节点元素
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 批量清空单元格内容并提交事务，必须同步完成以保证DOM一致性 */
export const clearTableCell = (protyle: IProtyle, tableBlockElement: HTMLElement) => {
    if (!tableBlockElement) {
        return;
    }
    const tableSelectEl = tableBlockElement.querySelector(".table__select");
    const tableSelectElement = tableSelectEl instanceof HTMLElement ? tableSelectEl : undefined;
    // 选区元素不存在时无法操作
    if (!tableSelectElement) {
        return;
    }
    const selectCellElements: HTMLTableCellElement[] = [];
    const firstChild = tableBlockElement.firstElementChild;
    const scrollLeft = firstChild ? firstChild.scrollLeft : 0;
    const tableEl = tableBlockElement.querySelector("table");
    const scrollTop = tableEl ? tableEl.scrollTop : 0;
    const allCells = tableBlockElement.querySelectorAll("th, td");
    for (const el of allCells) {
        // 跳过非表格单元格元素和被合并覆盖的占位单元格
        if (!(el instanceof HTMLTableCellElement) || el.classList.contains("fn__none")) {
            continue;
        }
        // 单元格在选区范围内时加入待清空列表
        if (isIncludeCell({tableSelectElement, scrollLeft, scrollTop, item: el})) {
            selectCellElements.push(el);
        }
    }
    tableSelectElement.removeAttribute("style");
    const selection = getSelection();
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : undefined;
    // 存在有效选区且选区起点在表格内时，插入 wbr 标记以便后续恢复光标
    if (range && tableBlockElement.contains(range.startContainer)) {
        range.insertNode(document.createElement("wbr"));
    }
    const oldHTML = tableBlockElement.outerHTML;
    const wbrEl = tableBlockElement.querySelector("wbr");
    wbrEl?.remove();
    tableBlockElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
    for (const cell of selectCellElements) {
        cell.innerHTML = "";
    }
    updateTransaction(protyle, tableBlockElement, oldHTML);
};

