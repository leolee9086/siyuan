import { hasClosestBlock } from "../util/hasClosest";
import { setLastNodeRange, fixTableRange, focusByRange } from "../util/selection";
import { getContenteditableElement, hasNextSibling, hasPreviousSibling } from "../wysiwyg/getBlock";
import { 构建标记上下文, 准备标记内容, 清理内联标记内容, 移除内联标记, 添加内联标记, 合并相邻同类型元素, 整理零宽空格, 显示特殊类型菜单 } from "./inlineMark";
import { isMobile, isArrayEqual } from "../../util/platform/functions";
import { Constants } from "../../constants";
import * as dayjs from "dayjs";
import {updateTransaction} from "../wysiwyg/transaction/update";
import { hasSameTextStyle } from "./Font";

export function setInlineMark(
    protyle: IProtyle,
    type: string,
    action: "range" | "toolbar",
    range: Range,
    element: HTMLElement,
    textObj?: ITextOption
) {
    let currentRange = range;
    const nodeElement = hasClosestBlock(currentRange.startContainer);
    if (!nodeElement || nodeElement.getAttribute("data-type") === "NodeCodeBlock") {
        return { newNodes: undefined, range: currentRange };
    }
    const endElement = hasClosestBlock(currentRange.endContainer);
    if (!endElement) {
        return { newNodes: undefined, range: currentRange };
    }
    // 三击后还没有重新纠正 range 时使用快捷键标记会导致异常 https://github.com/siyuan-note/siyuan/issues/7068
    if (nodeElement !== endElement) {
        currentRange = setLastNodeRange(getContenteditableElement(nodeElement), currentRange, false);
    }

    // 构建上下文信息
    const context = 构建标记上下文(currentRange, type, textObj);
    if (context.shouldReturn) {
        return { newNodes: undefined, range: currentRange };
    }
    const { rangeTypes, isSameNode, selectText } = context;
    let keepZWPS = context.keepZWPS;
    fixTableRange(currentRange);

    const { contents, html, needWrapTarget, isEndSpan } = 准备标记内容(
        currentRange,
        nodeElement,
        isSameNode,
        hasPreviousSibling,
        hasNextSibling
    );

    清理内联标记内容(contents, currentRange, needWrapTarget, selectText);

    const toolbarElement = isMobile() ? document.querySelector("#keyboardToolbar .keyboard__dynamic").nextElementSibling : element;
    const actionBtn = action === "toolbar" ? toolbarElement.querySelector(`[data-type="${type}"]`) : undefined;
    let newNodes: Node[] = [];
    let startContainer: Node | undefined;
    let endContainer: Node | undefined;
    let startOffset: number | undefined;
    let endOffset: number | undefined;
    if (type === "clear" || actionBtn?.classList.contains("protyle-toolbar__item--current") || (
        action === "range" && rangeTypes.length > 0 && rangeTypes.includes(type) && !textObj
    )) {
        // 移除
        const result = 移除内联标记(
            contents as DocumentFragment,
            type,
            rangeTypes,
            toolbarElement as HTMLElement,
            actionBtn as Element,
            textObj
        );
        newNodes = result.newNodes;
        startContainer = result.startContainer;
        startOffset = result.startOffset;
        keepZWPS = result.keepZWPS;
    } else {
        // 添加
        const addResult = 添加内联标记(
            contents as DocumentFragment,
            type,
            rangeTypes,
            toolbarElement as HTMLElement,
            actionBtn as Element,
            textObj,
            selectText,
            isEndSpan,
            !element.classList.contains("fn__none")
        );
        newNodes = addResult.newNodes;
        keepZWPS = addResult.keepZWPS;
    }
    // 插入元素
    for (let i = newNodes.length - 1; i > -1; i--) {
        currentRange.insertNode(newNodes[i]);
    }
    if (newNodes.length === 1 && newNodes[0].textContent === Constants.ZWSP) {
        currentRange.setStart(newNodes[0], 1);
        currentRange.collapse(true);
        if (newNodes[0].nodeType !== 3) {
            // 不选中后，ctrl+g 光标重置
            const currentType = ((newNodes[0] as HTMLElement).getAttribute("data-type") || "").split(" ");
            if (currentType.includes("code") || currentType.includes("tag") || currentType.includes("kbd")) {
                keepZWPS = false;
            }
        }
    }
    if (!keepZWPS) {
        // 合并元素
        const mergeResult = 合并相邻同类型元素(
            newNodes,
            hasPreviousSibling,
            hasNextSibling,
            isArrayEqual,
            hasSameTextStyle
        );
        if (mergeResult.startContainer) {
            startContainer = mergeResult.startContainer;
        }
        if (mergeResult.endContainer) {
            endContainer = mergeResult.endContainer;
        }
        if (mergeResult.startOffset !== undefined) {
            startOffset = mergeResult.startOffset;
        }
        if (mergeResult.endOffset !== undefined) {
            endOffset = mergeResult.endOffset;
        }
        // 整理 zwsp
        整理零宽空格(newNodes, hasPreviousSibling, hasNextSibling);
    }
    nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
    updateTransaction(protyle, nodeElement, html);
    nodeElement.querySelectorAll("wbr").forEach(item => {
        item.remove();
    });
    if (startContainer && typeof startOffset === "number") {
        if (startContainer.nodeType === 3) {
            currentRange.setStart(startContainer, startOffset);
        } else {
            currentRange.setStart(startContainer.firstChild, startOffset);
        }
    }

    if (endContainer && typeof endOffset === "number") {
        if (endContainer.nodeType === 3) {
            currentRange.setEnd(endContainer, endOffset);
        } else {
            currentRange.setEnd(endContainer.firstChild, endOffset);
        }
    }
    focusByRange(currentRange);

    显示特殊类型菜单(protyle, newNodes[0] as HTMLElement, type, selectText, newNodes, nodeElement, html);
    return { newNodes, range: currentRange };
}
