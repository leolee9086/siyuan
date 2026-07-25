/**
 * Files 组件 element 的事件处理器（click 事件辅助函数）
 * @module eventHandlers.element.click.helpers
 */

import { openEmojiPanel } from "../../../emoji";
import { initFileMenu, initNavigationMenu } from "../../../menus/navigation";
import { newFileInTree } from "../../../util/file/newFile";
import { fetchPost } from "../../../util/network/fetch";
import { isNotCtrl } from "../../../protyle/util/compatibility";
import {
    getSiyuanConfig,
    removeSiyuanMenu
} from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { getPublishAccessLevel, getPublishAccessOptionByLevel, openPublishAccessDialog } from "../../../protyle/util/publishAccess";
import type { AppFacade } from "../../../app/AppFacade.types";
import type {FilesEventHost} from "./eventHandlers.types";
import {handleFileClick} from "./eventHandlers.element.click.file";
import {collapseFileTree, isFileTreeCollapsing} from "../fileTreeAnimation";
import {saveOpenPaths} from "./treeOperations";

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
) {
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
) {
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
    target: Element,
    files: FilesEventHost,
    app: AppFacade,
    notebookId: string
): "unhandled" | "handled" | "opened" {
    // 检查是否按下了 Ctrl 键
    if (!isNotCtrl(event)) {
        return "unhandled";
    }
    // 检查是否在 iOS 上
    if (getSiyuanConfig().system.container === "ios") {
        return "unhandled";
    }
    // 检查是否点击了图标
    if (!target.classList.contains("b3-list-item__icon")) {
        return "unhandled";
    }

    const parentElement = target.parentElement;
    // 父元素不存在时跳过
    if (!parentElement) {
        return "handled";
    }

    const isFile = parentElement.getAttribute("data-type") === "navigation-file";
    const isBoxDoc = parentElement.getAttribute("data-type") === "navigation-root" &&
        Boolean(parentElement.getAttribute("data-node-id"));
    if ((isFile || isBoxDoc) && getSiyuanConfig().fileTree.docIconClickExpand) {
        if (Number(parentElement.getAttribute("data-count")) > 0) {
            files.getLeaf(parentElement, notebookId);
            return "handled";
        }
        if (parentElement instanceof HTMLElement) {
            files.lastSelectedElement = parentElement;
            files.setCurrent(parentElement, false);
            handleFileClick(event, parentElement, app);
            return "opened";
        }
    }

    if (isFile) {
        handleFileIconClick(event, target, parentElement);
        return "handled";
    }

    // 否则为笔记本类型
    const grandParent = parentElement.parentElement;
    // 祖父元素不存在时跳过
    if (!grandParent) {
        return "handled";
    }
    handleNotebookIconClick(event, target, grandParent);
    return "handled";
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
    files: FilesEventHost,
    notebookId: string
) {
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
    const isOpen = Boolean(parentElement.querySelector(".b3-list-item__arrow--open"));
    if (isOpen) {
        collapseFileTree(parentElement, () => saveOpenPaths(files.element));
    }
    if (!isOpen && !isFileTreeCollapsing(parentElement)) {
        files.getLeaf(parentElement, notebookId);
    }
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
 * @param app - AppFacade 实例
 * @param notebookId - 笔记本 ID
 * @param pathString - 路径字符串
 * @param parentElement - 父元素
 */
function handleWritableActions(
    event: MouseEvent,
    type: string | null,
    app: AppFacade,
    notebookId: string,
    pathString: string | null,
    parentElement: HTMLElement
) {
    // 处理新建文件
    if (type === "new") {
        newFileInTree(app, notebookId, pathString ?? "");
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
 * @param app - AppFacade 实例
 * @param notebookId - 笔记本 ID
 * @returns 是否已处理该事件
 */
function handleActionClick(
    event: MouseEvent,
    target: Element,
    app: AppFacade,
    notebookId: string
) {
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
        handleWritableActions(event, type, app, notebookId, pathString, parentElement);
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

/**
 * 处理 element click 事件中的发布权限开关点击
 * @param event - 鼠标事件
 * @param target - 目标元素
 * @returns 是否已处理该事件
 */
function handleSwitchClick(
    event: MouseEvent,
    target: Element
) {
    if (!target.classList.contains("b3-list-item__switch")) {
        return false;
    }

    event.stopPropagation();
    const rect = target.getBoundingClientRect();
    openPublishAccessDialog(
        target.parentElement?.getAttribute("data-node-id") ||
            target.parentElement?.parentElement?.getAttribute("data-url") || "",
        {
            x: rect.left,
            y: rect.bottom,
        },
        (access) => {
            target.innerHTML = getPublishAccessOptionByLevel(
                getPublishAccessLevel(access.visible, access.password, access.disable)
            ).iconHTML;
            fetchPost("/api/filetree/setPublishAccess", {
                id: access.id,
                visible: access.visible,
                password: access.password,
                disable: access.disable,
            });
        }
    );
    return true;
}

export {
    handleIconClick,
    handleToggleClick,
    handleActionClick,
    handleSwitchClick,
};
