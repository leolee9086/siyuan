/**
 * setInlineMark 方法的辅助函数 - 上下文准备
 * 从 index.ts 提取的预处理逻辑
 */

import { Constants } from "../../../constants";
import { hasNextSibling } from "../../wysiwyg/getBlock";
import { hasSameTextStyle } from "../Font";
import { 标记上下文 } from "./inlineMark.types";
import { isHTMLElement } from "./inlineMark.guard";

/**
 * 收集选区内容的类型信息
 */
function 收集选区类型(range: Range): string[] {
    let rangeTypes: string[] = [];
    const childNodes = Array.from(range.cloneContents().childNodes);
    for (const item of childNodes) {
        if (item.nodeType !== 3 && isHTMLElement(item)) {
            rangeTypes = rangeTypes.concat((item.getAttribute("data-type") || "").split(" "));
        }
    }
    return rangeTypes;
}

/**
 * 判断是否同节点选择
 */
function 判断是否同节点选择(range: Range): boolean {
    let rangeStartNextSibling = hasNextSibling(range.startContainer);
    while (rangeStartNextSibling && rangeStartNextSibling.nodeType === 1 && isHTMLElement(rangeStartNextSibling) && rangeStartNextSibling.tagName === "BR") {
        rangeStartNextSibling = hasNextSibling(rangeStartNextSibling);
    }
    return range.startContainer === range.endContainer ||
        (!!rangeStartNextSibling && rangeStartNextSibling === range.endContainer &&
            range.startContainer.parentElement === range.endContainer.parentElement);
}

/**
 * 补充父元素的类型信息
 */
function 补充父元素类型(range: Range, isSameNode: boolean, rangeTypes: string[]): string[] {
    const parentElement = range.startContainer.parentElement;
    if (!parentElement) {
        return rangeTypes;
    }
    const endTextContent = range.endContainer.textContent || "";
    if (range.startContainer.nodeType === 3 && parentElement.tagName === "SPAN" &&
        isSameNode &&
        range.startOffset > -1 && range.endOffset <= endTextContent.length) {
        return rangeTypes.concat((parentElement.getAttribute("data-type") || "").split(" "));
    }
    return rangeTypes;
}

/**
 * 处理 ZWSP 场景（光标在零宽空格位置）
 * 
 * @returns 更新后的 rangeTypes 和 keepZWPS 状态
 */
function 处理ZWSP场景(
    range: Range,
    selectText: string,
    rangeTypes: string[]
): { rangeTypes: string[]; keepZWPS: boolean } {
    // ctrl+b/u/i  https://github.com/siyuan-note/siyuan/issues/14820
    if (selectText || range.startOffset !== 1 || range.startContainer.textContent !== Constants.ZWSP) {
        return { rangeTypes, keepZWPS: false };
    }

    let newElement: HTMLElement | null;
    if (range.startContainer.nodeType === 1 && isHTMLElement(range.startContainer)) {
        newElement = range.startContainer;
    } else {
        newElement = range.startContainer.parentElement;
    }

    if (!newElement || newElement.tagName !== "SPAN") {
        return { rangeTypes, keepZWPS: false };
    }

    const updatedTypes = rangeTypes.concat((newElement.getAttribute("data-type") || "").split(" "));
    const firstChild = newElement.firstChild;
    const lastChild = newElement.lastChild;
    if (firstChild && lastChild) {
        range.setStart(firstChild, 0);
        range.setEnd(lastChild, lastChild.textContent?.length || 0);
    }
    return { rangeTypes: updatedTypes, keepZWPS: true };
}

/**
 * 检查早期返回条件 - 特殊类型 clear 场景
 */
function 检查特殊类型Clear条件(rangeTypes: string[], type: string): boolean {
    if (rangeTypes.length !== 1 || type !== "clear") {
        return false;
    }
    // https://github.com/siyuan-note/siyuan/issues/6501
    // https://github.com/siyuan-note/siyuan/issues/12877
    const firstType = rangeTypes[0];
    return !!firstType && ["block-ref", "virtual-block-ref", "file-annotation-ref", "a", "inline-memo", "inline-math", "tag"].includes(firstType);
}

/**
 * 检查早期返回条件 - 相同文本样式场景
 */
function 检查相同文本样式条件(
    rangeTypes: string[],
    type: string,
    textObj: ITextOption | undefined,
    range: Range
): boolean {
    // https://github.com/siyuan-note/siyuan/issues/14534
    if (!rangeTypes.includes("text") || type !== "text" || !textObj) {
        return false;
    }
    if (range.startContainer.nodeType !== 3 || range.startContainer !== range.endContainer) {
        return false;
    }
    const selectParentElement = range.startContainer.parentElement;
    return !!selectParentElement && hasSameTextStyle(selectParentElement, selectParentElement, textObj);
}

/**
 * 构建 setInlineMark 方法的上下文信息
 * 
 * 提取选区类型、判断是否同节点、处理 ZWSP 场景等
 */
export function 构建标记上下文(
    range: Range,
    type: string,
    textObj: ITextOption | undefined
): 标记上下文 {
    // 收集选区类型
    let rangeTypes = 收集选区类型(range);

    // 判断是否同节点选择
    const isSameNode = 判断是否同节点选择(range);

    // 补充父元素类型
    rangeTypes = 补充父元素类型(range, isSameNode, rangeTypes);

    // 获取选中文本
    const selectText = range.toString();

    // 处理 ZWSP 场景
    const zwspResult = 处理ZWSP场景(range, selectText, rangeTypes);
    rangeTypes = zwspResult.rangeTypes;
    const keepZWPS = zwspResult.keepZWPS;

    // 检查早期返回条件
    const shouldReturn = 检查特殊类型Clear条件(rangeTypes, type) ||
        检查相同文本样式条件(rangeTypes, type, textObj, range);

    return {
        rangeTypes,
        isSameNode,
        selectText,
        keepZWPS,
        shouldReturn
    };
}
