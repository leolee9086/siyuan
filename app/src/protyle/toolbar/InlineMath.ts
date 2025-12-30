import { ToolbarItem } from "./ToolbarItem";
import { hasClosestBlock, hasClosestByAttribute } from "../util/hasClosest";
import { hasNextSibling, hasPreviousSibling } from "../wysiwyg/getBlock";

export class InlineMath extends ToolbarItem {
    public declare element: HTMLElement;

    constructor(protyle: IProtyle, menuItem: IMenuItem) {
        super(protyle, menuItem);
        this.element.addEventListener("click", (event) => {
            处理点击(protyle, event);
        });
    }
}

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
