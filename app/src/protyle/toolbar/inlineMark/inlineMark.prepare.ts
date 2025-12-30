/**
 * setInlineMark 方法的辅助函数 - 内容准备
 * 从 setInlineMark.helper.ts 拆分出来
 */

import { Constants } from "../../../constants";

import { 准备标记内容结果 } from "./inlineMark.types";
import { isHTMLElement } from "./inlineMark.guard";


/**
 * 准备内联标记的内容
 * 包括：切割 Span 元素、调整 Range、提取内容等
 * 
 * 原始位置: index.ts L304-364
 */
export function 准备标记内容(
    range: Range,
    nodeElement: HTMLElement,
    isSameNode: boolean,
    hasPreviousSibling: (node: Node) => Node | false,
    hasNextSibling: (node: Node) => Node | false
): 准备标记内容结果 {
    let contents: DocumentFragment | undefined;
    let html: string | undefined;
    let needWrapTarget: HTMLElement | undefined;

    const startParentElement = range.startContainer.parentElement;
    if (range.startContainer.nodeType === 3 && startParentElement?.tagName === "SPAN" &&
        isSameNode) {
        const result = 处理同节点Span逻辑(range, nodeElement, startParentElement, hasPreviousSibling, hasNextSibling);
        needWrapTarget = result.needWrapTarget;
        html = result.html;
        contents = result.contents;
    }

    const { isEndSpan } = 调整Range范围(range, hasPreviousSibling, hasNextSibling);

    if (!html || !contents) {
        range.insertNode(document.createElement("wbr"));
        html = nodeElement.outerHTML;
        contents = range.extractContents();
    }

    return {
        contents,
        html,
        needWrapTarget,
        isEndSpan
    };
}

function 是否满足切割条件(
    range: Range,
    endTextContent: string,
    hasPreviousSibling: (node: Node) => Node | false,
    hasNextSibling: (node: Node) => Node | false
): boolean {
    const startPreviousSibling = hasPreviousSibling(range.startContainer);
    const endNextSibling = hasNextSibling(range.endContainer);
    const startContainerText = range.startContainer.textContent || "";
    const parentElement = range.startContainer.parentElement;

    if (!parentElement) {
        return false;
    }

    return (
        range.startOffset !== 0 ||
        // https://github.com/siyuan-note/siyuan/issues/14869
        (range.startOffset === 0 && startPreviousSibling &&
            (startPreviousSibling.nodeType === 3 || (isHTMLElement(startPreviousSibling) && startPreviousSibling.tagName === "BR")) &&
            range.startContainer.previousSibling?.parentElement === range.startContainer.parentElement)
    ) && (
            range.endOffset !== endTextContent.length ||
            // https://github.com/siyuan-note/siyuan/issues/14869#issuecomment-2911553387
            (
                range.endOffset === endTextContent.length && endNextSibling &&
                (endNextSibling.nodeType === 3 || (isHTMLElement(endNextSibling) && endNextSibling.tagName === "BR")) &&
                range.endContainer.nextSibling?.parentElement === range.endContainer.parentElement
            )
        ) &&
        !(range.startOffset === 1 && startContainerText.startsWith(Constants.ZWSP));
}

function 执行元素切割(
    range: Range,
    nodeElement: HTMLElement,
    parentElement: HTMLElement
): { html: string, contents: DocumentFragment } {
    const afterElement = document.createElement("span");
    const attributes = parentElement.attributes;
    for (let i = 0; i < attributes.length; i++) {
        const attr = attributes[i];
        if (attr) {
            afterElement.setAttribute(attr.name, attr.value);
        }
    }

    range.insertNode(document.createElement("wbr"));
    const html = nodeElement.outerHTML;
    const contents = range.extractContents();

    if (parentElement.lastChild) {
        range.setEnd(parentElement.lastChild, parentElement.lastChild.textContent?.length || 0);
    }

    afterElement.append(range.extractContents());
    parentElement.after(afterElement);
    range.setStartBefore(afterElement);
    range.collapse(true);

    return { html, contents };
}

function 调整Range范围(
    range: Range,
    hasPreviousSibling: (node: Node) => Node | false,
    hasNextSibling: (node: Node) => Node | false
): { isEndSpan: boolean } {
    let isEndSpan = false;
    const startContainerText = range.startContainer.textContent || "";
    const endContainerParentElement = range.endContainer.parentElement;

    // https://github.com/siyuan-note/siyuan/issues/7200
    if (range.endOffset === startContainerText.length &&
        endContainerParentElement &&
        !["DIV", "TD", "TH", "TR"].includes(endContainerParentElement.tagName) &&
        !hasNextSibling(range.endContainer)) {
        range.setEndAfter(endContainerParentElement);
        isEndSpan = true;
    }

    const startParentElement = range.startContainer.parentElement;
    if (range.startOffset === 0 &&
        startParentElement &&
        !["DIV", "TD", "TH", "TR"].includes(startParentElement.tagName) &&
        !hasPreviousSibling(range.startContainer)) {
        range.setStartBefore(startParentElement);
    }

    return { isEndSpan };
}

function 处理同节点Span逻辑(
    range: Range,
    nodeElement: HTMLElement,
    parentElement: HTMLElement,
    hasPreviousSibling: (node: Node) => Node | false,
    hasNextSibling: (node: Node) => Node | false
): { needWrapTarget: HTMLElement | undefined, html: string | undefined, contents: DocumentFragment | undefined } {
    let needWrapTarget: HTMLElement | undefined;
    let html: string | undefined;
    let contents: DocumentFragment | undefined;

    const endTextContent = range.endContainer.textContent || "";
    if (range.startOffset > -1 && range.endOffset <= endTextContent.length) {
        needWrapTarget = parentElement;
    }

    if (是否满足切割条件(range, endTextContent, hasPreviousSibling, hasNextSibling)) {
        const result = 执行元素切割(range, nodeElement, parentElement);
        html = result.html;
        contents = result.contents;
    }

    return {
        needWrapTarget,
        html,
        contents
    };
}
