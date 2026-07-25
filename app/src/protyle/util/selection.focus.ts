import {
    getContenteditableElement,
    getNextBlock,
    getPreviousBlock,
    hasPreviousSibling,
    isContainerBlock,
} from "../wysiwyg/getBlock";
import {genRenderFrame} from "../render/util";
import {isMobile} from "../../platform";
import {hasClosestBlock} from "./hasClosest";

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

/** 设置 Range 的末端边界，供聚焦和事务定位共享。 */
/** @同步豁免: 需要绝对同步的DOM访问 */
/** Range 边界必须在同一 DOM 事务中立即写入。 */
export const setLastNodeRange = (editElement: Element, range: Range, setStart = true) => {
    if (!editElement) {
        return range;
    }
    let lastNode: Node | null = editElement.lastChild;
    while (lastNode && lastNode.nodeType !== 3) {
        // https://github.com/siyuan-note/siyuan/issues/12792
        if (!(lastNode instanceof Element) || !lastNode.lastChild) {
            break;
        }
        // 最后一个为多种行内元素嵌套
        lastNode = lastNode.lastChild;
    }
    // https://github.com/siyuan-note/siyuan/issues/12753
    if (!lastNode) {
        lastNode = editElement;
    }
    const isEmptyRenderBoundary = lastNode instanceof Element &&
        lastNode.nodeType !== 3 &&
        (lastNode.classList.contains("render-node") || lastNode.tagName === "BR") && lastNode.innerHTML === "";
    // 空渲染节点或 BR 需要使用节点边界，否则 Range 会落到不可编辑的内部偏移。
    if (isEmptyRenderBoundary && setStart) {
        range.setStartAfter(lastNode);
        return range;
    }
    if (isEmptyRenderBoundary) {
        range.setEndAfter(lastNode);
        return range;
    }
    if (setStart) {
        range.setStart(lastNode, lastNode.textContent?.length ?? 0);
        return range;
    }
    range.setEnd(lastNode, lastNode.textContent?.length ?? 0);
    return range;
};

/** 将 Range 起点移动到编辑区域的第一个可编辑节点，供聚焦和事务定位复用。 */
/** @同步豁免: 需要绝对同步的DOM访问 */
/** Range 边界必须在同一 DOM 事务中立即写入。 */
export const setFirstNodeRange = (editElement: Element, range: Range) => {
    if (!editElement) {
        return range;
    }
    let firstChild: Node | null = editElement.firstChild;
    while (firstChild && firstChild.nodeType !== 3 &&
        (!(firstChild instanceof Element) || (!firstChild.classList.contains("render-node") && !firstChild.classList.contains("img")))) {
        firstChild = firstChild.firstChild;
    }
    // 图片没有文本偏移，必须把起点放在图片节点之前。
    if (firstChild instanceof Element && firstChild.classList.contains("img")) { // https://ld246.com/article/1665360254842
        range.setStartBefore(firstChild);
        return range;
    }
    // 空编辑器使用容器内容作为有效范围。
    if (!firstChild) {
        range.selectNodeContents(editElement);
        return range;
    }
    // 渲染节点同样只能通过节点边界定位，普通文本节点使用字符偏移。
    if (firstChild instanceof Element && firstChild.nodeType !== 3 && firstChild.classList.contains("render-node")) {
        range.setStartBefore(firstChild);
        return range;
    }
    range.setStart(firstChild, 0);
    return range;
};

const correctEditorRange = (element: Element, range: Range): Range | undefined => {
    if (range.toString() !== "" || range.startContainer.nodeType !== 1) {
        return;
    }
    const firstFocusRange = range.startOffset === 0 && (range.startContainer as HTMLElement).classList.contains("protyle-wysiwyg")
        ? focusBlock(range.startContainer.firstChild as Element)
        : false;
    if (firstFocusRange) {
        return firstFocusRange;
    }
    const startElement = range.startContainer as Element;
    const canCorrectMobileRange = startElement.getAttribute("contenteditable") !== "true" && getContenteditableElement(startElement);
    const blockElement = canCorrectMobileRange ? hasClosestBlock(range.startContainer) : undefined;
    return blockElement ? focusBlock(blockElement) || undefined : undefined;
};

const getEditorTargetElement = (element: Element): Element | ChildNode | undefined => {
    if (element.classList.contains("table")) {
        return element.querySelector("th") || element.querySelector("td") || undefined;
    }
    const editableElement = getContenteditableElement(element);
    if (editableElement?.tagName === "TABLE") {
        return editableElement.querySelector("th") || element.querySelector("td") || undefined;
    }
    if (editableElement) {
        return editableElement;
    }
    const type = element.getAttribute("data-type");
    if (type === "NodeThematicBreak") {
        return element.firstElementChild || undefined;
    }
    if (type === "NodeBlockQueryEmbed") {
        return element.querySelector(".protyle-cursor")?.firstChild;
    }
    if (["NodeMathBlock", "NodeHTMLBlock"].includes(type)) {
        return element.lastElementChild?.previousElementSibling?.lastElementChild?.firstChild;
    }
    if (type === "NodeVideo") {
        return element.firstElementChild?.firstChild;
    }
    return type === "NodeAudio" ? element.firstElementChild?.lastChild : undefined;
};

/** 获取编辑器内可用的当前选区，必要时将光标修正到可编辑块。 */
export const getEditorRange = (element: Element): Range => {
    const activeRange = getSelection().rangeCount > 0 ? getSelection().getRangeAt(0) : undefined;
    if (activeRange && (element === activeRange.startContainer || element.contains(activeRange.startContainer))) {
        return correctEditorRange(element, activeRange) || activeRange;
    }
    const childElement = element.classList.contains("li") || element.classList.contains("list")
        ? element.querySelector("[data-node-id]")
        : undefined;
    if (childElement) {
        return getEditorRange(childElement);
    }
    // 代码块过长，在代码块的下一个块前删除，代码块会滚动到顶部，因粗需要 preventScroll
    (element as HTMLElement).focus({preventScroll: true});
    const range = activeRange || document.createRange();
    range.setStart(getEditorTargetElement(element) || element, 0);
    range.collapse(true);
    return range;
};

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
