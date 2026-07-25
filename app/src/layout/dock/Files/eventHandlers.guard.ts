/**
 * Files 组件事件处理器的类型守卫
 * @module eventHandlers.guard
 */

import { isHTMLElement, isStylableElement } from "../../../util/DOM/element.guard";
import type {FilesDomain} from "./eventHandlers.types";

// 重导出统一守卫
export { isHTMLElement, isStylableElement };

/** 判断对象是否具备 Files 完整领域表面。 */
/** @同步豁免: 类型守卫 */
export function isFilesDomain(value: object | undefined): value is FilesDomain {
    if (!value || !("layoutModel" in value) || !("element" in value) || !("selectItem" in value) ||
        !("init" in value) || !("updateDocActions" in value) || !("onNotebookSortChanged" in value)) {
        return false;
    }
    return value.layoutModel === true && value.element instanceof HTMLElement &&
        typeof value.selectItem === "function" && typeof value.init === "function" &&
        typeof value.updateDocActions === "function" && typeof value.onNotebookSortChanged === "function";
}

/**
 * 类型守卫：检查元素是否为 HTMLLIElement
 * @param element - 待检查的元素
 * @returns 是否为 HTMLLIElement
 */
export function isHTMLLIElement(element: Element): element is HTMLLIElement {
    return element.tagName === "LI";
}

/**
 * 检查元素是否为文件类型
 * @param element - 待检查的元素
 * @returns 是否为文件类型
 */
export function isNavigationFile(element: HTMLElement): boolean {
    return element.getAttribute("data-type") === "navigation-file";
}

/**
 * 检查元素是否为根目录类型
 * @param element - 待检查的元素
 * @returns 是否为根目录类型
 */
export function isNavigationRoot(element: HTMLElement): boolean {
    return element.getAttribute("data-type") === "navigation-root";
}

/**
 * 检查元素是否正在打开中
 * @param element - 待检查的元素
 * @returns 是否正在打开
 */
export function isOpening(element: HTMLElement): boolean {
    return element.getAttribute("data-opening") !== null;
}

/**
 * 清除 Files 实例的 lastSelectedElement
 * 由于 Files.ts 中的类型定义为 Element = null，需要使用此辅助函数来安全地清除
 * @param files - 包含 lastSelectedElement 属性的对象
 */
export function clearLastSelectedElement(
    files: { lastSelectedElement: Element | null }
): void {
    files.lastSelectedElement = null;
}
