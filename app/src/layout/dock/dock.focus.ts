/**
 * dock.focus.ts - Dock 面板焦点相关逻辑
 */
import type { Wnd } from "../Wnd";
import type { Dock } from "./index";
import { setPanelFocus } from "../utils/setPanelFocus";
import { clearBeforeResizeTop } from "../../protyle/util/resize";
import { getAllTabs } from "../getAll";
import { isMobile } from "../../platform";

/**
 * 处理已激活面板的焦点切换
 * @returns true 如果需要焦点切换并已处理，false 否则
 */
export function handlePanelFocusSwitch(
    wnd: Wnd,
    target: HTMLElement,
    dock: Dock
) {
    const tabContainer = wnd.element.querySelector(".layout-tab-container");
    if (!tabContainer) {
        return false;
    }

    let needFocus = false;
    const targetDataId = target.getAttribute("data-id");

    for (const item of Array.from(tabContainer.children)) {
        if (item.getAttribute("data-id") !== targetDataId) {
            continue;
        }

        /**
         * 意图：检查当前标签页是否尚未激活。
         * 生效场景：只有当目标标签页没有 `layout__tab--active` 类时，才需要重新设置焦点。
         * 如果已经激活，则不需要重复操作，避免不必要的副作用。
         */
        if (!item.classList.contains("layout__tab--active")) {
            setPanelFocus(item);
            needFocus = true;
        }
        break;
    }

    if (!needFocus) {
        return false;
    }

    blurActiveElement();
    clearBeforeResizeTop();
    dock.showDock();
    return true;
}

/**
 * 关闭 dock 后设置光标
 */
export function handlePostCloseFocus(isSaveLayout: boolean) {
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

    if (isMobile) {
        return;
    }
    const dataId = currentElement.getAttribute("data-id");
    for (const item of getAllTabs()) {
        if (item.id !== dataId) {
            continue;
        }
        item.parent.switchTab(item.headElement, false, true, false);
        break;
    }
}

/**
 * 处理 tab 切换（显示/隐藏）
 */
export function handleTabSwitch(wnd: Wnd, targetDataId: string | null) {
    const tabContainer = wnd.element.querySelector(".layout-tab-container");
    if (!tabContainer) {
        return;
    }

    for (const item of Array.from(tabContainer.children)) {
        /**
         * 意图：根据 data-id 判断是否为目标面板。
         * 生效场景：如果当前项的 data-id 与目标 data-id 相同，则显示该面板并设置焦点（通过移除 `fn__none` 类）；
         * 否则添加 `fn__none` 类隐藏该面板。
         */
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
export function blurActiveElement() {
    const activeElement = document.activeElement;
    /**
     * 意图：类型守卫，确保 activeElement 是 HTMLElement 以便安全调用 blur()。
     * 生效场景：当 document.activeElement 不为空且为 HTMLElement 实例时，移除焦点。
     */
    if (activeElement instanceof HTMLElement) {
        activeElement.blur();
    }
}
