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

/** 类型守卫：判断事件是否为 CustomEvent */
export const isCustomEvent = <T = unknown>(event: Event): event is CustomEvent<T> => {
    return event instanceof CustomEvent;
};

/** 类型守卫：判断节点是否为 SVGElement */
export const isSVGElement = (node: unknown): node is SVGElement => {
    return node instanceof SVGElement;
};

/** 类型守卫：判断节点是否为 SVGUseElement */
export const isSVGUseElement = (node: unknown): node is SVGUseElement => {
    return node instanceof SVGUseElement;
};

/** 类型守卫：判断节点是否为 HTMLInputElement */
export const isHTMLInputElement = (node: unknown): node is HTMLInputElement => {
    return node instanceof HTMLInputElement;
};

/** 类型守卫：判断节点是否为 Element（包含 HTMLElement 和 SVGElement） */
export const isElement = (node: unknown): node is Element => {
    return node instanceof Element;
};

/** 类型守卫：判断节点是否为可样式化元素（HTMLElement 或 SVGElement） */
export const isStylableElement = (node: unknown): node is HTMLElement | SVGElement => {
    return node instanceof HTMLElement || node instanceof SVGElement;
};

/** 类型守卫：判断节点是否为 Text 节点 */
export const isTextNode = (node: unknown): node is Text => {
    return node instanceof Text;
};

/** 类型守卫：判断节点是否为 ChildNode */
export const isChildNode = (node: unknown): node is ChildNode => {
    return node instanceof Node && "remove" in node && typeof (node as ChildNode).remove === "function";
};

/** 类型守卫：判断元素是否为 HTMLTableCellElement（TD 或 TH） */
export const isHTMLTableCellElement = (element: unknown): element is HTMLTableCellElement => {
    return element instanceof HTMLTableCellElement;
};
