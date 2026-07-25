/**
 * layout.guard.ts - Layout 模块类型守卫
 * 用于替代 as 类型断言，提供运行时类型检查
 */

import type { Layout } from "./index";
import type { Wnd } from "./Wnd";
export {ensureDirection, ensureSize, ensureType} from "./options";

// 重导出统一的 DOM 元素守卫函数
export { isStylableElement } from "../util/DOM/element.guard";

/**
 * 类型守卫：检查元素是否为可样式化元素（HTMLElement 或 SVGElement）
 * @deprecated 请从 '../util/DOM/element.guard' 导入 isStylableElement 以支持 SVG 元素
 */
export function isHTMLElement(element: Element): element is HTMLElement | SVGElement {
    return element instanceof HTMLElement || element instanceof SVGElement;
}

/**
 * 类型守卫：检查是否为有效的 Layout 实例
 */
export function isLayout(item: unknown): item is Layout {
    return typeof item === "object" && item !== null && "element" in item && "children" in item;
}

/**
 * 类型守卫：检查是否为有效的 Wnd 实例
 */
export function isWnd(item: unknown): item is Wnd {
    return typeof item === "object" && item !== null && "element" in item && "type" in item;
}
