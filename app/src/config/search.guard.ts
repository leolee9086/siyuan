/**
 * search.guard.ts - 配置搜索模块的类型守卫
 *
 * 意图：为 search.ts 中的 DOM 操作提供类型安全的守卫函数，
 *       避免使用 `as` 断言，符合项目 lint 规范
 * 调用时机：在 search.ts 中进行 DOM 查询和事件处理时使用
 */

/** 用途：DOM 元素类型守卫。使用范围：配置搜索模块守卫。解耦评估：通过 ./imports 转发。 */
import { isHTMLElement } from "./imports";
/** 用途：HTMLInputElement 类型守卫。使用范围：配置搜索事件处理。解耦评估：通过 ./imports 转发。 */
import { isHTMLInputElement } from "./imports";
/** 用途：InputEvent 类型守卫。使用范围：配置搜索事件处理。解耦评估：通过 ./imports 转发。 */
import { isInputEvent } from "./imports";

/** 重新导出 DOM 类型守卫 */
export { isHTMLElement };
/** 重新导出 HTMLInputElement 类型守卫 */
export { isHTMLInputElement };
/** 重新导出 InputEvent 类型守卫 */
export { isInputEvent };

/**
 * 类型守卫：安全获取 HTMLElement，接受 Element | null | undefined
 *
 * 意图：统一处理 querySelector 等返回的可空 Element 类型
 */
/** @同步豁免: 类型守卫 */
export const isHTMLElementSafe = (element: Element | null | undefined): element is HTMLElement => {
    return element != null && isHTMLElement(element);
};
