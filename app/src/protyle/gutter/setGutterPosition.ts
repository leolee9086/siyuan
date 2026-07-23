import { isHTMLElement, isSVGElement } from "../../util/DOM/element.guard";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import {hasClosestByAttribute} from "../util/hasClosest";

interface IGutterPositionState {
    protyle: IProtyle;
    element: Element;
    gutterElement: HTMLElement;
    listItem: Element | undefined;
    nodeElement: Element | undefined;
    space: number;
    observer?: ResizeObserver;
}

const standalonePositionStates = new WeakMap<HTMLElement, IGutterPositionState>();

const isStandaloneGutter = () => Reflect.get(globalThis, "siyuan")?.standaloneProtyle === true;

const hasFixedContainingBlock = (style: CSSStyleDeclaration) =>
    style.transform !== "none" ||
    style.perspective !== "none" ||
    style.filter !== "none" ||
    (style.backdropFilter !== "" && style.backdropFilter !== "none") ||
    style.contain.includes("paint") ||
    style.willChange.split(",").some(value => ["transform", "perspective", "filter"].includes(value.trim()));

/** 找到 fixed 元素实际使用的 containing block，兼容宿主页面的 transform/filter/contain。 */
export const getGutterCoordinateOrigin = (gutterElement: HTMLElement) => {
    if (!isStandaloneGutter()) {
        return {left: 0, top: 0};
    }
    let parent = gutterElement.parentElement;
    while (parent) {
        if (hasFixedContainingBlock(getComputedStyle(parent))) {
            const rect = parent.getBoundingClientRect();
            const style = getComputedStyle(parent);
            return {
                left: rect.left + parseFloat(style.borderLeftWidth || "0"),
                top: rect.top + parseFloat(style.borderTopWidth || "0"),
            };
        }
        parent = parent.parentElement;
    }
    return {left: 0, top: 0};
};

const applyGutterCoordinates = (gutterElement: HTMLElement, top: number, left: number) => {
    if (!isStandaloneGutter()) {
        gutterElement.style.top = `${top}px`;
        gutterElement.style.left = `${left}px`;
        return;
    }
    const origin = getGutterCoordinateOrigin(gutterElement);
    gutterElement.style.position = "fixed";
    gutterElement.style.top = `${top - origin.top}px`;
    gutterElement.style.left = `${left - origin.left}px`;
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
    // 确保内容元素存在
    if (!protyle.contentElement) {
        throw new Error("protyle.contentElement 不存在，protyle 对象不完整");
    }

    let rect = element.getBoundingClientRect();

    // 检查是否应该使用列表项的位置
    const shouldCheckListItem = listItem && !getSiyuanConfig().editor.rtl && getComputedStyle(element).direction !== "rtl" && !element.classList.contains("callout");
    if (shouldCheckListItem && listItem.firstElementChild) {
        rect = listItem.firstElementChild.getBoundingClientRect();
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
    return { rect, marginHeight: calculateMetricsForDefault(rect, gutterElement, nodeElement, element, protyle.contentElement.getBoundingClientRect().top), space: 0 };
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
export const setGutterPosition = (protyle: IProtyle, element: Element, gutterElement: HTMLElement, listItem: Element | undefined, nodeElement: Element | undefined, space: number) => {
    // 确保内容元素存在
    if (!protyle.contentElement) {
        throw new Error("protyle.contentElement 不存在，protyle 对象不完整");
    }

    // 计算位置度量信息
    const { rect, marginHeight, space: pSpace } = calculatePositionMetrics(protyle, element, gutterElement, listItem, nodeElement);
    let contentTop = protyle.contentElement.getBoundingClientRect().top;
    if (protyle.options.backlinkData) {
        const backlinkElement = protyle.element.closest(".backlinkList, .backlinkMList");
        if (backlinkElement) {
            contentTop = Math.max(contentTop, backlinkElement.getBoundingClientRect().top);
        }
    }

    // 设置垂直位置
    const foldElement = hasClosestByAttribute(element.parentElement, "fold", "1");
    const foldTop = foldElement ? foldElement.getBoundingClientRect().top : 0;
    const top = Math.max(rect.top + marginHeight, contentTop, foldTop);

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

    applyGutterCoordinates(gutterElement, top, left);

    // 处理空间不足的情况
    const parentElement = gutterElement.parentElement;
    if (parentElement && left < parentElement.getBoundingClientRect().left) {
        gutterElement.style.width = "24px";
        applyGutterCoordinates(gutterElement, top, rect.left - gutterElement.clientWidth - space / 2 + 3);

        // 重新排列按钮，使其垂直堆叠
        // 跳过块标边缘框线与+号元素，避免被压缩重排
        let html = "";
        const children = Array.from(gutterElement.children).reverse();
        for (const [index, item] of children.entries()) {
            if (item.classList.contains("protyle-gutters__line") || item.classList.contains("protyle-gutters__plus")) {
                continue;
            }
            const firstChild = item.firstElementChild;
            if (index !== 0 && (isHTMLElement(firstChild) || isSVGElement(firstChild))) {
                firstChild.style.height = "14px";
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

/** 独立入口在宿主布局变化后重测块标；完整 App 不安装额外观察器。 */
export const observeStandaloneGutterPosition = (options: Omit<IGutterPositionState, "observer">) => {
    if (!isStandaloneGutter()) {
        return;
    }
    let state = standalonePositionStates.get(options.gutterElement);
    if (!state) {
        state = {...options};
        standalonePositionStates.set(options.gutterElement, state);
        if (typeof ResizeObserver !== "undefined") {
            state.observer = new ResizeObserver(() => {
                setGutterPosition(state!.protyle, state!.element, state!.gutterElement, state!.listItem, state!.nodeElement, state!.space);
            });
            state.observer.observe(options.protyle.element);
            state.observer.observe(options.protyle.contentElement);
        }
    } else {
        Object.assign(state, options);
    }
};
