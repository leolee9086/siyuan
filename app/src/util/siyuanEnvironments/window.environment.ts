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
 * 向当前窗口派发自定义事件。
 *
 * 作用：封装 `window.dispatchEvent`，统一窗口级自定义事件发送入口。
 * 意图：避免业务文件直接访问 `window`，符合环境层封装约束。
 * 调用时机：需要在主窗口广播自定义事件时。
 */
/** @同步豁免: 需要绝对同步的DOM访问 - dispatchEvent 为同步 DOM API */
export function dispatchWindowCustomEvent<TDetail>(type: string, detail: TDetail) {
    window.dispatchEvent(new CustomEvent(type, { detail }));
}

/**
 * 向指定事件目标派发自定义事件。
 *
 * 作用：封装 `EventTarget.dispatchEvent`，用于 iframe 窗口等目标的事件广播。
 * 意图：统一事件派发写法，减少业务侧重复样板代码。
 * 调用时机：需要向非当前窗口事件目标发送自定义事件时。
 */
/** @同步豁免: 需要绝对同步的DOM访问 - dispatchEvent 为同步 DOM API */
export function dispatchCustomEvent<TDetail>(target: EventTarget, type: string, detail: TDetail): void {
    target.dispatchEvent(new CustomEvent(type, { detail }));
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

