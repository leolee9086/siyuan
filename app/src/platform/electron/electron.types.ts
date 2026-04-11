/**
 * Electron 适配层类型定义
 *
 * 定义适配层内部使用的类型，避免业务代码直接依赖 electron 类型。
 */

/**
 * IPC 事件监听器函数签名。
 *
 * 用途：ipcOn 注册的回调函数类型
 * 使用场景：监听主进程发来的消息时使用
 * 关联类型：对应 Electron IpcRendererEvent 的简化版本
 */
export type IpcListener = (event: unknown, ...args: unknown[]) => void;
