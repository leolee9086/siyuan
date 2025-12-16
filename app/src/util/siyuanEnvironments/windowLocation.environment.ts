
/**
 * 封装 window.location 的访问
 * 用于设置和获取 location.hash
 */

/**
 * 设置 window.location.hash
 * @param hash 要设置的 hash 值
 */
export const setLocationHash = (hash: string) => {
    window.location.hash = hash;
};

/**
 * 获取 window.location.hash
 * @returns 当前的 hash 值
 */
export const getLocationHash = () => {
    return window.location.hash;
};

/**
 * 获取 window.innerWidth
 * @returns 窗口内部宽度
 */
export const getWindowInnerWidth = () => {
    return window.innerWidth;
};

/**
 * 获取 window.location.protocol
 * @returns 协议，如 "http:" 或 "https:"
 */
export const getLocationProtocol = () => {
    return window.location.protocol;
};

/**
 * 获取 window.location.host
 * @returns 主机名和端口号，如 "localhost:6806"
 */
export const getLocationHost = () => {
    return window.location.host;
};

/**
 * 重新加载当前页面
 * 封装 window.location.reload()
 */
export const reloadLocation = () => {
    window.location.reload();
};
