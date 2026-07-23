/**
 * Files 组件 closeElement 的事件处理器
 * @module eventHandlers.closeElement
 */

import { openEmojiPanel } from "../../../emoji";
import { fetchPost } from "../../../util/network/fetch";
import { setPanelFocus } from "../../utils/setPanelFocus";
import { removeSiyuanMenu } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { isStylableElement } from "./eventHandlers.guard";
import type { Files } from "../Files";
import {openEncryptedNotebook} from "../../../util/file/mount";

/**
 * 处理 closeElement 中的图标点击
 * @param event - 鼠标事件
 * @param target - 目标元素
 * @returns 是否已处理该事件
 */
function handleCloseElementIconClick(
    event: MouseEvent,
    target: Element
): boolean {
    // 检查是否点击了笔记本图标
    if (!target.classList.contains("b3-list-item__icon")) {
        return false;
    }

    event.preventDefault();
    event.stopPropagation();
    const rect = target.getBoundingClientRect();
    const parentElement = target.parentElement;
    // 父元素不存在时跳过
    if (!parentElement) {
        return true;
    }
    const dataUrl = parentElement.getAttribute("data-url") ?? "";
    const imgElement = target.querySelector("img") ?? undefined;
    openEmojiPanel(dataUrl, "notebook", {
        x: rect.left,
        y: rect.bottom,
        h: rect.height,
        w: rect.width,
    }, undefined, imgElement);
    return true;
}

/**
 * 折叠 closeElement 面板
 * @param files - Files 实例
 * @param svgElement - SVG 元素
 */
function collapseCloseElement(files: Files, svgElement: SVGSVGElement): void {
    files.closeElement.style.height = "30px";
    svgElement.classList.remove("b3-list-item__arrow--open");
    const lastChild = files.closeElement.lastElementChild;
    // lastChild 存在时隐藏
    if (lastChild) {
        lastChild.classList.add("fn__none");
    }
}

/**
 * 展开 closeElement 面板
 * @param files - Files 实例
 * @param svgElement - SVG 元素
 */
function expandCloseElement(files: Files, svgElement: SVGSVGElement): void {
    files.closeElement.style.height = "40%";
    svgElement.classList.add("b3-list-item__arrow--open");
    const lastChild = files.closeElement.lastElementChild;
    // lastChild 存在时显示
    if (lastChild) {
        lastChild.classList.remove("fn__none");
    }
}

/**
 * 处理 closeElement 中的 toggle 按钮点击
 * @param event - 鼠标事件
 * @param target - 目标元素
 * @param files - Files 实例
 * @returns 是否已处理该事件
 */
function handleCloseElementToggleClick(
    event: MouseEvent,
    target: Element,
    files: Files
): boolean {
    const type = target.getAttribute("data-type");
    // 检查是否点击了 toggle 按钮
    if (type !== "toggle") {
        return false;
    }

    const svgElement = target.querySelector("svg");
    // svg 元素不存在时跳过
    if (!svgElement) {
        return true;
    }

    // 箭头已展开时折叠
    if (svgElement.classList.contains("b3-list-item__arrow--open")) {
        collapseCloseElement(files, svgElement);
        removeSiyuanMenu();
        event.stopPropagation();
        event.preventDefault();
        return true;
    }

    // 箭头未展开时展开
    expandCloseElement(files, svgElement);
    removeSiyuanMenu();
    event.stopPropagation();
    event.preventDefault();
    return true;
}

/**
 * 处理 closeElement 中的 open 按钮点击
 * @param event - 鼠标事件
 * @param target - 目标元素
 * @returns 是否已处理该事件
 */
function handleCloseElementOpenClick(
    event: MouseEvent,
    target: Element,
    files: Files
): boolean {
    const type = target.getAttribute("data-type");
    // 检查是否点击了 open 按钮
    if (type !== "open") {
        return false;
    }

    const notebookId = target.getAttribute("data-url") ?? "";
    const liElement = target.closest("li");
    if (liElement?.getAttribute("data-encrypted") === "true") {
        const name = liElement.querySelector(".b3-list-item__text")?.textContent ?? "";
        openEncryptedNotebook(files.app, notebookId, name);
    }
    if (liElement?.getAttribute("data-encrypted") !== "true") {
        fetchPost("/api/notebook/openNotebook", {notebook: notebookId});
    }
    removeSiyuanMenu();
    event.stopPropagation();
    event.preventDefault();
    return true;
}

/**
 * closeElement 的 click 事件处理函数
 * @param event - 鼠标事件
 * @param files - Files 实例
 */
function onCloseElementClick(event: MouseEvent, files: Files): void {
    const parentElement = files.element.parentElement;
    // 父元素存在时设置焦点
    if (parentElement) {
        setPanelFocus(parentElement);
    }

    // 使用类型守卫获取事件目标（支持 SVG 图标元素）
    if (!isStylableElement(event.target)) {
        return;
    }
    let target: HTMLElement | SVGElement | null = event.target;

    while (target && !target.isEqualNode(files.closeElement)) {
        // 处理图标点击
        if (handleCloseElementIconClick(event, target)) {
            break;
        }

        // 处理 toggle 按钮点击
        if (handleCloseElementToggleClick(event, target, files)) {
            break;
        }

        // 处理 open 按钮点击
        if (handleCloseElementOpenClick(event, target, files)) {
            break;
        }

        target = target.parentElement;
    }
}

/**
 * 创建 closeElement 的 click 事件处理器
 * 返回一个绑定了 files 实例的事件处理函数
 * @param files - Files 实例
 * @returns 事件处理函数
 * @同步豁免: UI构建
 */
export function createCloseElementClickHandler(files: Files): (event: MouseEvent) => void {
    return (event: MouseEvent) => {
        onCloseElementClick(event, files);
    };
}

/**
 * 设置 closeElement 的 click 事件处理
 * @param files - Files 实例
 * @同步豁免: UI构建
 */
export function setupCloseElementClickHandler(files: Files): void {
    const handler = createCloseElementClickHandler(files);
    files.closeElement.addEventListener("click", handler);
}
