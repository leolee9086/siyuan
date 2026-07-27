/**
 * Files 组件 element 的文件点击打开处理
 * @module eventHandlers.element.click.file
 */

import { Constants } from "../../../constants";
import { isNotCtrl, isOnlyMeta } from "../../../protyle/util/compatibility";
import { getSiyuanConfig } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import type { AppFacade } from "../../../app/AppFacade.types";

// ============================================================================
// 文件点击打开处理
// ============================================================================

/**
 * 清除文件打开状态的回调函数
 * 在文件打开完成后移除 data-opening 属性
 * @param target - 目标元素
 */
function createAfterOpenCallback(target: HTMLElement): () => void {
    return () => {
        target.removeAttribute("data-opening");
    };
}

/**
 * 处理 Alt+Click 在右侧打开文件
 * @param event - 鼠标事件
 * @param target - 目标元素
 * @param app - AppFacade 实例
 * @returns 是否已处理
 */
function handleAltClick(
    event: MouseEvent,
    target: HTMLElement,
    app: AppFacade
): boolean {
    if (!event.altKey || !isNotCtrl(event) || event.shiftKey) {
        return false;
    }
    const nodeId = target.getAttribute("data-node-id") ?? "";
    app.openBlock({
        id: nodeId,
        position: "right",
        action: [Constants.CB_GET_FOCUS, Constants.CB_GET_SCROLL],
        afterOpen: createAfterOpenCallback(target)
    });
    return true;
}

/**
 * 处理 Ctrl/Cmd+Shift+Click 在下方打开文件
 * @param event - 鼠标事件
 * @param target - 目标元素
 * @param app - AppFacade 实例
 * @returns 是否已处理
 */
function handleCtrlShiftClick(
    event: MouseEvent,
    target: HTMLElement,
    app: AppFacade
): boolean {
    if (event.altKey || !isOnlyMeta(event) || !event.shiftKey) {
        return false;
    }
    const nodeId = target.getAttribute("data-node-id") ?? "";
    app.openBlock({
        id: nodeId,
        position: "bottom",
        action: [Constants.CB_GET_FOCUS, Constants.CB_GET_SCROLL],
        afterOpen: createAfterOpenCallback(target)
    });
    return true;
}

/**
 * 处理 Ctrl/Cmd+Alt+Click 在新标签页打开文件
 * @param event - 鼠标事件
 * @param target - 目标元素
 * @param app - AppFacade 实例
 * @returns 是否已处理
 */
function handleCtrlAltClick(
    event: MouseEvent,
    target: HTMLElement,
    app: AppFacade
): boolean {
    const useCurrentTab = getSiyuanConfig().fileTree.openFilesUseCurrentTab;
    if (!useCurrentTab || !event.altKey || !isOnlyMeta(event) || event.shiftKey) {
        return false;
    }
    const nodeId = target.getAttribute("data-node-id") ?? "";
    app.openBlock({
        removeCurrentTab: false,
        id: nodeId,
        action: [Constants.CB_GET_FOCUS, Constants.CB_GET_SCROLL],
        afterOpen: createAfterOpenCallback(target)
    });
    return true;
}

/**
 * 处理文件点击打开
 * @同步豁免: UI构建 - 点击事件处理需要同步响应用户操作
 * @param event - 鼠标事件
 * @param target - 目标元素
 * @param app - AppFacade 实例
 */
export function handleFileClick(
    event: MouseEvent,
    target: HTMLElement,
    app: AppFacade
): void {
    // 检查是否正在打开中
    if (target.getAttribute("data-opening")) {
        return;
    }
    target.setAttribute("data-opening", "true");

    // Alt+Click: 在右侧打开
    if (handleAltClick(event, target, app)) {
        return;
    }

    // Ctrl/Cmd+Shift+Click: 在下方打开
    if (handleCtrlShiftClick(event, target, app)) {
        return;
    }

    // Ctrl/Cmd+Alt+Click: 在新标签页打开（当启用使用当前标签页时）
    if (handleCtrlAltClick(event, target, app)) {
        return;
    }

    // 默认: 正常打开
    const nodeId = target.getAttribute("data-node-id") ?? "";
    app.openBlock({
        id: nodeId,
        action: [Constants.CB_GET_FOCUS, Constants.CB_GET_SCROLL],
        afterOpen: createAfterOpenCallback(target)
    });
}
