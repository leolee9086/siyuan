/**
 * Vue 组件挂载相关的类型守卫
 *
 * 把原本散落在 mount.ts 中的 `as any` 断言收敛为可复用的类型守卫，集中在本守卫文件中以遵循架构约束。同时提供 DOM 元素守卫，避免业务文件在 querySelector 之后使用 `as` 断言。
 */

/** 挂载实例上具备 $refs 字段的最小访问结构 */
export interface VueRefsHolder {
    $refs: Record<string, unknown>;
}

/**
 * 判断挂载实例是否携带可用的 $refs 模板引用表
 * @param instance - Vue 应用挂载后返回的实例，类型未知，由守卫收窄
 * @returns 为真时 instance 被收窄为 VueRefsHolder
 */
export const hasVueRefs = (instance: unknown): instance is VueRefsHolder => {
    // 宿主实例形态不定，先确认为非空对象再检查 $refs 字段是否为对象
    if (typeof instance !== "object" || instance === null) {
        return false;
    }
    const refs = (instance as VueRefsHolder).$refs;
    return typeof refs === "object" && refs !== null;
};

/**
 * 判断目标对象上是否存在可调用的指定方法
 * @param target - 待检测的对象（通常是模板引用对应的子组件实例），类型未知
 * @param methodName - 要调用的方法名
 * @returns 为真时 target 被收窄为含该方法的对象
 */
export const hasInitMethod = (
    target: unknown,
    methodName: string
): target is Record<string, (...args: unknown[]) => unknown> => {
    // 宿主对象可能是任意形态，先确认其为非空对象再检查方法可调用性
    if (typeof target !== "object" || target === null) {
        return false;
    }
    const method = (target as Record<string, unknown>)[methodName];
    return typeof method === "function";
};

/**
 * 判断一个节点是否为 HTMLElement
 * @param node - querySelector 等接口返回的节点，可能为 null
 * @returns 为真时 node 被收窄为 HTMLElement
 */
export const isHTMLElement = (node: Element | null): node is HTMLElement => {
    // querySelector 返回 Element | null，需确认其具备 HTMLElement 专属能力后再用于挂载
    return node instanceof HTMLElement;
};