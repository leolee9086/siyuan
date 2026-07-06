/**
 * UI 工具模块
 * 提供顶部工具栏调整和布局相关的UI操作功能
 */

import { Layout } from "./index";
import { Wnd } from "./Wnd";
import { Constants } from "../constants";
import {
    getWindowInnerWidth,
    getScreenWidth,
    getUnpinnedPlugins,
    getCenterLayoutParent,
} from "./ui-utils.environment";

/** 工具栏元素选择器常量 */
const TOOLBAR_SELECTORS = {
    TOOLBAR: "#toolbar",
    DRAG: "#drag",
    BAR_MORE: "#barMore",
    BAR_WORKSPACE: "barWorkspace",
} as const;

/** CSS 类名常量 */
const CSS_CLASSES = {
    NONE: "fn__none",
    FLEX_1: "fn__flex-1",
    LAYOUT_CENTER: "layout__center",
} as const;

/** HTML 属性名常量 */
const ATTRS = {
    DATA_HIDE: "data-hide",
    DATA_HIDE_IDS: "data-hideids",
} as const;

/** 布局方向常量 */
const DIRECTION = {
    LEFT_RIGHT: "lr",
} as const;

/** 尺寸约束常量 */
const SIZE_CONSTRAINTS = {
    MIN_WIDTH_PX: 8,
    // S-forge: 上游 #17919 dock 宽度记忆——最小面板宽度阈值由 64 提升至 168，避免面板过窄失去意义
    MIN_PANEL_WIDTH_PX: 168,
    SCROLL_TOLERANCE_PX: 2,
    PADDING_TOLERANCE_RATIO: 3,
} as const;

/** 重置隐藏状态的元素 */
const resetHiddenElements = (toolbarElement: Element): void => {
    const hiddenElements = toolbarElement.querySelectorAll(`[${ATTRS.DATA_HIDE}="true"]`);
    for (const item of hiddenElements) {
        item.classList.remove(CSS_CLASSES.NONE);
        item.removeAttribute(ATTRS.DATA_HIDE);
    }
};

/**
 * 处理工具栏元素溢出
 * 当工具栏内容超出可视区域时，将元素标记为隐藏
 */
const processOverflowElements = (
    toolbarElement: HTMLElement,
    startElement: Element | null,
    getNextElement: (el: Element) => Element | null,
    shouldStop: (el: Element) => boolean,
    hideIds: string[]
): void => {
    let currentElement = startElement;
    while (toolbarElement.scrollWidth > toolbarElement.clientWidth + SIZE_CONSTRAINTS.SCROLL_TOLERANCE_PX) {
        // 安全检查：确保当前元素存在
        if (!currentElement) {
            break;
        }
        hideIds.push(currentElement.id);
        currentElement.classList.add(CSS_CLASSES.NONE);
        currentElement.setAttribute(ATTRS.DATA_HIDE, "true");
        currentElement = getNextElement(currentElement);
        // 检查是否到达边界
        if (!currentElement || shouldStop(currentElement)) {
            break;
        }
    }
};

/** 调整拖拽元素的填充以居中显示 */
const adjustDragElementPadding = (dragElement: HTMLElement): void => {
    dragElement.style.padding = "";
    const width = dragElement.clientWidth;
    const dragRect = dragElement.getBoundingClientRect();
    const left = dragRect.left;
    const right = getWindowInnerWidth() - dragRect.right;
    const leftRightDiff = left - right;
    const tolerance = width / SIZE_CONSTRAINTS.PADDING_TOLERANCE_RATIO;
    // 左侧空间更大且差值在容差范围内：添加右侧填充
    if (left > right && leftRightDiff < tolerance) {
        dragElement.style.paddingRight = `${leftRightDiff}px`;
        return;
    }
    // 右侧空间更大且差值在容差范围内：添加左侧填充
    if (left < right && -leftRightDiff < tolerance) {
        dragElement.style.paddingLeft = `${-leftRightDiff}px`;
    }
};

/** 应用插件固定的隐藏状态 */
const applyPluginPinStates = (toolbarElement: HTMLElement) => {
    const unpinnedPlugins = getUnpinnedPlugins();
    for (const id of unpinnedPlugins) {
        const element = toolbarElement.querySelector<HTMLElement>(`#${id}`);
        if (element) {
            element.classList.add(CSS_CLASSES.NONE);
        }
    }
};

/**
 * 调整顶部工具栏
 * 根据窗口宽度自动调整顶部工具栏元素的显示/隐藏
 * @同步豁免: UI构建 - 需要同步访问DOM以立即反映UI变化
 */
export const resizeTopBar = () => {
    const toolbarElement = document.querySelector<HTMLElement>(TOOLBAR_SELECTORS.TOOLBAR);
    if (!toolbarElement) {
        return;
    }
    const dragElement = toolbarElement.querySelector<HTMLElement>(TOOLBAR_SELECTORS.DRAG);
    if (!dragElement) {
        return;
    }
    dragElement.style.padding = "";
    const barMoreElement = toolbarElement.querySelector<HTMLElement>(TOOLBAR_SELECTORS.BAR_MORE);
    if (!barMoreElement) {
        return;
    }
    barMoreElement.classList.remove(CSS_CLASSES.NONE);
    barMoreElement.removeAttribute(ATTRS.DATA_HIDE_IDS);
    resetHiddenElements(toolbarElement);

    if (window.siyuan.config.appearance.hideToolbar) {
        return;
    }

    const hideIds: string[] = [];
    // 处理拖拽元素右侧的溢出
    processOverflowElements(
        toolbarElement,
        dragElement.nextElementSibling,
        (el) => el.nextElementSibling,
        (el) => el.id === "barMore",
        hideIds
    );
    // 处理拖拽元素左侧的溢出
    processOverflowElements(
        toolbarElement,
        dragElement.previousElementSibling,
        (el) => el.previousElementSibling,
        (el) => el.id === TOOLBAR_SELECTORS.BAR_WORKSPACE,
        hideIds
    );
    const hasHiddenItems = hideIds.length > 0;
    barMoreElement.classList.toggle(CSS_CLASSES.NONE, !hasHiddenItems);
    barMoreElement.setAttribute(ATTRS.DATA_HIDE_IDS, hideIds.join(","));
    adjustDragElementPadding(dragElement);
    applyPluginPinStates(toolbarElement);
};

/** 记录停靠栏面板的原始宽度（仅首次记录，用于宽度记忆） */
const recordDockWidthIfAbsent = (item: Layout | Wnd): void => {
    // S-forge: 上游 #17919 dock 宽度记忆——首次设置 maxWidth 前记录原始宽度，便于序列化时取回
    if (!item.element.hasAttribute(Constants.ATTRIBUTE_DOCK_WIDTH)) {
        item.element.setAttribute(Constants.ATTRIBUTE_DOCK_WIDTH, item.element.clientWidth.toString());
    }
};

/** 调整子元素的最大宽度以解决溢出 */
const adjustChildrenMaxWidth = (layout: Layout) => {
    let totalWidth = 0;
    const innerWidth = getWindowInnerWidth();
    for (const item of layout.children) {
        const width = item.element.style.width;
        const hasFixedWidth = width && width !== "0px";
        if (hasFixedWidth) {
            recordDockWidthIfAbsent(item);
            const clientWidth = item.element.clientWidth;
            const newMaxWidth = Math.max(Math.min(clientWidth, innerWidth) - SIZE_CONSTRAINTS.MIN_WIDTH_PX, SIZE_CONSTRAINTS.MIN_PANEL_WIDTH_PX);
            item.element.style.maxWidth = `${newMaxWidth}px`;
        }
        totalWidth += item.element.clientWidth;
    }
    return totalWidth;
};

/** 重置子元素的尺寸约束 */
const resetChildrenConstraints = (layout: Layout) => {
    for (const item of layout.children) {
        item.element.style.maxWidth = "";
        // S-forge: 上游 #17919 dock 宽度记忆——清空 maxWidth 时同步移除记录的原始宽度属性
        item.element.removeAttribute(Constants.ATTRIBUTE_DOCK_WIDTH);
        const hasNoWidth = !item.element.style.width;
        const isCenterLayout = item.element.classList.contains(CSS_CLASSES.LAYOUT_CENTER);
        // 对于没有固定宽度且不是中心布局的元素，设置最小宽度以保证可操作性
        if (hasNoWidth && !isCenterLayout) {
            item.element.style.minWidth = `${SIZE_CONSTRAINTS.MIN_WIDTH_PX}px`;
            continue;
        }
        item.element.style.minWidth = "";
    }
};

/**
 * 调整布局尺寸
 * 根据容器大小自动调整布局子元素的宽度，防止内容溢出
 * @同步豁免: UI构建 - 需要同步访问DOM以立即反映布局变化
 */
export const adjustLayout = (layout?: Layout) => {
    const targetLayout = layout ?? getCenterLayoutParent();
    if (!targetLayout) {
        return;
    }
    resetChildrenConstraints(targetLayout);
    const isHorizontalLayout = targetLayout.direction === DIRECTION.LEFT_RIGHT;
    const hasOverflow = targetLayout.element.scrollWidth > targetLayout.element.clientWidth + SIZE_CONSTRAINTS.SCROLL_TOLERANCE_PX;
    if (!isHorizontalLayout || !hasOverflow) {
        return;
    }
    const maxIterations = Math.ceil(getScreenWidth() / SIZE_CONSTRAINTS.MIN_WIDTH_PX);
    let iterations = maxIterations;
    while (iterations > 0) {
        iterations--;
        const totalWidth = adjustChildrenMaxWidth(targetLayout);
        const containerWidth = targetLayout.element.clientWidth;
        // 如果总宽度小于等于容器宽度，说明不再溢出
        if (totalWidth <= containerWidth) {
            break;
        }
    }
    for (const item of targetLayout.children) {
        const isLayout = item instanceof Layout;
        // 只调整非零尺寸的子布局
        if (isLayout && item.size !== "0px") {
            adjustLayout(item);
        }
    }
};

/**
 * 清除元素的 Flex-1 样式
 * @param item - 布局或窗口对象
 * @param isHorizontal - 是否为水平布局
 */
const clearFlex1Style = (item: Layout | Wnd, isHorizontal: boolean) => {
    const hasFlex1 = item.element.classList.contains(CSS_CLASSES.FLEX_1);
    if (!hasFlex1) {
        return;
    }
    if (isHorizontal) {
        // 水平布局：固定宽度并移除 Flex-1
        item.element.style.width = `${item.element.clientWidth}px`;
        item.element.classList.remove(CSS_CLASSES.FLEX_1);
        return;
    }
    // 垂直布局：固定高度并移除 Flex-1
    item.element.style.height = `${item.element.clientHeight}px`;
    item.element.classList.remove(CSS_CLASSES.FLEX_1);
};

/**
 * 为倒数第二个子元素应用 Flex-1 样式
 * @param layout - 布局对象
 * @param flex1Element - 需要应用 Flex-1 样式的元素
 * @param isHorizontal - 是否为水平布局
 */
const applyFlex1ToElement = (layout: Layout, flex1Element: HTMLElement, isHorizontal: boolean) => {
    // 水平布局且有固定宽度：清除宽度并添加 Flex-1，使其自适应填充剩余空间
    if (isHorizontal && flex1Element.style.width) {
        flex1Element.style.width = "";
        flex1Element.classList.add(CSS_CLASSES.FLEX_1);
        return;
    }
    // 垂直布局且有固定高度：清除高度并添加 Flex-1，使其自适应填充剩余空间
    if (!isHorizontal && flex1Element.style.height) {
        flex1Element.style.height = "";
        flex1Element.classList.add(CSS_CLASSES.FLEX_1);
    }
};

/**
 * 修复窗口 Flex 布局
 * 确保布局中只有一个元素具有 Flex-1 样式
 * @同步豁免: UI构建 - 需要同步访问DOM以立即反映布局变化
 */
export const fixWndFlex1 = (layout: Layout) => {
    const hasEnoughChildren = layout.children.length >= 2;
    if (!hasEnoughChildren) {
        return;
    }
    const secondLastIndex = layout.children.length - 2;
    const secondLastChild = layout.children[secondLastIndex];
    if (!secondLastChild) {
        return;
    }
    const alreadyHasFlex1 = secondLastChild.element.classList.contains(CSS_CLASSES.FLEX_1);
    if (alreadyHasFlex1) {
        return;
    }
    const isHorizontal = layout.direction === DIRECTION.LEFT_RIGHT;
    for (let index = 0; index < layout.children.length; index++) {
        // 跳过倒数第二个元素，它应该保持 Flex-1
        if (index === secondLastIndex) {
            continue;
        }
        const item = layout.children[index];
        if (item) {
            clearFlex1Style(item, isHorizontal);
        }
    }
    applyFlex1ToElement(layout, secondLastChild.element, isHorizontal);
};
