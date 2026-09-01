import {
    getContenteditableElement,
} from "../wysiwyg/getBlock";
import { hasClosestBlock, hasClosestByAttribute, hasClosestByClassName, hasClosestByTag, isInEmbedBlock } from "./hasClosest";
import { countBlockWord, countSelectWord } from "../runtime/status.port";
import { hideElements } from "../ui/hideElements";
import { focusByRange, focusBlock, getEditorRange } from "./selection.focus";
import { getSelectionOffset, setLastNodeRange, focusByOffset } from "./selection.range";
import { Constants } from "../../constants";
import { getUndoFocusElement } from "./selectionFocus";


// table 选中处理
export const fixTableRange = (range: Range) => {
    const tableElement = hasClosestByAttribute(range.startContainer, "data-type", "NodeTable");
    if (range.toString() !== "" && tableElement && range.commonAncestorContainer.nodeType !== 3) {
        const parentTag = (range.commonAncestorContainer as Element).tagName;
        if (parentTag !== "TH" && parentTag !== "TD") {
            const startCellElement = hasClosestByTag(range.startContainer, "TD") || hasClosestByTag(range.startContainer, "TH");
            const endCellElement = hasClosestByTag(range.endContainer, "TD") || hasClosestByTag(range.endContainer, "TH");
            if (!startCellElement && !endCellElement) {
                const cellElement = tableElement.querySelector("th") || tableElement.querySelector("td");
                range.setStart(cellElement.firstChild, 0);
                range.setEnd(cellElement.lastChild, cellElement.lastChild.textContent.length);
            } else if (startCellElement &&
                // 不能包含自身元素，否则对 cell 中的部分文字两次高亮后就会选中整个 cell。 https://github.com/siyuan-note/siyuan/issues/3649 第二点
                !startCellElement.contains(range.endContainer)) {
                setLastNodeRange(startCellElement, range, false);
            }
        }
    }
};

export const selectAll = (protyle: IProtyle, nodeElement: Element, range: Range): boolean => {
    const editElement = getContenteditableElement(nodeElement);
    if (editElement) {
        let position;
        if (editElement.tagName === "TABLE") {
            const cellElement = hasClosestByTag(range.startContainer, "TD") || hasClosestByTag(range.startContainer, "TH");
            if (cellElement) {
                position = getSelectionOffset(cellElement, nodeElement, range);
                if (position.start !== 0 || position.end !== cellElement.textContent.length) {
                    range.setStart(cellElement.firstChild, 0);
                    range.setEndAfter(cellElement.lastChild);
                    protyle.toolbar.render(protyle, range);
                    countSelectWord(range, protyle.block.rootID, protyle.options.status);
                    return true;
                }
            }
        } else {
            position = getSelectionOffset(editElement, nodeElement, range);
            if (position.start !== 0 || position.end !== editElement.textContent.length) {
                // 全选后 rang 不对 https://ld246.com/article/1654848722251
                let firstChild = editElement.firstChild;
                while (firstChild) {
                    if (firstChild.nodeType === 3) {
                        if (firstChild.textContent !== "") {
                            range.setStart(firstChild, 0);
                            break;
                        }
                        firstChild = firstChild.nextSibling;
                    } else {
                        if ((firstChild as HTMLElement).classList.contains("render-node") ||
                            (firstChild as HTMLElement).classList.contains("img")) {
                            range.setStartBefore(firstChild);
                            break;
                        }
                        firstChild = firstChild.firstChild;
                    }
                }
                let lastChild = editElement.lastChild as HTMLElement;
                while (lastChild) {
                    if (lastChild.nodeType === 3) {
                        if (lastChild.textContent !== "") {
                            range.setEnd(lastChild, lastChild.textContent.length);
                            break;
                        }
                        lastChild = lastChild.previousSibling as HTMLElement;
                    } else {
                        if (lastChild.classList.contains("render-node") ||
                            lastChild.classList.contains("img") ||
                            lastChild.tagName === "BR") {
                            range.setEndAfter(lastChild);
                            break;
                        }
                        lastChild = lastChild.lastChild as HTMLElement;
                    }
                }
                // 列表回车后，左键全选无法选中
                focusByRange(range);
                protyle.toolbar.render(protyle, range);
                countSelectWord(range, protyle.block.rootID, protyle.options.status);
                return true;
            }
        }
    }
    range.collapse(true);
    const selectElements = protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select");
    if (selectElements.length > 0 && protyle.wysiwyg.element.childElementCount === selectElements.length &&
        selectElements[0].parentElement === protyle.wysiwyg.element) {
        return false;
    }
    hideElements(["select"], protyle);
    const ids: string[] = [];
    Array.from(protyle.wysiwyg.element.children).forEach(item => {
        const nodeId = item.getAttribute("data-node-id");
        if (nodeId) {
            item.classList.add("protyle-wysiwyg--select");
            ids.push(nodeId);
        }
    });
    countBlockWord(ids, protyle.block.rootID, false, protyle.options.status);
    return false;
};

export const getBlockRangeSelectElements = (rangeStartElement: HTMLElement, rangeEndElement: HTMLElement) => {
    let startElement = rangeStartElement;
    let endElement = rangeEndElement;
    let toDown = true;
    const startRect = startElement.getBoundingClientRect();
    const endRect = endElement.getBoundingClientRect();
    let startTop = startRect.top;
    let endTop = endRect.top;
    if (startTop === endTop) {
        // 横排 https://ld246.com/article/1663036247544
        startTop = startRect.left;
        endTop = endRect.left;
    }
    if (startTop > endTop) {
        const tempElement = endElement;
        endElement = startElement;
        startElement = tempElement;
        const tempTop = endTop;
        endTop = startTop;
        startTop = tempTop;
        toDown = false;
    }
    let selectElements: HTMLElement[] = [];
    let currentElement: HTMLElement = startElement;
    let hasJump = false;
    while (currentElement) {
        if (currentElement.classList.contains("protyle-breadcrumb__bar")) {
            currentElement = currentElement.nextElementSibling as HTMLElement;
        }
        if (currentElement && !currentElement.classList.contains("protyle-attr")) {
            const currentRect = currentElement.getBoundingClientRect();
            if (startRect.top === endRect.top ? currentRect.left <= endTop : currentRect.top <= endTop) {
                if (hasJump) {
                    // 父节点的下个节点在选中范围内才可使用父节点作为选中节点
                    if (currentElement.nextElementSibling &&
                        !currentElement.nextElementSibling.classList.contains("protyle-attr")) {
                        const currentNextRect = currentElement.nextElementSibling.getBoundingClientRect();
                        if (startRect.top === endRect.top ?
                            currentNextRect.left <= endTop && currentNextRect.bottom <= endRect.bottom :
                            currentNextRect.top <= endTop) {
                            selectElements = [currentElement];
                            currentElement = currentElement.nextElementSibling as HTMLElement;
                            hasJump = false;
                        } else if (currentElement.parentElement.classList.contains("sb")) {
                            currentElement = hasClosestBlock(currentElement.parentElement) as HTMLElement;
                            hasJump = true;
                        } else {
                            break;
                        }
                    } else {
                        currentElement = hasClosestBlock(currentElement.parentElement) as HTMLElement;
                        hasJump = true;
                    }
                } else {
                    if (!currentElement.classList.contains("sb__resize")) {
                        selectElements.push(currentElement);
                    }
                    currentElement = currentElement.nextElementSibling as HTMLElement;
                }
            } else if (currentElement.parentElement.classList.contains("sb")) {
                // 跳出超级块横向排版中的未选中元素
                currentElement = hasClosestBlock(currentElement.parentElement) as HTMLElement;
                hasJump = true;
            } else {
                break;
            }
        } else {
            currentElement = hasClosestBlock(currentElement.parentElement) as HTMLElement;
            hasJump = true;
        }
    }
    return {endElement, selectElements, startElement, toDown};
};

export const getBlockElementsByRange = (range: Range) => {
    const startBlockElement = hasClosestBlock(range.startContainer);
    const endBlockElement = hasClosestBlock(range.endContainer);
    if (!startBlockElement || !endBlockElement) {
        return [];
    }
    const startElement = (isInEmbedBlock(startBlockElement) || startBlockElement) as HTMLElement;
    const endElement = (isInEmbedBlock(endBlockElement) || endBlockElement) as HTMLElement;
    return startElement === endElement ? [startElement] :
        getBlockRangeSelectElements(startElement, endElement).selectElements;
};

export const selectBlocksByRange = (protyle: IProtyle, range: Range) => {
    const selectElements = getBlockElementsByRange(range);
    if (selectElements.length === 0) {
        return;
    }
    selectElements.forEach(selectElement => {
        selectElement.classList.add("protyle-wysiwyg--select");
        selectElement.querySelectorAll(".protyle-wysiwyg--select").forEach(item => {
            item.classList.remove("protyle-wysiwyg--select");
        });
    });
    range.collapse(false);
    countBlockWord(selectElements.map(item => item.getAttribute("data-node-id")), protyle.block.rootID);
};

// https://github.com/siyuan-note/siyuan/issues/8196
export const getRangeByPoint = (x: number, y: number) => {
    const range = document.caretRangeFromPoint(x, y);
    const imgElement = hasClosestByAttribute(range.startContainer, "data-type", "img");
    if (imgElement) {
        range.setStart(imgElement.nextSibling, 0);
        range.collapse();
    }
    // 列表标记不承载编辑内容，拖放命中时将插入点定位到列表项正文开头。
    const actionElement = hasClosestByClassName(range.startContainer, "protyle-action");
    const blockElement = actionElement && hasClosestBlock(actionElement);
    const editableElement = blockElement && getContenteditableElement(blockElement);
    if (editableElement) {
        range.selectNodeContents(editableElement);
        range.collapse(true);
    }
    return range;
};

export const restoreFocusContext = (protyle: IProtyle, context: Record<string, string>) => {
    const start = Number(context.undoFocusStart);
    const end = Number(context.undoFocusEnd);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < 0) {
        return false;
    }
    const focusScopeElement = context.undoFocusEmbedId ? protyle.wysiwyg.element.querySelector(
        `[data-type="NodeBlockQueryEmbed"][data-node-id="${context.undoFocusEmbedId}"]`
    ) : protyle.wysiwyg.element;
    if (!focusScopeElement) {
        return false;
    }
    const startBlockElements = Array.from(focusScopeElement.querySelectorAll(
        `[data-node-id="${context.undoFocusId}"]`
    ));
    const startBlockElement = getUndoFocusElement(
        startBlockElements,
        context.undoFocusIndex,
        item => !isInEmbedBlock(item, false),
    );
    const endBlockElements = context.undoFocusEndId === context.undoFocusId ?
        startBlockElements : Array.from(focusScopeElement.querySelectorAll(
            `[data-node-id="${context.undoFocusEndId || context.undoFocusId}"]`
        ));
    const endBlockElement = getUndoFocusElement(
        endBlockElements,
        context.undoFocusEndIndex,
        item => !isInEmbedBlock(item, false),
    );
    if (!startBlockElement || !endBlockElement) {
        return false;
    }
    const ignoreZWSP = context.undoFocusIgnoreZWSP === "true";
    if (context.undoFocusCollapseToEnd === "true") {
        return !!focusByOffset(endBlockElement, end, end, true, ignoreZWSP);
    }
    if (startBlockElement === endBlockElement) {
        return !!focusByOffset(startBlockElement, start, end, true, ignoreZWSP);
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
        while (endOffset > 0 && range.endContainer.textContent[endOffset - 1] === Constants.ZWSP) {
            endOffset--;
        }
        range.setEnd(range.endContainer, endOffset);
    }
    focusByRange(range);
    return true;
};

// 重导出本地使用的符号
export { focusByRange, focusBlock, getEditorRange, getSelectionOffset, setLastNodeRange };
// 重导出不在本地使用的符号
export { focusSideBlock, focusToolbarRange, 聚焦工具栏范围 } from "./selection.focus";
export { getBlockRanges, setFirstNodeRange, focusByOffset, setInsertWbrHTML, focusByWbr } from "./selection.range";
export type {IBlockRange} from "./selection.range";
export { getSelectionPosition } from "./selection.position";
export { getUndoFocusContext, restoreUndoFocus } from "./selection.undo";
