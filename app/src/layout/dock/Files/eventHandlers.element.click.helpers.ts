/**
 * Files 组件 element 的事件处理器（click 事件辅助函数）
 * @module eventHandlers.element.click.helpers
 */

import { openEmojiPanel } from "../../../emoji";
import { initFileMenu, initNavigationMenu } from "../../../menus/navigation";
import { newFile } from "../../../util/file/newFile";
import { fetchPost } from "../../../util/network/fetch";
import { isNotCtrl } from "../../../protyle/util/compatibility";
import {
    getSiyuanConfig,
    removeSiyuanMenu
} from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import type { App } from "../../../index";
import type { Files } from "../Files";

// ============================================================================
// 图标点击处理
// ============================================================================

/**
 * 处理文件图标点击（打开 emoji 面板）
 * @param event - 鼠标事件
 * @param target - 目标元素
 * @param parentElement - 父元素
 */
function handleFileIconClick(
    event: MouseEvent,
    target: Element,
    parentElement: Element
): void {
    event.preventDefault();
    event.stopPropagation();
    const rect = target.getBoundingClientRect();
    const nodeId = parentElement.getAttribute("data-node-id") ?? "";
    const imgElement = target.querySelector("img") ?? undefined;
    openEmojiPanel(nodeId, "doc", {
        x: rect.left,
        y: rect.bottom,
        h: rect.height,
        w: rect.width,
    }, undefined, imgElement);
}

/**
 * 处理笔记本图标点击（打开 emoji 面板）
 * @param event - 鼠标事件
 * @param target - 目标元素
 * @param grandParent - 祖父元素
 */
function handleNotebookIconClick(
    event: MouseEvent,
    target: Element,
    grandParent: Element
): void {
    event.preventDefault();
    event.stopPropagation();
    const rect = target.getBoundingClientRect();
    const dataUrl = grandParent.getAttribute("data-url") ?? "";
    const imgElement = target.querySelector("img") ?? undefined;
    openEmojiPanel(dataUrl, "notebook", {
        x: rect.left,
        y: rect.bottom,
        h: rect.height,
        w: rect.width,
    }, undefined, imgElement);
}

/**
 * 处理 element click 事件中的图标点击
 * @param event - 鼠标事件
 * @param target - 目标元素
 * @returns 是否已处理该事件
 */
function handleIconClick(
    event: MouseEvent,
    target: Element
): boolean {
    // 检查是否按下了 Ctrl 键
    if (!isNotCtrl(event)) {
        return false;
    }
    // 检查是否在 iOS 上
    if (getSiyuanConfig().system.container === "ios") {
        return false;
    }
    // 检查是否点击了图标
    if (!target.classList.contains("b3-list-item__icon")) {
        return false;
    }

    const parentElement = target.parentElement;
    // 父元素不存在时跳过
    if (!parentElement) {
        return true;
    }

    // 检查是否为文件类型
    if (parentElement.getAttribute("data-type") === "navigation-file") {
        handleFileIconClick(event, target, parentElement);
        return true;
    }

    // 否则为笔记本类型
    const grandParent = parentElement.parentElement;
    // 祖父元素不存在时跳过
    if (!grandParent) {
        return true;
    }
    handleNotebookIconClick(event, target, grandParent);
    return true;
}

// ============================================================================
// Toggle 点击处理
// ============================================================================

/**
 * 处理 element click 事件中的 toggle 点击
 * @param event - 鼠标事件
 * @param target - 目标元素
 * @param files - Files 实例
 * @param notebookId - 笔记本 ID
 * @returns 是否已处理该事件
 */
function handleToggleClick(
    event: MouseEvent,
    target: Element,
    files: Files,
    notebookId: string
): boolean {
    // 检查是否按下了 Ctrl 键
    if (!isNotCtrl(event)) {
        return false;
    }
    // 检查是否点击了 toggle 按钮
    if (!target.classList.contains("b3-list-item__toggle")) {
        return false;
    }

    const parentElement = target.parentElement;
    // 父元素不存在时跳过
    if (!parentElement) {
        return true;
    }
    files.getLeaf(parentElement, notebookId);
    event.preventDefault();
    event.stopPropagation();
    removeSiyuanMenu();
    return true;
}

// ============================================================================
// Action 按钮点击处理
// ============================================================================

/**
 * 处理非只读模式下的 action 操作
 * @param event - 鼠标事件
 * @param type - 操作类型
 * @param app - App 实例
 * @param notebookId - 笔记本 ID
 * @param pathString - 路径字符串
 * @param parentElement - 父元素
 * @param element - 容器元素
 */
function handleWritableActions(
    event: MouseEvent,
    type: string | null,
    app: App,
    notebookId: string,
    pathString: string | null,
    parentElement: HTMLElement,
    element: HTMLElement
): void {
    // 处理新建文件
    if (type === "new") {
        newFile({
            app: app,
            notebookId,
            currentPath: pathString ?? "",
            useSavePath: false,
            listDocTree: true,
        });
        return;
    }
    // 处理笔记本更多菜单
    if (type === "more-root") {
        initNavigationMenu(app, parentElement).popup({
            x: event.clientX,
            y: event.clientY
        });
        return;
    }
}

/**
 * 处理 element click 事件中的 action 按钮点击
 * @param event - 鼠标事件
 * @param target - 目标元素
 * @param app - App 实例
 * @param notebookId - 笔记本 ID
 * @param element - 容器元素
 * @returns 是否已处理该事件
 */
function handleActionClick(
    event: MouseEvent,
    target: Element,
    app: App,
    notebookId: string,
    element: HTMLElement
): boolean {
    // 检查是否按下了 Ctrl 键
    if (!isNotCtrl(event)) {
        return false;
    }
    // 检查是否点击了 action 按钮
    if (!target.classList.contains("b3-list-item__action")) {
        return false;
    }

    const type = target.getAttribute("data-type");
    const parentElement = target.parentElement;
    // 父元素不存在时跳过
    if (!parentElement) {
        return true;
    }
    const pathString = parentElement.getAttribute("data-path");

    // 非只读模式下处理新建、更多菜单、添加本地快捷方式
    if (!getSiyuanConfig().readonly) {
        handleWritableActions(event, type, app, notebookId, pathString, parentElement, element);
    }

    // 处理文件更多菜单
    if (type === "more-file") {
        initFileMenu(app, notebookId, pathString ?? "", parentElement).popup({
            x: event.clientX,
            y: event.clientY
        });
    }
    event.preventDefault();
    event.stopPropagation();
    return true;
}

export {
    handleIconClick,
    handleToggleClick,
    handleActionClick
};
