/**
 * setInlineMark 方法的辅助函数
 * 从 index.ts 中拆分出来，以保持代码整洁和方法行数在合理范围内
 */

import { Constants } from "../../constants";
import { linkMenu } from "../../menus/protyle";
import { mathRender } from "../render/mathRender";

/**
 * 显示特殊类型的编辑菜单
 * 根据内联元素类型（数学公式、备注、链接）显示对应的编辑界面
 * 
 * 原始位置: index.ts L831-L850
 */
export function 显示特殊类型菜单(
    protyle: IProtyle,
    showMenuElement: HTMLElement,
    type: string,
    selectText: string,
    newNodes: Node[],
    nodeElement: HTMLElement,
    html: string
): void {
    if (showMenuElement.nodeType === 3) {
        return;
    }

    const showMenuTypes = (showMenuElement.getAttribute("data-type") || "").split(" ");

    if (type === "inline-math") {
        mathRender(nodeElement);
    }

    if (type === "inline-math" && selectText === "" && showMenuTypes.includes("inline-math") && protyle.toolbar) {
        protyle.toolbar.showRender(protyle, showMenuElement, undefined, html);
    }

    if (type === "inline-math") {
        return;
    }

    if (type === "inline-memo" &&
        !showMenuElement.getAttribute("data-inline-memo-content") &&
        showMenuTypes.includes("inline-memo") &&
        protyle.toolbar) {
        protyle.toolbar.showRender(protyle, showMenuElement, newNodes as Element[], html);
        return;
    }

    if (type === "a" &&
        showMenuTypes.includes("a") &&
        (showMenuElement.textContent?.replace(Constants.ZWSP, "") === "" || !showMenuElement.getAttribute("data-href"))) {
        linkMenu(protyle, showMenuElement, !!showMenuElement.getAttribute("data-href"));
    }
}

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

    const previousType = previousElement ? (previousElement.getAttribute("data-type") || "").split(" ") : [];

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
    const previousType = previousElement?.nodeType !== 3
        ? (previousElement?.getAttribute("data-type") || "").split(" ")
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
    const currentType = previousElement?.nodeType !== 3
        ? (previousElement?.getAttribute("data-type") || "").split(" ")
        : [];
    const 需要添加ZWSP = currentType.includes("code") || currentType.includes("tag") || currentType.includes("kbd");
    if (!需要添加ZWSP || !previousElement) {
        return;
    }
    previousElement?.insertAdjacentText("afterend", Constants.ZWSP);
}

/**
 * 合并相邻的同类型元素
 * 当两个相邻元素具有相同的 data-type 和 text style 时，合并它们
 * 
 * 原始位置: index.ts L678-754
 * 
 * @returns 合并后需要更新的 range 位置信息
 */
export interface 合并结果 {
    startContainer?: Node;
    endContainer?: Node;
    startOffset?: number;
    endOffset?: number;
}

export function 合并相邻同类型元素(
    newNodes: Node[],
    hasPreviousSibling: (node: Node) => Node | false,
    hasNextSibling: (node: Node) => Node | false,
    isArrayEqual: (a: string[], b: string[]) => boolean,
    hasSameTextStyle: (a: HTMLElement, b: HTMLElement) => boolean
): 合并结果 {
    let startContainer: Node | undefined;
    let endContainer: Node | undefined;
    let startOffset: number | undefined;
    let endOffset: number | undefined;

    for (let i = 0; i <= newNodes.length; i++) {
        let previousElement = i === newNodes.length
            ? newNodes[i - 1] as HTMLElement
            : hasPreviousSibling(newNodes[i]) as HTMLElement;

        if (previousElement?.nodeType === 3 && previousElement.textContent === Constants.ZWSP) {
            previousElement = hasPreviousSibling(previousElement) as HTMLElement;
            if (previousElement) {
                previousElement.nextSibling?.remove();
            }
        }

        let currentNode = newNodes[i] as HTMLElement;
        if (!currentNode) {
            currentNode = hasNextSibling(newNodes[i - 1]!) as HTMLElement;
            if (currentNode?.nodeType === 3 && currentNode.textContent === Constants.ZWSP) {
                currentNode = hasNextSibling(currentNode) as HTMLElement;
                if (currentNode) {
                    currentNode.previousSibling?.remove();
                }
            }
        }

        if (!currentNode || currentNode.nodeType === 3) {
            continue;
        }

        const currentType = (currentNode.getAttribute("data-type") || "").split(" ");
        const 可以合并 = currentNode.tagName !== "BR" &&
            previousElement &&
            previousElement.nodeType !== 3 &&
            currentNode.nodeType !== 3 &&
            isArrayEqual(currentType, (previousElement.getAttribute("data-type") || "").split(" ")) &&
            hasSameTextStyle(currentNode, previousElement);

        if (!可以合并) {
            continue;
        }

        // 处理 code/tag/kbd 类型的 ZWSP 前缀
        if (currentType.includes("code") || currentType.includes("tag") || currentType.includes("kbd")) {
            if (currentNode.textContent?.startsWith(Constants.ZWSP)) {
                currentNode.textContent = currentNode.textContent.substring(1);
            }
        }

        // 合并内容
        if (currentType.includes("inline-math")) {
            // 数学公式合并 data-content
            currentNode.setAttribute(
                "data-content",
                (previousElement.getAttribute("data-content") || "") + (currentNode.getAttribute("data-content") || "")
            );
        } else if (currentType.includes("block-ref") &&
            previousElement.getAttribute("data-id") === currentNode.getAttribute("data-id")) {
            if (previousElement.dataset.subtype !== "d" || previousElement.dataset.subtype !== "d") {
                currentNode.setAttribute("data-subtype", "s");
                currentNode.textContent = (previousElement.textContent || "") + (currentNode.textContent || "");
            }
        } else {
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

        // 更新 range 位置信息（非数学公式类型）
        if (!currentType.includes("inline-math")) {
            if (i === 0) {
                startContainer = currentNode;
                startOffset = previousElement.textContent?.length || 0;
            } else if (i === newNodes.length) {
                endContainer = currentNode;
                endOffset = previousElement.textContent?.length || 0;
                if (!startContainer) {
                    startContainer = currentNode;
                } else if (startContainer === previousElement) {
                    startContainer = currentNode;
                }
            }
        }

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

    return { startContainer, endContainer, startOffset, endOffset };
}

