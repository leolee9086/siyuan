
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

/**
 * 获取 window.location.href
 * @returns 当前完整 URL
 */
export const getLocationHref = () => {
    return window.location.href;
};

/**
 * 设置 window.location.href（导航到新页面）
 * @param href 目标 URL
 */
export const setLocationHref = (href: string) => {
    window.location.href = href;
};

/**
 * 获取 window.location.search
 * @returns URL 查询字符串，如 "?id=123&focus=1"
 */
export const getLocationSearch = () => {
    return window.location.search;
};

/**
 * 获取 window.location.origin
 * @returns 源，如 "https://example.com:8080"
 */
export const getLocationOrigin = () => {
    return window.location.origin;
};
