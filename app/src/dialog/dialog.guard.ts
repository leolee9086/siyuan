/**
 * 对话框模块类型守卫
 */

/**
 * 判断是否为 HTMLElement
 */
export function isHTMLElement(el: unknown): el is HTMLElement {
    return el instanceof HTMLElement;
}

/**
 * 判断是否为 SVGElement
 */
export function isSVGElement(el: unknown): el is SVGElement {
    return el instanceof SVGElement;
}

/**
 * 判断是否为 SVGUseElement
 */
export function isSVGUseElement(el: unknown): el is SVGUseElement {
    return el instanceof SVGUseElement;
}
