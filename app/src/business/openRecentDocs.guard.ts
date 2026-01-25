/**
 * 类型守卫: 检查元素是否为HTMLSelectElement
 * @param element 待检查的元素
 * @returns 如果是HTMLSelectElement返回true
 */
export const isHTMLSelectElement = (element: Element | null): element is HTMLSelectElement => {
    return element !== null && element instanceof HTMLSelectElement;
};

/**
 * 类型守卫: 检查值是否为有效的排序类型
 * @param value 待检查的值
 * @returns 如果是有效的TRecentDocsSort返回true
 */
export const isTRecentDocsSort = (value: unknown): value is TRecentDocsSort => {
    return typeof value === "string" && 
           (value === "viewedAt" || value === "updated" || value === "openAt" || value === "closedAt");
};
