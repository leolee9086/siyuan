import {Constants} from "../../constants";
import {hasClosestBlock, hasClosestByClassName} from "../util/hasClosest";
import {focusByRange, focusByWbr, getEditorRange} from "../util/selection";
import {getSavePath} from "../../util/getSavePath";
import {getContenteditableElement} from "../wysiwyg/getBlock";
import {transaction, updateTransaction} from "../wysiwyg/transaction";
import {insertHTML} from "../util/insertHTML";
import {hideElements} from "../ui/hideElements";
import {fetchPost} from "../../util/fetch";
import {pathPosix} from "../../util/pathName";
import {addEmoji, unicode2Emoji} from "../../emoji";
import {blockRender} from "../render/blockRender";
import {isMobile} from "../../platform";
import {updateAttrViewCellAnimation} from "../render/av/action";
import {handleFillSlash} from "./index.fill.slash";
import type {IFillSlashContext} from "./index.fill.slash";
import type {Hint} from "./index";

/**
 * 处理 fill 方法中属性视图（av）源的填充逻辑。
 * 当 hint 的 source 为 "av" 时，处理新建文档或替换已有块的操作。
 * 从 Hint.fill 方法的 av 源处理段落（原 index.ts 458-533 行）原样提取。
 * @returns true 表示已处理（调用方应 return），false 表示未命中 av 源
 * @同步豁免: 遗留代码 — 需要同步操作 DOM 和事务
 */
export function handleFillAv(hint: Hint, value: string, protyle: IProtyle, source: string): boolean {
    if (source !== "av") {
        return false;
    }
    const range = protyle.toolbar.range;
    const nodeElement = hasClosestBlock(range.startContainer) as HTMLElement;
    if (!nodeElement) {
        return true;
    }
    let cellElement = hasClosestByClassName(range.startContainer, "av__cell");
    if (!cellElement) {
        cellElement = nodeElement.querySelector(".av__cell--select") as HTMLElement;
    }
    if (!cellElement) {
        return true;
    }
    const rowElement = hasClosestByClassName(cellElement, nodeElement.getAttribute("data-av-type") === "table" ? "av__row" : "av__gallery-item");
    if (!rowElement) {
        return true;
    }
    const previousID = rowElement.dataset.id;
    const avID = nodeElement.getAttribute("data-av-id");
    let tempElement = document.createElement("div");
    tempElement.innerHTML = value.replace(/<mark>/g, "").replace(/<\/mark>/g, "");
    tempElement = tempElement.firstElementChild as HTMLDivElement;
    if (value.startsWith("((newFile ") && value.endsWith(`${Lute.Caret}'))`)) {
        handleFillAvNewFile(protyle, value, rowElement, previousID, avID, cellElement, tempElement);
    } else {
        handleFillAvExisting(protyle, rowElement, previousID, avID, cellElement, tempElement);
    }
    return true;
}

/** @同步豁免: 遗留代码 — av 新建文档填充 */
function handleFillAvNewFile(
    protyle: IProtyle, value: string, rowElement: HTMLElement,
    previousID: string, avID: string, cellElement: HTMLElement, _tempElement: HTMLDivElement
) {
    const fileNames = value.substring(11, value.length - 4).split(`"${Constants.ZWSP}'`);
    const realFileName = fileNames.length === 1 ? fileNames[0] : fileNames[1];
    const newID = Lute.NewNodeID();
    rowElement.dataset.id = newID;
    getSavePath(protyle.path, protyle.notebookId, (pathString, targetNotebookId) => {
        fetchPost("/api/filetree/createDocWithMd", {
            notebook: targetNotebookId,
            path: pathPosix().join(pathString, realFileName),
            parentID: protyle.notebookId === targetNotebookId ? protyle.block.rootID : "",
            markdown: "",
            id: newID,
        }, () => {
            transaction(protyle, [{
                action: "replaceAttrViewBlock",
                avID,
                previousID,
                nextID: newID,
                isDetached: false,
            }], [{
                action: "replaceAttrViewBlock",
                avID,
                previousID: newID,
                nextID: previousID,
                isDetached: true,
            }]);
        });
    });
    updateAttrViewCellAnimation(cellElement, {
        type: "block",
        isDetached: false,
        block: {content: realFileName, id: newID}
    });
}

/** @同步豁免: 遗留代码 — av 已有块替换填充 */
function handleFillAvExisting(
    protyle: IProtyle, rowElement: HTMLElement,
    previousID: string, avID: string, cellElement: HTMLElement, tempElement: HTMLDivElement
) {
    const sourceId = tempElement.getAttribute("data-id");
    rowElement.dataset.id = sourceId;
    transaction(protyle, [{
        action: "replaceAttrViewBlock",
        avID,
        previousID,
        nextID: sourceId,
        isDetached: false,
    }], [{
        action: "replaceAttrViewBlock",
        avID,
        previousID: sourceId,
        nextID: previousID,
        isDetached: true,
    }]);
    updateAttrViewCellAnimation(cellElement, {
        type: "block",
        isDetached: false,
        block: {
            content: tempElement.textContent,
            id: sourceId
        }
    });
}

/**
 * Hint.fill 方法的主体逻辑（非 av、非斜杠部分）。
 * 处理 range 调整、块引用插入（含新建文件）、emoji 插入、嵌入/标签等提示，
 * 以及委托斜杠命令到 handleFillSlash。
 * 从 Hint.fill 方法（原 index.ts 534-901 行）原样提取。
 * @同步豁免: 遗留代码 — 需要同步操作 DOM Range 和事务
 */
export function handleFillContent(hint: Hint, value: string, protyle: IProtyle, refIsS: boolean, genEmojiHTML: (protyle: IProtyle) => void): void {
    const range = protyle.toolbar.range;
    const nodeElement = hasClosestBlock(range.startContainer) as HTMLElement;
    if (!nodeElement) {
        return;
    }
    hint.enableExtend = false;
    let id = "";
    if (nodeElement) {
        id = nodeElement.getAttribute("data-node-id");
    }
    const html = nodeElement.outerHTML;
    adjustRangeForEndSplit(hint, range);
    if (hint.lastIndex > -1) {
        range.setStart(range.startContainer, hint.lastIndex);
        focusByRange(range);
    }
    // 新建文件
    if (Constants.BLOCK_HINT_KEYS.includes(hint.splitChar) && value.startsWith("((newFile ") && value.endsWith(`${Lute.Caret}'))`)) {
        handleNewFileBlockRef(hint, value, protyle, range, refIsS);
        return;
    }
    if (Constants.BLOCK_HINT_KEYS.includes(hint.splitChar)) {
        handleBlockRef(value, protyle, range, nodeElement, refIsS, hint.splitChar);
        return;
    }
    if (hint.splitChar === ":") {
        handleEmoji(value, protyle);
        return;
    }
    if (["「「", "「『", "『「", "『『", "{{"].includes(hint.splitChar) || hint.splitChar === "#" || hint.splitChar === ":") {
        handleEmbedOrTag(value, protyle, nodeElement, range);
        return;
    }
    if (hint.splitChar === "/" || hint.splitChar === "、") {
        const ctx: IFillSlashContext = {
            hint, value, protyle, range, nodeElement, id, html,
            genEmojiHTML,
        };
        handleFillSlash(ctx);
    }
}

/** @同步豁免: 遗留代码 — 调整 range 以匹配结束分隔符 */
function adjustRangeForEndSplit(hint: Hint, range: Range) {
    const endSplit = Constants.BLOCK_HINT_CLOSE_KEYS[hint.splitChar];
    if (Constants.BLOCK_HINT_KEYS.includes(hint.splitChar) && endSplit && range.startContainer.nodeType === 3
        && (range.startContainer as Text).wholeText.indexOf(endSplit) > -1
        // 在包含 )) 的块中引用时会丢失字符  https://ld246.com/article/1679980200782
        && (range.startContainer as Text).wholeText.indexOf(hint.splitChar) > -1) {
        let matchEndChar = 0;
        let textNode = range.startContainer;
        while (textNode && matchEndChar < 2) {
            const index = textNode.textContent.indexOf(endSplit);
            const startIndex = textNode.textContent.indexOf(hint.splitChar);
            if (index > -1 && (index < startIndex || startIndex < 0)) {
                matchEndChar = 2;
                range.setEnd(textNode, index + 2);
                break;
            }
            const indexOne = textNode.textContent.indexOf(endSplit.substr(1));
            if (indexOne > -1) {
                matchEndChar += 1;
            }
            if (matchEndChar === 2) {
                range.setEnd(textNode, indexOne + 1);
                break;
            }
            textNode = textNode.nextSibling;
        }
    }
}

/** @同步豁免: 遗留代码 — 通过块引用新建文档 */
function handleNewFileBlockRef(hint: Hint, value: string, protyle: IProtyle, range: Range, refIsS: boolean) {
    const fileNames = value.substring(11, value.length - 4).split(`"${Constants.ZWSP}'`);
    const realFileName = fileNames.length === 1 ? fileNames[0] : fileNames[1];
    getSavePath(protyle.path, protyle.notebookId, (pathString, targetNotebookId) => {
        fetchPost("/api/filetree/createDocWithMd", {
            notebook: targetNotebookId,
            path: pathPosix().join(pathString, realFileName),
            parentID: protyle.notebookId === targetNotebookId ? protyle.block.rootID : "",
            markdown: ""
        }, response => {
            // https://github.com/siyuan-note/siyuan/issues/10133
            protyle.toolbar.range = range;
            const refElement = protyle.toolbar.setInlineMark(protyle, "block-ref", "range", {
                type: "id",
                color: `${response.data}${Constants.ZWSP}${refIsS ? "s" : "d"}${Constants.ZWSP}${(refIsS ? fileNames[0] : realFileName).substring(0, window.siyuan.config.editor.blockRefDynamicAnchorTextMaxLen)}`
            });
            if (refElement[0]) {
                protyle.toolbar.range.setEnd(refElement[0].lastChild, refElement[0].lastChild.textContent.length);
            }
            protyle.toolbar.range.collapse(false);
        });
    });
}

/** @同步豁免: 遗留代码 — 插入块引用标记 */
function handleBlockRef(value: string, protyle: IProtyle, range: Range, nodeElement: HTMLElement, refIsS: boolean, splitChar: string) {
    if (value === "") {
        const editElement = getContenteditableElement(nodeElement);
        if (editElement.textContent === "") {
            editElement.innerHTML = "<wbr>";
            focusByWbr(editElement, range);
        }
        return;
    }
    let tempElement = document.createElement("div");
    tempElement.innerHTML = value.replace(/<mark>/g, "").replace(/<\/mark>/g, "");
    tempElement = tempElement.firstElementChild as HTMLDivElement;
    if (refIsS) {
        const staticText = range.toString().replace(splitChar, "");
        if (staticText) {
            tempElement.setAttribute("data-subtype", "s");
            tempElement.innerText = staticText;
        }
    } else {
        tempElement.setAttribute("data-subtype", "d");
        const dynamicTexts = tempElement.innerText.split(Constants.ZWSP);
        if (dynamicTexts.length === 2) {
            tempElement.innerText = dynamicTexts[1];
        }
    }
    const refElement = protyle.toolbar.setInlineMark(protyle, "block-ref", "range", {
        type: "id",
        color: `${tempElement.getAttribute("data-id")}${Constants.ZWSP}${tempElement.getAttribute("data-subtype")}${Constants.ZWSP}${tempElement.textContent}`
    });
    if (refElement[0]) {
        protyle.toolbar.range.setEnd(refElement[0].lastChild, refElement[0].lastChild.textContent.length);
    }
    protyle.toolbar.range.collapse(false);
}

/** @同步豁免: 遗留代码 — 插入 emoji 字符 */
function handleEmoji(value: string, protyle: IProtyle) {
    addEmoji(value);
    let emoji;
    if (value.indexOf(".") > -1) {
        emoji = `:${value.split(".")[0]}: `;
    } else {
        emoji = unicode2Emoji(value) + " ";
    }
    insertHTML(protyle.lute.SpinBlockDOM(emoji), protyle);
}

/** @同步豁免: 遗留代码 — 嵌入块、标签等提示插入 */
function handleEmbedOrTag(value: string, protyle: IProtyle, nodeElement: HTMLElement, range: Range) {
    if (value === "") {
        const editElement = getContenteditableElement(nodeElement);
        if (editElement.textContent === "") {
            editElement.innerHTML = "<wbr>";
            focusByWbr(editElement, range);
        }
        return;
    }
    insertHTML(protyle.lute.SpinBlockDOM(value), protyle, false, isMobile);
    blockRender(protyle, protyle.wysiwyg.element);
}
