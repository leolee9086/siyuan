/**
 * DOM 元素类型守卫
 */

/** 类型守卫：判断元素是否为 HTMLDivElement */
export const isHTMLDivElement = (el: Element): el is HTMLDivElement => {
    return el instanceof HTMLDivElement;
};

/** 类型守卫：判断节点是否为 HTMLElement */
export const isHTMLElement = (node: unknown): node is HTMLElement => {
    return node instanceof HTMLElement;
};

/** 类型守卫：判断元素是否为 HTMLSelectElement */
export const isHTMLSelectElement = (el: unknown): el is HTMLSelectElement => {
    return el instanceof HTMLSelectElement;
};
