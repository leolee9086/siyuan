/**
 * BlockRender 模块类型守卫
 */

/**
 * 类型守卫：判断 Element 是否为 HTMLElement
 */
export function isHTMLElement(element: Element): element is HTMLElement {
    return element instanceof HTMLElement;
}
