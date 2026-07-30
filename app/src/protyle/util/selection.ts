import {
    getContenteditableElement,
} from "../wysiwyg/getBlock";
import { hasClosestByAttribute, hasClosestByTag } from "./hasClosest";
import { countBlockWord, countSelectWord } from "../runtime/status.port";
import { hideElements } from "../ui/hideElements";
import { focusByRange, focusBlock, getEditorRange } from "./selection.focus";
import { getSelectionOffset, setLastNodeRange } from "./selection.range";


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

export const selectAll = (protyle: IProtyle, nodeElement: Element, range: Range) => {
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
    if (protyle.wysiwyg.element.childElementCount === selectElements.length && (selectElements[0].parentElement === protyle.wysiwyg.element)) {
        return true;
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
};

// https://github.com/siyuan-note/siyuan/issues/8196
export const getRangeByPoint = (x: number, y: number) => {
    const range = document.caretRangeFromPoint(x, y);
    const imgElement = hasClosestByAttribute(range.startContainer, "data-type", "img");
    if (imgElement) {
        range.setStart(imgElement.nextSibling, 0);
        range.collapse();
    }
    return range;
};

// 重导出本地使用的符号
export { focusByRange, focusBlock, getEditorRange, getSelectionOffset, setLastNodeRange };
// 重导出不在本地使用的符号
export { focusSideBlock, focusToolbarRange, 聚焦工具栏范围 } from "./selection.focus";
export { getBlockRanges, setFirstNodeRange, focusByOffset, setInsertWbrHTML, focusByWbr } from "./selection.range";
export type {IBlockRange} from "./selection.range";
export { getSelectionPosition } from "./selection.position";
export { getUndoFocusContext, restoreUndoFocus } from "./selection.undo";
