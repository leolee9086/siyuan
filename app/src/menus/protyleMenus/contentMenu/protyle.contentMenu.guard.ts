/**
 * contentMenu 模块类型守卫
 */

/**
 * 判断节点是否为 HTMLElement。
 * @同步豁免: 类型守卫 - 该函数用于同步类型收窄，不涉及异步行为。
 */
export const isHTMLElement = (value: unknown): value is HTMLElement => {
    return value instanceof HTMLElement;
};

/**
 * 判断节点是否为 HTMLTableCellElement。
 * @同步豁免: 类型守卫 - 该函数用于同步类型收窄，不涉及异步行为。
 */
export const isHTMLTableCellElement = (value: unknown): value is HTMLTableCellElement => {
    return value instanceof HTMLTableCellElement;
};
