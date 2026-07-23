/**
 * Files 组件 element 的 click 事件处理器
 * @module eventHandlers.element.click
 */

import { isNotCtrl, isOnlyMeta } from "../../../protyle/util/compatibility";
import { hasTopClosestByTag } from "../../../protyle/util/hasClosest";
import { setPanelFocus } from "../../utils/setPanelFocus";
import { removeSiyuanMenu } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { isStylableElement, clearLastSelectedElement, isHTMLLIElement } from "./eventHandlers.guard";
import {
    handleIconClick,
    handleToggleClick,
    handleActionClick,
    handleSwitchClick,
} from "./eventHandlers.element.click.helpers";
import { handleFileClick } from "./eventHandlers.element.click.file";
import type { App } from "../../../index";
import type { Files } from "../Files";
import type { FilesEventContext } from "./eventHandlers.types";

// ============================================================================
// Shift+Click 多选处理
// ============================================================================

/**
 * 初始化 shift-click 的起始元素
 * 确保 lastSelectedElement 有有效值用于多选范围计算
 * @param files - Files 实例
 * @param target - 当前点击的目标元素
 */
function initShiftClickStartElement(
    files: Files,
    target: HTMLElement
): void {
    const lastSelected = files.lastSelectedElement;
    // 上次选中的元素不在 DOM 中时清空，避免引用已删除的元素
    if (lastSelected && !document.contains(lastSelected)) {
        clearLastSelectedElement(files);
    }
    // lastSelectedElement 已存在时直接返回
    if (files.lastSelectedElement) {
        return;
    }
    // 尝试获取当前焦点元素
    const focusElement = files.element.querySelector(".b3-list-item--focus");
    if (focusElement) {
        files.lastSelectedElement = focusElement;
        return;
    }
    // 使用父元素的第一个子元素
    const parentElement = target.parentElement;
    // 父元素不存在时跳过
    if (!parentElement) {
        return;
    }
    const firstChild = parentElement.firstElementChild;
    // firstChild 存在时设置
    if (firstChild) {
        files.lastSelectedElement = firstChild;
    }
}

/**
 * 处理 Shift+click 多选
 * @param target - 当前点击的目标元素
 * @param files - Files 实例
 */
function handleShiftClick(target: HTMLElement, files: Files): void {
    initShiftClickStartElement(files, target);

    // 清除所有焦点
    for (const item of files.element.querySelectorAll(".b3-list-item--focus")) {
        item.classList.remove("b3-list-item--focus");
    }

    // 获取所有文档项
    const allFiles = Array.from(files.element.querySelectorAll("li.b3-list-item"));

    // 获取起始和结束索引
    const lastSelected = files.lastSelectedElement;
    const startIndex = lastSelected ? allFiles.indexOf(lastSelected) : -1;
    const endIndex = allFiles.indexOf(target);

    // 确定选择范围
    const start = Math.min(startIndex, endIndex);
    const end = Math.max(startIndex, endIndex);

    // 添加新选择
    for (let i = start; i <= end; i++) {
        const item = allFiles[i];
        // item 是 HTMLElement 时添加焦点
        if (item instanceof HTMLElement) {
            item.classList.add("b3-list-item--focus");
        }
    }
}

// ============================================================================
// LI 元素点击处理
// ============================================================================

/**
 * 清除选择标记
 * @param element - 容器元素
 */
function clearSelectionMarkers(element: HTMLElement): void {
    const selectEndElement = element.querySelector('[select-end="true"]');
    // selectEndElement 存在时移除属性
    if (selectEndElement) {
        selectEndElement.removeAttribute("select-end");
    }
    const selectStartElement = element.querySelector('[select-start="true"]');
    // selectStartElement 存在时移除属性
    if (selectStartElement) {
        selectStartElement.removeAttribute("select-start");
    }
}

/**
 * 处理 Ctrl/Cmd+Click 切换选中状态
 * @returns 是否已处理
 */
function handleCtrlClick(event: MouseEvent, target: HTMLElement, files: Files): boolean {
    if (!isOnlyMeta(event) || event.altKey || event.shiftKey) {
        return false;
    }
    target.classList.toggle("b3-list-item--focus");
    files.lastSelectedElement = target;
    return true;
}

/**
 * 处理 Shift+Click 多选
 * @returns 是否已处理
 */
function handleShiftClickSelection(event: MouseEvent, target: HTMLElement, files: Files): boolean {
    if (!event.shiftKey || event.altKey || !isNotCtrl(event)) {
        return false;
    }
    handleShiftClick(target, files);
    return true;
}

/**
 * 处理普通点击（文件打开或文件夹展开）
 * @returns 是否需要设置焦点
 */
function handleNormalClick(
    event: MouseEvent,
    target: HTMLElement,
    files: Files,
    app: App,
    notebookId: string
): boolean {
    files.lastSelectedElement = target;
    files.setCurrent(target, false);
    const dataType = target.getAttribute("data-type");
    // 检查是否为文件类型
    const isBoxDoc = dataType === "navigation-root" && Boolean(target.getAttribute("data-node-id"));
    if (dataType === "navigation-file" || isBoxDoc) {
        handleFileClick(event, target, app);
        return false;
    }
    // 检查是否为根目录类型
    if (dataType === "navigation-root") {
        files.getLeaf(target, notebookId);
    }
    return true;
}

/** 普通左键点击有子项的文档标题时，根据配置切换展开状态。 */
function handleTitleExpandClick(event: MouseEvent, target: Element, files: Files, notebookId: string): boolean {
    if (event.button !== 0 || !isNotCtrl(event) || event.altKey || event.shiftKey ||
        !target.classList.contains("b3-list-item__text")) {
        return false;
    }
    const liElement = target.parentElement;
    const dataType = liElement?.getAttribute("data-type");
    const isDocument = dataType === "navigation-file" ||
        (dataType === "navigation-root" && Boolean(liElement?.getAttribute("data-node-id")));
    if (!liElement || !isDocument || !window.siyuan.config.fileTree.parentDocClickExpand ||
        Number(liElement.getAttribute("data-count")) <= 0) {
        return false;
    }
    files.getLeaf(liElement, notebookId);
    event.preventDefault();
    event.stopPropagation();
    removeSiyuanMenu();
    return true;
}

/**
 * 处理 LI 元素的点击（文件/文件夹选择和打开）
 * @returns 处理结果，包含是否已处理和是否需要设置焦点
 */
function handleLiClick(
    event: MouseEvent,
    target: Element,
    files: Files,
    app: App,
    notebookId: string
): { handled: boolean; needFocus: boolean } {
    // 使用类型守卫检查是否为 LI 元素
    if (!isHTMLLIElement(target)) {
        return { handled: false, needFocus: true };
    }

    let needFocus = true;

    // Ctrl/Cmd+Click: 切换选中状态
    const ctrlHandled = handleCtrlClick(event, target, files);
    // Shift+Click: 多选文档
    const shiftHandled = !ctrlHandled && handleShiftClickSelection(event, target, files);
    // 普通点击
    if (!ctrlHandled && !shiftHandled) {
        needFocus = handleNormalClick(event, target, files, app, notebookId);
    }

    // 清除选择标记
    clearSelectionMarkers(files.element);
    removeSiyuanMenu();
    event.stopPropagation();
    event.preventDefault();

    return { handled: true, needFocus };
}

// ============================================================================
// 主事件处理函数
// ============================================================================

/**
 * 设置面板焦点
 */
function setFocusIfNeeded(files: Files): void {
    const parentElement = files.element.parentElement;
    // 父元素存在时设置焦点
    if (parentElement) {
        setPanelFocus(parentElement);
    }
}

/**
 * element 的 click 事件处理函数
 */
function onElementClick(event: MouseEvent, files: Files, app: App): void {
    // 使用类型守卫获取事件目标（支持 SVG 图标元素）
    if (!isStylableElement(event.target)) {
        return;
    }
    let target: HTMLElement | SVGElement | null = event.target;
    const ulElement = hasTopClosestByTag(target, "UL");
    let needFocus = true;

    // 不在 UL 元素内时直接设置焦点
    if (!ulElement) {
        setFocusIfNeeded(files);
        return;
    }

    const notebookId = ulElement.getAttribute("data-url") ?? "";
    while (target && !target.isEqualNode(files.element)) {
        // 处理图标点击
        const iconResult = handleIconClick(event, target, files, app, notebookId);
        if (iconResult !== "unhandled") {
            needFocus = iconResult !== "opened";
            break;
        }
        // 处理 toggle 点击
        if (handleToggleClick(event, target, files, notebookId)) {
            break;
        }
        // 处理 action 按钮点击
        if (handleActionClick(event, target, app, notebookId)) {
            break;
        }
        // 处理发布权限开关点击
        if (handleSwitchClick(event, target)) {
            break;
        }
        if (handleTitleExpandClick(event, target, files, notebookId)) {
            break;
        }
        // 处理 LI 元素点击
        const liResult = handleLiClick(event, target, files, app, notebookId);
        if (liResult.handled) {
            needFocus = liResult.needFocus;
            break;
        }
        target = target.parentElement;
    }

    // 需要设置焦点时设置
    if (needFocus) {
        setFocusIfNeeded(files);
    }
}

/**
 * 设置 element 的 click 事件处理
 * @同步豁免: UI构建
 */
export function setupElementClickHandler(ctx: FilesEventContext): void {
    const { files, app } = ctx;

    files.element.addEventListener("click", (event) => {
        onElementClick(event, files, app);
    });
}
