/**
 * setInlineMark 方法的辅助函数 - 元素合并
 * 从 setInlineMark.helper.ts 拆分出来
 */

import { Constants } from "../../../constants";
import { 合并结果 } from "./inlineMark.types";
import { isHTMLElement, isChildNode } from "./inlineMark.guard";



/** 获取前一个有效元素（跳过 ZWSP 文本节点） */
function 获取前一个有效元素(
    currentIndex: number,
    newNodes: Node[],
    hasPreviousSibling: (node: Node) => Node | false
): Node | null {
    const nodeAtIndex = newNodes[currentIndex];
    const previousElement = currentIndex === newNodes.length
        ? newNodes[currentIndex - 1]
        : (nodeAtIndex ? hasPreviousSibling(nodeAtIndex) : null);

    if (!previousElement) {
        return null;
    }

    const isZWSP = previousElement.nodeType === 3 && previousElement.textContent === Constants.ZWSP;
    if (!isZWSP) {
        return previousElement;
    }

    const prev = hasPreviousSibling(previousElement);
    if (prev) {
        prev.nextSibling?.remove();
        return prev;
    }
    return null;
}

/** 跳过 ZWSP 节点并移除它 (用于向后查找时) */
function 跳过ZWSP节点(
    node: Node,
    hasNextSibling: (node: Node) => Node | false
): Node | null {
    if (!node || node.nodeType !== 3 || node.textContent !== Constants.ZWSP) {
        return node;
    }
    const nextNode = hasNextSibling(node);
    if (!nextNode) {
        return null;
    }
    const prev = nextNode.previousSibling;
    if (isChildNode(prev)) {
        prev.remove();
    }
    return nextNode;
}

/** 获取当前有效节点（处理边界情况和 ZWSP） */
// Retained signature
function 获取当前有效节点(
    currentIndex: number,
    newNodes: Node[],
    hasNextSibling: (node: Node) => Node | false
): Node | null {
    const currentNode = newNodes[currentIndex];
    if (currentNode) {
        return currentNode;
    }

    const prev = newNodes[currentIndex - 1];
    if (!prev) {
        return null;
    }

    const nextNode = hasNextSibling(prev);
    if (nextNode) {
        return 跳过ZWSP节点(nextNode, hasNextSibling);
    }
    return null;
}

/** 判断两个元素是否可以合并 */
function 判断是否可合并(
    currentNode: HTMLElement,
    previousElement: HTMLElement | null,
    currentType: string[],
    isArrayEqual: (a: string[], b: string[]) => boolean,
    hasSameTextStyle: (a: HTMLElement, b: HTMLElement) => boolean
): boolean {
    return currentNode.tagName !== "BR" &&
        !!previousElement &&
        previousElement.nodeType !== 3 &&
        currentNode.nodeType !== 3 &&
        isArrayEqual(currentType, (previousElement.getAttribute("data-type") || "").split(" ")) &&
        hasSameTextStyle(currentNode, previousElement);
}

/** 处理 code/tag/kbd 类型的 ZWSP 前缀 */
function 处理ZWSP前缀(currentNode: HTMLElement, currentType: string[]): void {
    const 需要处理ZWSP = currentType.includes("code") || currentType.includes("tag") || currentType.includes("kbd");
    if (需要处理ZWSP && currentNode.textContent?.startsWith(Constants.ZWSP)) {
        currentNode.textContent = currentNode.textContent.substring(1);
    }
}

/** 执行元素内容合并 */
function 执行合并内容(currentNode: HTMLElement, previousElement: HTMLElement, currentType: string[]): void {
    if (currentType.includes("inline-math")) {
        // 数学公式合并 data-content
        currentNode.setAttribute(
            "data-content",
            (previousElement.getAttribute("data-content") || "") + (currentNode.getAttribute("data-content") || "")
        );
        return;
    }

    const 是相同引用 = currentType.includes("block-ref") &&
        previousElement.getAttribute("data-id") === currentNode.getAttribute("data-id");
    if (是相同引用 && (previousElement.dataset.subtype !== "d" || currentNode.dataset.subtype !== "d")) {
        currentNode.setAttribute("data-subtype", "s");
        currentNode.textContent = (previousElement.textContent || "") + (currentNode.textContent || "");
    }
    if (是相同引用) {
        return;
    }

    // textContent：防止赋值后 \n 转换为 br；innerText：获取 br 的 \n
    currentNode.textContent = previousElement.innerText + currentNode.innerText;
    // 如果为备注时，合并备注内容
    if (currentType.includes("inline-memo")) {
        currentNode.setAttribute(
            "data-inline-memo-content",
            (previousElement.getAttribute("data-inline-memo-content") || "") +
            (currentNode.getAttribute("data-inline-memo-content") || "")
        );
    }
}

/** 更新 range 位置信息（非数学公式类型） */
function 更新Range位置(
    currentIndex: number,
    newNodesLength: number,
    currentNode: HTMLElement,
    previousElement: HTMLElement,
    currentType: string[],
    result: 合并结果
): void {
    if (currentType.includes("inline-math")) {
        return;
    }

    if (currentIndex === 0) {
        result.startContainer = currentNode;
        result.startOffset = previousElement.textContent?.length || 0;
        return;
    }

    if (currentIndex === newNodesLength) {
        result.endContainer = currentNode;
        result.endOffset = previousElement.textContent?.length || 0;
    }
    if (currentIndex === newNodesLength && (!result.startContainer || result.startContainer === previousElement)) {
        result.startContainer = currentNode;
    }
}

export function 合并相邻同类型元素(
    newNodes: Node[],
    hasPreviousSibling: (node: Node) => Node | false,
    hasNextSibling: (node: Node) => Node | false,
    isArrayEqual: (a: string[], b: string[]) => boolean,
    hasSameTextStyle: (a: HTMLElement, b: HTMLElement) => boolean
): 合并结果 {
    const result: 合并结果 = {};

    for (let i = 0; i <= newNodes.length; i++) {
        const previousElement = 获取前一个有效元素(i, newNodes, hasPreviousSibling);
        const currentNode = 获取当前有效节点(i, newNodes, hasNextSibling);

        if (!currentNode || !isHTMLElement(currentNode)) {
            continue;
        }

        const currentType = (currentNode.getAttribute("data-type") || "").split(" ");
        if (!previousElement || !isHTMLElement(previousElement)) {
            continue;
        }
        if (!判断是否可合并(currentNode, previousElement, currentType, isArrayEqual, hasSameTextStyle)) {
            continue;
        }

        处理ZWSP前缀(currentNode, currentType);
        执行合并内容(currentNode, previousElement, currentType);
        更新Range位置(i, newNodes.length, currentNode, previousElement, currentType, result);

        previousElement.remove();
        if (i > 0) {
            newNodes.splice(i - 1, 1);
            i--;
        }
        if (newNodes.length === 0) {
            newNodes.push(currentNode);
            break;
        }
    }

    return result;
}
