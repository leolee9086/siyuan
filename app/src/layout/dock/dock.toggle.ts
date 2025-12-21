/**
 * dock.toggle.ts - Dock 面板切换逻辑
 * 从 index.ts 提取的 toggleModel 相关辅助函数
 */

import type { Wnd } from "../Wnd";
import type { Dock } from "./index";
import { Graph } from "./Graph";
import { setPanelFocus } from "../utils/setPanelFocus";
import { clearBeforeResizeTop } from "../../protyle/util/resize";
import { getAllTabs } from "../getAll";

/**
 * 处理已激活面板的焦点切换
 * @returns true 如果需要焦点切换并已处理，false 否则
 */
export function handlePanelFocusSwitch(
    wnd: Wnd,
    target: HTMLElement,
    dock: Dock
): boolean {
    const tabContainer = wnd.element.querySelector(".layout-tab-container");
    if (!tabContainer) {
        return false;
    }

    let needFocus = false;
    const targetDataId = target.getAttribute("data-id");

    // @内联回调
    Array.from(tabContainer.children).find(item => {
        if (item.getAttribute("data-id") !== targetDataId) {
            return false;
        }
        if (!item.classList.contains("layout__tab--active")) {
            setPanelFocus(item);
            needFocus = true;
        }
        return true;
    });

    if (!needFocus) {
        return false;
    }

    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) {
        activeElement.blur();
    }
    clearBeforeResizeTop();
    dock.showDock();
    return true;
}

/**
 * 处理 Graph 类型面板的销毁
 */
export function handleGraphDestroy(
    type: string,
    dock: Dock
): void {
    if (type !== "graph" && type !== "globalGraph") {
        return;
    }

    const fullscreenElement = dock.layout.element.querySelector(".fullscreen");
    if (fullscreenElement) {
        const dragElement = document.getElementById("drag");
        dragElement?.classList.remove("fn__hidden");
    }

    const graph = dock.data[type];
    if (graph instanceof Graph) {
        graph.destroy();
    }
}

/**
 * 关闭 dock 后设置光标
 */
export function handlePostCloseFocus(isSaveLayout: boolean): void {
    if (!isSaveLayout) {
        return;
    }

    const activeWnd = document.querySelector(".layout__center .layout__wnd--active");
    if (activeWnd) {
        return;
    }

    const currentElement = document.querySelector(".layout__center ul.layout-tab-bar .item--focus");
    if (!currentElement) {
        return;
    }

    const dataId = currentElement.getAttribute("data-id");
    // @内联回调
    getAllTabs().find(item => {
        if (item.id !== dataId) {
            return false;
        }
        item.parent.switchTab(item.headElement, false, true, false);
        return true;
    });
}

/**
 * 处理 tab 切换（显示/隐藏）
 */
export function handleTabSwitch(wnd: Wnd, targetDataId: string | null): void {
    const tabContainer = wnd.element.querySelector(".layout-tab-container");
    if (!tabContainer) {
        return;
    }

    for (const item of Array.from(tabContainer.children)) {
        if (item.getAttribute("data-id") === targetDataId) {
            item.classList.remove("fn__none");
            setPanelFocus(item);
            continue;
        }
        item.classList.add("fn__none");
    }
}

/**
 * 更新两个 dock 面板的显示关系
 */
export function updateDockPanelRelation(
    dock: Dock,
    wnd: Wnd,
    anotherWnd: Wnd,
    index: number,
    anotherIndex: number,
    hasActive: boolean,
    anotherHasActive: boolean
): void {
    // 处理两个面板都激活的情况
    if (hasActive && anotherHasActive) {
        handleBothPanelsActive(dock, wnd, anotherWnd, anotherIndex);
        return;
    }

    // 隐藏分隔线
    hidePanelSeparator(anotherWnd, anotherIndex);
}

function handleBothPanelsActive(
    dock: Dock,
    wnd: Wnd,
    anotherWnd: Wnd,
    anotherIndex: number
): void {
    let lastWnd = wnd;

    if (anotherIndex === 0) {
        anotherWnd.element.nextElementSibling?.classList.remove("fn__none");
    }
    if (anotherIndex !== 0) {
        lastWnd = anotherWnd;
        anotherWnd.element.previousElementSibling?.classList.remove("fn__none");
    }

    const lastActiveElement = dock.element.querySelector('.dock__item--active[data-index="1"]');
    if (!lastActiveElement) {
        return;
    }

    const isLeftOrRight = dock.position === "Left" || dock.position === "Right";
    applyPanelSize(lastWnd, lastActiveElement, isLeftOrRight);
}

function applyPanelSize(
    lastWnd: Wnd,
    lastActiveElement: Element,
    isLeftOrRight: boolean
): void {
    const attrName = isLeftOrRight ? "data-height" : "data-width";
    const styleProp = isLeftOrRight ? "height" : "width";
    const attrValue = lastActiveElement.getAttribute(attrName);
    const size = parseInt(attrValue || "0", 10);
    const isValidSize = size !== 0 && !isNaN(size);
    if (!isValidSize) {
        return;
    }
    lastWnd.element.style[styleProp] = size + "px";
    lastWnd.element.classList.remove("fn__flex-1");
}

function hidePanelSeparator(anotherWnd: Wnd, anotherIndex: number): void {
    if (anotherIndex === 0) {
        anotherWnd.element.nextElementSibling?.classList.add("fn__none");
        return;
    }
    anotherWnd.element.previousElementSibling?.classList.add("fn__none");
}

/**
 * 更新面板可见性
 */
export function updatePanelVisibility(
    wnd: Wnd,
    anotherWnd: Wnd,
    hasActive: boolean,
    anotherHasActive: boolean
): void {
    // 更新 anotherWnd 可见性
    if (anotherHasActive) {
        anotherWnd.element.classList.remove("fn__none");
    }
    if (!anotherHasActive) {
        anotherWnd.element.classList.add("fn__none");
    }

    // 更新 wnd 可见性
    if (hasActive) {
        wnd.element.classList.remove("fn__none");
    }
    if (!hasActive) {
        wnd.element.classList.add("fn__none");
    }

    // 设置 flex-1
    if (hasActive && !anotherHasActive) {
        wnd.element.classList.add("fn__flex-1");
        wnd.element.style.height = "";
        wnd.element.style.width = "";
        return;
    }

    if (!hasActive && anotherHasActive) {
        anotherWnd.element.classList.add("fn__flex-1");
        anotherWnd.element.style.height = "";
        anotherWnd.element.style.width = "";
    }
}

/**
 * 处理 Graph 显示
 */
export function handleGraphShow(type: string, dock: Dock): void {
    if (type !== "graph" && type !== "globalGraph") {
        return;
    }

    const graph = dock.data[type];
    if (graph instanceof Graph) {
        graph.onGraph(false);
    }
}

/**
 * 处理 dock 隐藏时的尺寸和状态重置
 * @returns true 如果 dock 已被隐藏
 */
export function handleDockHideSize(
    dock: Dock,
    hasNoActiveItems: boolean
): boolean {
    if (!hasNoActiveItems) {
        return false;
    }

    const isHorizontal = dock.position === "Left" || dock.position === "Right";
    const styleProp = isHorizontal ? "width" : "height";
    dock.layout.element.style[styleProp] = "0px";
    dock.resizeElement.classList.add("fn__none");
    return true;
}

/**
 * 设置 dock 显示时的尺寸
 */
export function setDockLayoutSize(dock: Dock, size: number): void {
    const isHorizontal = dock.position === "Left" || dock.position === "Right";
    const styleProp = isHorizontal ? "width" : "height";
    dock.layout.element.style[styleProp] = size + "px";
}

/**
 * 处理全屏 Graph 的拖动条显示/隐藏
 */
export function handleGraphFullscreenDrag(type: string, dock: Dock, show: boolean): void {
    if (type !== "graph" && type !== "globalGraph") {
        return;
    }

    const fullscreenElement = dock.layout.element.querySelector(".fullscreen");
    if (!fullscreenElement) {
        return;
    }

    const dragElement = document.getElementById("drag");
    if (!dragElement) {
        return;
    }

    const method = show ? "add" : "remove";
    dragElement.classList[method]("fn__hidden");
}

/**
 * 模糊当前活动元素
 */
export function blurActiveElement(): void {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) {
        activeElement.blur();
    }
}

/**
 * 处理浮动模式切换
 */
export function handleFloatModeToggle(dock: Dock, hasActive: boolean): void {
    const { resizeTabs } = require("../tabUtil");
    dock.resetDockPosition(hasActive);
    dock.resizeElement.classList.add("fn__none");
    if (hasActive) {
        dock.showDock(true);
    }
    if (!hasActive) {
        dock.hideDock(true);
    }
    dock.layout.element.classList.toggle("layout--float");
    resizeTabs();
}

/**
 * 处理固定模式切换
 */
export function handlePinModeToggle(dock: Dock, hasActive: boolean): void {
    const { resizeTabs } = require("../tabUtil");
    dock.layout.element.style.opacity = "";
    dock.layout.element.style.transform = "";
    dock.layout.element.style.zIndex = "";
    if (hasActive) {
        dock.resizeElement.classList.remove("fn__none");
    }
    dock.layout.element.classList.toggle("layout--float");
    resizeTabs();
}

/**
 * 处理 toggle 隐藏
 */
export function triggerToggleHide(
    dock: Dock,
    wnd: Wnd,
    target: HTMLElement,
    type: string,
    close: boolean,
    isSaveLayout: boolean,
    hideResizeTimeout: number,
    clearWindowTimeoutFn: (id: number) => void
): void {
    if (!close && handlePanelFocusSwitch(wnd, target, dock)) {
        return;
    }
    target.classList.remove("dock__item--active", "dock__item--activefocus");
    const activeItems = dock.element.querySelectorAll(".dock__item--active");
    const hasNoActiveItems = activeItems.length === 0;
    if (handleDockHideSize(dock, hasNoActiveItems)) {
        clearWindowTimeoutFn(hideResizeTimeout);
        dock.hideDock();
    }
    handleGraphDestroy(type, dock);
    handlePostCloseFocus(isSaveLayout);
}

/**
 * 处理 toggle 显示
 */
export function triggerToggleShow(
    dock: Dock,
    wnd: Wnd,
    target: HTMLElement,
    type: string,
    index: number,
    createNewTabFn: (wnd: Wnd, target: HTMLElement, type: string) => void,
    showDockWithResizeFn: (type: string) => void
): void {
    for (const item of Array.from(dock.element.querySelectorAll(`.dock__item--active[data-index="${index}"]`))) {
        item.classList.remove("dock__item--active", "dock__item--activefocus");
    }
    target.classList.add("dock__item--active", "dock__item--activefocus");
    if (!target.getAttribute("data-id")) {
        createNewTabFn(wnd, target, type);
        return;
    }
    handleTabSwitch(wnd, target.getAttribute("data-id"));
    showDockWithResizeFn(type);
}

/**
 * 处理 toggle 隐藏操作（完整实现）
 */
export function executeToggleHide(
    dock: Dock,
    wnd: Wnd,
    target: HTMLElement,
    type: string,
    close: boolean,
    isSaveLayout: boolean,
    hideResizeTimeout: number,
    clearTimeoutFn: (id: number) => void
): void {
    if (!close && handlePanelFocusSwitch(wnd, target, dock)) {
        return;
    }
    target.classList.remove("dock__item--active", "dock__item--activefocus");
    const hasNoActiveItems = dock.element.querySelectorAll(".dock__item--active").length === 0;
    if (handleDockHideSize(dock, hasNoActiveItems)) {
        clearTimeoutFn(hideResizeTimeout);
        dock.hideDock();
    }
    handleGraphDestroy(type, dock);
    handlePostCloseFocus(isSaveLayout);
}

/**
 * 处理 toggle 显示操作（完整实现）
 */
export function executeToggleShow(
    dock: Dock,
    wnd: Wnd,
    target: HTMLElement,
    type: string,
    index: number,
    app: { new(): unknown },
    data: { [key: string]: unknown },
    setPanelFocusFn: (element: Element) => void,
    createDockTabFn: (opts: { app: unknown; type: string; editor?: unknown }) => { id: string; model: unknown; panelElement: Element },
    findActiveEditorFn: () => unknown,
    setDockLayoutSizeFn: (dock: Dock, size: number) => void,
    getMaxSizeFn: (dock: Dock) => number,
    handleGraphFullscreenDragFn: (type: string, dock: Dock, show: boolean) => void,
    setTimeoutFn: (fn: () => void, ms?: number) => number,
    adjustLayoutFn: () => void,
    TIMEOUT_TRANSITION: number
): void {
    for (const item of Array.from(dock.element.querySelectorAll(`.dock__item--active[data-index="${index}"]`))) {
        item.classList.remove("dock__item--active", "dock__item--activefocus");
    }
    target.classList.add("dock__item--active", "dock__item--activefocus");
    if (!target.getAttribute("data-id")) {
        const editor = findActiveEditorFn();
        const tab = createDockTabFn({ app, type, editor });
        wnd.addTab(tab, false, false);
        target.setAttribute("data-id", tab.id);
        data[type] = tab.model;
        setPanelFocusFn(tab.panelElement);
    }
    handleTabSwitch(wnd, target.getAttribute("data-id"));
    setDockLayoutSizeFn(dock, getMaxSizeFn(dock));
    handleGraphFullscreenDragFn(type, dock, true);
    if (dock.pin) {
        dock.layout.element.style.opacity = "";
        // @内联回调
        setTimeoutFn(() => {
            dock.resizeElement.classList.remove("fn__none");
            adjustLayoutFn();
        }, TIMEOUT_TRANSITION);
    }
    blurActiveElement();
}

/**
 * 更新面板关系逻辑
 */
export function executePanelRelationsUpdate(
    dock: Dock,
    wnd: Wnd,
    index: number,
    isWndFn: (child: unknown) => child is Wnd
): void {
    const anotherIndex = index === 0 ? 1 : 0;
    const anotherChild = dock.layout.children[anotherIndex];
    if (!isWndFn(anotherChild)) {
        return;
    }
    const anotherActiveItems = dock.element.querySelectorAll(`.dock__item--active[data-index="${anotherIndex}"]`);
    const currentActiveItems = dock.element.querySelectorAll(`.dock__item--active[data-index="${index}"]`);
    const anotherHasActive = anotherActiveItems.length > 0;
    const hasActive = currentActiveItems.length > 0;
    updateDockPanelRelation(dock, wnd, anotherChild, index, anotherIndex, hasActive, anotherHasActive);
    updatePanelVisibility(wnd, anotherChild, hasActive, anotherHasActive);
}

