import { hasClosestByTag } from "../util/hasClosest";
import { Constants } from "../../constants";
import { removeEmbed } from "./removeEmbed";
import { fetchSyncPost } from "../../util/network/fetch";
import { countBlockWord } from "../runtime/status.port";
import { encodeBase64 } from "../util/compatibility";
import {isIncludeCell} from "../util/table/selection/geometry";
import {getTableRangeHTML} from "../util/table/grid/html";
import {genCellValueByElement} from "../render/av/cell.value";
import {getTypeByCellElement} from "../render/av/cell/position";
import {getCellText} from "../render/av/cell/render";
import { removeZWJ } from "../util/normalizeText";
import { enableLuteMarkdownSyntax, getTextStar, restoreLuteMarkdownSyntax } from "../util/paste";
import { enhanceRichClipboard } from "../util/richClipboard";
import type {CopyClipboardEvent} from "./index.copy.types";

export function processSelectAV(nodeElement: HTMLElement) {
    let html = "";
    let textPlain = "";
    const cellElements: Element[] = Array.from(nodeElement.querySelectorAll(".av__cell--active, .av__cell--select")) || [];
    if (cellElements.length === 0) {
        nodeElement.querySelectorAll(".av__row--select:not(.av__row--header)").forEach(rowElement => {
            rowElement.querySelectorAll(".av__cell").forEach(cellElement => {
                cellElements.push(cellElement);
            });
        });
    }
    if (cellElements.length > 0) {
        html = "[";
        cellElements.forEach((item: HTMLElement, index) => {
            const cellText = getCellText(item);
            if (index === 0 || (
                cellElements[index - 1] !== item.previousElementSibling &&
                !(item.previousElementSibling?.classList.contains("av__colsticky") && !cellElements[index - 1].nextElementSibling &&
                    cellElements[index - 1].parentElement === item.previousElementSibling)
            )) {
                html += "[";
            }
            html += JSON.stringify(genCellValueByElement(getTypeByCellElement(item), item)) + ",";
            if (index === cellElements.length - 1 || (
                cellElements[index + 1] !== item.nextElementSibling &&
                !(!item.nextElementSibling && item.parentElement.nextElementSibling === cellElements[index + 1])
            )) {
                html = html.substring(0, html.length - 1) + "],";
                textPlain += cellText + "\n";
            } else {
                textPlain += cellText + "\t";
            }
        });
        textPlain = textPlain.substring(0, textPlain.length - 1);
        html = html.substring(0, html.length - 1) + "]";
    }
    return { html, textPlain };
}

export function processSelectTable(protyle: IProtyle, nodeElement: HTMLElement) {
    const scrollLeft = nodeElement.firstElementChild.scrollLeft;
    const scrollTop = nodeElement.querySelector("table").scrollTop;
    const tableSelectElement = nodeElement.querySelector(".table__select") as HTMLElement;
    const tableElement = nodeElement.querySelector("table");
    let startCell: HTMLElement = null;
    let endCell: HTMLElement = null;
    const allCells = Array.from(tableElement.querySelectorAll("th, td")) as HTMLElement[];
    allCells.forEach((item: HTMLTableCellElement) => {
        if (item.classList.contains("fn__none")) {
            return;
        }
        if (isIncludeCell({tableSelectElement, scrollLeft, scrollTop, item})) {
            if (!startCell) {
                startCell = item;
            }
            endCell = item;
        }
    });
    let html: string;
    if (startCell && endCell) {
        html = getTableRangeHTML(tableElement, startCell, endCell);
    } else {
        html = "<table></table>";
    }
    const textPlain = protyle.lute.HTML2Md(html);
    return { html, textPlain };
}

export async function processSingleBlock(item: HTMLElement, notebookId: string) {
    let needClipboardWrite = false;
    let itemHTML: string;
    if (item.getAttribute("data-type") === "NodeHeading" && item.getAttribute("fold") === "1") {
        needClipboardWrite = true;
        const response = await fetchSyncPost("/api/block/getHeadingChildrenDOM", {
            id: item.getAttribute("data-node-id"),
            removeFoldAttr: false
        });
        itemHTML = response.data;
    } else if (item.getAttribute("data-type") !== "NodeBlockQueryEmbed" && item.querySelector('[data-type="NodeHeading"][fold="1"]')) {
        needClipboardWrite = true;
        const response = await fetchSyncPost("/api/block/getBlockDOM", {
            id: item.getAttribute("data-node-id"),
            notebook: notebookId,
        });
        itemHTML = response.data.dom;
    } else {
        itemHTML = removeEmbed(item);
    }
    return { itemHTML, needClipboardWrite };
}

export function wrapListItem(
    item: HTMLElement,
    itemHTML: string,
    listHTML: string,
    isLastInGroup: boolean,
) {
    if (!listHTML) {
        listHTML = `<div data-subtype="${item.getAttribute("data-subtype")}" data-node-id="${Lute.NewNodeID()}" data-type="NodeList" class="list">`;
    }
    listHTML += itemHTML;
    if (isLastInGroup) {
        const wrapped = `${listHTML}<div class="protyle-attr" contenteditable="false">${Constants.ZWSP}</div></div>`;
        return { listHTML: "", html: wrapped };
    }
    return { listHTML, html: "" };
}

export async function processSelectElements(
    protyle: IProtyle,
    selectElements: Element[],
) {
    let html = "";
    let needClipboardWrite = false;
    const isRefText = selectElements[0].getAttribute("data-reftext") === "true";
    if (selectElements[0].getAttribute("data-type") === "NodeListItem" &&
        selectElements[0].parentElement.classList.contains("list") &&
        selectElements[0].parentElement.childElementCount - 1 === selectElements.length) {
        const hasNoLiElement = selectElements.find(item => {
            if (!selectElements[0].parentElement.contains(item)) {
                return true;
            }
        });
        if (!hasNoLiElement) {
            selectElements = [selectElements[0].parentElement];
        }
    }
    let listHTML = "";
    for (let i = 0; i < selectElements.length; i++) {
        const item = selectElements[i] as HTMLElement;
        if (isRefText) {
            html += getTextStar(item) + "\n\n";
        } else {
            const result = await processSingleBlock(item, protyle.notebookId);
            needClipboardWrite = needClipboardWrite || result.needClipboardWrite;
            if (item.getAttribute("data-type") === "NodeListItem") {
                const isLastInGroup = i === selectElements.length - 1 ||
                    selectElements[i + 1].getAttribute("data-type") !== "NodeListItem" ||
                    selectElements[i + 1].getAttribute("data-subtype") !== item.getAttribute("data-subtype");
                const wrapResult = wrapListItem(item, result.itemHTML, listHTML, isLastInGroup);
                listHTML = wrapResult.listHTML;
                if (wrapResult.html) {
                    html += wrapResult.html;
                }
            } else {
                html += result.itemHTML;
            }
        }
    }
    if (isRefText) {
        html = html.slice(0, -2);
        selectElements[0].removeAttribute("data-reftext");
    }
    return { html, needClipboardWrite };
}

export function detectTableRange(range: Range, selectTableElement: boolean | number) {
    let selectTableRange = false;
    let tableRangeElement: HTMLElement = null;
    let tableRangeStartCell: HTMLElement = null;
    let tableRangeEndCell: HTMLElement = null;
    if (!selectTableElement) {
        const startCell = hasClosestByTag(range.startContainer, "TD") || hasClosestByTag(range.startContainer, "TH");
        const endCell = hasClosestByTag(range.endContainer, "TD") || hasClosestByTag(range.endContainer, "TH");
        if (startCell && endCell && startCell !== endCell) {
            const startTable = (startCell as HTMLElement).closest("table");
            if (startTable && startTable === (endCell as HTMLElement).closest("table")) {
                selectTableRange = true;
                tableRangeElement = (startCell as HTMLElement).closest('[data-type="NodeTable"]') as HTMLElement;
                tableRangeStartCell = startCell as HTMLElement;
                tableRangeEndCell = endCell as HTMLElement;
            }
        }
    }
    return { selectTableRange, tableRangeElement, tableRangeStartCell, tableRangeEndCell };
}

export function collectSelectElements(
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    selectImgElement: HTMLElement | null,
    selectAVElement: HTMLElement | null,
    selectTableElement: boolean | number,
    selectTableRange: boolean,
) {
    let selectElements = Array.from(protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select"));
    if (selectElements.length === 0 && range.toString() === "" && !range.cloneContents().querySelector("img") &&
        !selectImgElement && !selectAVElement && !selectTableElement && !selectTableRange) {
        nodeElement.classList.add("protyle-wysiwyg--select");
        countBlockWord([nodeElement.getAttribute("data-node-id")], protyle.block.rootID, false, protyle.options.status);
        selectElements = [nodeElement];
    }
    return selectElements;
}

export async function writeClipboardData(
    protyle: IProtyle,
    event: CopyClipboardEvent,
    html: string,
    textPlain: string,
    selectTableElement: boolean | number,
    selectTableRange: boolean,
    selectAVElement: HTMLElement | null,
    needClipboardWrite: boolean,
) {
    enableLuteMarkdownSyntax(protyle);
    let textSiyuan: string;
    if (selectTableElement || selectTableRange) {
        const newId = Lute.NewNodeID();
        textSiyuan = `<div data-node-id="${newId}" data-type="NodeTable" class="table"><div contenteditable="true" spellcheck="false">${html}<div class="protyle-action__table"><div class="table__resize"></div><div class="table__select"></div></div></div><div class="protyle-attr" contenteditable="false">\u200b</div></div>`;
    } else {
        textSiyuan = html;
    }
    event.clipboardData.setData("text/siyuan", textSiyuan);
    restoreLuteMarkdownSyntax(protyle);
    const textHTML = `<!--data-siyuan='${encodeBase64(textSiyuan)}'-->` + removeZWJ((selectTableElement || selectTableRange) ? textSiyuan : protyle.lute.BlockDOM2HTML(selectAVElement ? textPlain : html));
    event.clipboardData.setData("text/html", textHTML);
    if (needClipboardWrite) {
        try {
            await navigator.clipboard.write([new ClipboardItem({
                ["text/plain"]: textPlain,
                ["text/html"]: textHTML,
            })]);
        } catch (e) {
            console.log("Copy write clipboard error:", e);
        }
    }
    // 移植上游 cf578cf166：富文本剪贴板增强（图片转 file:// 协议），保持本地 richClipboard 实现
    enhanceRichClipboard({text: textPlain, html: textHTML, notebookID: protyle.notebookId});
}
