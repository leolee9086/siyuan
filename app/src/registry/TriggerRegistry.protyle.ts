/**
 * TriggerRegistry.protyle.ts - Protyle 实例注册表
 * 
 * 用于管理 Protyle 实例的全局注册，支持从 DOM 元素反向查找 IProtyle 实例。
 * 
 * @module layout/registry/TriggerRegistry.protyle
 */

/**
 * 使用 Map 存储，通过 ID 索引，便于后续通过 ID 查找
 * DOM 元素上会绑定 data-protyle-id 属性
 */
const protyleRegistry = new Map<string, IProtyle>();

/**
 * 注册 Protyle 实例
 * 
 * 会在 protyle.element 上设置 data-protyle-id 属性
 * 
 * @param protyle Protyle 实例
 */
export function 注册Protyle(protyle: IProtyle): void {
    if (!protyle || !protyle.id || !protyle.element) {
        return;
    }
    protyleRegistry.set(protyle.id, protyle);
    protyle.element.setAttribute("data-protyle-id", protyle.id);
}

/**
 * 注销 Protyle 实例
 * 
 * @param protyle Protyle 实例
 */
export function 注销Protyle(protyle: IProtyle): void {
    if (!protyle || !protyle.id) {
        return;
    }
    protyleRegistry.delete(protyle.id);
    // 元素可能已经被销毁，尝试移除属性
    if (protyle.element) {
        protyle.element.removeAttribute("data-protyle-id");
    }
}

/**
 * 通过 DOM 元素查找归属的 Protyle 实例
 * 
 * 此函数会向上遍历 DOM 树，直到找到包含 data-protyle-id 属性的元素。
 * 
 * @param element 起始 DOM 元素
 * @returns 找到的 Protyle 实例，如果未找到则返回 null
 */
export function 查找Protyle(element: Node | null): IProtyle | null {
    let current = element;
    while (current) {
        const protyle = 尝试获取节点Protyle(current);
        if (protyle) {
            return protyle;
        }
        current = current.parentElement;
    }
    return null;
}

/**
 * 尝试从节点获取关联的 Protyle 实例
 * 
 * @param node DOM 节点
 * @returns Protyle 实例或 undefined
 */
function 尝试获取节点Protyle(node: Node): IProtyle | undefined {
    if (node instanceof Element) {
        const id = node.getAttribute("data-protyle-id");
        return id ? protyleRegistry.get(id) : undefined;
    }
    return undefined;
}

