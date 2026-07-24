import { hasClosestBlock, hasClosestByTag } from "../util/hasClosest";
import { isMobile } from "../../util/platform/functions";
import { Constants } from "../../constants";
import { getSelectionPosition } from "../util/selection";
import { setPosition } from "../../util/DOM/positioning/setPosition";

export function renderToolbar(
    protyle: IProtyle,
    range: Range,
    element: HTMLElement,
    setRange: (range: Range) => void
): { range: Range, toolbarHeight: number } | undefined {
    const currentRange = range;
    const nodeElement = hasClosestBlock(range.startContainer);
    if (isMobile() || !nodeElement || protyle.disabled || nodeElement.classList.contains("av") ||
        hasClosestByTag(range.startContainer, "CAPTION")) {
        element.classList.add("fn__none");
        return;
    }
    // https://github.com/siyuan-note/siyuan/issues/5157
    let hasText = false;
    Array.from(range.cloneContents().childNodes).find(item => {
        // zwsp 不显示工具栏
        if (item.textContent.length > 0 && item.textContent !== Constants.ZWSP) {
            if (item.nodeType === 1 && (item as HTMLElement).classList.contains("img")) {
                // 图片不显示工具栏
            } else {
                hasText = true;
                return true;
            }
        }
    });
    if (!hasText ||
        // 拖拽图片到最右侧
        (range.commonAncestorContainer.nodeType !== 3 && (range.commonAncestorContainer as HTMLElement).classList.contains("img"))) {
        element.classList.add("fn__none");
        return;
    }
    if (nodeElement.getAttribute("data-type") === "NodeCodeBlock") {
        element.classList.add("fn__none");
        return;
    }
    const rangePosition = getSelectionPosition(nodeElement, currentRange, true);
    element.classList.remove("fn__none");
    const toolbarHeight = element.clientHeight;
    const protyleRect = protyle.element.getBoundingClientRect();
    const rangeRects = range.getClientRects();
    const rangeRect = (rangePosition.isBottom ? rangeRects[rangeRects.length - 1] : rangeRects[0]) || range.getBoundingClientRect();
    const above = rangeRect.top - toolbarHeight - 4;
    const below = rangeRect.bottom + 4;
    const y = rangePosition.isBottom ?
        (below + toolbarHeight <= protyleRect.bottom ? below : Math.max(above, protyleRect.top + 30)) :
        (above >= protyleRect.top + 30 ? above : Math.min(below, protyleRect.bottom - toolbarHeight));
    element.setAttribute("data-inity", y + Constants.ZWSP + protyle.contentElement.scrollTop.toString());
    setPosition(element, rangePosition.left - element.clientWidth / 4, y);

    element.querySelectorAll(".protyle-toolbar__item--current").forEach(item => {
        item.classList.remove("protyle-toolbar__item--current");
    });
    const types = getRangeTypes(currentRange);
    types.forEach(item => {
        if (["search-mark", "a", "block-ref", "virtual-block-ref", "text", "file-annotation-ref", "inline-math",
            "inline-memo", "", "backslash"].includes(item)) {
            return;
        }
        const itemElement = element.querySelector(`[data-type="${item}"]`);
        if (itemElement) {
            itemElement.classList.add("protyle-toolbar__item--current");
        }
    });

    setRange(currentRange);
    return { range: currentRange, toolbarHeight };
}

export function getRangeTypes(range: Range) {
    let types: string[] = [];
    let startElement = range.startContainer as HTMLElement;
    if (startElement.nodeType === 3) {
        startElement = startElement.parentElement;
    } else if (startElement.childElementCount > 0 && startElement.childNodes[range.startOffset]?.nodeType !== 3) {
        startElement = startElement.childNodes[range.startOffset] as HTMLElement;
        if (startElement?.tagName === "WBR") {
            startElement = startElement.parentElement;
        }
    }
    if (!startElement || startElement.nodeType === 3) {
        return [];
    }
    if (!["DIV", "TD", "TH", "TR"].includes(startElement.tagName)) {
        types = (startElement.getAttribute("data-type") || "").split(" ");
    }
    let endElement = range.endContainer as HTMLElement;
    if (endElement.nodeType === 3) {
        endElement = endElement.parentElement;
    } else if (endElement.childElementCount > 0 && endElement.childNodes[range.endOffset]?.nodeType !== 3) {
        endElement = endElement.childNodes[range.endOffset] as HTMLElement;
    }
    if (types.length === 0 && (!endElement || endElement.nodeType === 3)) {
        return [];
    }
    if (endElement && !["DIV", "TD", "TH", "TR"].includes(endElement.tagName) && startElement !== endElement) {
        types = types.concat((endElement.getAttribute("data-type") || "").split(" "));
    }
    range.cloneContents().childNodes.forEach((item: Node) => {
        if (item.nodeType !== 3) {
            types = types.concat(((item as HTMLElement).getAttribute("data-type") || "").split(" "));
        }
    });
    types = [...new Set(types)];
    types.find((item, index) => {
        if (item === "") {
            types.splice(index, 1);
            return true;
        }
    });
    return types;
}
