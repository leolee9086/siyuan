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

/**
 * 作用：按 data-node-id 属性值查找 PDF 标注矩形。
 * 意图：避免将 .sya 中的未可信 ID 拼接进 CSS selector，防止选择器注入。
 * 调用时机：高亮、颜色切换、删除和类型切换需要定位同一标注的矩形时。
 * 问题/改进：仅返回 HTMLElement，非 HTML 节点不会进入后续样式或删除操作。
 */
export const getRectElementsByNodeId = (element: HTMLElement, id: string | null): HTMLElement[] => {
    const results: HTMLElement[] = [];
    const candidates = element.querySelectorAll("[data-node-id]");
    for (const candidate of candidates) {
        // 属性值精确比较保持字面 ID 语义，不让引号或 selector 元字符参与选择器解析。
        if (isHTMLElement(candidate) && candidate.getAttribute("data-node-id") === id) {
            results.push(candidate);
        }
    }
    return results;
};
