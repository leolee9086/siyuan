/**
 * setInlineMark 方法的辅助函数 - 移除标记
 * 从 index.ts 拆分出来
 */

import { Constants } from "../../constants";

/**
 * 移除标记处理结果
 */
export interface 移除标记结果 {
    newNodes: Node[];
    startContainer?: Node;
    startOffset?: number;
    keepZWPS: boolean;
}

/**
 * 处理空选区时的移除逻辑
 */
function 处理空选区移除(
    type: string,
    rangeTypes: string[],
    newNodes: Node[]
): { startContainer?: Node; startOffset?: number; keepZWPS: boolean } {
    // 从 rangeTypes 中移除当前 type
    rangeTypes.find((itemType, index) => {
        if (type === itemType) {
            rangeTypes.splice(index, 1);
            return true;
        }
    });

    if (rangeTypes.length === 0 || type === "clear") {
        newNodes.push(document.createTextNode(Constants.ZWSP));
        return {
            startContainer: newNodes[0],
            startOffset: 1,
            keepZWPS: true
        };
    }

    // 移除不应继承的类型
    let removeIndex = 0;
    while (removeIndex < rangeTypes.length) {
        const shouldRemove = ["inline-memo", "text", "block-ref", "virtual-block-ref", "file-annotation-ref", "a"].includes(rangeTypes[removeIndex]);
        if (shouldRemove) {
            rangeTypes.splice(removeIndex, 1);
            continue;
        }
        ++removeIndex;
    }

    const inlineElement = document.createElement("span");
    inlineElement.setAttribute("data-type", rangeTypes.join(" "));
    inlineElement.textContent = Constants.ZWSP;
    newNodes.push(inlineElement);

    const firstNode = newNodes[0];
    return {
        startContainer: firstNode.firstChild,
        startOffset: 1,
        keepZWPS: true
    };
}

/**
 * 清除元素的文本样式
 */
function 清除文本样式(item: HTMLElement): void {
    item.style.color = "";
    item.style.webkitTextFillColor = "";
    item.style.webkitTextStroke = "";
    item.style.textShadow = "";
    item.style.backgroundColor = "";
    item.style.fontSize = "";
}

/**
 * 处理元素节点的类型移除
 */
function 处理元素节点类型移除(
    item: HTMLElement,
    type: string,
    textObj: ITextOption | undefined,
    newNodes: Node[]
): void {
    const types = (item.getAttribute("data-type") || "").split(" ");

    if (type !== "clear") {
        types.find((itemType, typeIndex) => {
            if (type === itemType) {
                types.splice(typeIndex, 1);
                return true;
            }
        });
    }
    if (type === "clear") {
        for (let i = 0; i < types.length; i++) {
            const shouldRemove = textObj?.type === "text"
                ? "text" === types[i]
                : ["kbd", "text", "strong", "em", "u", "s", "mark", "sup", "sub", "code"].includes(types[i]);
            if (shouldRemove) {
                types.splice(i, 1);
                i--;
            }
        }
    }

    if (types.length === 0) {
        newNodes.push(document.createTextNode(item.textContent));
        return;
    }

    if (type === "clear") {
        清除文本样式(item);
    }
    item.setAttribute("data-type", types.join(" "));
    newNodes.push(item);
}

/**
 * 移除内联标记
 * 
 * 从选中的内容中移除指定类型的标记
 * 
 * @param contents - 选中的内容片段
 * @param type - 要移除的标记类型
 * @param rangeTypes - 当前选区包含的所有类型
 * @param toolbarElement - 工具栏元素
 * @param actionBtn - 触发的按钮元素
 * @param textObj - 文本样式选项
 * @returns 处理结果
 */
export function 移除内联标记(
    contents: DocumentFragment,
    type: string,
    rangeTypes: string[],
    toolbarElement: Element,
    actionBtn: Element | undefined,
    textObj: ITextOption | undefined
): 移除标记结果 {
    const newNodes: Node[] = [];
    let startContainer: Node | undefined;
    let startOffset: number | undefined;
    const keepZWPS = false;

    // 更新工具栏按钮状态
    if (type === "clear") {
        const markElements = toolbarElement.querySelectorAll('[data-type="strong"],[data-type="em"],[data-type="u"],[data-type="s"],[data-type="mark"],[data-type="sup"],[data-type="sub"],[data-type="kbd"],[data-type="mark"],[data-type="code"]');
        for (const item of markElements) {
            item.classList.remove("protyle-toolbar__item--current");
        }
    }
    if (type !== "clear" && actionBtn) {
        actionBtn.classList.remove("protyle-toolbar__item--current");
    }

    // 空选区的特殊处理
    if (contents.childNodes.length === 0) {
        const result = 处理空选区移除(type, rangeTypes, newNodes);
        return {
            newNodes,
            startContainer: result.startContainer,
            startOffset: result.startOffset,
            keepZWPS: result.keepZWPS
        };
    }

    // 处理每个子节点
    for (const item of Array.from(contents.childNodes) as HTMLElement[]) {
        const 是需要处理的元素 = item.nodeType !== 3 && item.tagName !== "BR" && item.tagName !== "IMG" && !item.classList.contains("img");
        if (是需要处理的元素) {
            处理元素节点类型移除(item, type, textObj, newNodes);
            continue;
        }
        newNodes.push(item);
    }

    return {
        newNodes,
        startContainer,
        startOffset,
        keepZWPS
    };
}
