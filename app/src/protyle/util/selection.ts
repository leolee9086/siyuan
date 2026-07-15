import {
    getContenteditableElement,
} from "../wysiwyg/getBlock";
import { hasClosestBlock, hasClosestByAttribute, hasClosestByTag } from "./hasClosest";
import { countBlockWord, countSelectWord } from "../runtime/status.port";
import { hideElements } from "../ui/hideElements";
import { focusByRange, focusBlock } from "./selection.focus";
import { setLastNodeRange } from "./selection.range";


const selectIsEditor = (editor: Element, range?: Range) => {
    if (!range) {
        if (getSelection().rangeCount === 0) {
            return false;
        } else {
            range = getSelection().getRangeAt(0);
        }
    }
    const container = range.commonAncestorContainer;

    return editor.isEqualNode(container) || editor.contains(container);
};

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

export const getEditorRange = (element: Element): Range => {
    let range: Range;
    if (getSelection().rangeCount > 0) {
        range = getSelection().getRangeAt(0);
        if (element === range.startContainer || element.contains(range.startContainer)) {
            if (range.toString() === "" && range.startContainer.nodeType === 1) {
                // 有时候点击编辑器头部需要矫正到第一个块中
                if (range.startOffset === 0 && (range.startContainer as HTMLElement).classList.contains("protyle-wysiwyg")) {
                    const focusRange = focusBlock(range.startContainer.firstChild as Element);
                    if (focusRange) {
                        return focusRange;
                    }
                }
                // 移动端获取有偏差 https://github.com/siyuan-note/siyuan/issues/15998
                if ((range.startContainer as Element).getAttribute("contenteditable") !== "true" &&
                    getContenteditableElement(range.startContainer as Element)) {
                    const blockElement = hasClosestBlock(range.startContainer);
                    if (blockElement) {
                        const focusRange = focusBlock(blockElement);
                        if (focusRange) {
                            return focusRange;
                        }
                    }
                }
            }
            return range;
        }
    }

    if (element.classList.contains("li") || element.classList.contains("list")) {
        const childElement = element.querySelector("[data-node-id]");
        if (childElement) {
            return getEditorRange(childElement);
        }
    }

    // 代码块过长，在代码块的下一个块前删除，代码块会滚动到顶部，因粗需要 preventScroll
    (element as HTMLElement).focus({ preventScroll: true });
    if (!range) {
        range = document.createRange();
    }

    let targetElement;
    if (element.classList.contains("table")) {
        // 当光标不在表格区域中时表格无法被复制 https://ld246.com/article/1650510736504
        targetElement = element.querySelector("th") || element.querySelector("td");
    } else {
        targetElement = getContenteditableElement(element);
        if (!targetElement) {
            const type = element.getAttribute("data-type");
            if (type === "NodeThematicBreak") {
                targetElement = element.firstElementChild;
            } else if (type === "NodeBlockQueryEmbed") {
                targetElement = element.querySelector(".protyle-cursor")?.firstChild;
            } else if (["NodeMathBlock", "NodeHTMLBlock"].includes(type)) {
                targetElement = element.lastElementChild.previousElementSibling?.lastElementChild?.firstChild;
            } else if (type === "NodeVideo") {
                targetElement = element.firstElementChild.firstChild;
            } else if (type === "NodeAudio") {
                targetElement = element.firstElementChild.lastChild;
            }
        } else if (targetElement.tagName === "TABLE") {
            // 文档中开头为表格，获取错误 https://ld246.com/article/1663408335459?r=88250
            targetElement = targetElement.querySelector("th") || element.querySelector("td");
        }
    }
    range.setStart(targetElement || element, 0);
    range.collapse(true);
    return range;
};

export const getSelectionOffset = (selectElement: Node, editorElement?: Element, range?: Range) => {
    const position = {
        end: 0,
        start: 0,
    };

    if (!range) {
        if (getSelection().rangeCount === 0) {
            return position;
        }
        range = window.getSelection().getRangeAt(0);
    }

    if (editorElement && !selectIsEditor(editorElement, range)) {
        return position;
    }
    const preSelectionRange = range.cloneRange();
    if (selectElement.childNodes[0] && selectElement.childNodes[0].childNodes[0]) {
        preSelectionRange.setStart(selectElement.childNodes[0].childNodes[0], 0);
    } else {
        preSelectionRange.selectNodeContents(selectElement);
    }
    preSelectionRange.setEnd(range.startContainer, range.startOffset);
    // 需加上表格内软换行 br 与表情的长度
    position.start = preSelectionRange.toString().length + preSelectionRange.cloneContents().querySelectorAll("br, .emoji").length;
    position.end = position.start + range.toString().length + range.cloneContents().querySelectorAll("br, .emoji").length;
    return position;
};

// 重导出本地使用的符号
export { focusByRange, focusBlock, setLastNodeRange };
// 重导出不在本地使用的符号
export { focusSideBlock, focusToolbarRange, 聚焦工具栏范围 } from "./selection.focus";
export { setFirstNodeRange, focusByOffset, setInsertWbrHTML, focusByWbr } from "./selection.range";
export { getSelectionPosition } from "./selection.position";
