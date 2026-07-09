/**
 * dock.model.ts - Dock toggleModel 相关辅助方法
 * 从 index.ts 提取的 toggleModel 内部处理逻辑
 */

import type { Wnd } from "../Wnd";
import type { Dock } from "./index";
import { adjustLayout } from "./imports";
import { setPanelFocus } from "./imports";
import { Constants } from "./imports";
import { createDockTab } from "./dock.factory";
import { handleGraphDestroy } from "./dock.graph";
import { handleGraphFullscreenDrag } from "./dock.graph";
import { handlePanelFocusSwitch } from "./dock.toggle";
import { handlePostCloseFocus } from "./dock.toggle";
import { handleTabSwitch } from "./dock.toggle";
import { handleDockHideSize } from "./dock.toggle";
import { setDockLayoutSize } from "./dock.toggle";
import { blurActiveElement } from "./dock.toggle";
import { updateDockPanelRelation } from "./dock.relation";
import { updatePanelVisibility } from "./dock.relation";
import { setWindowTimeout } from "./dock.environment";
import { clearWindowTimeout } from "./dock.environment";
import { isWnd } from "./dock.guard";
import { findActiveEditor } from "./dock.init";
import { getMaxSize } from "./dock.size";

/**
 * 执行 toggle 隐藏
 * @returns true 如果焦点切换已处理，调用方应提前 return；false 则继续执行后续逻辑
 */
export function executeToggleHide(
    dock: Dock,
    wnd: Wnd,
    target: HTMLElement,
    type: string,
    close: boolean,
    isSaveLayout: boolean
): boolean {
    if (!close && handlePanelFocusSwitch(wnd, target, dock)) {
        return true;
    }
    target.classList.remove("dock__item--active", "dock__item--activefocus");
    const leftElements = dock.elements[0];
    const rightElements = dock.elements[1];
    if (!leftElements || !rightElements) {
        return false;
    }
    const hasNoActiveItems = !leftElements.querySelector(".dock__item--active") &&
        !rightElements.querySelector(".dock__item--active");
    if (handleDockHideSize(dock, hasNoActiveItems)) {
        clearWindowTimeout(dock.hideResizeTimeout);
        dock.hideDock();
    }
    handleGraphDestroy(type, dock);
    handlePostCloseFocus(isSaveLayout);
    if (isSaveLayout) {
        dock.saveLocalPlugin(type, { show: false });
    }
    return false;
}

/**
 * 执行 toggle 显示
 */
export function executeToggleShow(
    dock: Dock,
    wnd: Wnd,
    target: HTMLElement,
    type: string,
    index: number,
    isSaveLayout: boolean
): void {
    const targetElements = dock.elements[index];
    if (!targetElements) {
        return;
    }
    const items = targetElements.querySelectorAll(".dock__item--active");
    for (const item of Array.from(items)) {
        item.classList.remove("dock__item--active", "dock__item--activefocus");
    }
    target.classList.add("dock__item--active", "dock__item--activefocus");
    if (!target.getAttribute("data-id")) {
        const editor = findActiveEditor();
        const tab = createDockTab({ app: dock.app, type, ...(editor ? { editor } : {}) });
        wnd.addTab(tab, false, false);
        target.setAttribute("data-id", tab.id);
        dock.data[type] = tab.model;
        setPanelFocus(tab.panelElement);
    }
    handleTabSwitch(wnd, target.getAttribute("data-id"));
    setDockLayoutSize(dock, getMaxSize(dock));
    handleGraphFullscreenDrag(type, dock, true);
    if (dock.pin) {
        dock.layout.element.style.opacity = "";
        dock.hideResizeTimeout = setWindowTimeout(() => {
            dock.resizeElement.classList.remove("fn__none");
            adjustLayout();
        }, Constants.TIMEOUT_TRANSITION);
    }
    blurActiveElement();
    if (isSaveLayout) {
        dock.saveLocalPlugin(type, { show: true });
    }
}

/**
 * 执行更新面板关系
 */
export function executeUpdatePanelRelations(
    dock: Dock,
    wnd: Wnd,
    index: number
): void {
    const anotherIndex = index === 0 ? 1 : 0;
    const anotherChild = dock.layout.children[anotherIndex];
    if (!isWnd(anotherChild)) {
        return;
    }
    const anotherElements = dock.elements[anotherIndex];
    const currentElements = dock.elements[index];
    if (!anotherElements || !currentElements) {
        return;
    }
    const anotherActiveItems = anotherElements.querySelectorAll(".dock__item--active");
    const currentActiveItems = currentElements.querySelectorAll(".dock__item--active");
    updateDockPanelRelation(dock, wnd, anotherChild, index, anotherIndex, currentActiveItems.length > 0, anotherActiveItems.length > 0);
    updatePanelVisibility(wnd, anotherChild, currentActiveItems.length > 0, anotherActiveItems.length > 0);
}
