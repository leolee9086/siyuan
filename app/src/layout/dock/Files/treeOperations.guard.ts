/**
 * @fileoverview 文件树操作模块的类型守卫
 * 
 * 本模块包含用于类型检查的守卫函数。
 */

/**
 * 检查元素是否为HTMLElement
 * 
 * @param element - 要检查的元素
 * @returns 如果是HTMLElement则返回true
 */
export const isHTMLElement = (element: Element | null | undefined): element is HTMLElement => {
    return element instanceof HTMLElement;
};

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
