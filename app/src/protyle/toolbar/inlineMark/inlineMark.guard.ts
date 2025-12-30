/**
 * inlineMark 模块的类型守卫
 */

export const isHTMLElement = (node: Node): node is HTMLElement => {
    return node.nodeType === Node.ELEMENT_NODE;
};

export const isTextNode = (node: Node): node is Text => {
    return node.nodeType === Node.TEXT_NODE;
};

export const isChildNode = (node: Node | null): node is ChildNode => {
    return !!node && typeof (node as unknown as { remove: () => void }).remove === "function";
};
