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

export const renderGutter = (protyle: IProtyle, element: Element, options: { target?: Element | undefined, gutterElement: HTMLElement, gutterTip: string }) => {
    // https://github.com/siyuan-note/siyuan/issues/4659
    if (protyle.title && protyle.title.element.getAttribute("data-render") !== "true") return;
    // 防止划选时触碰图标导致 hl 无法移除
    const selectElement = protyle.element.querySelector(".protyle-select");
    if (selectElement && !selectElement.classList.contains("fn__none")) return;
    if (!protyle.contentElement) return;

    const { target, gutterElement, gutterTip } = options;
    const result = buildGutterHtml(protyle, element, target, gutterTip, gutterElement);

    // 防止抖动 https://github.com/siyuan-note/siyuan/issues/4166
    if (result.match && gutterElement.childElementCount > 0) {
        gutterElement.classList.remove("fn__none");
        return;
    }
    gutterElement.innerHTML = result.html;
    gutterElement.classList.remove("fn__none");
    gutterElement.style.width = "";

    setGutterPosition(protyle, result.element, gutterElement, result.listItem, result.nodeElement, result.space);
};

const buildGutterHtml = (protyle: IProtyle, element: Element, target: Element | undefined, gutterTip: string, gutterElement: HTMLElement) => {
    const avResult = handleAttributeView(target, element, protyle, element.getAttribute("data-type"));
    if (avResult) return { html: avResult.html, match: false, space: 0, element: avResult.element };

    const initial = calculateInitialNode(element, target);
    if (initial.shouldReturn) return { html: "", match: false, space: 0, element: element };
    let { nodeElement, listItem } = initial;
    let html = "", space = 0, index = 0, hideParent = false;

    while (nodeElement) {
        if (!nodeElement.parentElement) break;
        const inputParent = hasClosestBlock(nodeElement.parentElement);
        const parentElement = inputParent === false ? undefined : inputParent;
        const embedCheck = checkEmbedBlock(nodeElement, parentElement);
        if (embedCheck.shouldBreak) break;
        if (embedCheck.shouldContinue) {
            nodeElement = embedCheck.nodeElement!;
            continue;
        }

        let type: string | null = null;
        if (!hideParent) type = nodeElement.getAttribute("data-type");
        if (type === "NodeListItem" && index === 1) html = "";
        index += 1;

        const { buttonHTML, foldHTML } = generateButtonHtml(protyle, nodeElement, type, gutterTip, nodeElement.getAttribute("data-node-id"));
        if (!hideParent) html = buttonHTML + html;

        if (type === "NodeListItem" || type === "NodeList") listItem = nodeElement;
        if (type === "NodeListItem" && nodeElement.childElementCount > 3) html = buttonHTML + foldHTML;

        if (type === "NodeHeading") html = html + foldHTML;
        if (["NodeBlockquote", "NodeCallout"].includes(type || "")) space += 8;

        const parentLogic = handleParentLogic(nodeElement, parentElement);
        if (parentLogic.shouldReturn) return { html: "", match: false, space: 0, element: element };
        if (parentLogic.hideParent) hideParent = true;
        space += parentLogic.space;

        if (!parentElement) break;
        nodeElement = parentElement;
    }

    let match = true;
    const buttonsElement = gutterElement.querySelectorAll("button");
    if (buttonsElement.length !== html.split("</button>").length - 1) match = false;

    if (match) {
        for (const item of Array.from(buttonsElement)) {
            const id = item.getAttribute("data-node-id");
            if (id && html.indexOf(id) === -1) { match = false; break; }
            const rowId = item.getAttribute("data-row-id");
            if ((rowId && html.indexOf(rowId) === -1) || (!rowId && html.indexOf("NodeAttributeViewRowMenu") > -1)) { match = false; break; }
        }
    }
    return { html, match, listItem, nodeElement: nodeElement || undefined, space, element };
};

const checkEmbedBlock = (nodeElement: Element, parentElement: Element | undefined | null) => {
    if (!isInEmbedBlock(nodeElement)) return {};
    if (!parentElement) return { shouldBreak: true };
    return { nodeElement: parentElement, shouldContinue: true };
};

const calculateInitialNode = (element: Element, target: Element | undefined) => {
    let nodeElement = element;
    const type = nodeElement.getAttribute("data-type");
    const isSpecialType = ["NodeBlockquote", "NodeList", "NodeCallout", "NodeSuperBlock"].includes(type || "");
    const isInfoCallout = target && type === "NodeCallout" && hasTopClosestByClassName(target, "callout-info");
    if (isSpecialType && !isInfoCallout) return { nodeElement, shouldReturn: true };

    let topElement = getTopAloneElement(nodeElement);
    if (topElement.classList.contains("callout") && !nodeElement.classList.contains("callout") &&
        getParentBlock(nodeElement) !== topElement) {
        topElement = topElement.querySelector("[data-node-id]") || topElement;
    }
    let listItem = topElement.querySelector(".li") || topElement.querySelector(".list") || undefined;
    if (listItem && (isInEmbedBlock(listItem) || isInAVBlock(listItem))) listItem = undefined;

    if (topElement !== nodeElement && type !== "NodeHeading" && !topElement.classList.contains("callout")) {
        nodeElement = topElement;
    }
    return { nodeElement, listItem, shouldReturn: false };
};

const handleParentLogic = (nodeElement: Element, parentElement: Element | undefined | null) => {
    let hideParent = false, space = 0, shouldReturn = false;
    const shouldCheckParent = (nodeElement.previousElementSibling && nodeElement.previousElementSibling.getAttribute("data-node-id")) ||
        (nodeElement.parentElement && nodeElement.parentElement.classList.contains("callout-content"));
    if (shouldCheckParent) {
        hideParent = true;
    }
    if (shouldCheckParent && parentElement && parentElement.getAttribute("fold") === "1") shouldReturn = true;
    if (shouldCheckParent && parentElement && ["NodeBlockquote", "NodeCallout"].includes(parentElement.getAttribute("data-type") || "")) space = 8;
    return { hideParent, space, shouldReturn };
};

const handleAttributeView = (target: Element | undefined, nodeElement: Element, protyle: IProtyle, type: string | null) => {
    if (type !== "NodeAttributeView" || !target) return null;
    const rowElement = hasClosestByClassName(target, "av__row");
    if (!rowElement || rowElement.classList.contains("av__row--header") || !rowElement.dataset.id) return null;

    const bodyElement = hasClosestByClassName(rowElement, "av__body") as HTMLElement;
    let iconAriaLabel = isMac() ? siyuanI18n.rowTip : siyuanI18n.rowTip.replace("⇧", "Shift+");
    const firstBlock = rowElement.querySelector('[data-dtype="block"]');

    if (protyle.disabled) {
        iconAriaLabel = siyuanI18n.rowTip.substring(0, siyuanI18n.rowTip.indexOf("<br"));
    }
    if (!protyle.disabled && firstBlock?.getAttribute("data-detached") === "true") {
        iconAriaLabel = siyuanI18n.rowTip.substring(0, siyuanI18n.rowTip.lastIndexOf("<br"));
    }
    const dataNodeId = nodeElement.getAttribute("data-node-id");
    let html = `<button data-type="NodeAttributeViewRowMenu" data-node-id="${dataNodeId}" data-row-id="${rowElement.dataset.id}" data-group-id="${bodyElement.dataset.groupId || ""}" class="ariaLabel" data-position="parentW" aria-label="${iconAriaLabel}"><svg><use xlink:href="#iconDrag"></use></svg><span ${protyle.disabled ? "" : 'draggable="true" class="fn__grab"'}></span></button>`;
    if (!protyle.disabled) {
        html = `<button data-type="NodeAttributeViewRow" data-node-id="${dataNodeId}" data-row-id="${rowElement.dataset.id}" data-group-id="${bodyElement.dataset.groupId || ""}" class="ariaLabel" data-position="parentW" aria-label="${isMac() ? siyuanI18n.addBelowAbove : siyuanI18n.addBelowAbove.replace("⌥", "Alt+")}"><svg><use xlink:href="#iconAdd"></use></svg></button>${html}`;
    }
    return { html, element: rowElement };
};

const generateButtonHtml = (protyle: IProtyle, nodeElement: Element, type: string | null, gutterTip: string, dataNodeId: string | null) => {
    let currentGutterTip = gutterTip;
    if (protyle.disabled) currentGutterTip = gutterTip.split("<br>").splice(0, 2).join("<br>");
    let popoverHTML = "";
    if (protyle.options.backlinkData) popoverHTML = `class="popover__block" data-id="${dataNodeId}"`;
    const buttonHTML = `<button class="ariaLabel" data-position="parentW" aria-label="${currentGutterTip}" 
data-type="${type}" data-subtype="${nodeElement.getAttribute("data-subtype")}" data-node-id="${dataNodeId}">
<svg><use xlink:href="#${getIconByType((type || "") as string, nodeElement.getAttribute("data-subtype"))}"></use></svg>
<span ${popoverHTML} ${protyle.disabled ? "" : 'draggable="true"'}></span>
</button>`;
    let foldHTML = "";
    if (type === "NodeListItem" && nodeElement.childElementCount > 3 || type === "NodeHeading") {
        const fold = nodeElement.getAttribute("fold");
        foldHTML = `<button class="ariaLabel" data-position="parentW" aria-label="${siyuanI18n.fold}" 
data-type="fold" style="cursor:inherit;"><svg style="width: 10px${fold && fold === "1" ? "" : ";transform:rotate(90deg)"}"><use xlink:href="#iconPlay"></use></svg></button>`;
    }
    return { buttonHTML, foldHTML };
};

const calculateMetricsForDefault = (rect: DOMRect, gutterElement: HTMLElement, nodeElement: Element | undefined, element: Element, contentTop: number) => {
    const fontSize = getSiyuanConfig().editor.fontSize;
    const fontHeight = Math.floor(fontSize * 1.625) + 8;

    if (rect.height < fontHeight || (rect.height > fontHeight && rect.height < Math.floor(fontSize * 1.625) * 2 + 8)) {
        return (rect.height - gutterElement.clientHeight) / 2;
    }
    if ((nodeElement && nodeElement.getAttribute("data-type") === "NodeAttributeView" || element.getAttribute("data-type") === "NodeAttributeView") && contentTop < rect.top) {
        return 8;
    }
    return 0;
};

const calculatePositionMetrics = (protyle: IProtyle, element: Element, gutterElement: HTMLElement, listItem: Element | undefined, nodeElement: Element | undefined) => {
    let rect = element.getBoundingClientRect();
    const shouldCheckListItem = listItem && !getSiyuanConfig().editor.rtl && getComputedStyle(element).direction !== "rtl" && !element.classList.contains("callout");
    if (shouldCheckListItem && listItem!.firstElementChild) {
        rect = listItem!.firstElementChild.getBoundingClientRect();
    }
    if (shouldCheckListItem) {
        return { rect, marginHeight: 0, space: 0 };
    }
    if (nodeElement && nodeElement.getAttribute("data-type") === "NodeBlockQueryEmbed") {
        return { rect: nodeElement.getBoundingClientRect(), marginHeight: 0, space: 0 };
    }
    if (element.classList.contains("av__row")) {
        return { rect, marginHeight: 0, space: 0 };
    }
    return { rect, marginHeight: calculateMetricsForDefault(rect, gutterElement, nodeElement, element, protyle.contentElement!.getBoundingClientRect().top), space: 0 };
};

const setGutterPosition = (protyle: IProtyle, element: Element, gutterElement: HTMLElement, listItem: Element | undefined, nodeElement: Element | undefined, space: number) => {
    const { rect, marginHeight, space: pSpace } = calculatePositionMetrics(protyle, element, gutterElement, listItem, nodeElement);
    const contentTop = protyle.contentElement!.getBoundingClientRect().top;

    gutterElement.style.top = `${Math.max(rect.top, contentTop) + marginHeight}px`;
    let left = rect.left - gutterElement.clientWidth - space - pSpace;

    const isEmbed = (nodeElement && nodeElement.getAttribute("data-type") === "NodeBlockQueryEmbed" && gutterElement.childElementCount === 1);
    const isAvRow = element.classList.contains("av__row");
    if (isEmbed) {
        left = nodeElement!.getBoundingClientRect().left - gutterElement.clientWidth - space;
    }
    if (!isEmbed && isAvRow) {
        left = nodeElement!.getBoundingClientRect().left - gutterElement.clientWidth - space + parseInt(getComputedStyle(nodeElement || element).paddingLeft);
    }
    gutterElement.style.left = `${left}px`;

    if (left < gutterElement.parentElement!.getBoundingClientRect().left) {
        gutterElement.style.width = "24px";
        gutterElement.style.left = `${rect.left - gutterElement.clientWidth - space / 2 + 3}px`;
        let html = "";
        const children = Array.from(gutterElement.children).reverse();
        for (const [index, item] of children.entries()) {
            if (index !== 0) (item.firstElementChild as HTMLElement).style.height = "14px";
            html += item.outerHTML;
        }
        gutterElement.innerHTML = html;
        return;
    }
    const svgList = gutterElement.querySelectorAll("svg");
    for (const item of svgList) item.style.height = "";
};
