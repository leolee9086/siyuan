/** 导出 preventScroll 用于在异步操作期间阻止编辑器滚动，避免数据竞争导致的视觉跳跃。 */
export const preventScroll = (protyle: IProtyle, scrollTop = 0, timeout = 1000) => {
    // 防止滚动条滚动后调用 get 请求
    protyle.scroll.lastScrollTop = -1;
    setTimeout(() => {
        protyle.scroll.lastScrollTop = scrollTop;
    }, timeout);
};
