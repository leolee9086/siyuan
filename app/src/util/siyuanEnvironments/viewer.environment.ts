/**
 * 获取 window.siyuan.viewer
 * @returns viewer 实例
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 读取 window.siyuan.viewer 是同步的全局对象访问，异步化会不必要地改变返回值类型。 */
export const getSiyuanViewer = () => {
    return window.siyuan?.viewer;
};

/**
 * 设置 window.siyuan.viewer
 * @param viewer viewer 实例
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 写 window.siyuan.viewer 是同步的全局对象写入，异步化会让调用方无法确定写入时序。 */
export const setSiyuanViewer = (viewer: Viewer) => {
    if (window.siyuan) {
        window.siyuan.viewer = viewer;
    }
};

/**
 * 销毁 window.siyuan.viewer
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 调用 viewer.destroy() 是同步的 DOM 清理操作，异步化会导致 viewer 在销毁过程中被其他代码访问。 */
export const destroySiyuanViewer = () => {
    window.siyuan?.viewer?.destroy();
};
