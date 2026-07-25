/**
 * dock.visibility.ts - Dock 可见性和显示/隐藏逻辑
 * 从 index.ts 提取的辅助函数
 */

import type { Dock } from "./index";
import {
    getSiyuanLayout
} from "./dock.environment";

/**
 * 检查是否应该跳过显示 dock
 */
export function shouldSkipShowDock(dock: Dock): boolean {
    const hasActiveItem = dock.element.querySelector(".dock__item--active");
    return dock.pin || !hasActiveItem || dock.layout.element.style.opacity === "1";
}

/**
 * 检查 dock 尺寸是否为零
 */
export function isZeroSize(dock: Dock): boolean {
    const isHorizontal = dock.position === "Left" || dock.position === "Right";
    if (isHorizontal) {
        return dock.layout.element.clientWidth === 0 && dock.layout.element.style.width.startsWith("0");
    }
    if (dock.position === "Bottom") {
        return dock.layout.element.clientHeight === 0 && dock.layout.element.style.height.startsWith("0");
    }
    return false;
}

/**
 * 检查是否有阻止显示的覆盖层
 */
export function hasBlockingOverlay(): boolean {
    const hasDialog = document.querySelector(".b3-dialog");
    const hasPopover = document.querySelector(".block__popover");
    const hasMenu = document.querySelector("#commonMenu:not(.fn__none)");
    if (!hasDialog && !hasPopover && !hasMenu) {
        return false;
    }

    const siyuanLayout = getSiyuanLayout();
    const leftOpacity = siyuanLayout?.leftDock?.layout?.element?.style?.opacity === "1";
    const rightOpacity = siyuanLayout?.rightDock?.layout?.element?.style?.opacity === "1";
    const bottomOpacity = siyuanLayout?.bottomDock?.layout?.element?.style?.opacity === "1";
    return leftOpacity || rightOpacity || bottomOpacity;
}

/**
 * 设置 dock 位置
 */
export function setDockPosition(dock: Dock): void {
    if (dock.position === "Left") {
        dock.layout.element.style.left = `${dock.element.clientWidth}px`;
        return;
    }
    if (dock.position === "Right") {
        dock.layout.element.style.right = `${dock.element.clientWidth}px`;
        return;
    }
    if (dock.position === "Bottom") {
        const statusElement = document.getElementById("status");
        const statusHeight = statusElement?.offsetHeight || 0;
        dock.layout.element.style.bottom = `${dock.element.offsetHeight + statusHeight}px`;
    }
}

/**
 * 检查是否有全屏元素激活
 */
export function isFullscreenActive(dock: Dock): boolean {
    const fullscreenElement = dock.layout.element.querySelector(".fullscreen");
    return Boolean(fullscreenElement && fullscreenElement.clientHeight > 0);
}

/**
 * 检查是否有文本框获得焦点
 */
export function isTextFieldFocused(dock: Dock): boolean {
    const activeEl = document.activeElement;
    if (!activeEl) {
        return false;
    }
    const isTextField = activeEl.classList.contains("b3-text-field");
    return dock.layout.element.contains(activeEl) && isTextField;
}

/**
 * 检查是否有更高 zIndex 的覆盖层
 */
export function hasHigherZIndexOverlay(dock: Dock): boolean {
    const layoutZIndex = dock.layout.element.style.zIndex;
    const dialogElement = document.querySelector(".b3-dialog");
    const blockElement = document.querySelector(".block__popover");
    const menuElement = document.querySelector("#commonMenu:not(.fn__none)");

    if (dialogElement instanceof HTMLElement && dialogElement.style.zIndex > layoutZIndex) {
        return true;
    }
    if (blockElement instanceof HTMLElement && blockElement.style.zIndex > layoutZIndex) {
        return true;
    }
    if (menuElement instanceof HTMLElement && menuElement.style.zIndex > layoutZIndex) {
        return true;
    }
    return false;
}

/**
 * 应用隐藏变换
 */
export function applyHideTransform(dock: Dock): void {
    if (dock.position === "Left") {
        dock.layout.element.style.transform = `translateX(-${dock.layout.element.clientWidth + 8}px)`;
        dock.layout.element.style.left = "";
        return;
    }
    if (dock.position === "Right") {
        dock.layout.element.style.transform = `translateX(${dock.layout.element.clientWidth + 8}px)`;
        dock.layout.element.style.right = "";
        return;
    }
    if (dock.position === "Bottom") {
        dock.layout.element.style.transform = `translateY(${dock.layout.element.clientHeight + 8}px)`;
        dock.layout.element.style.bottom = "";
    }
}

/**
 * @简洁函数 检查 item 是否为有效类型
 */
const isValidType = (item: Config.IUILayoutDockTab, types: string[]) => types.includes(item.type) || item.type.startsWith("custom_list:");

/**
 * 检查数据数组中是否包含有效的类型
 */
export function hasValidDockType(data: Config.IUILayoutDockTab[][], types: string[]): boolean {
    const first = data[0];
    const second = data[1];
    const firstHasType = first ? first.find(item => isValidType(item, types)) : undefined;
    const secondHasType = second ? second.find(item => isValidType(item, types)) : undefined;
    return Boolean(firstHasType) || Boolean(secondHasType);
}
