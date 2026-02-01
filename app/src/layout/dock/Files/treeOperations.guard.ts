/**
 * @fileoverview 文件树操作模块的类型守卫
 *
 * 本模块重导出统一的DOM类型守卫，并提供兼容的参数签名。
 *
 * @deprecated 请从 '@/util/DOM/element.guard' 导入统一的DOM类型守卫
 */

import * as ElementGuards from "../../../util/DOM/element.guard";

/**
 * 检查元素是否为HTMLElement（兼容null/undefined参数）
 *
 * @param element - 要检查的元素
 * @returns 如果是HTMLElement则返回true
 * @deprecated 请从 '@/util/DOM/element.guard' 导入
 */
export function isHTMLElement(element: Element | null | undefined): element is HTMLElement {
    return element !== null && element !== undefined && ElementGuards.isHTMLElement(element);
}

/**
 * 检查元素是否为SVGElement（兼容null/undefined参数）
 *
 * @param element - 要检查的元素
 * @returns 如果是SVGElement则返回true
 */
export function isSVGElement(element: Element | null | undefined): element is SVGElement {
    return element !== null && element !== undefined && ElementGuards.isSVGElement(element);
}

/**
 * 检查元素是否为可样式化元素（兼容null/undefined参数）
 *
 * @param element - 要检查的元素
 * @returns 如果是HTMLElement或SVGElement则返回true
 */
export function isStylableElement(element: Element | null | undefined): element is HTMLElement | SVGElement {
    return element !== null && element !== undefined && ElementGuards.isStylableElement(element);
}

/**
 * 断言元素为HTMLElement，如果不是则抛出错误
 *
 * @param element - 要检查的元素
 * @param context - 错误上下文信息
 * @returns HTMLElement类型的元素
 * @throws 如果元素不是HTMLElement
 */
export const assertHTMLElement = (element: Element | null | undefined, context: string): HTMLElement => {
    if (!isHTMLElement(element)) {
        throw new Error(`[${context}] 元素不是 HTMLElement`);
    }
    return element;
};

/**
 * 断言元素为可样式化元素，如果不是则抛出错误
 *
 * @param element - 要检查的元素
 * @param context - 错误上下文信息
 * @returns HTMLElement或SVGElement类型的元素
 * @throws 如果元素不是可样式化元素
 */
export const assertStylableElement = (element: Element | null | undefined, context: string): HTMLElement | SVGElement => {
    if (!isStylableElement(element)) {
        throw new Error(`[${context}] 元素不是可样式化元素（HTMLElement 或 SVGElement）`);
    }
    return element;
};
