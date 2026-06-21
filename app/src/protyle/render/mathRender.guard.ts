/**
 * mathRender.guard.ts - 数学公式渲染模块的类型守卫
 *
 * 提供运行时类型检查，替代 as 类型断言。
 * 用于 mathRender 中需要将 Element 安全转换为 HTMLElement 的场景。
 *
 * @module protyle/render/mathRender.guard
 */

/**
 * 检查 Element 是否为 HTMLElement
 *
 * 作用：运行时类型守卫，安全地将 Element 窄化为 HTMLElement
 * 意图：替代 `as HTMLElement` 断言，提供运行时安全检查
 * 调用时机：遍历 querySelectorAll 返回的 Element 列表时，
 *          需要访问 HTMLElement 特有属性（如 style、offsetWidth）前调用
 */
/** @同步豁免: 类型守卫 */
export function isHTMLElement(element: Element | null | undefined): element is HTMLElement {
    return element instanceof HTMLElement;
}

/**
 * 检查 Node 是否为 HTMLElement
 *
 * 作用：运行时类型守卫，安全地将 Node（如 nextSibling）窄化为 HTMLElement
 * 意图：替代 `hasNextSibling(element) as HTMLElement`，提供运行时安全检查
 * 调用时机：处理 DOM 兄弟节点时，需要访问 HTMLElement 属性前调用
 */
/** @同步豁免: 类型守卫 */
export function isHTMLElementNode(node: Node | false | null | undefined): node is HTMLElement {
    return node instanceof HTMLElement;
}

/**
 * 检查 unknown 值是否为 IObject（字符串键值对对象）
 *
 * 作用：运行时类型守卫，将渲染参数解析返回的 unknown 安全窄化为 IObject
 * 意图：替代 `as IObject` 断言，提供运行时安全检查
 * 调用时机：解析 KaTeX 宏配置后，需要传递给 KaTeX 渲染器前调用
 */
/** @同步豁免: 类型守卫 */
export function isIObject(value: unknown): value is IObject {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    for (const val of Object.values(value)) {
        // IObject 要求所有值为 string
        if (typeof val !== "string") {
            return false;
        }
    }
    return true;
}
