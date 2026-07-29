/**
 * 返回 History 视图中按模板约定必然存在的元素。
 * 模板与事件处理器失配时直接报错，避免点击动作被静默丢弃。
 */
export const requireHistoryElement = <T extends Element>(
    element: T | null | undefined,
    description: string,
): T => {
    if (!element) {
        throw new Error(`History view invariant failed: ${description}`);
    }
    return element;
};

/** 返回 History 视图中按协议必然存在的 DOM 属性。 */
export const requireHistoryAttribute = (element: Element, attribute: string): string => {
    const value = element.getAttribute(attribute);
    if (value === null) {
        throw new Error(`History view invariant failed: missing ${attribute}`);
    }
    return value;
};
