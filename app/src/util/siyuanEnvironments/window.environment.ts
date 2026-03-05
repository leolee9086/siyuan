/**
 * window.environment.ts - Window 对象访问封装
 * 
 * 封装对全局 window 对象的访问，符合架构规范。
 * 提供具体、细粒度的访问方法，而不是暴露整个 window/document 对象。
 * 
 * @module util/siyuanEnvironments/window.environment
 */

/**
 * 用途：导入窗口事件处理函数的类型定义
 * 使用范围：本模块所有事件监听封装函数的类型约束
 * 解耦评估：类型导入无法解耦，这是TypeScript类型系统的必需依赖
 */
import type { WindowEventHandler } from "./window.environment.types";

// ============ 事件监听封装 ============

/**
 * 添加全局窗口事件监听
 * 
 * 封装 window.addEventListener，用于需要监听全局事件的场景。
 * @AIDONE: 提供具体的事件监听封装，替代直接暴露 window 对象
 * 
 * @param type 事件类型
 * @param handler 事件处理函数
 * @param options 事件选项
 */
export function 添加窗口事件监听<K extends keyof WindowEventMap>(
    type: K,
    handler: WindowEventHandler<K>,
    options?: boolean | AddEventListenerOptions
): void {
    window.addEventListener(type, handler, options);
}

/**
 * 移除全局窗口事件监听
 * 
 * 封装 window.removeEventListener，用于清理事件监听。
 * @AIDONE: 提供具体的事件监听封装，替代直接暴露 window 对象
 * 
 * @param type 事件类型
 * @param handler 事件处理函数  
 * @param options 事件选项
 */
export function 移除窗口事件监听<K extends keyof WindowEventMap>(
    type: K,
    handler: WindowEventHandler<K>,
    options?: boolean | EventListenerOptions
): void {
    window.removeEventListener(type, handler, options);
}

// ============ 导航封装 ============

/**
 * 在新窗口/标签页中打开指定 URL。
 *
 * 作用：封装 window.open，避免直接访问 window 全局对象
 * 意图：替代散落在各处的 window.open 调用，统一管控
 * 调用时机：浏览器环境下需要打开外部链接时
 */
/** @同步豁免: 需要绝对同步的DOM访问 - window.open 是同步 DOM API */
export function openInNewWindow(url: string): void {
    window.open(url);
}

/**
 * 重新加载当前页面
 *
 * 作用：封装 window.location.reload，避免直接访问 window 全局对象
 * 意图：统一管理页面重载操作，便于追踪和调试
 * 调用时机：需要强制刷新页面时（如脚本加载失败需要重试）
 */
/** @同步豁免: 需要绝对同步的DOM访问 - window.location.reload 是同步 DOM API */
export function reloadWindow(): void {
    window.location.reload();
}

