/**
 * @fileoverview WebSocket处理模块的类型守卫
 */

/**
 * 检查值是否为字符串数组
 */
export const isStringArray = (value: unknown): value is string[] => {
    return Array.isArray(value) && value.every(item => typeof item === "string");
};

/**
 * 检查元素是否为HTMLElement
 */
export const isHTMLElement = (element: Element | null | undefined): element is HTMLElement => {
    return element instanceof HTMLElement;
};
