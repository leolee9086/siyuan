/**
 * setInlineMark 方法的辅助函数 - 添加标记
 * 从 index.ts 拆分出来
 */

import { Constants } from "../../../constants";
import { setFontStyle } from "../Font";

/**
 * 添加内联标记处理结果
 */
export interface 添加标记结果 {
    newNodes: Node[];
    keepZWPS: boolean;
}

function 清理结尾跨度类型(rangeTypes: string[], type: string) {
    let removeIndex = 0;
    while (removeIndex < rangeTypes.length) {
        const currentType = rangeTypes[removeIndex];
        if (currentType && ["inline-memo", "text", "block-ref", "virtual-block-ref", "file-annotation-ref", "a"].includes(currentType)) {
            rangeTypes.splice(removeIndex, 1);
            continue;
        }
        ++removeIndex;
    }
    // https://github.com/siyuan-note/siyuan/issues/14421
    if (rangeTypes.length === 0) {
        rangeTypes.push(type);
    }
}

function 处理空选区添加(
    type: string,
    rangeTypes: string[],
    textObj: ITextOption | undefined,
    isEndSpan: boolean,
    newNodes: Node[]
): boolean {
    const inlineElement = document.createElement("span");
    rangeTypes.push(type);

    // 遇到以下类型结尾不应继承 https://github.com/siyuan-note/siyuan/issues/7200
    if (isEndSpan) {
        清理结尾跨度类型(rangeTypes, type);
    }
    inlineElement.setAttribute("data-type", [...new Set(rangeTypes)].join(" "));
    inlineElement.textContent = Constants.ZWSP;
    setFontStyle(inlineElement, textObj);
    newNodes.push(inlineElement);
    return true;
}

const removeTokens = (types: string[], targetTypes: string[]) => {
    for (let i = 0; i < types.length; i++) {
        const t = types[i];
        if (t && targetTypes.includes(t)) {
            types.splice(i, 1);
            i--;
        }
    }
};

const removeToken = (types: string[], targetType: string) => {
    const index = types.indexOf(targetType);
    if (index > -1) {
        types.splice(index, 1);
    }
};

const removeTypeFromToolbar = (types: string[], targetType: string, toolbarElement: Element) => {
    if (types.includes(targetType)) {
        removeToken(types, targetType);
        const targetElement = toolbarElement.querySelector(`[data-type="${targetType}"]`);
        targetElement?.classList.remove("protyle-toolbar__item--current");
    }
};

const conflictStrategies: Record<string, (types: string[], toolbarElement: Element) => void> = {
    "sub": (types, el) => removeTypeFromToolbar(types, "sup", el),
    "sup": (types, el) => removeTypeFromToolbar(types, "sub", el),
    "block-ref": (types) => removeTokens(types, ["a", "file-annotation-ref"]),
    "a": (types) => removeTokens(types, ["block-ref", "file-annotation-ref"]),
    "file-annotation-ref": (types) => removeTokens(types, ["block-ref", "a"]),
    "inline-memo": (types) => removeToken(types, "inline-math"),
    "inline-math": (types) => removeToken(types, "inline-memo"),
};

function 处理链接类型(
    element: HTMLElement,
    textObj: ITextOption | undefined
) {
    if (!element.textContent) {
        element.textContent = "*";
    }
    if (textObj && textObj.color) {
        textObj.color = textObj.color.split(Constants.ZWSP)[0] || "";
    }
}

function 处理互斥类型(
    type: string,
    types: string[],
    toolbarElement: Element
): void {
    const strategy = conflictStrategies[type];
    if (strategy) {
        strategy(types, toolbarElement);
    }
}

function 处理元素节点(
    item: HTMLElement,
    type: string,
    toolbarElement: Element,
    textObj: ITextOption | undefined,
    newNodes: Node[]
): void {
    let types = (item.getAttribute("data-type") || "").split(" ");
    for (let i = 0; i < types.length; i++) {
        // "backslash", "virtual-block-ref", "search-mark" 只能单独存在
        const type = types[i];
        if (type && ["backslash", "virtual-block-ref", "search-mark"].includes(type)) {
            types.splice(i, 1);
            i--;
        }
    }
    if (!types.includes("img")) {
        types.push(type);
    }

    处理互斥类型(type, types, toolbarElement);

    if (type === "inline-memo" && item.querySelector(".katex")) {
        // 选中完整的数学公式才进行备注 https://github.com/siyuan-note/siyuan/issues/13667
        item.textContent = item.getAttribute("data-content") || "";
    }

    types = [...new Set(types)];
    if (item.tagName === "BR" || item.tagName === "IMG" || types.includes("img")) {
        newNodes.push(item);
        return;
    }

    item.setAttribute("data-type", types.join(" "));
    if (type === "a") {
        处理链接类型(item, textObj);
    }
    setFontStyle(item, textObj);

    if (types.includes("text") && !item.getAttribute("style") && types.length === 1 && item.textContent) {
        const tempText = document.createTextNode(item.textContent);
        newNodes.push(tempText);
        return;
    }

    if (types.includes("text") && !item.getAttribute("style")) {
        removeToken(types, "text");
        item.setAttribute("data-type", types.join(" "));
        newNodes.push(item);
        return;
    }
    newNodes.push(item);
}

const pushRemoveText = (removeText: string, newNodes: Node[]) => {
    if (removeText) {
        newNodes.push(document.createTextNode(removeText));
    }
};

function 处理文本节点(
    item: HTMLElement, // 实际上是 Text 节点，但为了方便访问 textContent
    type: string,
    textObj: ITextOption | undefined,
    newNodes: Node[]
): void {
    let removeText = "";
    if (!item.textContent) {
        return;
    }

    // https://github.com/siyuan-note/siyuan/issues/14204
    while (item.textContent.endsWith("\n")) {
        item.textContent = item.textContent.substring(0, item.textContent.length - 1);
        removeText += "\n";
    }

    if (!item.textContent) {
        pushRemoveText(removeText, newNodes);
        return;
    }

    const inlineElement = document.createElement("span");
    inlineElement.setAttribute("data-type", type);
    inlineElement.textContent = item.textContent;
    if (type === "a") {
        处理链接类型(inlineElement, textObj);
    }
    setFontStyle(inlineElement, textObj);

    if (type === "text" && !inlineElement.getAttribute("style")) {
        newNodes.push(item);
        pushRemoveText(removeText, newNodes);
        return;
    }
    newNodes.push(inlineElement);
    pushRemoveText(removeText, newNodes);
}

/**
 * 添加内联标记
 */
export function 添加内联标记(
    contents: DocumentFragment,
    type: string,
    rangeTypes: string[],
    toolbarElement: Element,
    actionBtn: Element | undefined,
    textObj: ITextOption | undefined,
    selectText: string,
    isEndSpan: boolean,
    isToolbarShown: boolean
): 添加标记结果 {
    const newNodes: Node[] = [];
    let keepZWPS = false;

    // 更新工具栏按钮状态
    if (isToolbarShown && type !== "text" && actionBtn) {
        actionBtn.classList.add("protyle-toolbar__item--current");
    }

    if (selectText === "") {
        keepZWPS = 处理空选区添加(type, rangeTypes, textObj, isEndSpan, newNodes);
        return {
            newNodes,
            keepZWPS
        };
    }

    // https://github.com/siyuan-note/siyuan/issues/7477
    // https://github.com/siyuan-note/siyuan/issues/8825
    if (type === "block-ref") {
        while (contents.childNodes.length > 1) {
            const firstChild = contents.childNodes[0];
            firstChild?.remove();
        }
    }

    const childNodes = Array.from(contents.childNodes);
    for (const item of childNodes) {
        const htmlItem = item as HTMLElement;
        if (item.nodeType === 3) {
            处理文本节点(htmlItem, type, textObj, newNodes);
            continue;
        }

        if (item.nodeType === 1) {
            处理元素节点(htmlItem, type, toolbarElement, textObj, newNodes);
        }
    }

    return {
        newNodes,
        keepZWPS
    };
}
