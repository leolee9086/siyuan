/**
 * 面包屑模块类型守卫
 */

/**
 * 检查目标是否为 HTMLInputElement
 */
export function isInputElement(target: EventTarget | null): target is HTMLInputElement {
    return target !== null && "files" in target;
}

/**
 * 检查目标是否为 Element
 */
export function isElement(node: unknown): node is Element {
    return (node as Node)?.nodeType === Node.ELEMENT_NODE;
}

/**
 * 检查目标是否为 HTMLElement
 */
export function isHTMLElement(node: unknown): node is HTMLElement {
    return isElement(node) && "style" in node;
}
