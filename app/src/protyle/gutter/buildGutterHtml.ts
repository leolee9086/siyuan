import { getIconByType } from "../../editor/getIcon";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getLangByType } from "../../block/util";
import {
    hasClosestBlock,
    isInAVBlock,
    isInEmbedBlock
} from "../util/hasClosest";
import { getEmbedChildOperationContext, getParentBlock, getTopAloneElement } from "../wysiwyg/getBlock";
import { handleAttributeView } from "./handleAttributeView";

/**
 * 构建 Gutter 的 HTML 内容
 *
 * 此函数负责生成 Gutter 的 HTML 内容，包括块操作按钮、折叠按钮等。
 * 它会遍历元素的父级链，为每个需要显示 Gutter 的元素生成相应的按钮。
 *
 * @param protyle 编辑器实例
 * @param element 需要渲染 Gutter 的目标元素
 * @param target 可选的目标子元素，用于精确定位
 * @param gutterTip Gutter 的提示文本，包含快捷键信息
 * @param gutterElement Gutter 的 DOM 元素容器
 * @returns 包含 HTML 内容、匹配状态和其他信息的对象
 */
export const buildGutterHtml = (protyle: IProtyle, element: Element, target: Element | undefined, gutterTip: string, gutterElement: HTMLElement) => {
    const embedContext = getEmbedChildOperationContext(element);
    const embedElement = embedContext ? isInEmbedBlock(element, false) : false;
    const embedID = embedElement ? embedElement.getAttribute("data-node-id") || undefined : undefined;
    // 处理属性视图（Attribute View）的特殊情况
    const avResult = embedContext ? undefined : handleAttributeView(target, element, protyle, element.getAttribute("data-type"));
    if (avResult) {
        return { html: avResult.html, match: false, space: 0, element: avResult.element, nodeElement: avResult.nodeElement };
    }

    // 计算初始节点和列表项
    const initial = calculateInitialNode(element, target, embedContext);
    if (initial.shouldReturn) {
        return { html: "", match: false, space: 0, element: element };
    }

    // 遍历元素的父级链，生成 Gutter 内容
    const result = processGutterNodes(protyle, initial.nodeElement, initial.listItem, gutterTip, embedContext, embedID);
    if (result.shouldReturn) {
        return { html: "", match: false, space: 0, element: element };
    }

    // 检查生成的 HTML 是否与现有按钮匹配
    const match = isGutterMatch(gutterElement, result.html, embedID);

    return {
        html: result.html,
        match,
        listItem: result.listItem,
        nodeElement: result.nodeElement || undefined,
        space: result.space,
        element,
        embedContext,
    };
};

/**
 * 遍历节点处理 Gutter 按钮生成
 */
const processGutterNodes = (
    protyle: IProtyle,
    initialNodeElement: Element,
    initialListItem: Element | undefined,
    gutterTip: string,
    embedContext: IEmbedChildOperationContext | undefined,
    embedID: string | undefined,
) => {
    let nodeElement: Element = initialNodeElement;
    const state = {
        html: "",
        space: 0,
        listItem: initialListItem,
        index: 0,
        hideParent: false
    };

    // 遍历元素的父级链，为每个需要显示 Gutter 的元素生成按钮
    while (nodeElement) {
        if (!nodeElement.parentElement) {
            break;
        }
        const inputParent = hasClosestBlock(nodeElement.parentElement);
        let parentElement = inputParent === false ? undefined : inputParent;
        if (embedContext && parentElement && !embedContext.boundaryElement.contains(parentElement)) {
            parentElement = undefined;
        }

        // 检查是否为嵌入块
        if (!embedContext) {
            const embedCheck = checkEmbedBlock(nodeElement, parentElement);
            if (embedCheck.shouldBreak) {
                break;
            }
            if (embedCheck.shouldContinue && embedCheck.nodeElement) {
                nodeElement = embedCheck.nodeElement;
                continue;
            }
        }

        accumulateGutterHtml(protyle, nodeElement, gutterTip, state, embedContext, embedID);

        // 处理父级逻辑
        const parentLogic = handleParentLogic(nodeElement, parentElement);
        if (parentLogic.shouldReturn) {
            return { html: "", space: 0, listItem: undefined, nodeElement: undefined, shouldReturn: true };
        }
        if (parentLogic.hideParent) {
            state.hideParent = true;
        }
        state.space += parentLogic.space;

        if (!parentElement) {
            break;
        }
        nodeElement = parentElement;
    }

    return { html: state.html, space: state.space, listItem: state.listItem, nodeElement, shouldReturn: false };
};

/**
 * 累积生成 Gutter 按钮的 HTML 内容
 *
 * 此函数为单个节点元素生成 Gutter 按钮 HTML，并累积到 state 中。
 * 它会根据元素类型处理特殊情况，如列表项、标题、引用块等。
 *
 * @param protyle 编辑器实例
 * @param nodeElement 当前处理的节点元素
 * @param gutterTip Gutter 的提示文本
 * @param state 累积状态对象，包含 HTML、缩进、列表项等信息
 */
const accumulateGutterHtml = (
    protyle: IProtyle,
    nodeElement: Element,
    gutterTip: string,
    state: { html: string, space: number, listItem: Element | undefined, index: number, hideParent: boolean },
    embedContext: IEmbedChildOperationContext | undefined,
    embedID: string | undefined,
) => {
    let type: string | null = null;
    if (!state.hideParent) {
        type = nodeElement.getAttribute("data-type");
    }

    // 处理列表项的特殊情况
    if (type === "NodeListItem" && state.index === 1) {
        state.html = "";
    }
    state.index += 1;

    // 生成按钮 HTML
    const { buttonHTML, foldHTML } = generateButtonHtml(
        protyle,
        nodeElement,
        type,
        gutterTip,
        nodeElement.getAttribute("data-node-id"),
        embedContext,
        embedID,
    );
    if (!state.hideParent) {
        state.html = buttonHTML + state.html;
    }

    // 处理列表项和列表
    if (type === "NodeListItem" || type === "NodeList") {
        state.listItem = nodeElement;
    }
    if (type === "NodeListItem" && nodeElement.childElementCount > 3) {
        state.html = buttonHTML + foldHTML;
    }

    // 处理标题
    if (type === "NodeHeading") {
        state.html = state.html + foldHTML;
    }

    // 处理引用块和标注块，增加缩进
    if (["NodeBlockquote", "NodeCallout"].includes(type || "")) {
        state.space += 10;
    }
};

/**
 * 检查生成的 HTML 是否与现有 Gutter 按钮匹配
 * 统计时排除块标边缘框线与+号元素，它们由 render 末尾单独追加，不参与防抖比较
 */
const isGutterMatch = (gutterElement: HTMLElement, html: string, embedID: string | undefined) => {
    let match = true;
    const buttonsElement = gutterElement.querySelectorAll("button:not(.protyle-gutters__line):not(.protyle-gutters__plus)");
    if (buttonsElement.length !== html.split("</button>").length - 1) {
        match = false;
    }

    if (match) {
        for (const item of Array.from(buttonsElement)) {
            const id = item.getAttribute("data-node-id");
            if (id && (html.indexOf(id) === -1 || (item as HTMLElement).dataset.embedId !== embedID)) {
                match = false;
                break;
            }
            const rowId = item.getAttribute("data-row-id");
            if ((rowId && html.indexOf(rowId) === -1) || (!rowId && html.indexOf("NodeAttributeViewRowMenu") > -1)) {
                match = false;
                break;
            }
        }
    }
    return match;
};

/**
 * 检查元素是否为嵌入块并决定处理方式
 *
 * 此函数用于处理嵌入块的特殊情况，确定是否应该继续处理父级元素或中断处理。
 *
 * @param nodeElement 当前检查的元素
 * @param parentElement 父级元素
 * @returns 包含处理指令的对象
 */
const checkEmbedBlock = (nodeElement: Element, parentElement: Element | undefined | null) => {
    // 如果不是嵌入块，无需特殊处理
    if (!isInEmbedBlock(nodeElement)) {
        return {};
    }

    // 如果没有父级元素，应该中断处理
    if (!parentElement) {
        return { shouldBreak: true };
    }

    // 继续处理父级元素
    return { nodeElement: parentElement, shouldContinue: true };
};

/**
 * 计算初始节点和列表项
 *
 * 此函数确定应该从哪个元素开始渲染 Gutter，以及相关的列表项。
 * 它会处理特殊类型的块，如引用块、列表、标注块和超级块。
 *
 * @param element 需要渲染 Gutter 的目标元素
 * @param target 可选的目标子元素，用于精确定位
 * @returns 包含节点元素、列表项和是否应该返回标志的对象
 */
const calculateInitialNode = (
    element: Element,
    _target: Element | undefined,
    embedContext: IEmbedChildOperationContext | undefined,
) => {
    let nodeElement = element;
    const type = nodeElement.getAttribute("data-type");

    // 只对列表和超级块返回（这两种类型的gutter由其子元素处理）
    // 引述块和callout块需要显示块标以便用户操作
    if (["NodeList", "NodeSuperBlock"].includes(type || "")) {
        return { nodeElement, shouldReturn: true };
    }

    // 获取顶级独立元素
    let topElement = getTopAloneElement(nodeElement);
    if (embedContext && !embedContext.boundaryElement.contains(topElement)) {
        topElement = embedContext.targetElement || nodeElement;
    }

    // 处理标注块的特殊情况
    if (topElement.classList.contains("callout") && !nodeElement.classList.contains("callout") &&
        getParentBlock(nodeElement) !== topElement) {
        topElement = topElement.querySelector("[data-node-id]") || topElement;
    }

    // 查找列表项
    let listItem = topElement.querySelector(".li") || topElement.querySelector(".list") || undefined;
    if (listItem && ((!embedContext && isInEmbedBlock(listItem)) || isInAVBlock(listItem))) {
        listItem = undefined;
    }

    const topType = topElement.getAttribute("data-type");

    // 超级块需要保留子块作为 gutter 起点，这样才能同时显示子块和超级块块标
    if (topElement !== nodeElement && type !== "NodeHeading" && !topElement.classList.contains("callout") && topType !== "NodeSuperBlock") {
        nodeElement = topElement;
    }

    return { nodeElement, listItem, shouldReturn: false };
};

/**
 * 处理父级元素的逻辑
 *
 * 此函数确定是否应该隐藏父级元素的 Gutter，以及是否应该中断处理。
 * 它还会计算额外的缩进空间。
 *
 * @param nodeElement 当前元素
 * @param parentElement 父级元素
 * @returns 包含处理指令的对象
 */
const handleParentLogic = (nodeElement: Element, parentElement: Element | undefined | null) => {
    let hideParent = false, space = 0, shouldReturn = false;

    // 检查是否应该检查父级元素
    let previousBlock = nodeElement.previousElementSibling;
    while (previousBlock && !previousBlock.getAttribute("data-node-id")) {
        previousBlock = previousBlock.previousElementSibling;
    }
    const shouldCheckParent = (previousBlock && previousBlock.getAttribute("data-node-id")) ||
        (nodeElement.parentElement && nodeElement.parentElement.classList.contains("callout-content"));

    if (shouldCheckParent) {
        hideParent = true;
    }

    // 如果父级元素已折叠，则应该中断处理
    if (shouldCheckParent && parentElement && parentElement.getAttribute("fold") === "1") {
        shouldReturn = true;
    }

    // 如果父级元素是引用块或标注块，增加缩进
    if (shouldCheckParent && parentElement && ["NodeBlockquote", "NodeCallout"].includes(parentElement.getAttribute("data-type") || "")) {
        space = 10;
    }

    return { hideParent, space, shouldReturn };
};

/**
 * 生成 Gutter 按钮的 HTML
 *
 * 此函数为指定元素生成 Gutter 按钮的 HTML，包括主按钮和折叠按钮。
 * 它会根据元素类型和编辑器状态调整按钮的属性和提示信息。
 *
 * @param protyle 编辑器实例
 * @param nodeElement 需要生成按钮的元素
 * @param type 元素类型
 * @param gutterTip Gutter 的提示文本，包含快捷键信息
 * @param dataNodeId 元素的节点 ID
 * @returns 包含按钮 HTML 和折叠按钮 HTML 的对象
 */
const generateButtonHtml = (
    protyle: IProtyle,
    nodeElement: Element,
    type: string | null,
    gutterTip: string,
    dataNodeId: string | null,
    embedContext: IEmbedChildOperationContext | undefined,
    embedID: string | undefined,
) => {
    // 根据编辑器状态调整提示文本
    let currentGutterTip = gutterTip.replace("${x}", () => getLangByType(type || ""));
    if (embedContext) {
        currentGutterTip = currentGutterTip.split("<br>")[0];
    } else if (protyle.disabled) {
        currentGutterTip = currentGutterTip.split("<br>").splice(0, 2).join("<br>");
    }

    // 处理反向链接数据的情况
    let popoverHTML = "";
    if (protyle.options.backlinkData) {
        popoverHTML = `class="popover__block" data-id="${dataNodeId}"`;
    }

    // 生成主按钮 HTML，使用 data-delay 实现提示延迟以避免干扰
    const embedHTML = embedID ? ` data-embed-id="${embedID}"` : "";
    const buttonHTML = type ? `<button class="ariaLabel" data-delay="500" data-position="parentW" aria-label="${currentGutterTip}"
data-type="${type}" data-subtype="${nodeElement.getAttribute("data-subtype")}" data-node-id="${dataNodeId}"${embedHTML}>
<svg><use xlink:href="#${getIconByType(type || "", nodeElement.getAttribute("data-subtype") || undefined)}"></use></svg>
<span ${popoverHTML} ${protyle.disabled || embedContext ? "" : 'draggable="true"'}></span>
</button>` : "";

    // 生成折叠按钮 HTML（如果需要）
    let foldHTML = "";
    if (type === "NodeListItem" && nodeElement.childElementCount > 3 || type === "NodeHeading") {
        const fold = nodeElement.getAttribute("fold");
        foldHTML = `<button class="ariaLabel" data-position="parentW" aria-label="${siyuanI18n.fold}"
data-type="fold" style="cursor:inherit;"><svg style="width: 10px;${fold && fold === "1" ? "" : "transform:rotate(90deg)"}"><use xlink:href="#iconPlay"></use></svg></button>`;
    }

    return { buttonHTML, foldHTML };
};
