
/**
 * 获取配置项的工具函数
 * @param path 配置项的路径，例如 "editor.fontSize" 或 "appearance.themeDark"
 * @returns 返回配置内容
 */
export const getSiyuanConfig = () => {
    if (!window.siyuan?.config) {
        throw ("[getConfig] window.siyuan.config 不存在");
    }
    return window.siyuan.config;
};

/**
 * 获取配置项的工具函数
 * @returns 如果存在则返回对应的值，否则返回 undefined
 */
export const getSiyuanUser = () => {
    if (!window.siyuan?.user) {
        throw ("[getConfig] window.siyuan.config 不存在");
    }
    return window.siyuan.user;
};

/**
 * 获取配置项的工具函数
 * @returns 如果存在则返回对应的值，否则返回 undefined
 */
export const getSiyuanStorage = () => {
    if (!window.siyuan?.storage) {
        throw ("[getConfig] window.siyuan.storage 不存在");
    }
    return window.siyuan.storage;
};

/**
 * 获取 window.siyuan.layout
 * @returns layout 对象
 */
export const getSiyuanLayout = () => {
    if (!window.siyuan?.layout) {
        throw ("[getSiyuanLayout] window.siyuan.layout 不存在");
    }
    return window.siyuan.layout;
};

/**
 * 设置 window.siyuan.emojis
 * @param emojis emoji 列表
 */
export const setSiyuanEmojis = (emojis: IEmoji[]) => {
    window.siyuan.emojis = emojis;
};

/**
 * 设置 window.siyuan.layout.centerLayout
 * @param layout layout 对象 (使用 unknown 类型避免循环依赖)
 */
export const setSiyuanLayoutCenterLayout = (layout: unknown) => {
    if (!window.siyuan?.layout) {
        throw ("[setSiyuanLayoutCenterLayout] window.siyuan.layout 不存在");
    }
    window.siyuan.layout.centerLayout = layout as NonNullable<typeof window.siyuan.layout.centerLayout>;
};

/**
 * 获取 window.siyuan.backStack
 * @returns backStack 列表
 */
export const getSiyuanBackStack = () => {
    return window.siyuan?.backStack || [];
};

