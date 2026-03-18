import { createToolbarItemElement } from "./ToolbarItem";
import { hasClosestBlock, hasClosestByAttribute } from "../util/hasClosest";
import { hasNextSibling, hasPreviousSibling } from "../wysiwyg/getBlock";

/**
 * 创建行内数学公式工具栏项
 *
 * 作用：渲染行内数学按钮并绑定点击行为
 * 意图：使用函数式渲染替代类继承实现
 * 调用时机：ToolbarItemFactory 在识别到 inline-math 时调用
 */
export const createInlineMathToolbarItem = (protyle: IProtyle, menuItem: IMenuItem): HTMLElement => {
    const element = createToolbarItemElement(protyle, menuItem);
    element.addEventListener("click", (event) => {
        处理点击(protyle, event);
    });
    return element;
};

function 处理点击(protyle: IProtyle, event: MouseEvent) {
    if (!protyle.toolbar) {
        return;
    }
    protyle.toolbar.element.classList.add("fn__none");
    event.stopPropagation();

    const range = protyle.toolbar.range;
    if (!range) {
        return;
    }
    const nodeElement = hasClosestBlock(range.startContainer);
    if (!nodeElement) {
        return;
    }
    let mathElement: HTMLElement | boolean | undefined = hasClosestByAttribute(range.startContainer, "data-type", "inline-math");
    if (!mathElement) {
        mathElement = 查找前置数学公式节点(range);
    }
    if (!mathElement && range.startOffset === (range.startContainer.textContent || "").length && range.startContainer.nodeType === 3) {
        mathElement = findMathElementInContext(range) || mathElement;
    }
    if (mathElement) {
        protyle.toolbar.showRender(protyle, mathElement);
        return;
    }
    protyle.toolbar.setInlineMark(protyle, "inline-math", "range", {
        type: "inline-math",
    });
}

function 查找前置数学公式节点(range: Range) {
    const currentNode = range.startContainer.childNodes[range.startOffset];
    if (range.startContainer.nodeType === 3 || !currentNode) {
        return undefined;
    }
    const previousSibling = hasPreviousSibling(currentNode);
    if (previousSibling instanceof HTMLElement && (previousSibling.getAttribute("data-type") || "").indexOf("inline-math") > -1) {
        return previousSibling;
    }
    return undefined;
}

function findMathElementInContext(range: Range) {
    let isMath = true;
    let hasMath = false;
    // https://github.com/siyuan-note/siyuan/issues/6007
    for (const item of Array.from(range.cloneContents().childNodes)) {
        const isMathElement = item instanceof Element && (item.getAttribute("data-type") || "").indexOf("inline-math") > -1;
        const isEmptyText = item.nodeType === 3 && item.textContent === "";
        if (!isMathElement && !isEmptyText) {
            isMath = false;
            break;
        }
        // 是否仅选中数学公式
        hasMath = true;
    }

    if (!isMath || !hasMath) {
        return undefined;
    }
    const nextSibling = hasNextSibling(range.startContainer);
    if (nextSibling instanceof HTMLElement && (nextSibling.getAttribute("data-type") || "").indexOf("inline-math") > -1) {
        return nextSibling;
    }
    const previousSibling = hasPreviousSibling(range.startContainer);
    if (range.startOffset === 0 && previousSibling instanceof HTMLElement && (previousSibling.getAttribute("data-type") || "").indexOf("inline-math") > -1) {
        return previousSibling;
    }
    return undefined;
}
