/**
 * @fileoverview WebSocket处理模块的类型守卫
 *
 * 本模块重导出统一的DOM类型守卫，并提供兼容的参数签名。
 *
 * @deprecated 请从 '@/util/DOM/element.guard' 导入统一的DOM类型守卫
 */

import * as ElementGuards from "../../../util/DOM/element.guard";

/**
 * 检查值是否为字符串数组
 */
export const isStringArray = (value: unknown): value is string[] => {
    return Array.isArray(value) && value.every(item => typeof item === "string");
};

/**
 * 检查元素是否为HTMLElement（兼容null/undefined参数）
 *
 * @param element - 要检查的元素
 * @returns 如果是HTMLElement则返回true
 * @deprecated 请从 '@/util/DOM/element.guard' 导入，或考虑使用 isStylableElement 支持 SVG 元素
 */
export const isHTMLElement = (element: Element | null | undefined): element is HTMLElement => {
    return element !== null && element !== undefined && ElementGuards.isHTMLElement(element);
};

/**
 * 检查元素是否为可样式化元素（HTMLElement 或 SVGElement）
 *
 * @param element - 要检查的元素
 * @returns 如果是HTMLElement或SVGElement则返回true
 */
export const isStylableElement = (element: Element | null | undefined): element is HTMLElement | SVGElement => {
    return element !== null && element !== undefined && ElementGuards.isStylableElement(element);
};
