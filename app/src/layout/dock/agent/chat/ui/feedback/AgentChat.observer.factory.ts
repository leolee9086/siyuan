/**
 * 创建用于跟踪流式卡片尺寸变化的观察器。
 * @同步豁免: 生命周期 - ResizeObserver 必须在绑定目标元素前同步创建，创建过程不包含可异步化的副作用。
 */
export function createAgentChatResizeObserver(callback: ResizeObserverCallback) {
    return new ResizeObserver(callback);
}

/**
 * 创建用于观察设置 Dialog 关闭的节点观察器。
 * @同步豁免: 生命周期 - AgentChat 必须在登记观察目标前同步取得观察器实例，异步创建会漏掉初始化期间的 DOM 变化。
 */
export function createAgentChatMutationObserver(callback: MutationCallback) {
    return new MutationObserver(callback);
}
