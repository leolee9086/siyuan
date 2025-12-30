import { Constants } from "../../../constants";
import { mergeNodes } from "../../../util/DOM/rangeOperations";
import { isHTMLElement } from "./inlineMark.guard";

const removeEmptyNode = (range: Range) => {
    let emptyNode: Node | undefined | null = range.startContainer.childNodes[range.startOffset];
    if (!emptyNode) {
        emptyNode = range.startContainer.childNodes[range.startOffset - 1];
    }
    if (emptyNode && emptyNode.nodeType === 3) {
        const container = range.startContainer;
        emptyNode = (isHTMLElement(container) && container.tagName === "DIV")
            ? emptyNode.previousSibling
            : container;
    }
    if (emptyNode && isHTMLElement(emptyNode) && emptyNode.textContent?.replace(Constants.ZWSP, "") === "" &&
        !["TD", "TH", "BR"].includes(emptyNode.tagName)) {
        emptyNode.remove();
    }
};

export const 清理内联标记内容 = (
    contents: DocumentFragment,
    range: Range,
    needWrapTarget: HTMLElement | null,
    selectText: string
) => {
    mergeNodes(contents.childNodes);
    for (const item of Array.from(contents.childNodes)) {
        if (item.nodeType === 3 && item.textContent === Constants.ZWSP) {
            item.remove();
        }
        if (isHTMLElement(item) && item.textContent === "" && item.tagName === "SPAN") {
            item.remove();
        }
    }

    if (selectText && range.startContainer.nodeType !== 3) {
        removeEmptyNode(range);
    }

    // 选择 span 中的部分需进行包裹
    if (needWrapTarget) {
        const attributes = needWrapTarget.attributes;
        for (const item of Array.from(contents.childNodes)) {
            if (item.nodeType === 3) {
                const spanElement = document.createElement("span");
                for (let i = 0; i < attributes.length; i++) {
                    const attribute = attributes[i];
                    if (attribute) {
                        spanElement.setAttribute(attribute.name, attribute.value);
                    }
                }
                spanElement.innerHTML = item.textContent || "";
                item.replaceWith(spanElement);
            }
        }
    }
};
