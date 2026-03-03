/**
 * setCodeTheme的类型守卫
 */

/**
 * 类型守卫：检查元素是否为HTMLLinkElement
 * @param element DOM元素
 * @returns 如果是HTMLLinkElement则返回true
 */
export function isHTMLLinkElement(element: HTMLElement | null): element is HTMLLinkElement {
    return element !== null && element.tagName === "LINK";
}
