/**
 * 封装 window.webkit
 * @returns window.webkit
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 读取 window.webkit 原生桥接对象，异步化会导致桥接对象在异步间隙被回收。 */
export const getWindowWebkit = () => {
    return window.webkit;
};

/**
 * 封装 window.JSAndroid
 * @returns window.JSAndroid
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 读取 window.JSAndroid 原生桥接对象，调用方在同步上下文中判断桥接可用性。 */
export const getWindowJSAndroid = () => {
    return window.JSAndroid;
};

/**
 * 封装 window.JSHarmony
 * @returns window.JSHarmony
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 读取 window.JSHarmony 原生桥接对象，调用方在同步上下文中判断桥接可用性。 */
export const getWindowJSHarmony = () => {
    return window.JSHarmony;
};
