/**
 * Electron IPC处理器模块
 *
 * 本模块提供与Electron主进程通信的能力，用于处理需要与桌面应用
 * 交互的场景，如系统退出、窗口关闭等操作。
 *
 * 设计考虑：
 * - 支持Electron和浏览器双环境运行
 * - 在非Electron环境中优雅降级
 * - 提供类型安全的IPC通信接口
 *
 * @module handlers/electronHandler
 * @see {@link app/src/util/fetch.ts} 原始实现参考
 */

// ============================================================================
// 常量定义
// ============================================================================

/**
 * 思源退出IPC通道名称
 *
 * 与 Constants.SIYUAN_QUIT 对应，用于通知Electron主进程执行退出逻辑。
 *
 * @internal
 */
export const SIYUAN_QUIT_CHANNEL = 'siyuan-quit';

/**
 * 发送窗口消息的IPC通道名称
 *
 * 用于向所有窗口广播消息，如关闭按钮行为等。
 *
 * @internal
 */
export const SIYUAN_SEND_WINDOWS_CHANNEL = 'siyuan-send_windows';

/**
 * 需要触发退出处理的API路径列表
 *
 * 当这些API请求失败时，需要通知Electron执行退出逻辑。
 *
 * @internal
 */
export const EXIT_API_PATHS: readonly string[] = [
    '/api/system/exit',
    '/api/system/setWorkspaceDir',
];

/**
 * 可能触发退出处理的API路径（需要额外条件判断）
 *
 * @internal
 */
export const CONDITIONAL_EXIT_API_PATHS: readonly string[] = [
    '/api/system/setUILayout',
];

// ============================================================================
// 类型定义
// ============================================================================

/**
 * IPC发送器接口
 *
 * 抽象Electron的ipcRenderer.send方法，便于测试和非Electron环境适配。
 */
export interface IIPCSender {
    /**
     * 发送IPC消息到主进程
     *
     * @param channel - 通道名称
     * @param args - 消息参数
     */
    send(channel: string, ...args: unknown[]): void;
}

/**
 * 窗口消息数据结构
 *
 * 用于 siyuan-send_windows 通道的消息格式。
 */
export interface IWindowMessage {
    /** 命令类型 */
    cmd: string;
    /** 附加数据 */
    [key: string]: unknown;
}

/** IWindowMessage 的中文别名 */
export type 窗口消息 = IWindowMessage;

// ============================================================================
// 接口定义
// ============================================================================

/**
 * Electron IPC处理器接口
 *
 * 定义了与Electron主进程通信的标准接口。
 * 支持环境检测、IPC消息发送和退出API错误处理。
 *
 * @example
 * ```typescript
 * const handler: IElectronHandler = new ElectronHandler();
 *
 * // 检测环境
 * if (handler.isElectron()) {
 *     // 发送IPC消息
 *     handler.send('siyuan-quit', location.port);
 * }
 *
 * // 处理退出API错误
 * handler.handleExitError('/api/system/exit');
 * ```
 */
export interface IElectronHandler {
    /**
     * 检测是否在Electron环境中
     *
     * 通过检查全局对象中是否存在Electron特有的API来判断。
     *
     * @returns 如果在Electron环境中返回 true，否则返回 false
     *
     * @example
     * ```typescript
     * if (handler.isElectron()) {
     *     // Electron特有逻辑
     * } else {
     *     // 浏览器降级逻辑
     * }
     * ```
     */
    isElectron(): boolean;

    /**
     * 发送IPC消息到主进程
     *
     * 在非Electron环境中调用此方法不会产生任何效果。
     *
     * @param channel - 通道名称，如 'siyuan-quit'
     * @param data - 消息数据
     *
     * @example
     * ```typescript
     * // 通知主进程退出
     * handler.send('siyuan-quit', location.port);
     *
     * // 广播窗口消息
     * handler.send('siyuan-send_windows', { cmd: 'closeButtonBehavior' });
     * ```
     */
    send(channel: string, data: unknown): void;

    /**
     * 处理退出API错误
     *
     * 当退出相关API（如 /api/system/exit）请求失败时，
     * 通知Electron主进程执行退出逻辑。
     *
     * @param url - 请求URL
     * @param port - 当前窗口端口号，用于标识窗口
     * @param errorExit - 可选，是否为错误退出标志（用于条件判断API）
     *
     * @example
     * ```typescript
     * // 处理退出API失败
     * handler.handleExitError('/api/system/exit', '6806');
     *
     * // 处理带条件的API失败
     * handler.handleExitError('/api/system/setUILayout', '6806', true);
     * ```
     */
    handleExitError(url: string, port?: string, errorExit?: boolean): void;

    /**
     * 检查URL是否为退出相关API
     *
     * @param url - 请求URL
     * @param errorExit - 可选，错误退出标志
     * @returns 如果是退出相关API返回 true
     */
    isExitApi(url: string, errorExit?: boolean): boolean;
}

/** IElectronHandler 的中文别名 */
export type Electron处理器接口 = IElectronHandler;

// ============================================================================
// 实现类
// ============================================================================

/**
 * Electron IPC处理器实现
 *
 * 提供与Electron主进程通信的默认实现。
 * 支持依赖注入IPC发送器，便于测试和自定义。
 *
 * @example
 * ```typescript
 * // 使用默认配置
 * const handler = new ElectronHandler();
 *
 * // 注入自定义IPC发送器（用于测试）
 * const mockSender: IIPCSender = { send: jest.fn() };
 * const testHandler = new ElectronHandler(mockSender);
 * ```
 */
export class ElectronHandler implements IElectronHandler {
    /**
     * IPC发送器实例
     * @internal
     */
    private readonly ipcSender: IIPCSender | null;

    /**
     * 创建ElectronHandler实例
     *
     * @param ipcSender - 可选的IPC发送器，用于依赖注入。
     *                    如果不提供，将尝试从全局获取Electron的ipcRenderer。
     */
    constructor(ipcSender?: IIPCSender) {
        this.ipcSender = ipcSender ?? this.getElectronIpcRenderer();
    }

    /**
     * 检测是否在Electron环境中
     *
     * @returns 如果在Electron环境中返回 true
     */
    public isElectron(): boolean {
        return this.ipcSender !== null;
    }

    /**
     * 发送IPC消息到主进程
     *
     * @param channel - 通道名称
     * @param data - 消息数据
     */
    public send(channel: string, data: unknown): void {
        if (!this.ipcSender) {
            // 非Electron环境，静默忽略
            return;
        }
        this.ipcSender.send(channel, data);
    }

    /**
     * 处理退出API错误
     *
     * @param url - 请求URL
     * @param port - 当前窗口端口号
     * @param errorExit - 错误退出标志
     */
    public handleExitError(url: string, port?: string, errorExit?: boolean): void {
        if (!this.isElectron()) {
            return;
        }

        if (this.isExitApi(url, errorExit)) {
            this.send(SIYUAN_QUIT_CHANNEL, port);
        }
    }

    /**
     * 检查URL是否为退出相关API
     *
     * @param url - 请求URL
     * @param errorExit - 错误退出标志
     * @returns 如果是退出相关API返回 true
     */
    public isExitApi(url: string, errorExit?: boolean): boolean {
        // 直接匹配退出API
        if (EXIT_API_PATHS.includes(url)) {
            return true;
        }

        // 条件匹配API（需要errorExit标志）
        if (CONDITIONAL_EXIT_API_PATHS.includes(url) && errorExit) {
            return true;
        }

        return false;
    }

    /**
     * 尝试获取Electron的ipcRenderer
     *
     * @returns IPC发送器或null（非Electron环境）
     * @internal
     */
    private getElectronIpcRenderer(): IIPCSender | null {
        // 检查是否在Electron环境中
        // 注意：此检查需要在运行时进行，因为SDK可能在浏览器中使用
        try {
            // 使用 globalThis 以兼容各种运行环境（Node.js、浏览器、Electron）
            const global = globalThis as unknown as {
                require?: (module: string) => { ipcRenderer?: IIPCSender };
            };

            // 检查全局是否存在 require 函数（Electron 环境特征）
            if (typeof global.require === 'function') {
                // 尝试 require electron 模块
                const electron = global.require('electron');
                if (electron?.ipcRenderer) {
                    return electron.ipcRenderer;
                }
            }
        } catch {
            // 非Electron环境，忽略错误
        }
        return null;
    }
}

/** ElectronHandler 的中文别名 */
export { ElectronHandler as Electron处理器 };

// ============================================================================
// 默认实例导出
// ============================================================================

/**
 * 默认Electron处理器实例
 *
 * 提供一个预创建的处理器实例，自动检测运行环境。
 *
 * @example
 * ```typescript
 * import { electronHandler } from './electronHandler';
 *
 * if (electronHandler.isElectron()) {
 *     electronHandler.handleExitError(url, location.port);
 * }
 * ```
 */
export const electronHandler = new ElectronHandler();

/** electronHandler 的中文别名 */
export { electronHandler as Electron处理器实例 };
