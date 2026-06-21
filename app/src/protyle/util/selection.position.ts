import { getEditorRange } from "./selection";

export const getSelectionPosition = (nodeElement: Element, range?: Range, useDirect = false) => {
    if (!range) {
        range = getEditorRange(nodeElement);
    }
    if (!nodeElement.contains(range.startContainer)) {
        return {
            left: 0,
            top: 0,
        };
    }
    let cursorRect;
    if (range.getClientRects().length === 0) {
        if (range.startContainer.nodeType === 3) {
            // 空行时，会出现没有 br 的情况，需要根据父元素 <p> 获取位置信息
            const parentRects = range.startContainer.parentElement?.getClientRects();
            // 连续粘贴图片时
            const previousRects = (range.startContainer as Element).previousElementSibling?.getClientRects();
            if (parentRects.length > 0 || previousRects.length > 0) {
                if (parentRects.length === 0 || (previousRects &&
                    previousRects.length > 0 && parentRects[0].top < previousRects[previousRects.length - 1].bottom)) {
                    cursorRect = {
                        left: previousRects[previousRects.length - 1].left,
                        top: previousRects[previousRects.length - 1].bottom,
                    };
                } else {
                    cursorRect = parentRects[0];
                }
            } else {
                return {
                    left: 0,
                    top: 0,
                };
            }
        } else {
            const children = (range.startContainer as Element).children;
            if (children[range.startOffset] &&
                children[range.startOffset].getClientRects().length > 0) {
                // markdown 模式回车
                cursorRect = children[range.startOffset].getClientRects()[0];
            } else if (range.startContainer.childNodes.length > 0) {
                // in table or code block
                const cloneRange = range.cloneRange();
                if (range.startOffset === 0) {
                    let firstNode = range.startContainer.childNodes[range.startOffset] || range.startContainer.firstChild;
                    while (firstNode) {
                        if (firstNode.textContent === "" && firstNode.nodeType === 3) {
                            if (!firstNode.previousSibling) {
                                break;
                            }
                            firstNode = firstNode.previousSibling;
                        } else {
                            break;
                        }
                    }
                    range.selectNodeContents(firstNode);
                    range.collapse(true);
                } else {
                    let lastNode = range.startContainer.childNodes[range.startOffset] || range.startContainer.lastChild;
                    while (lastNode) {
                        if (lastNode.textContent === "" && lastNode.nodeType === 3) {
                            if (!lastNode.previousSibling) {
                                break;
                            }
                            lastNode = lastNode.previousSibling;
                        } else {
                            break;
                        }
                    }
                    range.selectNodeContents(lastNode);
                    range.collapse(false);
                }
                cursorRect = range.getClientRects()[0];
                range.setEnd(cloneRange.endContainer, cloneRange.endOffset);
                range.setStart(cloneRange.startContainer, cloneRange.startOffset);
            } else {
                cursorRect = (range.startContainer as HTMLElement).getClientRects()[0];
            }
            if (!cursorRect) {
                let parentElement = range.startContainer.childNodes[range.startOffset] as HTMLElement;
                if (!parentElement) {
                    parentElement = range.startContainer.childNodes[range.startOffset - 1] as HTMLElement;
                }
                if (!parentElement) {
                    cursorRect = range.getBoundingClientRect();
                } else {
                    while (!parentElement.getClientRects || (parentElement.getClientRects && parentElement.getClientRects().length === 0)) {
                        parentElement = parentElement.parentElement;
                    }
                    cursorRect = parentElement.getClientRects()[0];
                }
            }
        }
    } else {
        const rects = range.getClientRects(); // 由于长度过长折行，光标在行首时有多个 rects https://github.com/siyuan-note/siyuan/issues/6156
        if (range.toString()) {
            if (useDirect) {
                const selection = window.getSelection() as Selection & {
                    direction: "forward" | "backward" | "none"
                };
                // 判断选择方向
                const isBackward = (selection && "direction" in selection && selection.direction !== "none") ?
                    selection.direction === "backward"
                    : range.startContainer === selection?.focusNode && range.startOffset === selection?.focusOffset;
                const isBottom = !isBackward && rects[0].top !== rects[rects.length - 1].top;
                return {
                    // 向左选择：使用第一个矩形的左边界；向右选择：使用最后一个矩形的右边界
                    left: isBackward ? rects[0].left : rects[rects.length - 1].right,
                    // 如果向右选择时有多个垂直位置不同的矩形：使用最后一个矩形的下边界；否则使用第一个矩形的上边界
                    top: isBottom ? rects[rects.length - 1].bottom : rects[0].top,
                    isBottom
                };
            } else {
                return {    // 选中多行不应遮挡第一行 https://github.com/siyuan-note/siyuan/issues/7541
                    left: rects[rects.length - 1].left,
                    top: rects[0].top
                };
            }
        } else {
            return {    // 代码块首 https://github.com/siyuan-note/siyuan/issues/13113
                left: rects[rects.length - 1].left,
                top: rects[rects.length - 1].top
            };
        }
    }

    return {
        left: cursorRect.left,
        top: cursorRect.top,
    };
};
