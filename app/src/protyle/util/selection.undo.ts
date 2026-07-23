/** 用途：定位块内可编辑区域。使用范围：仅 Undo 焦点捕获。解耦评估：通过本目录依赖入口复用无状态查询能力。 */
import {getContenteditableElement} from "./imports";
/** 用途：定位选区所属块。使用范围：仅 Undo 焦点捕获。解耦评估：同目录纯 DOM 查询无需宿主注入。 */
import {hasClosestBlock} from "./hasClosest";
/** 用途：排除嵌入块镜像。使用范围：仅 Undo 焦点恢复的缺省实例选择。解耦评估：同目录纯 DOM 判定无需宿主注入。 */
import {isInEmbedBlock} from "./hasClosest";
/** 用途：把 Range 转为文本偏移。使用范围：仅 Undo 焦点捕获。解耦评估：复用 Selection 公共契约，避免复制偏移算法。 */
import {getSelectionOffset} from "./selection";
/** 用途：按文本偏移重建 Range。使用范围：仅 Undo 焦点恢复。解耦评估：复用 Selection Range 能力，避免复制 TreeWalker 算法。 */
import {focusByOffset} from "./selection.range";

/** 捕获插入块之前的精确编辑区选区，供撤销事务完成后恢复。 */
/** @同步豁免: 需要绝对同步的DOM访问 - 必须在事务修改 DOM 前捕获当前 Range 和块实例索引。 */
export const getUndoFocusContext = (editorElement: Element, range?: Range) => {
    if (!range || !editorElement.contains(range.startContainer) || !editorElement.contains(range.endContainer)) {
        return undefined;
    }
    const blockElement = hasClosestBlock(range.startContainer);
    if (!blockElement || !blockElement.contains(range.endContainer)) {
        return undefined;
    }
    const editableElement = getContenteditableElement(blockElement) || blockElement;
    if (!editableElement.contains(range.startContainer) || !editableElement.contains(range.endContainer)) {
        return undefined;
    }
    const blockElements = Array.from(editorElement.querySelectorAll(
        `[data-node-id="${blockElement.getAttribute("data-node-id")}"]`
    ));
    const position = getSelectionOffset(editableElement, undefined, range);
    return {
        undoFocusId: blockElement.getAttribute("data-node-id") || "",
        undoFocusIndex: blockElements.indexOf(blockElement).toString(),
        undoFocusStart: position.start.toString(),
        undoFocusEnd: position.end.toString(),
    };
};

/** 按事务中保存的块实例索引与文本偏移恢复撤销后的选区。 */
/** @同步豁免: 需要绝对同步的DOM访问 - Undo 回放完成后必须在同一焦点恢复阶段立即重建浏览器 Selection。 */
export const restoreUndoFocus = (protyle: IProtyle, operations: IOperation[]) => {
    const operation = operations.find(item => item.context?.undoFocusId);
    if (!operation) {
        return false;
    }
    const start = Number(operation.context.undoFocusStart);
    const end = Number(operation.context.undoFocusEnd);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < 0) {
        return false;
    }
    const blockElements = Array.from(protyle.wysiwyg.element.querySelectorAll(
        `[data-node-id="${operation.context.undoFocusId}"]`
    ));
    const index = Number(operation.context.undoFocusIndex);
    const indexedElement = Number.isInteger(index) && index >= 0 ? blockElements[index] : undefined;
    const blockElement = indexedElement || blockElements.find(item => !isInEmbedBlock(item, false)) || blockElements[0];
    return blockElement ? Boolean(focusByOffset(blockElement, start, end)) : false;
};
