/**
 * search.environment.ts - 配置搜索模块的环境访问封装
 *
 * 意图：封装 document 全局对象访问，避免直接引用
 * 调用时机：search.ts 中需要访问 document 全局对象时使用
 */

/**
 * 获取当前活动元素
 *
 * 作用：安全地访问 document.activeElement
 * 意图：封装全局对象访问，符合 lint 规范
 * 调用时机：需要操作当前焦点元素时调用
 */
/** @同步豁免: 需要绝对同步的DOM访问 */
export const getActiveElement = () => {
    return document.activeElement;
};
