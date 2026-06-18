/**
 * dock.environment.ts - Dock 模块的环境封装
 * 封装所有 window 访问以符合 no-restricted-globals 规则
 */

// ============ 思源核心对象访问 ============

/**
 * 获取思源国际化语言对象
 * @同步豁免: 生命周期 — 环境层同步读取全局语言对象
 */
export const getSiyuanLanguages = () => window.siyuan?.languages;

/**
 * 获取思源配置对象
 * @同步豁免: 生命周期 — 环境层同步读取全局配置
 */
export const getSiyuanConfig = () => window.siyuan?.config;

/**
 * 获取思源布局对象
 * @同步豁免: 生命周期 — 环境层同步读取全局布局
 */
export const getSiyuanLayout = () => window.siyuan?.layout;

/**
 * 获取并递增思源 zIndex
 * @同步豁免: 生命周期 — 环境层同步操作全局 zIndex
 */
export const incrementSiyuanZIndex = () => ++window.siyuan.zIndex;

/**
 * 获取思源 Storage 对象
 * @同步豁免: 生命周期 — 环境层同步读取全局存储
 */
export const getSiyuanStorage = () => window.siyuan?.storage;

// ============ 窗口尺寸 ============

/**
 * 获取窗口内部宽度
 * @同步豁免: 生命周期 — 环境层同步读取窗口尺寸
 */
export const getWindowInnerWidth = () => window.innerWidth;

/**
 * 获取窗口内部高度
 * @同步豁免: 生命周期 — 环境层同步读取窗口尺寸
 */
export const getWindowInnerHeight = () => window.innerHeight;

// ============ 定时器 (复用现有封装) ============

/**
 * 封装 window.setTimeout
 * @同步豁免: 生命周期 — 环境层封装定时器接口
 */
// @柯里化
export const setWindowTimeout = (callback: () => void, ms?: number) => {
    // @setTimeout豁免: 环境层封装 - 提供统一的 setTimeout 接口供 dock 模块使用
    return window.setTimeout(callback, ms);
};

/**
 * 封装 window.clearTimeout
 * @同步豁免: 生命周期 — 环境层封装定时器接口
 */
// @柯里化
export const clearWindowTimeout = (timeoutId?: number) => {
    window.clearTimeout(timeoutId);
};

/**
 * 封装 window.setInterval
 * @同步豁免: 生命周期 — 环境层封装定时器接口
 */
// @柯里化
export const setWindowInterval = (callback: () => void, ms?: number) => {
    // @setInterval豁免: 环境层封装 - 提供统一的 setInterval 接口供 dock 模块使用
    return window.setInterval(callback, ms);
};

/**
 * 封装 window.clearInterval
 * @同步豁免: 生命周期 — 环境层封装定时器接口
 */
// @柯里化
export const clearWindowInterval = (intervalId?: number) => {
    window.clearInterval(intervalId);
};
