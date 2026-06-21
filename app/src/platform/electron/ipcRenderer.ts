/**
 * Electron ipcRenderer 适配层
 *
 * 封装 ipcRenderer 的延迟加载，避免模块顶层静态导入 electron。
 * 非 Electron 环境调用直接抛出错误。
 *
 * @module platform/electron/ipcRenderer
 */

import { isElectron } from "../index";
import type { IpcListener } from "./electron.types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _ipcRenderer: any = null;

/**
 * 获取缓存的 ipcRenderer 实例。
 *
 * 作用：延迟加载 electron 模块并缓存引用，避免在非 Electron 环境中导入失败
 * 意图：适配层的核心——将静态导入转为运行时按需加载
 * 调用时机：每个 ipc* 函数内部调用
 *
 * @returns electron.ipcRenderer 实例
 * @throws 非 Electron 环境下抛出错误
 */
/** @同步豁免: 模块缓存访问，require 是同步 API，无法异步化 */
function getIpcRenderer() {
    if (_ipcRenderer) {
        return _ipcRenderer;
    }
    if (!isElectron) {
        throw new Error("ipcRenderer is not available in browser environment");
    }
    _ipcRenderer = __non_webpack_require__("electron").ipcRenderer;
    return _ipcRenderer;
}

/**
 * 向主进程发送异步消息（fire-and-forget）。
 *
 * 作用：封装 ipcRenderer.send，非 Electron 环境抛出错误
 * 意图：替代桌面端条件分支中的 ipcRenderer.send 调用
 * 调用时机：需要向主进程发送单向消息时
 */
/** @同步豁免: 遗留代码 - 封装 Electron ipcRenderer.send 同步 fire-and-forget API */
export function ipcSend(channel: string, ...args: unknown[]): void {
    getIpcRenderer().send(channel, ...args);
}

/**
 * 向主进程发送消息并等待异步响应。
 *
 * 作用：封装 ipcRenderer.invoke，非 Electron 环境抛出错误
 * 意图：替代桌面端条件分支中的 ipcRenderer.invoke 调用
 * 调用时机：需要从主进程获取返回值时
 */
export async function ipcInvoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
    return getIpcRenderer().invoke(channel, ...args);
}

/**
 * 向主进程发送同步消息并阻塞等待响应。
 *
 * 作用：封装 ipcRenderer.sendSync，非 Electron 环境抛出错误
 * 意图：替代桌面端条件分支中的 ipcRenderer.sendSync 调用
 * 调用时机：需要同步获取主进程响应时（如对话框）
 */
/** @同步豁免: 遗留代码 - 封装 Electron ipcRenderer.sendSync 阻塞式 API，语义上必须同步 */
export function ipcSendSync(channel: string, ...args: unknown[]): unknown {
    return getIpcRenderer().sendSync(channel, ...args);
}

/**
 * 监听主进程发来的消息。
 *
 * 作用：封装 ipcRenderer.on 的延迟加载
 * 意图：替代桌面端条件分支中的 ipcRenderer.on 调用
 * 调用时机：应用启动时注册 IPC 事件监听（仅 Electron 环境）
 *
 * @returns 清理函数，调用后移除监听
 * @throws 非 Electron 环境下抛出错误
 */
/** @同步豁免: 遗留代码 - 事件监听器注册是同步模式，返回同步清理函数 */
export function ipcOn(channel: string, listener: IpcListener): () => void {
    const ipc = getIpcRenderer();
    ipc.on(channel, listener);
    return () => {
        ipc.removeListener(channel, listener);
    };
}
