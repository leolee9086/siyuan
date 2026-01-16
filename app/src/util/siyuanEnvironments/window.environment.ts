/**
 * window.environment.ts - Window 对象访问封装
 * 
 * 封装对全局 window 对象的访问，符合架构规范
 * 用于需要直接操作 window 对象的场景（如事件监听）
 */

/**
 * 获取全局 Window 对象
 * 
 * 用于需要操作 window 对象本身的场景，如：
 * - 添加/移除全局事件监听
 * - 访问 window 级别的 API
 * 
 * @returns Window 对象
 */
export function getGlobalWindow(): Window & typeof globalThis {
    return window;
}

/**
 * 获取 Document 对象
 * 
 * 用于需要操作 document 对象的场景
 * 
 * @returns Document 对象
 */
export function getDocument(): Document {
    return document;
}

// 中文别名
export const 获取全局窗口 = getGlobalWindow;
export const 获取文档 = getDocument;
