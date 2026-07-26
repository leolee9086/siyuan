/**
 * dock.toggle.ts - Dock 面板切换逻辑
 * 从 index.ts 提取的 toggleModel 相关辅助函数
 */

import type {DockDomain} from "./dock.types";

import { handlePanelFocusSwitch } from "./dock.focus";
import { handlePostCloseFocus } from "./dock.focus";
import { handleTabSwitch } from "./dock.focus";
import { blurActiveElement } from "./dock.focus";
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
    dock: DockDomain,
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
export function setDockLayoutSize(dock: DockDomain, size: number): void {
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
