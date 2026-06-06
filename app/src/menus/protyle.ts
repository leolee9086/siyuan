import {
    hasClosestBlock,
    isInEmbedBlock
} from "../protyle/util/hasClosest";
import { focusBlock, focusByRange } from "../protyle/util/selection";
import {
    getColIndex,
    setTableAlign} from "../protyle/util/table";
import {
    insertRow,
    insertRowAbove,
    deleteRow,
    moveRowToUp,
    moveRowToDown,
} from "../protyle/util/table/row";
import {
    insertColumn,
    deleteColumn,
    moveColumnToLeft,
    moveColumnToRight,
} from "../protyle/util/table/column";
import { updateTableTitle } from "../protyle/util/table/title.update";
import { transaction } from "../protyle/wysiwyg/transaction";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import { isMobile } from "../util/platform/functions";
import { Dialog } from "../dialog";
import { setFold } from "../protyle/util/blockFold";

// ==================== 从拆分文件重新导出 ====================

// 从根目录拆分文件导出
export { refMenu } from "./protyleMenus/refMenu/protyle.refMenu";
export { tagMenu } from "./protyleMenus/refMenu/protyle.tagMenu";
export { inlineMathMenu } from "./protyleMenus/editorMenu/protyle.inlineMathMenu";
export { genImageWidthMenu } from "./protyleMenus/imageMenu/sizeMenu/protyle.genImageWidthMenu";
export { genImageHeightMenu } from "./protyleMenus/imageMenu/sizeMenu/protyle.genImageHeightMenu";
export { iframeMenu } from "./protyleMenus/iframeMenu/iframeMenu";
export { zoomOut } from "./protyleMenus/editorMenu/protyle.zoomOut";

// 从 protyleMenus/ 子目录导出
export { assetMenu, renderAssetList } from "./protyleMenus/assetMenu/protyle.asset";
export { contentMenu } from "./protyleMenus/contentMenu/protyle.contentMenu";
export { enterBack } from "./protyleMenus/editorMenu/protyle.enterBack";
export { fileAnnotationRefMenu } from "./protyleMenus/refMenu/protyle.fileAnnotationRefMenu";
export { imgMenu } from "./protyleMenus/imageMenu/protyle.imgMenu";
export { linkMenu } from "./protyleMenus/linkMenu/protyle.linkMenu";

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
    // @无需注释
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
                // @无需注释
                if (cellElement.tagName === "TH") {
                    let prueTrElement: HTMLElement | undefined;
                    // @内联回调
                    Array.from(nodeElement.querySelectorAll("thead tr")).find((item: Element) => {
                        prueTrElement = item as HTMLElement;
                        // @无需注释
                        for (const cell of Array.from(item.children)) {
                            const tableCell = cell as HTMLTableCellElement;
                            // @无需注释
                            if (tableCell.rowSpan !== 1 || tableCell.classList.contains("fn__none")) {
                                prueTrElement = undefined;
                            }
                        }
                        // @无需注释
                        if (prueTrElement) {
                            return true;
                        }
                    });
                    // @无需注释
                    if (prueTrElement) {
                        const tbodyElement = nodeElement.querySelector("tbody");
                        const theadElement = nodeElement.querySelector("thead");
                        if (tbodyElement && theadElement && theadElement.lastElementChild) {
                            while (prueTrElement !== theadElement.lastElementChild) {
                                const lastChild = theadElement.lastElementChild;
                                if (lastChild) {
                                    tbodyElement.insertAdjacentElement("afterbegin", lastChild);
                                }
                            }
                        }
                    }
                }
                focusByRange(range);
                const nodeId = nodeElement.getAttribute("data-node-id");
                if (nodeId) {
                    const { updateTransaction } = require("../protyle/wysiwyg/transaction");
                    updateTransaction(protyle, nodeId, nodeElement.outerHTML, oldHTML);
                }
            }
        });
    }
    const colElements = nodeElement.querySelectorAll("col");
    const thMatchElement = colElements[colIndex];
    // @无需注释
    if (thMatchElement && (thMatchElement.style.width || thMatchElement.style.minWidth !== "60px")) {
        otherMenus.push({
            id: "useDefaultWidth",
            label: siyuanI18n.useDefaultWidth,
            /** 使用默认宽度 */
            click: () => {
                const html = nodeElement.outerHTML;
                thMatchElement.style.width = "";
                thMatchElement.style.minWidth = "60px";
                const nodeId = nodeElement.getAttribute("data-node-id");
                if (nodeId) {
                    const { updateTransaction } = require("../protyle/wysiwyg/transaction");
                    updateTransaction(protyle, nodeId, nodeElement.outerHTML, html);
                }
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
            // @无需注释
            if (isPinHead) {
                nodeElement.removeAttribute("custom-pinthead");
            } else {
                nodeElement.setAttribute("custom-pinthead", "true");
            }
            const nodeId = nodeElement.getAttribute("data-node-id");
            if (nodeId) {
                const { updateTransaction } = require("../protyle/wysiwyg/transaction");
                updateTransaction(protyle, nodeId, nodeElement.outerHTML, html);
            }
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
            // @无需注释
            if (tableCell.colSpan > 1) {
                hasColSpan = true;
            }
            // @无需注释
            if (tableCell.rowSpan > 1) {
                hasRowSpan = true;
            }
        }
    }
    let previousHasNone: false | Element = false;
    let previousHasColSpan = false;
    let previousHasRowSpan = false;
    let previousRowElement = cellElement.parentElement?.previousElementSibling;
    // @无需注释
    if (!previousRowElement && cellElement.parentElement?.parentElement?.tagName === "TBODY") {
        const theadElement = tableElement.querySelector("thead");
        previousRowElement = theadElement?.lastElementChild || null;
    }
    // @无需注释
    if (previousRowElement) {
        previousHasNone = previousRowElement.querySelector(".fn__none") || false;
        for (const item of Array.from(previousRowElement.children)) {
            const tableCell = item as HTMLTableCellElement;
            // @无需注释
            if (tableCell.colSpan > 1) {
                previousHasColSpan = true;
            }
            // @无需注释
            if (tableCell.rowSpan > 1) {
                previousHasRowSpan = true;
            }
        }
    }
    let nextHasNone: false | Element = false;
    let nextHasColSpan = false;
    let nextHasRowSpan = false;
    let nextRowElement = cellElement.parentElement?.nextElementSibling;
    // @无需注释
    if (!nextRowElement && cellElement.parentElement?.parentElement?.tagName === "THEAD") {
        const tbodyElement = tableElement.querySelector("tbody");
        nextRowElement = tbodyElement?.firstElementChild || null;
    }
    // @无需注释
    if (nextRowElement) {
        nextHasNone = nextRowElement.querySelector(".fn__none") || false;
        for (const item of Array.from(nextRowElement.children)) {
            const tableCell = item as HTMLTableCellElement;
            // @无需注释
            if (tableCell.colSpan > 1) {
                nextHasColSpan = true;
            }
            // @无需注释
            if (tableCell.rowSpan > 1) {
                nextHasRowSpan = true;
            }
        }
    }
    let colIsPure = true;
    for (const row of Array.from(tableElement.rows)) {
        const cell = row.cells[colIndex];
        // @无需注释
        if (cell && (cell.classList.contains("fn__none") || cell.colSpan > 1 || cell.rowSpan > 1)) {
            colIsPure = false;
            break;
        }
    }
    let nextColIsPure = true;
    for (const row of Array.from(tableElement.rows)) {
        const cell = row.cells[colIndex + 1];
        // @无需注释
        if (cell && (cell.classList.contains("fn__none") || cell.colSpan > 1 || cell.rowSpan > 1)) {
            nextColIsPure = false;
            break;
        }
    }
    let previousColIsPure = true;
    for (const row of Array.from(tableElement.rows)) {
        const cell = row.cells[colIndex - 1];
        // @无需注释
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
    // @无需注释
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
                    // @无需注释
                    if (!event.isComposing && event.key === "Enter") {
                        insertRow(protyle, range, cellElement, nodeElement, parseInt(element.querySelector("input").value));
                        window.siyuan.menus.menu.remove();
                    }
                });
            }
        });
    }
    // @无需注释
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
                    // @无需注释
                    if (!event.isComposing && event.key === "Enter") {
                        insertColumn(protyle, nodeElement, cellElement, "beforebegin", range, parseInt(element.querySelector("input").value));
                        window.siyuan.menus.menu.remove();
                    }
                });
            }
        });
    }
    // @无需注释
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
                    // @无需注释
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
    // @无需注释
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

    // @无需注释
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
    // @无需注释
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
    // @无需注释
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
    // @无需注释
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
    // @无需注释
    if ((cellElement.parentElement?.parentElement?.tagName !== "THEAD" &&
        ((!hasNone && !hasRowSpan) || (hasNone && !hasRowSpan && hasColSpan))) || colIsPure) {
        menus.push({
            type: "separator"
        });
    }
    const removeMenus = [];
    // @无需注释
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
    // @无需注释
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

/**
 * 根据ID设置折叠状态
 * @作用 在编辑器中查找指定ID的元素并设置其折叠状态
 * @意图 提供通过ID远程控制块折叠的能力
 * @调用时机 需要折叠特定块时(如从其他视图触发折叠操作)
 * @param data - 包含目标ID和当前节点ID的数据对象
 * @param protyle - 编辑器实例
 * @同步豁免 遗留代码
 */
export const setFoldById = (data: {
    id: string,
    currentNodeID: string,
}, protyle: IProtyle) => {
    const elements = protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${data.id}"]`);
    for (const item of Array.from(elements)) {
        // @无需注释
        if (!isInEmbedBlock(item)) {
            const operations = setFold(protyle, item, true, false, true, true);
            if (operations.doOperations && operations.doOperations[0]) {
                operations.doOperations[0].context = {
                    focusId: data.currentNodeID,
                };
            }
            transaction(protyle, operations.doOperations, operations.undoOperations);
            break;
        }
    }
};

