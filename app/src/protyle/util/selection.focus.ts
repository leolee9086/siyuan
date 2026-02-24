import {
    getContenteditableElement,
    getNextBlock,
    getPreviousBlock,
    hasPreviousSibling,
    isContainerBlock,
} from "../wysiwyg/getBlock";
import {genRenderFrame} from "../render/util";
import {isMobile} from "../../platform";
import {setFirstNodeRange, setLastNodeRange} from "./selection.range";
import {getEditorRange} from "./selection";

export const focusByRange = (range: Range) => {
    if (!range) {
        return;
    }

    const startNode = range.startContainer.childNodes[range.startOffset] as HTMLElement;
    if (startNode && startNode.nodeType !== 3 && ["INPUT", "TEXTAREA"].includes(startNode.tagName)) {
        startNode.focus();
        return;
    }
    const selection = window.getSelection();
    if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
    }
};

/**
 * 聚焦到 protyle toolbar 当前保存的范围
 * 若 range 不存在则不执行任何操作
 */
export const focusToolbarRange = (protyle: IProtyle) => {
    const range = protyle.toolbar?.range;
    if (range) {
        focusByRange(range);
    }
};
export {focusToolbarRange as 聚焦工具栏范围};

export const focusBlock = (element: Element, parentElement?: HTMLElement, toStart = true): false | Range => {
    if (!element) {
        return false;
    }

    // hr、嵌入块、数学公式、iframe、音频、视频、图表渲染块等，删除段落块后，光标位置矫正 https://github.com/siyuan-note/siyuan/issues/4143
    if (element.classList.contains("render-node") || element.classList.contains("iframe") || element.classList.contains("hr") || element.classList.contains("av")) {
        const range = document.createRange();
        const type = element.getAttribute("data-type");
        let setRange = false;
        if (type === "NodeThematicBreak") {
            range.selectNodeContents(element.firstElementChild);
            setRange = true;
        } else if (type === "NodeBlockQueryEmbed") {
            genRenderFrame(element);
            range.setStart(element.querySelector(".protyle-cursor").firstChild, 0);
            range.collapse(true);
            setRange = true;
        } else if (type === "NodeMathBlock") {
            genRenderFrame(element);
            range.setStart(element.firstElementChild.lastElementChild.firstChild, 0);
            setRange = true;
        } else if (type === "NodeHTMLBlock") {
            range.setStart(element.lastElementChild.previousElementSibling.lastElementChild.firstChild, 0);
            range.collapse(true);
            setRange = true;
        } else if (type === "NodeIFrame" || type === "NodeWidget") {
            range.setStart(element, 0);
            setRange = true;
        } else if (type === "NodeVideo") {
            range.setStart(element.firstElementChild.firstChild, 0);
            setRange = true;
        } else if (type === "NodeAudio") {
            range.setStart(element.firstElementChild.lastChild, 0);
            setRange = true;
        } else if (type === "NodeCodeBlock") {
            range.selectNodeContents(element);
            range.collapse(true);
            setRange = true;
        } else if (type === "NodeAttributeView") {
            if (isMobile) {
                return false;
            }
            const cursorElement = element.querySelector(".av__cursor");
            if (cursorElement) {
                range.setStart(cursorElement.firstChild, 0);
                setRange = true;
            } else {
                element.setAttribute("data-need-focus", "true");
                return false;
            }
        }
        if (setRange) {
            focusByRange(range);
            return range;
        } else {
            focusSideBlock(element);
            return false;
        }
    }
    let cursorElement;
    if (toStart) {
        cursorElement = getContenteditableElement(element);
    } else {
        Array.from(element.querySelectorAll('[contenteditable="true"]')).reverse().find(item => {
            if (item.getBoundingClientRect().width > 0) {
                cursorElement = item;
                return true;
            }
        });
    }
    if (cursorElement) {
        if (cursorElement.getAttribute("contenteditable") === "false") {
            return false;
        }
        if (cursorElement.tagName === "TABLE") {
            if (toStart) {
                cursorElement = cursorElement.querySelector("th, td");
            } else {
                const cellElements = cursorElement.querySelectorAll("th, td");
                cursorElement = cellElements[cellElements.length - 1];
            }
        }
        let range;
        if (toStart) {
            // 需要定位到第一个 child https://github.com/siyuan-note/siyuan/issues/5930
            range = setFirstNodeRange(cursorElement, getEditorRange(cursorElement));
            range.collapse(true);
        } else {
            let focusHljs = false;
            // 定位到末尾 https://github.com/siyuan-note/siyuan/issues/5982
            if (element.getAttribute("data-type") === "NodeCodeBlock") {
                // 代码块末尾定位需在 /n 之前 https://github.com/siyuan-note/siyuan/issues/9141，https://github.com/siyuan-note/siyuan/issues/9189
                let lastNode = cursorElement.lastChild;
                if (!lastNode) {
                    // 粘贴 ``` 报错
                    cursorElement.innerHTML = "\n";
                    lastNode = cursorElement.lastChild;
                }
                if (lastNode.textContent === "" && lastNode.nodeType === 3) {
                    lastNode = hasPreviousSibling(cursorElement.lastChild) as HTMLElement;
                }
                if (lastNode && lastNode.textContent.endsWith("\n")) {
                    // https://github.com/siyuan-note/siyuan/issues/11362
                    if (lastNode.nodeType === 1) {
                        lastNode = lastNode.lastChild;
                        while (lastNode && lastNode.textContent.indexOf("\n") === -1) {
                            lastNode = lastNode.previousSibling;
                        }
                    }
                    range = getEditorRange(cursorElement);
                    range.setStart(lastNode, lastNode.textContent.length - 1);
                    focusHljs = true;
                }
            }
            if (!focusHljs) {
                range = setLastNodeRange(cursorElement, getEditorRange(cursorElement));
            }
            range.collapse(false);
        }
        focusByRange(range);
        return range;
    } else if (parentElement) {
        parentElement.focus();
    } else {
        // li 下面为 hr、嵌入块、数学公式、iframe、音频、视频、图表渲染块等时递归处理
        if (isContainerBlock(element)) {
            return focusBlock(element.querySelector("[data-node-id]"), parentElement, toStart);
        }
    }
    return false;
};

export const focusSideBlock = (updateElement: Element) => {
    if (updateElement.getAttribute("data-node-id")) {
        let sideBlockElement;
        let collapse;
        if (updateElement.nextElementSibling &&
            !updateElement.nextElementSibling.classList.contains("protyle-attr") // 用例 https://ld246.com/article/1661928364696
        ) {
            collapse = true;
            sideBlockElement = getNextBlock(updateElement) as HTMLElement;
        } else if (updateElement.previousElementSibling) {
            collapse = false;
            sideBlockElement = getPreviousBlock(updateElement) as HTMLElement;
        }
        if (!sideBlockElement) {
            sideBlockElement = updateElement;
        }
        focusBlock(sideBlockElement, undefined, collapse);
        return;
    }
    const range = getEditorRange(updateElement);
    if (updateElement.nextSibling) {
        range.selectNodeContents(updateElement.nextSibling);
        range.collapse(true);
    } else if (updateElement.previousSibling) {
        range.selectNodeContents(updateElement.previousSibling);
        range.collapse(false);
    }
    focusByRange(range);
};
