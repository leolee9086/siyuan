import {
    hasClosestBlock,
    isInEmbedBlock
} from "../protyle/util/hasClosest";
import { focusBlock, focusByRange, } from "../protyle/util/selection";
import {
    deleteColumn,
    deleteRow,
    getColIndex,
    insertColumn,
    insertRow,
    insertRowAbove,
    moveColumnToLeft,
    moveColumnToRight,
    moveRowToDown,
    moveRowToUp,
    setTableAlign
} from "../protyle/util/table";
import { transaction, updateTransaction } from "../protyle/wysiwyg/transaction";
import { openMenu } from "./commonMenuItem.openMenu";
import { preventScroll } from "../protyle/scroll/preventScroll";
/// #if !MOBILE
/// #endif
import { removeFoldHeading } from "../protyle/util/heading";
import { lineNumberRender } from "../protyle/render/highlightRender";
import { renameAsset } from "../editor/rename";
import { exportAsset } from "./util";
import { clearSelect } from "../protyle/util/clearSelect";
import { scrollCenter } from "../util/highlightById";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";

export const videoMenu = (protyle: IProtyle, nodeElement: Element, type: string) => {
    const id = nodeElement.getAttribute("data-node-id");
    const videoElement = nodeElement.querySelector(type === "NodeVideo" ? "video" : "audio");
    let html = nodeElement.outerHTML;
    const subMenus: IMenu[] = [{
        id: "asset",
        iconHTML: "",
        type: "readonly",
        label: `<textarea spellcheck="false" rows="1" style="margin: 4px 0" class="b3-text-field fn__block" placeholder="${siyuanI18n.link}">${videoElement.getAttribute("src")}</textarea>`,
        bind(element) {
            element.style.maxWidth = "none";
            element.querySelector("textarea").addEventListener("change", (event) => {
                videoElement.setAttribute("src", (event.target as HTMLTextAreaElement).value.replace(/\n|\r\n|\r|\u2028|\u2029/g, "").trim());
                updateTransaction(protyle, id, nodeElement.outerHTML, html);
                html = nodeElement.outerHTML;
                event.stopPropagation();
            });
        }
    }];
    const src = videoElement.getAttribute("src");
    if (src && src.startsWith("assets/")) {
        subMenus.push({
            type: "separator"
        });
        subMenus.push({
            id: "rename",
            label: siyuanI18n.rename,
            icon: "iconEdit",
            click() {
                renameAsset(src);
            }
        });
    }
    if (src) {
        subMenus.push({
            id: "openBy",
            label: siyuanI18n.openBy,
            icon: "iconOpen",
            submenu: openMenu(protyle.app, src, true, false) as IMenu[]
        });
    }
    if (src && src.startsWith("assets/")) {
        subMenus.push(exportAsset(src));
    }
    return subMenus;
};

export const tableMenu = (protyle: IProtyle, nodeElement: Element, cellElement: HTMLTableCellElement, range: Range) => {
    const otherMenus: IMenu[] = [];
    const colIndex = getColIndex(cellElement);
    if (cellElement.rowSpan > 1 || cellElement.colSpan > 1) {
        otherMenus.push({
            id: "cancelMerged",
            label: siyuanI18n.cancelMerged,
            click: () => {
                const oldHTML = nodeElement.outerHTML;
                let rowSpan = cellElement.rowSpan;
                let currentRowElement: Element = cellElement.parentElement;
                const orgColSpan = cellElement.colSpan;
                while (rowSpan > 0 && currentRowElement) {
                    let currentCellElement = currentRowElement.children[colIndex] as HTMLTableCellElement;
                    let colSpan = orgColSpan;
                    while (colSpan > 0 && currentCellElement) {
                        currentCellElement.classList.remove("fn__none");
                        currentCellElement.colSpan = 1;
                        currentCellElement.rowSpan = 1;
                        currentCellElement = currentCellElement.nextElementSibling as HTMLTableCellElement;
                        colSpan--;
                    }
                    currentRowElement = currentRowElement.nextElementSibling;
                    rowSpan--;
                }
                cellElement.rowSpan = 1;
                cellElement.colSpan = 1;
                if (cellElement.tagName === "TH") {
                    let prueTrElement: HTMLElement;
                    Array.from(nodeElement.querySelectorAll("thead tr")).find((item: HTMLElement) => {
                        prueTrElement = item;
                        Array.from(item.children).forEach((cellElement: HTMLTableCellElement) => {
                            if (cellElement.rowSpan !== 1 || cellElement.classList.contains("fn__none")) {
                                prueTrElement = undefined;
                            }
                        });
                        if (prueTrElement) {
                            return true;
                        }
                    });
                    if (prueTrElement) {
                        const tbodyElement = nodeElement.querySelector("tbody");
                        const theadElement = nodeElement.querySelector("thead");
                        while (prueTrElement !== theadElement.lastElementChild) {
                            tbodyElement.insertAdjacentElement("afterbegin", theadElement.lastElementChild);
                        }
                    }
                }
                focusByRange(range);
                updateTransaction(protyle, nodeElement.getAttribute("data-node-id"), nodeElement.outerHTML, oldHTML);
            }
        });
    }
    const thMatchElement = nodeElement.querySelectorAll("col")[colIndex];
    if (thMatchElement.style.width || thMatchElement.style.minWidth !== "60px") {
        otherMenus.push({
            id: "useDefaultWidth",
            label: siyuanI18n.useDefaultWidth,
            click: () => {
                const html = nodeElement.outerHTML;
                thMatchElement.style.width = "";
                thMatchElement.style.minWidth = "60px";
                updateTransaction(protyle, nodeElement.getAttribute("data-node-id"), nodeElement.outerHTML, html);
            }
        });
    }
    const isPinHead = nodeElement.getAttribute("custom-pinthead");
    otherMenus.push({
        id: isPinHead ? "unpinTableHead" : "pinTableHead",
        icon: isPinHead ? "iconUnpin" : "iconPin",
        label: isPinHead ? siyuanI18n.unpinTableHead : siyuanI18n.pinTableHead,
        click: () => {
            const html = nodeElement.outerHTML;
            if (isPinHead) {
                nodeElement.removeAttribute("custom-pinthead");
            } else {
                nodeElement.setAttribute("custom-pinthead", "true");
            }
            updateTransaction(protyle, nodeElement.getAttribute("data-node-id"), nodeElement.outerHTML, html);
        }
    });
    otherMenus.push({ id: "separator_1", type: "separator" });
    otherMenus.push({
        id: "alignLeft",
        icon: "iconAlignLeft",
        accelerator: window.siyuan.config.keymap.editor.general.alignLeft.custom,
        label: siyuanI18n.alignLeft,
        click: () => {
            setTableAlign(protyle, [cellElement], nodeElement, "left", range);
        }
    });
    otherMenus.push({
        id: "alignCenter",
        icon: "iconAlignCenter",
        label: siyuanI18n.alignCenter,
        accelerator: window.siyuan.config.keymap.editor.general.alignCenter.custom,
        click: () => {
            setTableAlign(protyle, [cellElement], nodeElement, "center", range);
        }
    });
    otherMenus.push({
        id: "alignRight",
        icon: "iconAlignRight",
        label: siyuanI18n.alignRight,
        accelerator: window.siyuan.config.keymap.editor.general.alignRight.custom,
        click: () => {
            setTableAlign(protyle, [cellElement], nodeElement, "right", range);
        }
    });
    otherMenus.push({
        id: "useDefaultAlign",
        icon: "",
        label: siyuanI18n.useDefaultAlign,
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
    const hasNone = cellElement.parentElement.querySelector(".fn__none");
    let hasColSpan = false;
    let hasRowSpan = false;
    Array.from(cellElement.parentElement.children).forEach((item: HTMLTableCellElement) => {
        if (item.colSpan > 1) {
            hasColSpan = true;
        }
        if (item.rowSpan > 1) {
            hasRowSpan = true;
        }
    });
    let previousHasNone: false | Element = false;
    let previousHasColSpan = false;
    let previousHasRowSpan = false;
    let previousRowElement = cellElement.parentElement.previousElementSibling;
    if (!previousRowElement && cellElement.parentElement.parentElement.tagName === "TBODY") {
        previousRowElement = tableElement.querySelector("thead").lastElementChild;
    }
    if (previousRowElement) {
        previousHasNone = previousRowElement.querySelector(".fn__none");
        Array.from(previousRowElement.children).forEach((item: HTMLTableCellElement) => {
            if (item.colSpan > 1) {
                previousHasColSpan = true;
            }
            if (item.rowSpan > 1) {
                previousHasRowSpan = true;
            }
        });
    }
    let nextHasNone: false | Element = false;
    let nextHasColSpan = false;
    let nextHasRowSpan = false;
    let nextRowElement = cellElement.parentElement.nextElementSibling;
    if (!nextRowElement && cellElement.parentElement.parentElement.tagName === "THEAD") {
        nextRowElement = tableElement.querySelector("tbody")?.firstElementChild;
    }
    if (nextRowElement) {
        nextHasNone = nextRowElement.querySelector(".fn__none");
        Array.from(nextRowElement.children).forEach((item: HTMLTableCellElement) => {
            if (item.colSpan > 1) {
                nextHasColSpan = true;
            }
            if (item.rowSpan > 1) {
                nextHasRowSpan = true;
            }
        });
    }
    let colIsPure = true;
    Array.from(tableElement.rows).find(item => {
        const cellElement = item.cells[colIndex];
        if (cellElement.classList.contains("fn__none") || cellElement.colSpan > 1 || cellElement.rowSpan > 1) {
            colIsPure = false;
            return true;
        }
    });
    let nextColIsPure = true;
    Array.from(tableElement.rows).find(item => {
        const cellElement = item.cells[colIndex + 1];
        if (cellElement && (cellElement.classList.contains("fn__none") || cellElement.colSpan > 1 || cellElement.rowSpan > 1)) {
            nextColIsPure = false;
            return true;
        }
    });
    let previousColIsPure = true;
    Array.from(tableElement.rows).find(item => {
        const cellElement = item.cells[colIndex - 1];
        if (cellElement && (cellElement.classList.contains("fn__none") || cellElement.colSpan > 1 || cellElement.rowSpan > 1)) {
            previousColIsPure = false;
            return true;
        }
    });
    const insertMenus = [];
    insertMenus.push({
        id: "insertRowAbove",
        icon: "iconBefore",
        label: siyuanI18n.insertRowAbove,
        accelerator: window.siyuan.config.keymap.editor.table.insertRowAbove.custom,
        click: () => {
            insertRowAbove(protyle, range, cellElement, nodeElement);
        }
    });
    if (!nextHasNone || (nextHasNone && !nextHasRowSpan && nextHasColSpan)) {
        insertMenus.push({
            id: "insertRowBelow",
            icon: "iconAfter",
            label: siyuanI18n.insertRowBelow,
            accelerator: window.siyuan.config.keymap.editor.table.insertRowBelow.custom,
            click: () => {
                insertRow(protyle, range, cellElement, nodeElement);
            }
        });
    }
    if (colIsPure || previousColIsPure) {
        insertMenus.push({
            id: "insertColumnLeft",
            icon: "iconInsertLeft",
            label: siyuanI18n.insertColumnLeft,
            accelerator: window.siyuan.config.keymap.editor.table.insertColumnLeft.custom,
            click: () => {
                insertColumn(protyle, nodeElement, cellElement, "beforebegin", range);
            }
        });
    }
    if (colIsPure || nextColIsPure) {
        insertMenus.push({
            id: "insertColumnRight",
            icon: "iconInsertRight",
            label: siyuanI18n.insertColumnRight,
            accelerator: window.siyuan.config.keymap.editor.table.insertColumnRight.custom,
            click: () => {
                insertColumn(protyle, nodeElement, cellElement, "afterend", range);
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
            accelerator: window.siyuan.config.keymap.editor.table.moveToUp.custom,
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
            accelerator: window.siyuan.config.keymap.editor.table.moveToDown.custom,
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
            accelerator: window.siyuan.config.keymap.editor.table.moveToLeft.custom,
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
            accelerator: window.siyuan.config.keymap.editor.table.moveToRight.custom,
            click: () => {
                moveColumnToRight(protyle, range, cellElement, nodeElement);
            }
        });
    }
    menus.push(...other2Menus);
    if ((cellElement.parentElement.parentElement.tagName !== "THEAD" &&
        ((!hasNone && !hasRowSpan) || (hasNone && !hasRowSpan && hasColSpan))) || colIsPure) {
        menus.push({
            type: "separator"
        });
    }
    const removeMenus = [];
    if (cellElement.parentElement.parentElement.tagName !== "THEAD" &&
        ((!hasNone && !hasRowSpan) || (hasNone && !hasRowSpan && hasColSpan))) {
        removeMenus.push({
            id: "deleteRow",
            icon: "iconDeleteRow",
            label: siyuanI18n["delete-row"],
            accelerator: window.siyuan.config.keymap.editor.table["delete-row"].custom,
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
            accelerator: window.siyuan.config.keymap.editor.table["delete-column"].custom,
            click: () => {
                deleteColumn(protyle, range, nodeElement, cellElement);
            }
        });
    }
    menus.push(...removeMenus);
    return { menus, removeMenus, insertMenus, otherMenus, other2Menus };
};

export const setFoldById = (data: {
    id: string,
    currentNodeID: string,
}, protyle: IProtyle) => {
    Array.from(protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${data.id}"]`)).find((item: Element) => {
        if (!isInEmbedBlock(item)) {
            const operations = setFold(protyle, item, true, false, true, true);
            operations.doOperations[0].context = {
                focusId: data.currentNodeID,
            };
            transaction(protyle, operations.doOperations, operations.undoOperations);
            return true;
        }
    });
};

export const setFold = (protyle: IProtyle, nodeElement: Element, isOpen?: boolean,
    isRemove?: boolean, addLoading = true, getOperations = false) => {
    if (nodeElement.getAttribute("data-type") === "NodeListItem" && nodeElement.childElementCount < 4 &&
        // 该情况需要强制展开 https://github.com/siyuan-note/siyuan/issues/12327
        !isOpen) {
        // 没有子列表或多个块的列表项不进行折叠
        return { fold: -1 };
    }
    if (nodeElement.getAttribute("data-type") === "NodeThematicBreak") {
        return { fold: -1 };
    }
    const hasFold = nodeElement.getAttribute("fold") === "1";
    if (hasFold) {
        if (typeof isOpen === "boolean" && !isOpen) {
            return { fold: -1 };
        }
        nodeElement.removeAttribute("fold");
        // https://github.com/siyuan-note/siyuan/issues/4411
        nodeElement.querySelectorAll(".protyle-linenumber__rows").forEach((item: HTMLElement) => {
            lineNumberRender(item.parentElement);
        });
    } else {
        if (typeof isOpen === "boolean" && isOpen) {
            return { fold: -1 };
        }
        nodeElement.setAttribute("fold", "1");
        // 光标在子列表中，再次 focus 段尾的时候不会变 https://ld246.com/article/1647099132461
        if (getSelection().rangeCount > 0) {
            const range = getSelection().getRangeAt(0);
            const blockElement = hasClosestBlock(range.startContainer);
            if (blockElement && blockElement.getBoundingClientRect().width === 0) {
                // https://github.com/siyuan-note/siyuan/issues/5833
                focusBlock(nodeElement, undefined, false);
            }
        }
        clearSelect(["img", "av"], nodeElement);
        scrollCenter(protyle, nodeElement);
    }
    const id = nodeElement.getAttribute("data-node-id");
    const doOperations: IOperation[] = [];
    const undoOperations: IOperation[] = [];
    if (nodeElement.getAttribute("data-type") === "NodeHeading") {
        if (hasFold) {
            if (addLoading) {
                nodeElement.insertAdjacentHTML("beforeend", '<div spin="1" style="text-align: center"><img width="24px" height="24px" src="/stage/loading-pure.svg"></div>');
            }
            doOperations.push({
                action: "unfoldHeading",
                id,
                data: isRemove ? "remove" : undefined,
            });
            undoOperations.push({
                action: "foldHeading",
                id
            });
        } else {
            doOperations.push({
                action: "foldHeading",
                id
            });
            undoOperations.push({
                action: "unfoldHeading",
                id
            });
            removeFoldHeading(nodeElement);
        }
    } else {
        doOperations.push({
            action: "setAttrs",
            id,
            data: JSON.stringify({ fold: hasFold ? "" : "1" })
        });
        undoOperations.push({
            action: "setAttrs",
            id,
            data: JSON.stringify({ fold: hasFold ? "1" : "" })
        });
    }
    if (!getOperations) {
        transaction(protyle, doOperations, undoOperations);
    }
    // 折叠后，防止滚动条滚动后调用 get 请求 https://github.com/siyuan-note/siyuan/issues/2248
    preventScroll(protyle);
    return { fold: !hasFold ? 1 : 0, undoOperations, doOperations };
};
