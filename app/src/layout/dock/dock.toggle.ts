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
