/**
 * PDF注释模块的类型守卫函数
 */

/**
 * 检查元素是否为 HTMLElement
 * @param element - 要检查的元素
 * @returns 如果是 HTMLElement 返回 true
 */
export const isHTMLElement = (element: Element | null | undefined): element is HTMLElement => {
    return element instanceof HTMLElement;
};

/**
 * 检查元素是否为 HTMLDivElement
 * @param element - 要检查的元素
 * @returns 如果是 HTMLDivElement 返回 true
 */
export const isHTMLDivElement = (element: Element | null | undefined): element is HTMLDivElement => {
    return element instanceof HTMLDivElement;
};

/**
 * 安全地获取或创建具有特定类名的子元素
 * 如果元素不存在则创建，返回时确保是 HTMLElement 类型
 * 
 * @param container - 父容器元素
 * @param selector - CSS 选择器
 * @param createHtml - 创建元素的 HTML 字符串
 * @returns HTMLElement 或 null（如果创建失败）
 */
export const getOrCreateElement = (
    container: HTMLElement,
    selector: string,
    createHtml: string
): HTMLElement | null => {
    const existing = container.querySelector(selector);
    if (isHTMLElement(existing)) {
        return existing;
    }

    // 创建新元素
    container.insertAdjacentHTML("beforeend", createHtml);
    const created = container.querySelector(selector);

    if (isHTMLElement(created)) {
        return created;
    }

    return null;
};
