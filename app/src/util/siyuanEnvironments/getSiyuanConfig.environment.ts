
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

