/**
 * CSS变量提取工具的环境访问封装
 * 用于封装对全局对象的访问，符合架构约束
 */

/**
 * 获取元素的计算样式
 * @param element DOM元素
 * @returns 计算后的样式对象
 */
export function getComputedStyle(element: Element): CSSStyleDeclaration {
    return window.getComputedStyle(element);
}

/**
 * 获取文档的根元素
 * @returns HTML根元素
 */
export function getDocumentElement(): HTMLElement {
    return document.documentElement;
}

/**
 * 获取所有样式表
 * @returns 样式表列表
 */
export function getStyleSheets(): StyleSheetList {
    return document.styleSheets;
}
