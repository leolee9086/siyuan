/** @同步豁免: 生命周期 - BlockPanel 必须立即保存观察器并开始观察当前 DOM。 */
export function createPanelResizeObserver(callback: ResizeObserverCallback) {
    return new ResizeObserver(callback);
}

/** @同步豁免: 生命周期 - BlockPanel 必须在同一渲染调用栈中注册懒加载观察器。 */
export function createPanelIntersectionObserver(callback: IntersectionObserverCallback, options: IntersectionObserverInit) {
    return new IntersectionObserver(callback, options);
}
