/** 检查 DOM 节点是否是可访问样式表的 style 元素。 */
export const isHTMLStyleElement = (value: Element | null): value is HTMLStyleElement => value instanceof HTMLStyleElement;
