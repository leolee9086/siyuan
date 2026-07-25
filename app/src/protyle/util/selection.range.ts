import {
    getContenteditableElement,
    hasPreviousSibling,
    isNotEditBlock,
} from "../wysiwyg/getBlock";
import {Constants} from "../../constants";
import {focusByRange, focusBlock, setLastNodeRange} from "./selection.focus";
import {hasClosestByTag} from "./hasClosest";

export {setFirstNodeRange, setLastNodeRange} from "./selection.focus";

const selectIsEditor = (editor: Element, range?: Range) => {
    if (!range) {
        if (getSelection().rangeCount === 0) {
            return false;
        }
        range = getSelection().getRangeAt(0);
    }
    const container = range.commonAncestorContainer;
    return editor.isEqualNode(container) || editor.contains(container);
};

/** 将浏览器选区转换为编辑器内的文本偏移，计入软换行和表情节点。 */
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

function searchNode(
    container: Node,
    startNode: Node,
    predicate: (node: Node) => boolean,
    excludeSibling?: boolean,
): boolean {
    if (!startNode) {
        return false;
    }

    if (predicate(startNode as Text)) {
        return true;
    }

    for (let i = 0, len = startNode.childNodes.length; i < len; i++) {
        if (searchNode(startNode, startNode.childNodes[i], predicate, true)) {
            return true;
        }
    }

    if (!excludeSibling) {
        let parentNode = startNode;
        while (parentNode && parentNode !== container) {
            let nextSibling = parentNode.nextSibling;
            while (nextSibling) {
                if (searchNode(container, nextSibling, predicate, true)) {
                    return true;
                }
                nextSibling = nextSibling.nextSibling;
            }
            parentNode = parentNode.parentNode;
        }
    }

    return false;
}

export const focusByOffset = (container: Element, start: number, end: number, isFocus = true) => {
    if (!container) {
        return false;
    }
    // 空块无法 focus
    const editElement = getContenteditableElement(container);
    if (editElement) {
        container = editElement;
    } else if (isFocus && (isNotEditBlock(container) || container.classList.contains("av"))) {
        return focusBlock(container);
    }
    const isSame = start === end;
    let startNode: Node;
    searchNode(container, container.firstChild, node => {
        if (node.nodeType === Node.TEXT_NODE) {
            const dataLength = (node as Text).data.length;
            if (start <= dataLength) {
                startNode = node;
                return true;
            }
            start -= dataLength;
            end -= dataLength;
            return false;
        } else if (node.nodeType === Node.ELEMENT_NODE &&
            ((node as Element).tagName === "BR" || (node as Element).classList.contains("emoji"))) {
            if (start <= 1) {
                startNode = node;
                return true;
            }
            start -= 1;
            end -= 1;
            return false;
        }
    });

    let endNode;
    if (startNode) {
        if (isSame) {
            endNode = startNode;
        } else {
            searchNode(container, startNode, node => {
                if (node.nodeType === Node.TEXT_NODE) {
                    const dataLength = (node as Text).data.length;
                    if (end <= dataLength) {
                        endNode = node;
                        return true;
                    }
                    end -= dataLength;
                    return false;
                } else if (node.nodeType === Node.ELEMENT_NODE &&
                    ((node as Element).tagName === "BR" || (node as Element).classList.contains("emoji"))) {
                    if (end <= 1) {
                        endNode = node;
                        return true;
                    }
                    end -= 1;
                    return false;
                }
            });
        }
    }

    const range = document.createRange();
    if (startNode) {
        if (startNode.nodeType === Node.TEXT_NODE && start <= (startNode as Text).data.length) {
            range.setStart(startNode, start);
        } else {
            range.setStartAfter(startNode);
        }
    } else {
        if (start === 0) {
            range.setStart(container, 0);
        } else {
            setLastNodeRange(getContenteditableElement(container as Element), range);
        }
    }

    if (isSame) {
        range.collapse(true);
    } else if (endNode) {
        if (endNode.nodeType === Node.TEXT_NODE && end <= (endNode as Text).data.length) {
            range.setEnd(endNode, end);
        } else {
            range.setEndAfter(endNode);
        }
    } else {
        if (end === 0) {
            range.setEnd(container, 0);
        } else {
            setLastNodeRange(getContenteditableElement(container as Element), range, false);
        }
    }
    if (isFocus) {
        focusByRange(range);
    }
    return range;
};

export const setInsertWbrHTML = (nodeElement: HTMLElement, range: Range, protyle: IProtyle) => {
    const editElement = getContenteditableElement(nodeElement);
    if (!editElement) {
        return;
    }
    if (nodeElement.classList.contains("table")) {
        const cellElement = hasClosestByTag(range.startContainer, "TH") || hasClosestByTag(range.startContainer, "TD");
        if (cellElement) {
            const offset = getSelectionOffset(cellElement, nodeElement, range);
            const cloneNode = nodeElement.cloneNode(true) as HTMLElement;
            const cellIndex = Array.from(cellElement.parentElement.children).indexOf(cellElement);
            const sourceTable = nodeElement.querySelector("table");
            const cloneTable = cloneNode.querySelector("table");
            if (!sourceTable || !cloneTable) {
                throw new Error("Table selection clone is missing its table element");
            }
            const sourceRow = cellElement.parentElement;
            if (!(sourceRow instanceof HTMLTableRowElement)) {
                throw new Error("Table selection cell is missing its row element");
            }
            const rowIndex = Array.from(sourceTable.rows).indexOf(sourceRow);
            const cloneCellElement = cloneTable.rows[rowIndex]?.cells[cellIndex];
            if (!cloneCellElement) {
                throw new Error(`Table selection clone is missing cell ${rowIndex}:${cellIndex}`);
            }
            const cloneRange = focusByOffset(cloneCellElement, offset.end, offset.end, false);
            if (cloneRange) {
                cloneRange.insertNode(document.createElement("wbr"));
            }
            protyle.wysiwyg.lastHTMLs[nodeElement.getAttribute("data-node-id")] = cloneNode.outerHTML;
        }
    } else {
        const offset = getSelectionOffset(editElement, nodeElement, range);
        const cloneNode = nodeElement.cloneNode(true) as HTMLElement;
        const cloneRange = focusByOffset(cloneNode, offset.end, offset.end, false);
        if (cloneRange) {
            cloneRange.insertNode(document.createElement("wbr"));
        }
        protyle.wysiwyg.lastHTMLs[nodeElement.getAttribute("data-node-id")] = cloneNode.outerHTML;
    }
};

export const focusByWbr = (element: Element, range: Range) => {
    const wbrElements = element.querySelectorAll("wbr");
    if (wbrElements.length === 0) {
        return;
    }
    // 没找到 wbr 产生多个的地方，先顶顶
    wbrElements.forEach((item, index) => {
        if (index !== 0) {
            item.remove();
        }
    });
    const wbrElement = wbrElements[0];
    if (!wbrElement.previousElementSibling) {
        if (wbrElement.previousSibling) {
            // text<wbr>
            range.setStart(wbrElement.previousSibling, wbrElement.previousSibling.textContent.length);
        } else if (wbrElement.nextSibling) {
            if (wbrElement.nextSibling.nodeType === 3) {
                if (wbrElement.nextSibling.textContent === Constants.ZWSP) {
                    // <wbr>零宽空格text
                    range.setStart(wbrElement.nextSibling, 1);
                } else {
                    // <wbr>text
                    range.setStart(wbrElement.nextSibling, 0);
                }
            } else {
                // <wbr><span>a</span>
                range.setStartAfter(wbrElement);
            }
        } else {
            // 内容为空
            range.setStart(wbrElement.parentElement, 0);
        }
    } else {
        const wbrPreviousSibling = hasPreviousSibling(wbrElement);
        if (wbrPreviousSibling && wbrElement.previousElementSibling === wbrPreviousSibling) {
            if (wbrElement.previousElementSibling.lastChild?.nodeType === 3) {
                // <em>text</em><wbr> 需把光标放在里面，因为 chrome 点击后也是默认在里面
                range.setStart(wbrElement.previousElementSibling.lastChild, wbrElement.previousElementSibling.lastChild.textContent.length);
            } else if (wbrPreviousSibling.nodeType !== 3 && (wbrPreviousSibling as HTMLElement).classList.contains("img")) {
                // <img><wbr>, 删除图片后的唯一的一个字符
                range.setStartAfter(wbrPreviousSibling);
            } else {
                // <span class="hljs-function"><span class="hljs-keyword">fun</span></span>
                range.setStartBefore(wbrElement);
            }
        } else {
            // <em>text</em>text<wbr>
            range.setStart(wbrElement.previousSibling, wbrElement.previousSibling.textContent.length);
        }
    }
    range.collapse(true);
    wbrElement.remove();
    focusByRange(range);
    return range;
};
