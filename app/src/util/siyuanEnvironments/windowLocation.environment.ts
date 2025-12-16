
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
