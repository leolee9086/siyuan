import { getIconByType } from "../../editor/getIcon";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { isMac } from "../util/compatibility";
import {
    hasClosestBlock,
    hasClosestByClassName,
    hasTopClosestByClassName,
    isInAVBlock,
    isInEmbedBlock
} from "../util/hasClosest";
import { getParentBlock, getTopAloneElement } from "../wysiwyg/getBlock";

/**
 * 渲染编辑器侧边栏（Gutter）内容
 *
 * 这是 Gutter 渲染的核心函数，负责根据当前元素和目标位置渲染 Gutter 的内容。
 * 它会生成适当的按钮、图标和提示信息，并设置正确的位置。
 *
 * @param protyle 编辑器实例，包含编辑器的所有配置和状态
 * @param element 需要渲染 Gutter 的目标元素
 * @param options 渲染选项对象
 * @param options.target 可选的目标子元素，用于精确定位
 * @param options.gutterElement Gutter 的 DOM 元素容器
 * @param options.gutterTip Gutter 的提示文本，包含快捷键信息
 */
export const renderGutter = (protyle: IProtyle, element: Element, options: { target?: Element | undefined, gutterElement: HTMLElement, gutterTip: string }) => {
    // 检查标题是否已渲染完成，防止在标题未渲染时显示 Gutter
    // 参考: https://github.com/siyuan-note/siyuan/issues/4659
    if (protyle.title && protyle.title.element.getAttribute("data-render") !== "true") {
        return;
    }

    // 防止在文本选择时触碰图标导致高亮无法移除
    const selectElement = protyle.element.querySelector(".protyle-select");
    if (selectElement && !selectElement.classList.contains("fn__none")) {
        return;
    }

    // 确保内容元素存在
    if (!protyle.contentElement) {
        return;
    }

    const { target, gutterElement, gutterTip } = options;
    const result = buildGutterHtml(protyle, element, target, gutterTip, gutterElement);

    // 防止 Gutter 抖动，如果内容匹配且已有子元素，则不重新渲染
    // 参考: https://github.com/siyuan-note/siyuan/issues/4166
    if (result.match && gutterElement.childElementCount > 0) {
        gutterElement.classList.remove("fn__none");
        return;
    }

    // 更新 Gutter 内容
    gutterElement.innerHTML = result.html;
    gutterElement.classList.remove("fn__none");
    gutterElement.style.width = "";

    // 设置 Gutter 位置
    setGutterPosition(protyle, result.element, gutterElement, result.listItem, result.nodeElement, result.space);
};

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
const buildGutterHtml = (protyle: IProtyle, element: Element, target: Element | undefined, gutterTip: string, gutterElement: HTMLElement) => {
    // 处理属性视图（Attribute View）的特殊情况
    const avResult = handleAttributeView(target, element, protyle, element.getAttribute("data-type"));
    if (avResult) {
        return { html: avResult.html, match: false, space: 0, element: avResult.element, nodeElement: avResult.nodeElement };
    }

    // 计算初始节点和列表项
    const initial = calculateInitialNode(element, target);
    if (initial.shouldReturn) {
        return { html: "", match: false, space: 0, element: element };
    }
    let { nodeElement, listItem } = initial;
    let html = "", space = 0, index = 0, hideParent = false;

    // 遍历元素的父级链，为每个需要显示 Gutter 的元素生成按钮
    while (nodeElement) {
        if (!nodeElement.parentElement) {
            break;
        }
        const inputParent = hasClosestBlock(nodeElement.parentElement);
        const parentElement = inputParent === false ? undefined : inputParent;

        // 检查是否为嵌入块
        const embedCheck = checkEmbedBlock(nodeElement, parentElement);
        if (embedCheck.shouldBreak) {
            break;
        }
        if (embedCheck.shouldContinue) {
            nodeElement = embedCheck.nodeElement!;
            continue;
        }

        let type: string | null = null;
        if (!hideParent) {
            type = nodeElement.getAttribute("data-type");
        }

        // 处理列表项的特殊情况
        if (type === "NodeListItem" && index === 1) {
            html = "";
        }
        index += 1;

        // 生成按钮 HTML
        const { buttonHTML, foldHTML } = generateButtonHtml(protyle, nodeElement, type, gutterTip, nodeElement.getAttribute("data-node-id"));
        if (!hideParent) {
            html = buttonHTML + html;
        }

        // 处理列表项和列表
        if (type === "NodeListItem" || type === "NodeList") {
            listItem = nodeElement;
        }
        if (type === "NodeListItem" && nodeElement.childElementCount > 3) {
            html = buttonHTML + foldHTML;
        }

        // 处理标题
        if (type === "NodeHeading") {
            html = html + foldHTML;
        }

        // 处理引用块和标注块，增加缩进
        if (["NodeBlockquote", "NodeCallout"].includes(type || "")) {
            space += 8;
        }

        // 处理父级逻辑
        const parentLogic = handleParentLogic(nodeElement, parentElement);
        if (parentLogic.shouldReturn) {
            return { html: "", match: false, space: 0, element: element };
        }
        if (parentLogic.hideParent) {
            hideParent = true;
        }
        space += parentLogic.space;

        if (!parentElement) {
            break;
        }
        nodeElement = parentElement;
    }

    // 检查生成的 HTML 是否与现有按钮匹配
    let match = true;
    const buttonsElement = gutterElement.querySelectorAll("button");
    if (buttonsElement.length !== html.split("</button>").length - 1) {
        match = false;
    }

    if (match) {
        for (const item of Array.from(buttonsElement)) {
            const id = item.getAttribute("data-node-id");
            if (id && html.indexOf(id) === -1) {
                match = false; break;
            }
            const rowId = item.getAttribute("data-row-id");
            if ((rowId && html.indexOf(rowId) === -1) || (!rowId && html.indexOf("NodeAttributeViewRowMenu") > -1)) {
                match = false; break;
            }
        }
    }

    return { html, match, listItem, nodeElement: nodeElement || undefined, space, element };
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
const calculateInitialNode = (element: Element, target: Element | undefined) => {
    let nodeElement = element;
    const type = nodeElement.getAttribute("data-type");

    // 检查是否为特殊类型的块
    const isSpecialType = ["NodeBlockquote", "NodeList", "NodeCallout", "NodeSuperBlock"].includes(type || "");
    const isInfoCallout = target && type === "NodeCallout" && hasTopClosestByClassName(target, "callout-info");

    // 如果是特殊类型且不是信息标注，则直接返回
    if (isSpecialType && !isInfoCallout) {
        return { nodeElement, shouldReturn: true };
    }

    // 获取顶级独立元素
    let topElement = getTopAloneElement(nodeElement);

    // 处理标注块的特殊情况
    if (topElement.classList.contains("callout") && !nodeElement.classList.contains("callout") &&
        getParentBlock(nodeElement) !== topElement) {
        topElement = topElement.querySelector("[data-node-id]") || topElement;
    }

    // 查找列表项
    let listItem = topElement.querySelector(".li") || topElement.querySelector(".list") || undefined;
    if (listItem && (isInEmbedBlock(listItem) || isInAVBlock(listItem))) {
        listItem = undefined;
    }

    // 如果顶级元素不是当前元素且不是标题或标注，则使用顶级元素
    if (topElement !== nodeElement && type !== "NodeHeading" && !topElement.classList.contains("callout")) {
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
    const shouldCheckParent = (nodeElement.previousElementSibling && nodeElement.previousElementSibling.getAttribute("data-node-id")) ||
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
        space = 8;
    }

    return { hideParent, space, shouldReturn };
};

/**
 * 处理属性视图（Attribute View）的特殊情况
 *
 * 此函数为属性视图的行生成特殊的 Gutter 按钮，包括拖拽按钮和添加按钮。
 * 它会根据编辑器状态和行类型调整按钮的可用性和提示信息。
 *
 * @param target 目标元素，通常是属性视图中的行
 * @param nodeElement 属性视图的容器元素
 * @param protyle 编辑器实例
 * @param type 元素类型
 * @returns 包含 HTML 内容和目标元素的对象，如果不是属性视图则返回 null
 */
const handleAttributeView = (target: Element | undefined, nodeElement: Element, protyle: IProtyle, type: string | null) => {
    // 如果不是属性视图或没有目标元素，则不处理
    if (type !== "NodeAttributeView" || !target) {
        return null;
    }

    // 查找行元素
    const rowElement = hasClosestByClassName(target, "av__row");
    if (!rowElement || rowElement.classList.contains("av__row--header") || !rowElement.dataset.id) {
        return null;
    }

    // 获取属性视图主体元素
    const bodyElement = hasClosestByClassName(rowElement, "av__body") as HTMLElement;

    // 根据操作系统设置提示标签
    let iconAriaLabel = isMac() ? siyuanI18n.rowTip : siyuanI18n.rowTip.replace("⇧", "Shift+");
    const firstBlock = rowElement.querySelector('[data-dtype="block"]');

    // 如果编辑器被禁用，调整提示标签
    if (protyle.disabled) {
        iconAriaLabel = siyuanI18n.rowTip.substring(0, siyuanI18n.rowTip.indexOf("<br"));
    }

    // 如果第一个块是分离的，调整提示标签
    if (!protyle.disabled && firstBlock?.getAttribute("data-detached") === "true") {
        iconAriaLabel = siyuanI18n.rowTip.substring(0, siyuanI18n.rowTip.lastIndexOf("<br"));
    }

    const dataNodeId = nodeElement.getAttribute("data-node-id");

    // 生成行菜单按钮（拖拽按钮）
    let html = `<button data-type="NodeAttributeViewRowMenu" data-node-id="${dataNodeId}" data-row-id="${rowElement.dataset.id}" data-group-id="${bodyElement.dataset.groupId || ""}" class="ariaLabel" data-position="parentW" aria-label="${iconAriaLabel}"><svg><use xlink:href="#iconDrag"></use></svg><span ${protyle.disabled ? "" : 'draggable="true" class="fn__grab"'}></span></button>`;

    // 如果编辑器未被禁用，添加添加按钮
    if (!protyle.disabled) {
        html = `<button data-type="NodeAttributeViewRow" data-node-id="${dataNodeId}" data-row-id="${rowElement.dataset.id}" data-group-id="${bodyElement.dataset.groupId || ""}" class="ariaLabel" data-position="parentW" aria-label="${isMac() ? siyuanI18n.addBelowAbove : siyuanI18n.addBelowAbove.replace("⌥", "Alt+")}"><svg><use xlink:href="#iconAdd"></use></svg></button>${html}`;
    }

    return { html, element: rowElement, nodeElement };
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
const generateButtonHtml = (protyle: IProtyle, nodeElement: Element, type: string | null, gutterTip: string, dataNodeId: string | null) => {
    // 根据编辑器状态调整提示文本
    let currentGutterTip = gutterTip;
    if (protyle.disabled) {
        currentGutterTip = gutterTip.split("<br>").splice(0, 2).join("<br>");
    }

    // 处理反向链接数据的情况
    let popoverHTML = "";
    if (protyle.options.backlinkData) {
        popoverHTML = `class="popover__block" data-id="${dataNodeId}"`;
    }

    // 生成主按钮 HTML
    const buttonHTML = `<button class="ariaLabel" data-position="parentW" aria-label="${currentGutterTip}"
data-type="${type}" data-subtype="${nodeElement.getAttribute("data-subtype")}" data-node-id="${dataNodeId}">
<svg><use xlink:href="#${getIconByType((type || "") as string, nodeElement.getAttribute("data-subtype") || undefined)}"></use></svg>
<span ${popoverHTML} ${protyle.disabled ? "" : 'draggable="true"'}></span>
</button>`;

    // 生成折叠按钮 HTML（如果需要）
    let foldHTML = "";
    if (type === "NodeListItem" && nodeElement.childElementCount > 3 || type === "NodeHeading") {
        const fold = nodeElement.getAttribute("fold");
        foldHTML = `<button class="ariaLabel" data-position="parentW" aria-label="${siyuanI18n.fold}"
data-type="fold" style="cursor:inherit;"><svg style="width: 10px${fold && fold === "1" ? "" : ";transform:rotate(90deg)"}"><use xlink:href="#iconPlay"></use></svg></button>`;
    }

    return { buttonHTML, foldHTML };
};

/**
 * 计算默认情况下的位置度量
 *
 * 此函数计算 Gutter 在默认情况下的垂直位置偏移量，确保 Gutter 与元素正确对齐。
 *
 * @param rect 元素的边界矩形
 * @param gutterElement Gutter 元素
 * @param nodeElement 节点元素
 * @param element 当前元素
 * @param contentTop 内容区域的顶部位置
 * @returns 垂直位置偏移量
 */
const calculateMetricsForDefault = (rect: DOMRect, gutterElement: HTMLElement, nodeElement: Element | undefined, element: Element, contentTop: number) => {
    const fontSize = getSiyuanConfig().editor.fontSize;
    const fontHeight = Math.floor(fontSize * 1.625) + 8;

    // 如果元素高度小于字体高度或在一定范围内，计算居中偏移
    if (rect.height < fontHeight || (rect.height > fontHeight && rect.height < Math.floor(fontSize * 1.625) * 2 + 8)) {
        return (rect.height - gutterElement.clientHeight) / 2;
    }

    // 如果是属性视图且内容区域在元素上方，返回固定偏移
    if ((nodeElement && nodeElement.getAttribute("data-type") === "NodeAttributeView" || element.getAttribute("data-type") === "NodeAttributeView") && contentTop < rect.top) {
        return 8;
    }

    return 0;
};

/**
 * 计算 Gutter 位置的度量信息
 *
 * 此函数计算 Gutter 的位置度量信息，包括边界矩形、边距高度和空间偏移。
 * 它会根据元素类型和布局方向调整计算方式。
 *
 * @param protyle 编辑器实例
 * @param element 当前元素
 * @param gutterElement Gutter 元素
 * @param listItem 列表项元素
 * @param nodeElement 节点元素
 * @returns 包含位置度量信息的对象
 */
const calculatePositionMetrics = (protyle: IProtyle, element: Element, gutterElement: HTMLElement, listItem: Element | undefined, nodeElement: Element | undefined) => {
    let rect = element.getBoundingClientRect();

    // 检查是否应该使用列表项的位置
    const shouldCheckListItem = listItem && !getSiyuanConfig().editor.rtl && getComputedStyle(element).direction !== "rtl" && !element.classList.contains("callout");
    if (shouldCheckListItem && listItem!.firstElementChild) {
        rect = listItem!.firstElementChild.getBoundingClientRect();
    }

    if (shouldCheckListItem) {
        return { rect, marginHeight: 0, space: 0 };
    }

    // 处理嵌入查询块的特殊情况
    if (nodeElement && nodeElement.getAttribute("data-type") === "NodeBlockQueryEmbed") {
        return { rect: nodeElement.getBoundingClientRect(), marginHeight: 0, space: 0 };
    }

    // 处理属性视图行的特殊情况
    if (element.classList.contains("av__row")) {
        return { rect, marginHeight: 0, space: 0 };
    }

    // 默认情况
    return { rect, marginHeight: calculateMetricsForDefault(rect, gutterElement, nodeElement, element, protyle.contentElement!.getBoundingClientRect().top), space: 0 };
};

/**
 * 设置 Gutter 的位置
 *
 * 此函数设置 Gutter 的位置，包括水平和垂直位置。
 * 它会处理各种特殊情况，如嵌入块、属性视图行和空间不足的情况。
 *
 * @param protyle 编辑器实例
 * @param element 当前元素
 * @param gutterElement Gutter 元素
 * @param listItem 列表项元素
 * @param nodeElement 节点元素
 * @param space 额外的空间偏移
 */
const setGutterPosition = (protyle: IProtyle, element: Element, gutterElement: HTMLElement, listItem: Element | undefined, nodeElement: Element | undefined, space: number) => {
    // 计算位置度量信息
    const { rect, marginHeight, space: pSpace } = calculatePositionMetrics(protyle, element, gutterElement, listItem, nodeElement);
    const contentTop = protyle.contentElement!.getBoundingClientRect().top;

    // 设置垂直位置
    gutterElement.style.top = `${Math.max(rect.top, contentTop) + marginHeight}px`;

    // 计算初始水平位置
    let left = rect.left - gutterElement.clientWidth - space - pSpace;

    // 处理嵌入块的特殊情况
    const isEmbed = (nodeElement && nodeElement.getAttribute("data-type") === "NodeBlockQueryEmbed" && gutterElement.childElementCount === 1);
    const isAvRow = element.classList.contains("av__row");

    if (isEmbed && nodeElement) {
        left = nodeElement.getBoundingClientRect().left - gutterElement.clientWidth - space;
    }

    // 处理属性视图行的特殊情况
    if (!isEmbed && isAvRow && nodeElement) {
        left = nodeElement.getBoundingClientRect().left - gutterElement.clientWidth - space + parseInt(getComputedStyle(nodeElement).paddingLeft);
    }

    gutterElement.style.left = `${left}px`;

    // 处理空间不足的情况
    const parentElement = gutterElement.parentElement;
    if (parentElement && left < parentElement.getBoundingClientRect().left) {
        gutterElement.style.width = "24px";
        gutterElement.style.left = `${rect.left - gutterElement.clientWidth - space / 2 + 3}px`;

        // 重新排列按钮，使其垂直堆叠
        let html = "";
        const children = Array.from(gutterElement.children).reverse();
        for (const [index, item] of children.entries()) {
            if (index !== 0) {
                (item.firstElementChild as HTMLElement).style.height = "14px";
            }
            html += item.outerHTML;
        }
        gutterElement.innerHTML = html;
        return;
    }

    // 重置 SVG 高度
    const svgList = gutterElement.querySelectorAll("svg");
    for (const item of svgList) {
        item.style.height = "";
    }
};
