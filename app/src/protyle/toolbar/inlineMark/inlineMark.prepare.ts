/**
 * setInlineMark 方法的辅助函数 - 内容准备
 * 从 setInlineMark.helper.ts 拆分出来
 */

import { Constants } from "../../../constants";

export interface 准备标记内容结果 {
    contents: DocumentFragment;
    html: string | undefined;
    needWrapTarget: HTMLElement | undefined;
    isEndSpan: boolean;
}

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
    let contents: DocumentFragment;
    let html: string | undefined;
    let needWrapTarget: HTMLElement | undefined;

    if (range.startContainer.nodeType === 3 && range.startContainer.parentElement.tagName === "SPAN" &&
        isSameNode) {
        const endTextContent = range.endContainer.textContent || "";
        if (range.startOffset > -1 && range.endOffset <= endTextContent.length) {
            needWrapTarget = range.startContainer.parentElement || undefined;
        }
        const startPreviousSibling = hasPreviousSibling(range.startContainer);
        const endNextSibling = hasNextSibling(range.endContainer);
        const startContainerText = range.startContainer.textContent || "";
        const parentElement = range.startContainer.parentElement;

        if (parentElement && (
            range.startOffset !== 0 ||
            // https://github.com/siyuan-note/siyuan/issues/14869
            (range.startOffset === 0 && startPreviousSibling &&
                (startPreviousSibling.nodeType === 3 || (startPreviousSibling as HTMLElement).tagName === "BR") &&
                range.startContainer.previousSibling?.parentElement === range.startContainer.parentElement)
        ) && (
                range.endOffset !== endTextContent.length ||
                // https://github.com/siyuan-note/siyuan/issues/14869#issuecomment-2911553387
                (
                    range.endOffset === endTextContent.length && endNextSibling &&
                    (endNextSibling.nodeType === 3 || (endNextSibling as HTMLElement).tagName === "BR") &&
                    range.endContainer.nextSibling?.parentElement === range.endContainer.parentElement
                )
            ) &&
            !(range.startOffset === 1 && startContainerText.startsWith(Constants.ZWSP))) {
            // 切割元素
            const afterElement = document.createElement("span");
            const attributes = parentElement.attributes;
            for (let i = 0; i < attributes.length; i++) {
                afterElement.setAttribute(attributes[i].name, attributes[i].value);
            }
            range.insertNode(document.createElement("wbr"));
            html = nodeElement.outerHTML;
            contents = range.extractContents();
            if (parentElement.lastChild) {
                range.setEnd(parentElement.lastChild, parentElement.lastChild.textContent?.length || 0);
            }
            afterElement.append(range.extractContents());
            parentElement.after(afterElement);
            range.setStartBefore(afterElement);
            range.collapse(true);
        }
    }

    let isEndSpan = false;
    // https://github.com/siyuan-note/siyuan/issues/7200
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
    if (!html) {
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
