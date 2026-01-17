/**
 * 判断节点是否为 HTMLElement 类型
 */
export const isHTMLElement = (node: Node | null): node is HTMLElement => {
    return node !== null && node.nodeType === Node.ELEMENT_NODE;
};

/**
 * 判断元素是否为 HTMLTableCellElement（TD 或 TH）
 */
export const isTableCellElement = (element: Element | false): element is HTMLTableCellElement => {
    if (element === false) {
        return false;
    }
    const tagName = element.tagName.toUpperCase();
    return tagName === "TD" || tagName === "TH";
};
