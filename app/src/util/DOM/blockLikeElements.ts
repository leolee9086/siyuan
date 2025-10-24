
/**
 * 获取DOM元素的块ID
 * @param element - DOM元素
 * @returns 返回元素的data-node-id属性值，如果不存在则返回null
 */
export const getElementBlockId = (element: Element) => {
    return element.getAttribute("data-node-id");
};

/**
 * 批量获取多个DOM元素的块ID
 * @param elements - DOM元素数组
 * @returns 返回包含所有元素块ID的字符串数组
 */
export const getElementsBlockId = (elements: Element[]) => {
    const ids: string[] = [];
    elements.forEach(item => {
        ids.push(getElementBlockId(item));
    });
    return ids;
};

