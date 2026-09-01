import {paste} from "../util/paste";
import {focusBlock, focusByRange, focusByWbr, getEditorRange} from "../util/selection";
import {MenuItem} from "../../menus/Menu.Item";
import {copyPlainText, readClipboard} from "../util/compatibility";
import {clearTableCell, setTableAlign} from "../util/table/table";
import {deleteTableColumns, deleteTableRows, getTableFullColumnSelection, getTableFullRowSelection} from "../util/table/selection/operations";
import {isIncludeCell} from "../util/table/selection/geometry";
import {updateTransaction} from "./transaction/update";
import {siyuanI18n} from "../../util/siyuanEnvironments/i18n.getI18n.environment";

/**
 * 构建表格单元格选择后的右键菜单（合并、对齐、复制、剪切、粘贴等）。
 */
export function buildTableCellMenu(
    protyle: IProtyle,
    tableBlockElement: HTMLElement | false,
    tableSelectElement: HTMLElement,
    mouseUpEvent: MouseEvent,
): void {
    if (!tableBlockElement) {
        return;
    }
    if (!protyle.disabled) {
        window.siyuan.menus.menu.append(new MenuItem({
            id: "mergeCell",
            label: siyuanI18n.mergeCell,
            click: () => {
                if (tableBlockElement) {
                    executeMergeCell(protyle, tableBlockElement, tableSelectElement);
                }
            }
        }).element);
        window.siyuan.menus.menu.append(new MenuItem({
            id: "separator_1",
            type: "separator"
        }).element);
        appendAlignMenuItems(protyle, tableBlockElement, tableSelectElement);
        window.siyuan.menus.menu.append(new MenuItem({
            id: "separator_2",
            type: "separator"
        }).element);
    }
    appendCopyMenuItems(protyle, tableBlockElement);
    if (!protyle.disabled) {
        appendEditMenuItems(protyle, tableBlockElement);
        // S-Forge: 使用本地投影感知删除，保留合并单元格超集
        const tableElement = tableBlockElement.querySelector("table");
        if (tableElement) {
            const selectedCellElements: HTMLTableCellElement[] = [];
            const scrollLeft = tableBlockElement.firstElementChild.scrollLeft;
            const scrollTop = tableElement.scrollTop;
            tableBlockElement.querySelectorAll("th, td").forEach((item: HTMLTableCellElement) => {
                if (!item.classList.contains("fn__none") && isIncludeCell({
                    tableSelectElement,
                    scrollLeft,
                    scrollTop,
                    item,
                })) {
                    selectedCellElements.push(item);
                }
            });
            const rowSelection = getTableFullRowSelection(tableElement, selectedCellElements);
            const columnSelection = getTableFullColumnSelection(tableElement, selectedCellElements);
            if (rowSelection.indexes.length > 0 || columnSelection.indexes.length > 0) {
                window.siyuan.menus.menu.append(new MenuItem({
                    id: "deleteRowsSeparator",
                    type: "separator",
                }).element);
            }
            if (rowSelection.indexes.length > 0) {
                window.siyuan.menus.menu.append(new MenuItem({
                    id: "deleteRows",
                    icon: "iconTrashcan",
                    label: siyuanI18n["delete-row"],
                    click() {
                        tableSelectElement.removeAttribute("style");
                        deleteTableRows(protyle, tableBlockElement as HTMLElement, rowSelection.indexes);
                    },
                }).element);
            }
            if (columnSelection.indexes.length > 0) {
                window.siyuan.menus.menu.append(new MenuItem({
                    id: "deleteColumns",
                    icon: "iconTrashcan",
                    label: siyuanI18n["delete-column"],
                    click() {
                        tableSelectElement.removeAttribute("style");
                        deleteTableColumns(protyle, tableBlockElement as HTMLElement, columnSelection.indexes);
                    },
                }).element);
            }
        }
    }
    window.siyuan.menus.menu.popup({x: mouseUpEvent.clientX - 8, y: mouseUpEvent.clientY - 16});
}

function executeMergeCell(
    protyle: IProtyle,
    tableBlockElement: HTMLElement,
    tableSelectElement: HTMLElement,
) {
    const selectCellElements: HTMLTableCellElement[] = [];
    const colIndexList: number[] = [];
    const colCount = tableBlockElement.querySelectorAll("th").length;
    let fnNoneMax = 0;
    const scrollLeft = tableBlockElement.firstElementChild.scrollLeft;
    const scrollTop = tableBlockElement.querySelector("table").scrollTop;
    let isTHead = false;
    let isTBody = false;
    tableBlockElement.querySelectorAll("th, td").forEach((item: HTMLTableCellElement, index: number) => {
        if (item.classList.contains("fn__none")) {
            // 合并的元素中间有 fn__none 的元素
            if (item.previousElementSibling && item.previousElementSibling === selectCellElements[selectCellElements.length - 1]) {
                selectCellElements.push(item);
                if (!isTHead && item.parentElement.parentElement.tagName === "THEAD") {
                    isTHead = true;
                } else if (!isTBody && item.parentElement.parentElement.tagName === "TBODY") {
                    isTBody = true;
                }
            } else {
                if (index < fnNoneMax && colIndexList.includes((index + 1) % colCount)) {
                    selectCellElements.push(item);
                    if (!isTHead && item.parentElement.parentElement.tagName === "THEAD") {
                        isTHead = true;
                    } else if (!isTBody && item.parentElement.parentElement.tagName === "TBODY") {
                        isTBody = true;
                    }
                }
            }
        } else {
            if (isIncludeCell({
                tableSelectElement,
                scrollLeft,
                scrollTop,
                item,
            })) {
                selectCellElements.push(item);
                if (!isTHead && item.parentElement.parentElement.tagName === "THEAD") {
                    isTHead = true;
                } else if (!isTBody && item.parentElement.parentElement.tagName === "TBODY") {
                    isTBody = true;
                }
                colIndexList.push((index + 1) % colCount);
                // https://github.com/siyuan-note/insider/issues/1014
                fnNoneMax = Math.max((item.rowSpan - 1) * colCount + index + 1, fnNoneMax);
            }
        }
    });
    tableSelectElement.removeAttribute("style");
    const oldHTML = tableBlockElement.outerHTML;
    let cellElement = selectCellElements[0];
    let colSpan = cellElement.colSpan;
    let idx = 1;
    while (cellElement.nextElementSibling && cellElement.nextElementSibling === selectCellElements[idx]) {
        cellElement = cellElement.nextElementSibling as HTMLTableCellElement;
        if (!cellElement.classList.contains("fn__none")) { // https://github.com/siyuan-note/insider/issues/1007#issuecomment-1046195608
            colSpan += cellElement.colSpan;
        }
        idx++;
    }
    let html = "";
    let rowElement: Element = selectCellElements[0].parentElement;
    let rowSpan = selectCellElements[0].rowSpan;
    selectCellElements.forEach((item, index) => {
        let cellHTML = item.innerHTML.trim();
        if (cellHTML.endsWith("<br>")) {
            cellHTML = cellHTML.substr(0, cellHTML.length - 4);
        }
        html += cellHTML + ((!cellHTML || index === selectCellElements.length - 1) ? "" : "<br>");
        if (index !== 0) {
            if (rowElement !== item.parentElement) {
                if (!item.classList.contains("fn__none")) { // https://github.com/siyuan-note/insider/issues/1011
                    rowSpan += item.rowSpan;
                }
                rowElement = item.parentElement;
                if (selectCellElements[0].parentElement.parentElement.tagName === "THEAD" && item.parentElement.parentElement.tagName !== "THEAD") {
                    selectCellElements[0].parentElement.parentElement.insertAdjacentElement("beforeend", item.parentElement);
                }
            }
            item.classList.add("fn__none");
            item.innerHTML = "";
        }
    });

    // https://github.com/siyuan-note/insider/issues/1017
    if (isTHead && isTBody) {
        rowElement = rowElement.parentElement.nextElementSibling.firstElementChild;
        while (rowElement && rowElement.parentElement.tagName !== "THEAD") {
            let colSpanCount = 0;
            let noneCount = 0;
            Array.from(rowElement.children).forEach((item: HTMLTableCellElement) => {
                colSpanCount += item.colSpan - 1;
                if (item.classList.contains("fn__none")) {
                    noneCount++;
                }
            });
            if (colSpanCount !== noneCount) {
                selectCellElements[0].parentElement.parentElement.insertAdjacentElement("beforeend", rowElement);
                rowElement = rowElement.parentElement.nextElementSibling.firstElementChild;
            } else {
                break;
            }
        }
    }

    // 合并背景色不会修改，需要等计算完毕
    setTimeout(() => {
        if (tableBlockElement) {
            selectCellElements[0].innerHTML = (html.replace(/<br>$/, "") || "<br>") + "<wbr>";
            selectCellElements[0].colSpan = colSpan;
            selectCellElements[0].rowSpan = rowSpan;
            focusByWbr(selectCellElements[0], document.createRange());
            protyle.wysiwyg.withInputSuppressed(() => {
                document.execCommand("insertHTML", false, "");
            });
            updateTransaction(protyle, tableBlockElement.getAttribute("data-node-id"), tableBlockElement.outerHTML, oldHTML);
        }
    });
}

function getSelectedCellsForAlign(
    tableBlockElement: HTMLElement,
    tableSelectElement: HTMLElement,
): HTMLTableCellElement[] {
    const selectCellElements: HTMLTableCellElement[] = [];
    const scrollLeft = tableBlockElement.firstElementChild.scrollLeft;
    const scrollTop = tableBlockElement.querySelector("table").scrollTop;
    tableBlockElement.querySelectorAll("th, td").forEach((item: HTMLTableCellElement) => {
        if (!item.classList.contains("fn__none") &&
            isIncludeCell({
                tableSelectElement,
                scrollLeft,
                scrollTop,
                item,
            }) && (selectCellElements.length === 0 || (selectCellElements.length > 0 && item.offsetTop === selectCellElements[0].offsetTop))) {
            selectCellElements.push(item);
        }
    });
    return selectCellElements;
}

function appendAlignMenuItems(
    protyle: IProtyle,
    tableBlockElement: HTMLElement,
    tableSelectElement: HTMLElement,
) {
    const alignOptions: Array<{ id: string; icon: string; accelKey: string; label: string; align: string }> = [
        {id: "alignLeft", icon: "iconAlignLeft", accelKey: "alignLeft", label: siyuanI18n.alignLeft, align: "left"},
        {id: "alignCenter", icon: "iconAlignCenter", accelKey: "alignCenter", label: siyuanI18n.alignCenter, align: "center"},
        {id: "alignRight", icon: "iconAlignRight", accelKey: "alignRight", label: siyuanI18n.alignRight, align: "right"},
        {id: "useDefaultAlign", icon: "", accelKey: "", label: siyuanI18n.useDefaultAlign, align: ""},
    ];
    for (const opt of alignOptions) {
        window.siyuan.menus.menu.append(new MenuItem({
            id: opt.id,
            icon: opt.icon,
            accelerator: opt.accelKey ? window.siyuan.config.keymap.editor.general[opt.accelKey].custom : undefined,
            label: opt.label,
            click: () => {
                if (tableBlockElement) {
                    const cells = getSelectedCellsForAlign(tableBlockElement, tableSelectElement);
                    tableSelectElement.removeAttribute("style");
                    setTableAlign(protyle, cells, tableBlockElement, opt.align, getEditorRange(tableBlockElement));
                }
            }
        }).element);
    }
}

function appendCopyMenuItems(
    protyle: IProtyle,
    tableBlockElement: HTMLElement | false,
) {
    window.siyuan.menus.menu.append(new MenuItem({
        id: "copyPlainText",
        label: siyuanI18n.copyPlainText,
        click() {
            if (tableBlockElement) {
                const selectCellElements: HTMLTableCellElement[] = [];
                const scrollLeft = tableBlockElement.firstElementChild.scrollLeft;
                const scrollTop = tableBlockElement.querySelector("table").scrollTop;
                const tse = tableBlockElement.querySelector(".table__select") as HTMLElement;
                tableBlockElement.querySelectorAll("th, td").forEach((item: HTMLTableCellElement) => {
                    if (!item.classList.contains("fn__none") && isIncludeCell({
                        tableSelectElement: tse,
                        scrollLeft,
                        scrollTop,
                        item,
                    })) {
                        selectCellElements.push(item);
                    }
                });
                let textPlain = "";
                selectCellElements.forEach((item, index) => {
                    textPlain += item.textContent.trim() + "\t";
                    if (!item.nextElementSibling || !selectCellElements[index + 1] ||
                        item.nextElementSibling !== selectCellElements[index + 1]) {
                        textPlain = textPlain.slice(0, -1) + "\n";
                    }
                });
                copyPlainText(textPlain.slice(0, -1));
                focusBlock(tableBlockElement);
            }
        }
    }).element);
    window.siyuan.menus.menu.append(new MenuItem({
        id: "copy",
        icon: "iconCopy",
        accelerator: "⌘C",
        label: siyuanI18n.copy,
        click() {
            if (tableBlockElement) {
                focusByRange(getEditorRange(tableBlockElement));
                document.execCommand("copy");
            }
        }
    }).element);
}

function appendEditMenuItems(
    protyle: IProtyle,
    tableBlockElement: HTMLElement | false,
) {
    window.siyuan.menus.menu.append(new MenuItem({
        id: "cut",
        icon: "iconCut",
        accelerator: "⌘X",
        label: siyuanI18n.cut,
        click() {
            if (tableBlockElement) {
                focusByRange(getEditorRange(tableBlockElement));
                document.execCommand("cut");
            }
        }
    }).element);
    window.siyuan.menus.menu.append(new MenuItem({
        id: "paste",
        label: siyuanI18n.paste,
        icon: "iconPaste",
        accelerator: "⌘V",
        async click() {
            if (document.queryCommandSupported("paste")) {
                document.execCommand("paste");
            } else if (tableBlockElement) {
                try {
                    const text = await readClipboard();
                    paste(protyle, Object.assign(text, {target: tableBlockElement as HTMLElement}));
                } catch (e) {
                    console.log(e);
                }
            }
        }
    }).element);
    window.siyuan.menus.menu.append(new MenuItem({
        id: "clear",
        label: siyuanI18n.clear,
        icon: "iconTrashcan",
        accelerator: "⌦",
        click() {
            clearTableCell(protyle, tableBlockElement as HTMLElement);
        }
    }).element);
}
