
/**
 * 封装 window.matchMedia
 * @param query 媒体查询字符串
 * @returns MediaQueryList
 */
export const windowMatchMedia = (query: string) => {
    return window.matchMedia(query);
};

/**
 * 获取 window.destroyTheme
 * @returns destroyTheme 函数
 */
export const getWindowDestroyTheme = () => {
    return window.destroyTheme;
};

/**
 * 设置 window.destroyTheme
 * @param func destroyTheme 函数
 */
export const setWindowDestroyTheme = (func: (() => Promise<void>) | undefined) => {
    (window as any).destroyTheme = func;
};
