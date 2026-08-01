/** 查询初始化阶段必须存在的元素，缺失时立即暴露模板与绑定不一致。 */
export function requireElement<ElementType extends Element>(root: ParentNode, selector: string) {
    const element = root.querySelector<ElementType>(selector);
    if (!element) {
        throw new Error(`AgentChat required element not found: ${selector}`);
    }
    return element;
}

/** 判断事件目标是否支持 HTMLElement 导航和数据集访问。 */
export function isHTMLElement(value: unknown): value is HTMLElement {
    return value instanceof HTMLElement;
}
