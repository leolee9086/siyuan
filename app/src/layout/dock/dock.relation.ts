/**
 * dock.relation.ts - Dock 面板关系与可见性逻辑
 */
import type { Dock } from "./index";
import type { Wnd } from "../Wnd";
import { isWnd } from "./dock.guard";

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

/**
 * 处理两个面板同时激活时的布局状态
 *
 * - 作用：在两个 Dock 面板都激活时，恢复它们的分隔线和尺寸比例
 * - 意图：确保多面板共存时的 UI 布局正确，特别是恢复之前保存的尺寸
 * - 调用时机：由 updateDockPanelRelation 调用，当检测到 index 和 anotherIndex 都有激活项时
 * - 改进：尺寸恢复逻辑依赖 DOM 读写，可能会引起重排，建议优化为直接读取数据模型
 */
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

    const lastActiveElement = dock.elements[0].parentElement.querySelector('.dock__item--active[data-index="1"]');
    if (!lastActiveElement) {
        return;
    }

    const isLeftOrRight = dock.position === "Left" || dock.position === "Right";
    applyPanelSize(lastWnd, lastActiveElement, isLeftOrRight);
}

/**
 * @简洁函数 应用面板保存的尺寸（高度或宽度）到 DOM
 */
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

/**
 * @简洁函数 隐藏两个面板之间的分隔线
 */
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
 * 更新面板关系逻辑
 */
export function executePanelRelationsUpdate(
    dock: Dock,
    wnd: Wnd,
    index: number
): void {
    const anotherIndex = index === 0 ? 1 : 0;
    const anotherChild = dock.layout.children?.[anotherIndex];
    if (!isWnd(anotherChild)) {
        return;
    }
    const anotherActiveItems = dock.element.querySelectorAll(`.dock__item--active[data-index="${anotherIndex}"]`);
    const currentActiveItems = dock.element.querySelectorAll(`.dock__item--active[data-index="${index}"]`);
    const anotherHasActive = anotherActiveItems.length > 0;
    const hasActive = currentActiveItems.length > 0;
    updateDockPanelRelation(dock, wnd, anotherChild, index, anotherIndex, hasActive, anotherHasActive);
    updatePanelVisibility(wnd, anotherChild, hasActive, anotherHasActive);
}
