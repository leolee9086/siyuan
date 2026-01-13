/**
 * 获取 window.siyuan.viewer
 * @returns viewer 实例
 */
export const getSiyuanViewer = () => {
    return window.siyuan?.viewer;
};

/**
 * 设置 window.siyuan.viewer
 * @param viewer viewer 实例
 */
export const setSiyuanViewer = (viewer: Viewer) => {
    if (window.siyuan) {
        window.siyuan.viewer = viewer;
    }
};

/**
 * 销毁 window.siyuan.viewer
 */
export const destroySiyuanViewer = () => {
    window.siyuan?.viewer?.destroy();
};
