/**
 * dock.toggle.ts - Dock 面板切换逻辑
 * 从 index.ts 提取的 toggleModel 相关辅助函数
 */

import type { Wnd } from "../Wnd";
import type { Tab } from "../Tab";
import type { Dock } from "./index";
import { handleGraphDestroy } from "./dock.graph";

import { handlePanelFocusSwitch } from "./dock.focus";
import { handlePostCloseFocus } from "./dock.focus";
import { handleTabSwitch } from "./dock.focus";
import { blurActiveElement } from "./dock.focus";
import { resizeTabs } from "./imports";
export {
    handlePanelFocusSwitch,
    handlePostCloseFocus,
    handleTabSwitch,
    blurActiveElement,
};














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

    // 使用卫语句替代 else-if 链
    if (dock.position === "Left") {
        dock.layout.element.style.width = "0px";
        dock.layout.element.style.marginRight = "0px";
        dock.resizeElement.classList.add("fn__none");
        return true;
    }
    if (dock.position === "Right") {
        dock.layout.element.style.width = "0px";
        dock.layout.element.style.marginLeft = "0px";
        dock.resizeElement.classList.add("fn__none");
        return true;
    }
    dock.layout.element.style.height = "0px";
    dock.layout.element.style.marginTop = "0px";
    dock.resizeElement.classList.add("fn__none");
    return true;
}

/**
 * 设置 dock 显示时的尺寸
 */
export function setDockLayoutSize(dock: Dock, size: number): void {
    // 合并条件避免嵌套 if（no-nested-if-block）
    if (dock.position === "Left" && dock.layout.element.style.width === "0px") {
        dock.layout.element.style.width = size + "px";
    }
    if (dock.position === "Right" && dock.layout.element.style.width === "0px") {
        dock.layout.element.style.width = size + "px";
    }
    if (dock.position === "Bottom" && dock.layout.element.style.height === "0px") {
        dock.layout.element.style.height = size + "px";
    }

    // 使用卫语句替代 else-if 链，每个位置独立处理 margin
    if (dock.position === "Left") {
        dock.layout.element.style.marginRight = "var(--b3-layout-space)";
        return;
    }
    if (dock.position === "Right") {
        dock.layout.element.style.marginLeft = "var(--b3-layout-space)";
        return;
    }
    if (dock.position === "Bottom") {
        dock.layout.element.style.marginTop = "var(--b3-layout-space)";
    }
}





/**
 * 处理浮动模式切换
 */
export function handleFloatModeToggle(dock: Dock, hasActive: boolean): void {
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
    const activeItems = dock.element.querySelectorAll(`.dock__item--active[data-index="${index}"]`);
    for (const item of Array.from(activeItems)) {
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
    const activeItems = dock.element.querySelectorAll(".dock__item--active");
    const hasNoActiveItems = activeItems.length === 0;
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
    createDockTabFn: (opts: { app: unknown; type: string; editor?: unknown }) => Tab,
    findActiveEditorFn: () => unknown,
    setDockLayoutSizeFn: (dock: Dock, size: number) => void,
    getMaxSizeFn: (dock: Dock) => number,
    handleGraphFullscreenDragFn: (type: string, dock: Dock, show: boolean) => void,
    setTimeoutFn: (fn: () => void, ms?: number) => number,
    adjustLayoutFn: () => void,
    TIMEOUT_TRANSITION: number
) {
    const activeItems = dock.element.querySelectorAll(`.dock__item--active[data-index="${index}"]`);
    for (const item of Array.from(activeItems)) {
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



