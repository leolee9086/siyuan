import {Constants} from "../../../constants";
import {hasClosestBlock, hasClosestByClassName} from "../../util/hasClosest";
import {newFileByRefHint} from "../../../util/file/newFile";
import {transaction} from "../../wysiwyg/transaction/submit";
import {updateAttrViewCellAnimation} from "../../render/av/action";
import {isHTMLElement} from "../../../util/DOM/element.guard";
import type {HintDomain} from "../hint.types";

/**
 * 处理 fill 方法中属性视图（av）源的填充逻辑。
 * 当 hint 的 source 为 "av" 时，处理新建文档或替换已有块的操作。
 * @returns true 表示已处理（调用方应 return），false 表示未命中 av 源
 * @同步豁免: 遗留代码 — 需要同步操作 DOM 和事务
 */
export function handleFillAv(hint: HintDomain, value: string, protyle: IProtyle, source: string) {
    if (source !== "av") {
        return false;
    }
    const range = protyle.toolbar?.range;
    if (!range) {
        return true;
    }
    const nodeElement = hasClosestBlock(range.startContainer);
    if (!nodeElement) {
        return true;
    }
    const cellElement = findAvCell(range, nodeElement);
    if (!cellElement) {
        return true;
    }
    const rowElement = hasClosestByClassName(cellElement, nodeElement.getAttribute("data-av-type") === "table" ? "av__row" : "av__gallery-item");
    if (!rowElement) {
        return true;
    }
    const previousID = rowElement.dataset.id ?? "";
    const avID = nodeElement.getAttribute("data-av-id") ?? "";
    const wrapper = document.createElement("div");
    wrapper.innerHTML = value.replace(/<mark>/g, "").replace(/<\/mark>/g, "");
    const tempElement = wrapper.firstElementChild;
    if (!tempElement || !isHTMLElement(tempElement)) {
        return true;
    }
    // value 匹配 newFile 模式时走新建文档分支，否则走已有块替换
    if (value.startsWith("((newFile ") && value.endsWith(`${Lute.Caret}'))`)) {
        handleFillAvNewFile(protyle, value, nodeElement, previousID, avID, cellElement);
        return true;
    }
    handleFillAvExisting(protyle, nodeElement, previousID, avID, cellElement, tempElement);
    return true;
}

/** 查找当前 range 所在的 av 单元格，优先直接命中，回退到选中态单元格 */
function findAvCell(range: Range, nodeElement: HTMLElement) {
    const cellElement = hasClosestByClassName(range.startContainer, "av__cell");
    if (cellElement) {
        return cellElement;
    }
    const selected = nodeElement.querySelector(".av__cell--select");
    if (selected && isHTMLElement(selected)) {
        return selected;
    }
    return false;
}

/** @同步豁免: 遗留代码 — av 新建文档填充 */
function handleFillAvNewFile(
    protyle: IProtyle, value: string, nodeElement: HTMLElement,
    previousID: string, avID: string, cellElement: HTMLElement
) {
    const fileNames = value.substring(11, value.length - 4).split(`"${Constants.ZWSP}'`);
    const realFileName = fileNames.length === 1 ? fileNames[0] : (fileNames[1] ?? fileNames[0]);
    const newID = Lute.NewNodeID();
    // @内联回调 — newFileByRefHint 回调需要闭包访问 protyle、avID、previousID、newID 等多个局部变量
    newFileByRefHint(protyle, realFileName ?? "", () => {
        transaction(protyle, [{
            action: "replaceAttrViewBlock",
            avID,
            previousID,
            nextID: newID,
            isDetached: false,
            blockID: nodeElement.dataset.nodeId,
            context: {protyleID: protyle.id},
        }], [{
            action: "replaceAttrViewBlock",
            avID,
            previousID,
            isDetached: true,
            blockID: nodeElement.dataset.nodeId,
            context: {protyleID: protyle.id},
        }]);
    }, newID);
    updateAttrViewCellAnimation(cellElement, {
        type: "block",
        isDetached: false,
        block: {content: realFileName ?? "", id: newID}
    });
}

/** @同步豁免: 遗留代码 — av 已有块替换填充 */
function handleFillAvExisting(
    protyle: IProtyle, nodeElement: HTMLElement,
    previousID: string, avID: string, cellElement: HTMLElement, tempElement: HTMLElement
) {
    const sourceId = tempElement.getAttribute("data-id");
    if (!sourceId) {
        return;
    }
    transaction(protyle, [{
        action: "replaceAttrViewBlock",
        avID,
        previousID,
        nextID: sourceId,
        isDetached: false,
        blockID: nodeElement.dataset.nodeId,
        context: {protyleID: protyle.id},
    }], [{
        action: "replaceAttrViewBlock",
        avID,
        previousID,
        isDetached: true,
        blockID: nodeElement.dataset.nodeId,
        context: {protyleID: protyle.id},
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
