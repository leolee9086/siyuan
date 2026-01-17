/**
 * dock.focus.ts - Dock 面板焦点相关逻辑
 */
import type { Wnd } from "../Wnd";
import type { Dock } from "./index";
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
 * 模糊当前活动元素
 */
export function blurActiveElement(): void {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) {
        activeElement.blur();
    }
}
