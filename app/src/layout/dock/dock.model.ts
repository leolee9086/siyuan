/**
 * dock.model.ts - Dock toggleModel 相关辅助方法
 * 从 index.ts 提取的 toggleModel 内部处理逻辑
 */

import type { Wnd } from "../Wnd";
import type { Dock } from "./index";
import { adjustLayout } from "../util";
import { setPanelFocus } from "../utils/setPanelFocus";
import { Constants } from "../../constants";
import { createDockTab } from "./dock.factory";
import {
    handlePanelFocusSwitch, handleGraphDestroy, handlePostCloseFocus,
    handleTabSwitch, updateDockPanelRelation, updatePanelVisibility,
    handleDockHideSize, setDockLayoutSize,
    handleGraphFullscreenDrag, blurActiveElement
} from "./dock.toggle";
import { setWindowTimeout, clearWindowTimeout } from "./dock.environment";
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
    isSaveLayout: boolean,
    _removeDock: boolean
): boolean {
    if (!close && handlePanelFocusSwitch(wnd, target, dock)) {
        return true;
    }
    target.classList.remove("dock__item--active", "dock__item--activefocus");
    const hasNoActiveItems = !dock.elements[0].querySelector(".dock__item--active") &&
        !dock.elements[1].querySelector(".dock__item--active");
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
    const items = dock.elements[index].querySelectorAll(".dock__item--active");
    for (const item of Array.from(items)) {
        item.classList.remove("dock__item--active", "dock__item--activefocus");
    }
    target.classList.add("dock__item--active", "dock__item--activefocus");
    if (!target.getAttribute("data-id")) {
        const editor = findActiveEditor();
        const tab = createDockTab({ app: dock.app, type, editor });
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
    const anotherActiveItems = dock.elements[anotherIndex].querySelectorAll(".dock__item--active");
    const currentActiveItems = dock.elements[index].querySelectorAll(".dock__item--active");
    updateDockPanelRelation(dock, wnd, anotherChild, index, anotherIndex, currentActiveItems.length > 0, anotherActiveItems.length > 0);
    updatePanelVisibility(wnd, anotherChild, currentActiveItems.length > 0, anotherActiveItems.length > 0);
}
