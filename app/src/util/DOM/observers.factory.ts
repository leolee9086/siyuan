/** @同步豁免: 生命周期 - 调用方必须立即保存观察器并在当前 DOM 生命周期内开始观察。 */
export const createResizeObserver = (callback: ResizeObserverCallback) => new ResizeObserver(callback);

/** @同步豁免: 生命周期 - 调用方必须在当前渲染调用栈内注册可见性观察。 */
export const createIntersectionObserver = (callback: IntersectionObserverCallback, options: IntersectionObserverInit) =>
    new IntersectionObserver(callback, options);
