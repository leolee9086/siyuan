import {focusByRange} from "../../../protyle/util/selection";
import {getColIndex, setTableAlign} from "../../../protyle/util/table/table";
import {
    deleteRow,
    insertRow,
    insertRowAbove,
    moveRowToDown,
    moveRowToUp,
} from "../../../protyle/util/table/table.row";
import {
    deleteColumn,
    insertColumn,
    moveColumnToLeft,
    moveColumnToRight,
} from "../../../protyle/util/table/column";
import {updateTableTitle} from "../../../protyle/util/table/table.title.update";
import {updateTransaction} from "../../../protyle/wysiwyg/transaction/update";
import {siyuanI18n} from "../../../util/siyuanEnvironments/i18n.getI18n.environment";

/**
 * 表格菜单
 * @作用 为表格单元格生成上下文菜单,包含插入/删除/移动行列、对齐、合并等操作
 * @意图 提供完整的表格编辑功能
 * @调用时机 用户在表格单元格中右键点击或触发菜单时
 * @param protyle - 编辑器实例
 * @param nodeElement - 表格节点元素
 * @param cellElement - 当前单元格元素
 * @param range - 当前选区
 * @returns 包含各类菜单项的对象
 * @同步豁免 遗留代码
 */
export const tableMenu = (protyle: IProtyle, nodeElement: Element, cellElement: HTMLTableCellElement, range: Range) => {
    const otherMenus: IMenu[] = [];
    const colIndex = getColIndex(cellElement);
    if (cellElement.rowSpan > 1 || cellElement.colSpan > 1) {
        otherMenus.push({
            id: "cancelMerged",
            label: siyuanI18n.cancelMerged,
            /** 取消合并单元格 */
            click: () => {
                const oldHTML = nodeElement.outerHTML;
                let rowSpan = cellElement.rowSpan;
                let currentRowElement: Element | null = cellElement.parentElement;
                const orgColSpan = cellElement.colSpan;
                while (rowSpan > 0 && currentRowElement) {
                    let currentCellElement = currentRowElement.children[colIndex] as HTMLTableCellElement;
                    let colSpan = orgColSpan;
                    while (colSpan > 0 && currentCellElement) {
                        currentCellElement.classList.remove("fn__none");
                        currentCellElement.removeAttribute("colspan");
                        currentCellElement.removeAttribute("rowspan");
                        currentCellElement = currentCellElement.nextElementSibling as HTMLTableCellElement;
                        colSpan--;
                    }
                    currentRowElement = currentRowElement.nextElementSibling;
                    rowSpan--;
                }
                cellElement.removeAttribute("colspan");
                cellElement.removeAttribute("rowspan");
                            if (cellElement.tagName === "TH") {
                    let prueTrElement: HTMLElement | undefined;
                    // @内联回调
                    Array.from(nodeElement.querySelectorAll("thead tr")).find((item: Element) => {
                        prueTrElement = item as HTMLElement;
                                            for (const cell of Array.from(item.children)) {
                            const tableCell = cell as HTMLTableCellElement;
                                                    if (tableCell.rowSpan !== 1 || tableCell.classList.contains("fn__none")) {
                                prueTrElement = undefined;
                            }
                        }
                                            if (prueTrElement) {
                            return true;
                        }
                    });
                                    if (prueTrElement) {
                        const tbodyElement = nodeElement.querySelector("tbody");
                        const theadElement = nodeElement.querySelector("thead");
                        if (tbodyElement && theadElement && theadElement.lastElementChild) {
                            while (prueTrElement !== theadElement.lastElementChild) {
                                const lastChild = theadElement.lastElementChild;
                                if (lastChild) {
                                    lastChild.querySelectorAll("th").forEach((item) => {
                                        const td = document.createElement("td");
                                        Array.from(item.attributes).forEach((attr) => {
                                            td.setAttribute(attr.name, attr.value);
                                        });
                                        while (item.firstChild) {
                                            td.appendChild(item.firstChild);
                                        }
                                        item.replaceWith(td);
                                    });
                                    tbodyElement.insertAdjacentElement("afterbegin", lastChild);
                                }
                            }
                        }
                    }
                }
                focusByRange(range);
                updateTransaction(protyle, nodeElement, oldHTML);
            }
        });
    }
    const colElements = nodeElement.querySelectorAll("col");
    const colCandidate = colElements.item(colIndex);
    const thMatchElement = colCandidate instanceof HTMLElement ? colCandidate : undefined;
    if (thMatchElement && (thMatchElement.style.width || thMatchElement.style.minWidth !== "60px")) {
        otherMenus.push({
            id: "useDefaultWidth",
            label: siyuanI18n.useDefaultWidth,
            /** 使用默认宽度 */
            click: () => {
                const html = nodeElement.outerHTML;
                thMatchElement.style.width = "";
                thMatchElement.style.minWidth = "60px";
                updateTransaction(protyle, nodeElement, html);
            }
        });
    }
    const isPinHead = nodeElement.getAttribute("custom-pinthead");
    otherMenus.push({
        id: isPinHead ? "unpinTableHead" : "pinTableHead",
        icon: isPinHead ? "iconUnpin" : "iconPin",
        label: isPinHead ? siyuanI18n.unpinTableHead : siyuanI18n.pinTableHead,
        /** 固定/取消固定表头 */
        click: () => {
            const html = nodeElement.outerHTML;
                    if (isPinHead) {
                nodeElement.removeAttribute("custom-pinthead");
            } else {
                nodeElement.setAttribute("custom-pinthead", "true");
            }
            updateTransaction(protyle, nodeElement, html);
        }
    });
    otherMenus.push({
        icon: "iconHeadings",
        label: siyuanI18n.title,
        /** 表格标题设置 */
        click: () => {
            updateTableTitle(protyle, nodeElement);
        }
    });
    otherMenus.push({ id: "separator_1", type: "separator" });
    otherMenus.push({
        id: "alignLeft",
        icon: "iconAlignLeft",
        accelerator: window.siyuan?.config?.keymap?.editor?.general?.alignLeft?.custom,
        label: siyuanI18n.alignLeft,
        /** 左对齐 */
        click: () => {
            setTableAlign(protyle, [cellElement], nodeElement, "left", range);
        }
    });
    otherMenus.push({
        id: "alignCenter",
        icon: "iconAlignCenter",
        label: siyuanI18n.alignCenter,
        accelerator: window.siyuan?.config?.keymap?.editor?.general?.alignCenter?.custom,
        /** 居中对齐 */
        click: () => {
            setTableAlign(protyle, [cellElement], nodeElement, "center", range);
        }
    });
    otherMenus.push({
        id: "alignRight",
        icon: "iconAlignRight",
        label: siyuanI18n.alignRight,
        accelerator: window.siyuan?.config?.keymap?.editor?.general?.alignRight?.custom,
        /** 右对齐 */
        click: () => {
            setTableAlign(protyle, [cellElement], nodeElement, "right", range);
        }
    });
    otherMenus.push({
        id: "useDefaultAlign",
        icon: "",
        label: siyuanI18n.useDefaultAlign,
        /** 使用默认对齐 */
        click: () => {
            setTableAlign(protyle, [cellElement], nodeElement, "", range);
        }
    });
    const menus: IMenu[] = [];
    menus.push(...otherMenus);
    menus.push({
        type: "separator"
    });
    const tableElement = nodeElement.querySelector("table");
    if (!tableElement) {
        return { menus, removeMenus: [], insertMenus: [], otherMenus, other2Menus: [] };
    }
    const hasNone = cellElement.parentElement?.querySelector(".fn__none");
    let hasColSpan = false;
    let hasRowSpan = false;
    const parentElement = cellElement.parentElement;
    if (parentElement) {
        for (const item of Array.from(parentElement.children)) {
            const tableCell = item as HTMLTableCellElement;
                    if (tableCell.colSpan > 1) {
                hasColSpan = true;
            }
                    if (tableCell.rowSpan > 1) {
                hasRowSpan = true;
            }
        }
    }
    let previousHasNone: false | Element = false;
    let previousHasColSpan = false;
    let previousHasRowSpan = false;
    let previousRowElement = cellElement.parentElement?.previousElementSibling;
    if (!previousRowElement && cellElement.parentElement?.parentElement?.tagName === "TBODY") {
        const theadElement = tableElement.querySelector("thead");
        previousRowElement = theadElement?.lastElementChild || null;
    }
    if (previousRowElement) {
        previousHasNone = previousRowElement.querySelector(".fn__none") || false;
        for (const item of Array.from(previousRowElement.children)) {
            const tableCell = item as HTMLTableCellElement;
                    if (tableCell.colSpan > 1) {
                previousHasColSpan = true;
            }
                    if (tableCell.rowSpan > 1) {
                previousHasRowSpan = true;
            }
        }
    }
    let nextHasNone: false | Element = false;
    let nextHasColSpan = false;
    let nextHasRowSpan = false;
    let nextRowElement = cellElement.parentElement?.nextElementSibling;
    if (!nextRowElement && cellElement.parentElement?.parentElement?.tagName === "THEAD") {
        const tbodyElement = tableElement.querySelector("tbody");
        nextRowElement = tbodyElement?.firstElementChild || null;
    }
    if (nextRowElement) {
        nextHasNone = nextRowElement.querySelector(".fn__none") || false;
        for (const item of Array.from(nextRowElement.children)) {
            const tableCell = item as HTMLTableCellElement;
                    if (tableCell.colSpan > 1) {
                nextHasColSpan = true;
            }
                    if (tableCell.rowSpan > 1) {
                nextHasRowSpan = true;
            }
        }
    }
    let colIsPure = true;
    for (const row of Array.from(tableElement.rows)) {
        const cell = row.cells[colIndex];
            if (cell && (cell.classList.contains("fn__none") || cell.colSpan > 1 || cell.rowSpan > 1)) {
            colIsPure = false;
            break;
        }
    }
    let nextColIsPure = true;
    for (const row of Array.from(tableElement.rows)) {
        const cell = row.cells[colIndex + 1];
            if (cell && (cell.classList.contains("fn__none") || cell.colSpan > 1 || cell.rowSpan > 1)) {
            nextColIsPure = false;
            break;
        }
    }
    let previousColIsPure = true;
    for (const row of Array.from(tableElement.rows)) {
        const cell = row.cells[colIndex - 1];
            if (cell && (cell.classList.contains("fn__none") || cell.colSpan > 1 || cell.rowSpan > 1)) {
            previousColIsPure = false;
            break;
        }
    }
    const insertMenus = [];
    insertMenus.push({
        id: "insertRowAbove",
        icon: "iconBefore",
        label: `<div class="fn__flex" style="align-items: center;">
${siyuanI18n.insertRowBefore.replace("${x}", `<span class="fn__space"></span><input type="number" step="1" min="1" value="1" placeholder="${siyuanI18n.enterKey}" class="b3-text-field b3-text-field--size"><span class="fn__space"></span>`)}
</div>`,
        accelerator: window.siyuan?.config?.keymap?.editor?.table?.insertRowAbove?.custom,
        /** 在上方插入行（支持批量） */
        bind(element: HTMLElement) {
            const inputElement = element.querySelector("input");
            // @内联回调
            element.addEventListener("click", () => {
                if (document.activeElement === inputElement) {
                    return;
                }
                insertRowAbove(protyle, range, cellElement, nodeElement, parseInt(element.querySelector("input").value));
                window.siyuan.menus.menu.remove();
            });
            // @内联回调
            inputElement.addEventListener("keydown", (event: KeyboardEvent) => {
                if (!event.isComposing && event.key === "Enter") {
                    insertRowAbove(protyle, range, cellElement, nodeElement, parseInt(element.querySelector("input").value));
                    window.siyuan.menus.menu.remove();
                }
            });
        }
    });
    if (!nextHasNone || (nextHasNone && !nextHasRowSpan && nextHasColSpan)) {
        insertMenus.push({
            id: "insertRowBelow",
            icon: "iconAfter",
            label: `<div class="fn__flex" style="align-items: center;">
${siyuanI18n.insertRowAfter.replace("${x}", `<span class="fn__space"></span><input type="number" step="1" min="1" value="1" placeholder="${siyuanI18n.enterKey}" class="b3-text-field b3-text-field--size"><span class="fn__space"></span>`)}
</div>`,
            accelerator: window.siyuan?.config?.keymap?.editor?.table?.insertRowBelow?.custom,
            /** 在下方插入行（支持批量） */
            bind(element: HTMLElement) {
                const inputElement = element.querySelector("input");
                // @内联回调
                element.addEventListener("click", () => {
                    if (document.activeElement === inputElement) {
                        return;
                    }
                    insertRow(protyle, range, cellElement, nodeElement, parseInt(element.querySelector("input").value));
                    window.siyuan.menus.menu.remove();
                });
                // @内联回调
                inputElement.addEventListener("keydown", (event: KeyboardEvent) => {
                                    if (!event.isComposing && event.key === "Enter") {
                        insertRow(protyle, range, cellElement, nodeElement, parseInt(element.querySelector("input").value));
                        window.siyuan.menus.menu.remove();
                    }
                });
            }
        });
    }
    if (colIsPure || previousColIsPure) {
        insertMenus.push({
            id: "insertColumnLeft",
            icon: "iconInsertLeft",
            label: `<div class="fn__flex" style="align-items: center;">
${siyuanI18n.insertColumnLeft1.replace("${x}", `<span class="fn__space"></span><input type="number" step="1" min="1" value="1" placeholder="${siyuanI18n.enterKey}" class="b3-text-field b3-text-field--size"><span class="fn__space"></span>`)}
</div>`,
            accelerator: window.siyuan?.config?.keymap?.editor?.table?.insertColumnLeft?.custom,
            /** 在左侧插入列（支持批量） */
            bind(element: HTMLElement) {
                const inputElement = element.querySelector("input");
                // @内联回调
                element.addEventListener("click", () => {
                    if (document.activeElement === inputElement) {
                        return;
                    }
                    insertColumn(protyle, nodeElement, cellElement, "beforebegin", range, parseInt(element.querySelector("input").value));
                    window.siyuan.menus.menu.remove();
                });
                // @内联回调
                inputElement.addEventListener("keydown", (event: KeyboardEvent) => {
                                    if (!event.isComposing && event.key === "Enter") {
                        insertColumn(protyle, nodeElement, cellElement, "beforebegin", range, parseInt(element.querySelector("input").value));
                        window.siyuan.menus.menu.remove();
                    }
                });
            }
        });
    }
    if (colIsPure || nextColIsPure) {
        insertMenus.push({
            id: "insertColumnRight",
            icon: "iconInsertRight",
            label: `<div class="fn__flex" style="align-items: center;">
${siyuanI18n.insertColumnRight1.replace("${x}", `<span class="fn__space"></span><input type="number" step="1" min="1" value="1" placeholder="${siyuanI18n.enterKey}" class="b3-text-field b3-text-field--size"><span class="fn__space"></span>`)}
</div>`,
            accelerator: window.siyuan?.config?.keymap?.editor?.table?.insertColumnRight?.custom,
            /** 在右侧插入列（支持批量） */
            bind(element: HTMLElement) {
                const inputElement = element.querySelector("input");
                // @内联回调
                element.addEventListener("click", () => {
                    if (document.activeElement === inputElement) {
                        return;
                    }
                    insertColumn(protyle, nodeElement, cellElement, "afterend", range, parseInt(element.querySelector("input").value));
                    window.siyuan.menus.menu.remove();
                });
                // @内联回调
                inputElement.addEventListener("keydown", (event: KeyboardEvent) => {
                                    if (!event.isComposing && event.key === "Enter") {
                        insertColumn(protyle, nodeElement, cellElement, "afterend", range, parseInt(element.querySelector("input").value));
                        window.siyuan.menus.menu.remove();
                    }
                });
            }
        });
    }
    menus.push(...insertMenus);
    const other2Menus: IMenu[] = [];
    if (((!hasNone || (hasNone && !hasRowSpan && hasColSpan)) &&
        (!previousHasNone || (previousHasNone && !previousHasRowSpan && previousHasColSpan))) ||
        ((!hasNone || (hasNone && !hasRowSpan && hasColSpan)) &&
            (!nextHasNone || (nextHasNone && !nextHasRowSpan && nextHasColSpan))) ||
        (colIsPure && previousColIsPure) ||
        (colIsPure && nextColIsPure)
    ) {
        other2Menus.push({
            id: "separator_2",
            type: "separator"
        });
    }

    if ((!hasNone || (hasNone && !hasRowSpan && hasColSpan)) &&
        (!previousHasNone || (previousHasNone && !previousHasRowSpan && previousHasColSpan))) {
        other2Menus.push({
            id: "moveToUp",
            icon: "iconUp",
            label: siyuanI18n.moveToUp,
            accelerator: window.siyuan?.config?.keymap?.editor?.table?.moveToUp?.custom,
            /** 上移行 */
            click: () => {
                moveRowToUp(protyle, range, cellElement, nodeElement);
            }
        });
    }
    if ((!hasNone || (hasNone && !hasRowSpan && hasColSpan)) &&
        (!nextHasNone || (nextHasNone && !nextHasRowSpan && nextHasColSpan))) {
        other2Menus.push({
            id: "moveToDown",
            icon: "iconDown",
            label: siyuanI18n.moveToDown,
            accelerator: window.siyuan?.config?.keymap?.editor?.table?.moveToDown?.custom,
            /** 下移行 */
            click: () => {
                moveRowToDown(protyle, range, cellElement, nodeElement);
            }
        });
    }
    if (colIsPure && previousColIsPure) {
        other2Menus.push({
            id: "moveToLeft",
            icon: "iconLeft",
            label: siyuanI18n.moveToLeft,
            accelerator: window.siyuan?.config?.keymap?.editor?.table?.moveToLeft?.custom,
            /** 左移列 */
            click: () => {
                moveColumnToLeft(protyle, range, cellElement, nodeElement);
            }
        });
    }
    if (colIsPure && nextColIsPure) {
        other2Menus.push({
            id: "moveToRight",
            icon: "iconRight",
            label: siyuanI18n.moveToRight,
            accelerator: window.siyuan?.config?.keymap?.editor?.table?.moveToRight?.custom,
            /** 右移列 */
            click: () => {
                moveColumnToRight(protyle, range, cellElement, nodeElement);
            }
        });
    }
    menus.push(...other2Menus);
    if ((cellElement.parentElement?.parentElement?.tagName !== "THEAD" &&
        ((!hasNone && !hasRowSpan) || (hasNone && !hasRowSpan && hasColSpan))) || colIsPure) {
        menus.push({
            type: "separator"
        });
    }
    const removeMenus = [];
    if (cellElement.parentElement?.parentElement?.tagName !== "THEAD" &&
        ((!hasNone && !hasRowSpan) || (hasNone && !hasRowSpan && hasColSpan))) {
        removeMenus.push({
            id: "deleteRow",
            icon: "iconDeleteRow",
            label: siyuanI18n["delete-row"],
            accelerator: window.siyuan?.config?.keymap?.editor?.table?.["delete-row"]?.custom,
            /** 删除行 */
            click: () => {
                deleteRow(protyle, range, cellElement, nodeElement);
            }
        });
    }
    if (colIsPure) {
        removeMenus.push({
            id: "deleteColumn",
            icon: "iconDeleteColumn",
            label: siyuanI18n["delete-column"],
            accelerator: window.siyuan?.config?.keymap?.editor?.table?.["delete-column"]?.custom,
            /** 删除列 */
            click: () => {
                deleteColumn(protyle, range, nodeElement, cellElement);
            }
        });
    }
    menus.push(...removeMenus);
    return { menus, removeMenus, insertMenus, otherMenus, other2Menus };
};
