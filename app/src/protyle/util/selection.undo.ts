/** 用途：定位块内可编辑区域。使用范围：仅 Undo 焦点捕获。解耦评估：通过本目录依赖入口复用无状态查询能力。 */
import {getContenteditableElement} from "./imports";
/** 用途：定位选区所属块。使用范围：仅 Undo 焦点捕获。解耦评估：同目录纯 DOM 查询无需宿主注入。 */
import {hasClosestBlock} from "./hasClosest";
/** 用途：排除嵌入块镜像。使用范围：仅 Undo 焦点恢复的缺省实例选择。解耦评估：同目录纯 DOM 判定无需宿主注入。 */
import {isInEmbedBlock} from "./hasClosest";
import {Constants} from "../../constants";
import {isEndOfBlock} from "../wysiwyg/getBlock";
/** 用途：把 Range 转为文本偏移。使用范围：仅 Undo 焦点捕获。解耦评估：复用 Selection 公共契约，避免复制偏移算法。 */
import {getSelectionOffset} from "./selection.range";
/** 用途：按文本偏移重建 Range。使用范围：仅 Undo 焦点恢复。解耦评估：复用 Selection Range 能力，避免复制 TreeWalker 算法。 */
import {focusByOffset, setLastNodeRange} from "./selection.range";
import {focusByRange} from "./selection.focus";

/** Serialized transaction context used to restore an editor selection after undo. */
export type UndoFocusContext = {
    undoFocusId: string;
    undoFocusIndex: string;
    undoFocusStart: string;
    undoFocusStartAtEnd: string;
    undoFocusEndId: string;
    undoFocusEndIndex: string;
    undoFocusEnd: string;
    undoFocusIgnoreZWSP: string;
    undoFocusCollapseToEnd?: string;
};

/** 捕获插入块之前的精确编辑区选区，供撤销事务完成后恢复。 */
/** @同步豁免: 需要绝对同步的DOM访问 - 必须在事务修改 DOM 前捕获当前 Range 和块实例索引。 */
export const getUndoFocusContext = (editorElement: Element, range?: Range, ignoreZWSP = false): UndoFocusContext | undefined => {
    if (!range || !editorElement.contains(range.startContainer) || !editorElement.contains(range.endContainer)) {
        return undefined;
    }
    const startBlockElement = hasClosestBlock(range.startContainer);
    const endBlockElement = hasClosestBlock(range.endContainer);
    if (!startBlockElement || !endBlockElement || (!ignoreZWSP && startBlockElement !== endBlockElement)) {
        return undefined;
    }
    const startEditableElement = getContenteditableElement(startBlockElement) || startBlockElement;
    const endEditableElement = getContenteditableElement(endBlockElement) || endBlockElement;
    if (!startEditableElement.contains(range.startContainer) || !endEditableElement.contains(range.endContainer)) {
        return undefined;
    }
    const startBlockElements = Array.from(editorElement.querySelectorAll(
        `[data-node-id="${startBlockElement.getAttribute("data-node-id")}"]`
    ));
    const endBlockElements = startBlockElement === endBlockElement ? startBlockElements : Array.from(
        editorElement.querySelectorAll(`[data-node-id="${endBlockElement.getAttribute("data-node-id")}"]`)
    );
    const startRange = range.cloneRange();
    startRange.collapse(true);
    const endRange = range.cloneRange();
    endRange.collapse(false);
    const start = getSelectionOffset(startEditableElement, undefined, startRange, ignoreZWSP).start;
    const end = getSelectionOffset(endEditableElement, undefined, endRange, ignoreZWSP).end;
    return {
        undoFocusId: startBlockElement.getAttribute("data-node-id") || "",
        undoFocusIndex: startBlockElements.indexOf(startBlockElement).toString(),
        undoFocusStart: start.toString(),
        undoFocusStartAtEnd: isEndOfBlock(startRange).toString(),
        undoFocusEndId: endBlockElement.getAttribute("data-node-id") || "",
        undoFocusEndIndex: endBlockElements.indexOf(endBlockElement).toString(),
        undoFocusEnd: end.toString(),
        undoFocusIgnoreZWSP: ignoreZWSP.toString(),
    };
};

/** 按事务中保存的块实例索引与文本偏移恢复撤销后的选区。 */
/** @同步豁免: 需要绝对同步的DOM访问 - Undo 回放完成后必须在同一焦点恢复阶段立即重建浏览器 Selection。 */
export const restoreUndoFocus = (protyle: IProtyle, operations: IOperation[]) => {
    const operation = operations.find(item => item.context?.undoFocusId);
    const context = operation?.context;
    if (!context) {
        return false;
    }
    const start = Number(context.undoFocusStart);
    const end = Number(context.undoFocusEnd);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < 0) {
        return false;
    }
    const startBlockElements = Array.from(protyle.wysiwyg.element.querySelectorAll(
        `[data-node-id="${context.undoFocusId}"]`
    ));
    const startIndex = Number(context.undoFocusIndex);
    const indexedStartElement = Number.isInteger(startIndex) && startIndex >= 0 ?
        startBlockElements[startIndex] : undefined;
    const startBlockElement = indexedStartElement ||
        startBlockElements.find(item => !isInEmbedBlock(item, false)) || startBlockElements[0];
    const endBlockElements = context.undoFocusEndId === context.undoFocusId ?
        startBlockElements : Array.from(protyle.wysiwyg.element.querySelectorAll(
            `[data-node-id="${context.undoFocusEndId || context.undoFocusId}"]`
        ));
    const endIndex = Number(context.undoFocusEndIndex);
    const indexedEndElement = Number.isInteger(endIndex) && endIndex >= 0 ? endBlockElements[endIndex] : undefined;
    const endBlockElement = indexedEndElement ||
        endBlockElements.find(item => !isInEmbedBlock(item, false)) || endBlockElements[0];
    if (!startBlockElement || !endBlockElement) {
        return false;
    }
    const ignoreZWSP = context.undoFocusIgnoreZWSP === "true";
    if (context.undoFocusCollapseToEnd === "true") {
        return Boolean(focusByOffset(endBlockElement, end, end, true, ignoreZWSP));
    }
    if (startBlockElement === endBlockElement) {
        return Boolean(focusByOffset(startBlockElement, start, end, true, ignoreZWSP));
    }
    let startRange: Range;
    if (context.undoFocusStartAtEnd === "true") {
        startRange = document.createRange();
        setLastNodeRange(getContenteditableElement(startBlockElement) || startBlockElement, startRange);
        startRange.collapse(true);
    } else {
        startRange = focusByOffset(startBlockElement, start, start, false, ignoreZWSP) as Range;
    }
    let endRange: Range;
    if (ignoreZWSP && end === 0) {
        endRange = document.createRange();
        endRange.setStart(getContenteditableElement(endBlockElement) || endBlockElement, 0);
        endRange.collapse(true);
    } else {
        endRange = focusByOffset(endBlockElement, 0, end, false, ignoreZWSP) as Range;
    }
    if (!startRange || !endRange) {
        return false;
    }
    const range = document.createRange();
    range.setStart(startRange.startContainer, startRange.startOffset);
    range.setEnd(endRange.endContainer, endRange.endOffset);
    if (range.endContainer.nodeType === Node.TEXT_NODE) {
        let endOffset = range.endOffset;
        while (endOffset > 0 && range.endContainer.textContent?.[endOffset - 1] === Constants.ZWSP) {
            endOffset--;
        }
        range.setEnd(range.endContainer, endOffset);
    }
    focusByRange(range);
    return true;
};
