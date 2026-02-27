/**
 * search.guard.ts - 配置搜索模块的类型守卫
 *
 * 意图：为 search.ts 中的 DOM 操作提供类型安全的守卫函数，
 *       避免使用 `as` 断言，符合项目 lint 规范
 * 调用时机：在 search.ts 中进行 DOM 查询和事件处理时使用
 */

import { isHTMLElement, isHTMLInputElement, isInputEvent } from "../util/DOM/element.guard";

export { isHTMLElement, isHTMLInputElement, isInputEvent };

/**
 * 类型守卫：安全获取 HTMLElement，接受 Element | null | undefined
 *
 * 意图：统一处理 querySelector 等返回的可空 Element 类型
 */
/** @同步豁免: 类型守卫 */
export const isHTMLElementSafe = (element: Element | null | undefined): element is HTMLElement => {
    return element != null && isHTMLElement(element);
};
