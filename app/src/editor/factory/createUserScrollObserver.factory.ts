/** @同步豁免: UI构建 */
/**
 * 作用：创建一组可由用户滚动中止的定位观察器资源。
 * 意图：将浏览器对象实例化集中在 editor factory owner，供临时 ResizeObserver 生命周期安全复用。
 * 调用时机：编辑器打开块并短暂监听布局变化时。
 * 问题/改进：资源仅管理本次定位生命周期，不保存跨编辑器状态。
 */
export const createUserScrollObserver = (onResize: ResizeObserverCallback) => ({
    abortController: new AbortController(),
    observer: new ResizeObserver(onResize),
});
