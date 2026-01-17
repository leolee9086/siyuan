/**
 * window.environment.types.ts - Window 环境封装的类型定义
 * 
 * @module util/siyuanEnvironments/window.environment.types
 */

/** Window 事件监听器类型 */
export type WindowEventHandler<K extends keyof WindowEventMap> = (event: WindowEventMap[K]) => void;
