/**
 * dock.environment.ts - Dock 模块的环境封装
 * 封装所有 window 访问以符合 no-restricted-globals 规则
 */

// ============ 思源核心对象访问 ============

/**
 * 获取思源国际化语言对象
 */
export const getSiyuanLanguages = () => window.siyuan?.languages;

/**
 * 获取思源配置对象
 */
export const getSiyuanConfig = () => window.siyuan?.config;

/**
 * 获取思源布局对象
 */
export const getSiyuanLayout = () => window.siyuan?.layout;


/**
 * 获取并递增思源 zIndex
 */
export const incrementSiyuanZIndex = (): number => ++window.siyuan.zIndex;

/**
 * 获取思源 Storage 对象
 */
export const getSiyuanStorage = () => window.siyuan?.storage;


// ============ 窗口尺寸 ============

/**
 * 获取窗口内部宽度
 */
export const getWindowInnerWidth = (): number => window.innerWidth;

/**
 * 获取窗口内部高度
 */
export const getWindowInnerHeight = (): number => window.innerHeight;

// ============ 定时器 (复用现有封装) ============

/**
 * 封装 window.setTimeout
 */
export const setWindowTimeout = (callback: () => void, ms?: number): number => {
    return window.setTimeout(callback, ms);
};


/**
 * 封装 window.clearTimeout
 */
export const clearWindowTimeout = (timeoutId?: number): void => {
    window.clearTimeout(timeoutId);
};

/**
 * 封装 window.setInterval
 */
export const setWindowInterval = (callback: () => void, ms?: number): number => {
    return window.setInterval(callback, ms);
};

/**
 * 封装 window.clearInterval
 */
export const clearWindowInterval = (intervalId?: number): void => {
    window.clearInterval(intervalId);
};
