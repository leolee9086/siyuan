/**
 * Files 组件事件处理器的类型守卫
 * @module eventHandlers.guard
 */

/**
 * 检查元素是否为 HTMLElement
 * @param element - 待检查的元素
 * @returns 是否为 HTMLElement
 */
export function isHTMLElement(element: unknown): element is HTMLElement {
    return element instanceof HTMLElement;
}

/**
 * 检查事件目标是否为 HTMLElement
 * @param target - 事件目标
 * @returns 是否为 HTMLElement
 */
export function isEventTargetHTMLElement(target: EventTarget | null): target is HTMLElement {
    return target instanceof HTMLElement;
}

/**
 * 检查元素是否为 LI 元素
 * @param element - 待检查的元素
 * @returns 是否为 LI 元素
 */
export function isLiElement(element: HTMLElement): boolean {
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
