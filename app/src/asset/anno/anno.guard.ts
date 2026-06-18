/**
 * PDF注释模块的类型守卫函数
 * @deprecated 请从 '@/util/DOM/element.guard' 导入统一的类型守卫
 */

/** 用途：HTMLElement 类型守卫。使用范围：anno 模块类型安全。解耦评估：通过 ./imports 转发。 */
import { isHTMLElement } from "./imports";
/** 用途：HTMLDivElement 类型守卫。使用范围：anno 模块类型安全。解耦评估：通过 ./imports 转发。 */
import { isHTMLDivElement } from "./imports";

/**
 * 检查元素是否为 HTMLElement（支持null/undefined输入）
 * @param element - 要检查的元素
 * @returns 如果是 HTMLElement 返回 true
 * @deprecated 请从 '@/util/DOM/element.guard' 导入
 */
export const isHTMLElementSafe = (element: Element | null | undefined): element is HTMLElement => {
    return element != null && isHTMLElement(element);
};

/**
 * 检查元素是否为 HTMLDivElement（支持null/undefined输入）
 * @param element - 要检查的元素
 * @returns 如果是 HTMLDivElement 返回 true
 * @deprecated 请从 '@/util/DOM/element.guard' 导入
 */
export const isHTMLDivElementSafe = (element: Element | null | undefined): element is HTMLDivElement => {
    return element != null && isHTMLDivElement(element);
};

// 重导出统一守卫以保持兼容性
export { isHTMLElement, isHTMLDivElement };

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
