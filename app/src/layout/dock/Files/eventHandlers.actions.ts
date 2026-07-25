/**
 * Files 组件 actionsElement 和 collapse 的事件处理器
 * @module eventHandlers.actions
 */

import { Constants } from "../../../constants";
import { setStorageVal } from "../../../protyle/util/compatibility";
import { setPanelFocus } from "../../utils/setPanelFocus";
import { getDockByType } from "../../tabUtil";
import { selectOpenTab } from "../util";
import {
    removeSiyuanMenu,
    setSiyuanStorageValue
} from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { isStylableElement } from "./eventHandlers.guard";
import { initMoreMenu } from "./moreMenu";
import type {FilesDomain} from "./eventHandlers.types";

// ============================================================================
// collapse 按钮点击事件处理
// ============================================================================

/**
 * 折叠单个笔记本项
 * @param item - 笔记本容器元素
 */
function collapseNotebookItem(item: Element): void {
    const liElement = item.firstElementChild;
    // liElement 不存在时跳过
    if (!liElement) {
        return;
    }

    const toggleElement = liElement.querySelector(".b3-list-item__arrow");
    // toggleElement 不存在时跳过
    if (!toggleElement) {
        return;
    }

    // 检查是否已展开
    if (!toggleElement.classList.contains("b3-list-item__arrow--open")) {
        return;
    }

    toggleElement.classList.remove("b3-list-item__arrow--open");
    const nextSibling = liElement.nextElementSibling;
    // 移除展开的子元素
    if (nextSibling) {
        nextSibling.remove();
    }
}

/**
 * collapse 按钮的 click 事件处理函数
 * @param files - Files 实例
 */
function onCollapseClick(files: FilesDomain): void {
    for (const item of Array.from(files.element.children)) {
        collapseNotebookItem(item);
    }
    setSiyuanStorageValue(Constants.LOCAL_FILESPATHS, []);
    setStorageVal(Constants.LOCAL_FILESPATHS, []);
}

/**
 * 创建 collapse 按钮的 click 事件处理器
 * @param files - Files 实例
 * @returns 事件处理函数
 */
function createCollapseClickHandler(files: FilesDomain): () => void {
    return () => {
        onCollapseClick(files);
    };
}

/**
 * 设置 collapse 按钮的 click 事件处理
 * @param files - Files 实例
 * @同步豁免: UI构建
 */
export function setupCollapseClickHandler(files: FilesDomain): void {
    const collapseButton = files.actionsElement.querySelector('[data-type="collapse"]');
    // collapseButton 不存在时跳过
    if (!collapseButton) {
        return;
    }

    const handler = createCollapseClickHandler(files);
    collapseButton.addEventListener("click", handler);
}

// ============================================================================
// actionsElement 点击事件处理
// ============================================================================

/**
 * 处理 min 按钮点击（最小化面板）
 * @param event - 鼠标事件
 * @param type - 按钮类型
 * @returns 是否已处理该事件
 */
function handleMinClick(event: MouseEvent, type: string | null): boolean {
    // 检查是否点击了 min 按钮
    if (type !== "min") {
        return false;
    }

    const dock = getDockByType("file");
    // dock 存在时切换模型
    if (dock) {
        dock.toggleModel("file", false, true);
    }
    event.preventDefault();
    event.stopPropagation();
    removeSiyuanMenu();
    return true;
}

/**
 * 处理 focus 按钮点击（定位当前文档）
 * @param event - 鼠标事件
 * @param type - 按钮类型
 * @returns 是否已处理该事件
 */
function handleFocusClick(event: MouseEvent, type: string | null): boolean {
    // 检查是否点击了 focus 按钮
    if (type !== "focus") {
        return false;
    }

    selectOpenTab();
    event.preventDefault();
    return true;
}

/**
 * 处理 more 按钮点击（更多菜单）
 * @param event - 鼠标事件
 * @param type - 按钮类型
 * @param files - Files 实例
 * @returns 是否已处理该事件
 */
function handleMoreClick(
    event: MouseEvent,
    type: string | null,
    files: FilesDomain
): boolean {
    // 检查是否点击了 more 按钮
    if (type !== "more") {
        return false;
    }

    initMoreMenu({
        element: files.element,
        init: files.init.bind(files),
        refreshPublishAccessSwitch: files.refreshPublishAccessSwitch?.bind(files),
        updateDocActions: files.updateDocActions?.bind(files),
    }).popup({ x: event.clientX, y: event.clientY });
    event.preventDefault();
    event.stopPropagation();
    return true;
}

/**
 * actionsElement 的 click 事件处理函数
 * @param event - 鼠标事件
 * @param files - Files 实例
 */
function onActionsClick(event: MouseEvent, files: FilesDomain): void {
    if (!isStylableElement(event.target)) {
        return;
    }
    let target: HTMLElement | SVGElement | null = event.target;
    let isFocus = true;

    while (target && !target.isEqualNode(files.actionsElement)) {
        const type = target.getAttribute("data-type");

        if (handleMinClick(event, type)) {
            isFocus = false;
            break;
        }

        if (handleFocusClick(event, type)) {
            break;
        }

        if (handleMoreClick(event, type, files)) {
            break;
        }

        target = target.parentElement;
    }

    const parentElement = files.element.parentElement;
    if (isFocus && parentElement) {
        setPanelFocus(parentElement);
    }
}

/**
 * 创建 actionsElement 的 click 事件处理器
 * @param files - Files 实例
 * @returns 事件处理函数
 */
function createActionsClickHandler(files: FilesDomain): (event: MouseEvent) => void {
    return (event: MouseEvent) => {
        onActionsClick(event, files);
    };
}

/**
 * 设置 actionsElement 的 click 事件处理
 * @param files - Files 实例
 * @同步豁免: UI构建
 */
export function setupActionsClickHandler(files: FilesDomain): void {
    const handler = createActionsClickHandler(files);
    files.actionsElement.addEventListener("click", handler);
}
