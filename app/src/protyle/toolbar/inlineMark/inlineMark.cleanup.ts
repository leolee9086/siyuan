import { Constants } from "../../../constants";
import { mergeNodes } from "../../../util/DOM/rangeOperations";

const removeEmptyNode = (range: Range) => {
    let emptyNode: Element = range.startContainer.childNodes[range.startOffset] as HTMLElement;
    if (!emptyNode) {
        emptyNode = range.startContainer.childNodes[range.startOffset - 1] as HTMLElement;
    }
    if (emptyNode && emptyNode.nodeType === 3) {
        emptyNode = (range.startContainer as HTMLElement).tagName === "DIV" ?
            emptyNode.previousSibling as HTMLElement :
            range.startContainer as HTMLElement;
    }
    if (emptyNode && emptyNode.nodeType !== 3 && emptyNode.textContent?.replace(Constants.ZWSP, "") === "" &&
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
        if (item.nodeType === 1 && item.textContent === "" && (item as HTMLElement).tagName === "SPAN") {
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
