/**
 * setInlineMark 方法的辅助函数 - ZWSP（零宽空格）处理
 * 从 setInlineMark.helper.ts 拆分出来
 */

import { Constants } from "../../constants";

/**
 * 整理零宽空格(ZWSP)
 * 在 code/tag/kbd 类型元素前后确保有ZWSP，并清理多余的ZWSP
 * 
 * 原始位置: index.ts L755-L808
 */
export function 整理零宽空格(
    newNodes: Node[],
    hasPreviousSibling: (node: Node) => Node | false,
    hasNextSibling: (node: Node) => Node | false
): void {
    for (let i = 0; i <= newNodes.length; i++) {
        const nodeAtIndex = newNodes[i];
        const previousElement = i === newNodes.length
            ? newNodes[i - 1] as HTMLElement
            : (nodeAtIndex ? hasPreviousSibling(nodeAtIndex) as HTMLElement : undefined);
        let currentNode = newNodes[i] as HTMLElement;
        if (!currentNode) {
            currentNode = hasNextSibling(newNodes[i - 1]!) as HTMLElement;
        }
        if (!currentNode) {
            处理尾部ZWSP(previousElement);
            break;
        }
        if (currentNode.nodeType === 3) {
            处理文本节点ZWSP(currentNode, previousElement);
            continue;
        }
        处理元素节点ZWSP(currentNode, previousElement);
    }
}

/**
 * 处理文本节点的ZWSP
 */
function 处理文本节点ZWSP(currentNode: HTMLElement, previousElement: HTMLElement | undefined): void {
    // 卫语句：previousElement 是文本节点的情况
    if (previousElement?.nodeType === 3 && currentNode.textContent?.startsWith(Constants.ZWSP)) {
        currentNode.textContent = currentNode.textContent.substring(1);
    }
    if (previousElement?.nodeType === 3 && previousElement.textContent?.endsWith(Constants.ZWSP)) {
        previousElement.textContent = previousElement.textContent.substring(0, previousElement.textContent.length - 2);
    }
    if (previousElement?.nodeType === 3) {
        return;
    }

    const previousType = (previousElement && previousElement.nodeType === 1) ? (previousElement.getAttribute("data-type") || "").split(" ") : [];

    // 卫语句：特殊类型（code/tag/kbd）需要保证有 ZWSP 前缀
    const 需要ZWSP前缀 = previousType.includes("code") || previousType.includes("tag") || previousType.includes("kbd");
    if (需要ZWSP前缀 && !currentNode.textContent?.startsWith(Constants.ZWSP)) {
        currentNode.textContent = Constants.ZWSP + currentNode.textContent;
        return;
    }
    if (需要ZWSP前缀) {
        return;
    }

    // 其他类型：移除多余的 ZWSP 前缀
    if (currentNode.textContent?.startsWith(Constants.ZWSP)) {
        currentNode.textContent = currentNode.textContent.substring(1);
    }
}

/**
 * 处理元素节点的ZWSP
 */
function 处理元素节点ZWSP(currentNode: HTMLElement, previousElement: HTMLElement | undefined): void {
    const currentType = currentNode.nodeType === 3 ? [] : (currentNode.getAttribute("data-type") || "").split(" ");

    const 是特殊类型 = currentType.includes("code") || currentType.includes("tag") || currentType.includes("kbd");

    // 处理 code/tag/kbd 类型：确保开头有 ZWSP
    if (是特殊类型 && !currentNode.textContent?.startsWith(Constants.ZWSP)) {
        currentNode.insertAdjacentText("afterbegin", Constants.ZWSP);
    }

    // 处理 code/tag/kbd 类型：确保前面有 ZWSP
    if (是特殊类型 && (!previousElement || (previousElement.nodeType === 3 && previousElement.textContent?.endsWith("\n")))) {
        currentNode.insertAdjacentText("beforebegin", Constants.ZWSP);
    }

    // 处理非 code/tag/kbd 类型但以 ZWSP 开头的情况
    if (!currentType.includes("code") && !currentType.includes("tag") && !currentType.includes("kbd")
        && currentNode.textContent?.startsWith(Constants.ZWSP)) {
        currentNode.textContent = currentNode.textContent.substring(1);
    }
    const previousType = (previousElement && previousElement.nodeType === 1)
        ? (previousElement.getAttribute("data-type") || "").split(" ")
        : [];
    if (previousType.includes("code") || previousType.includes("tag") || previousType.includes("kbd")) {
        currentNode.insertAdjacentText("beforebegin", Constants.ZWSP);
    }
}

/**
 * 处理尾部ZWSP
 * 当循环遍历完成后，检查最后一个元素是否需要添加尾部ZWSP
 */
function 处理尾部ZWSP(previousElement: HTMLElement | undefined): void {
    const currentType = (previousElement && previousElement.nodeType === 1)
        ? (previousElement.getAttribute("data-type") || "").split(" ")
        : [];
    const 需要添加ZWSP = currentType.includes("code") || currentType.includes("tag") || currentType.includes("kbd");
    if (!需要添加ZWSP || !previousElement) {
        return;
    }
    previousElement?.insertAdjacentText("afterend", Constants.ZWSP);
}
