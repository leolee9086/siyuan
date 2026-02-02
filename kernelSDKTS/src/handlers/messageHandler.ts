/**
 * 消息处理器模块
 *
 * 本模块提供API响应消息的处理功能，用于展示错误和提示消息。
 * 设计为可扩展的接口，支持自定义消息显示函数以集成不同的UI框架。
 *
 * @module handlers/messageHandler
 *
 * @example
 * ```typescript
 * // 使用默认消息处理器
 * import { messageHandler } from './handlers';
 *
 * const response = { code: -1, msg: '操作失败', data: { closeTimeout: 3000 } };
 * messageHandler.processMessage(response);
 *
 * // 使用自定义消息显示函数
 * const customHandler = new MessageHandler({
 *     showMessageFn: (msg, timeout, type) => {
 *         // 自定义UI显示逻辑
 *         return 'custom-id';
 *     },
 *     hideMessageFn: (id) => {
 *         // 自定义隐藏逻辑
 *     }
 * });
 * ```
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 消息类型枚举
 *
 * 定义消息的显示类型，用于区分不同级别的消息展示样式。
 */
export type MessageType = 'info' | 'error';

/**
 * 消息类型枚举（中文别名）
 */
export type 消息类型 = MessageType;

/**
 * API响应消息结构
 *
 * 定义processMessage方法接收的响应对象结构。
 */
export interface IApiResponse {
    /**
     * 响应状态码
     * - 0: 正常操作
     * - -1: 错误消息
     * - -2: 提示消息
     * - 其他负数: 其他提示类型
     * - 正数: 需要业务层处理的错误
     */
    code: number;

    /**
     * 消息内容
     */
    msg?: string;

    /**
     * 响应数据
     */
    data?: {
        /**
         * 消息自动关闭超时时间（毫秒）
         * 0 表示不自动关闭
         */
        closeTimeout?: number;
    };
}

/**
 * API响应消息结构（中文别名）
 */
export type API响应 = IApiResponse;

/**
 * 消息配置接口
 *
 * 用于配置消息处理行为，支持自定义消息显示和隐藏函数。
 */
export interface IMessageConfig {
    /**
     * 是否处理消息
     * @default true
     */
    processMessage?: boolean;

    /**
     * 是否显示错误消息（code === -1）
     * @default true
     */
    showErrorMessage?: boolean;

    /**
     * 是否显示提示消息（code === -2 或其他负数）
     * @default true
     */
    showInfoMessage?: boolean;

    /**
     * 自定义显示消息函数
     *
     * @param msg - 消息内容
     * @param timeout - 超时时间（毫秒），0表示不自动关闭
     * @param type - 消息类型
     * @returns 消息ID，用于后续隐藏消息
     */
    showMessageFn?: (msg: string, timeout?: number, type?: MessageType) => string;

    /**
     * 自定义隐藏消息函数
     *
     * @param id - 消息ID
     */
    hideMessageFn?: (id: string) => void;
}

/**
 * 消息配置接口（中文别名）
 */
export type 消息配置 = IMessageConfig;

/**
 * 消息处理器接口
 *
 * 定义消息处理器的核心方法，用于处理API响应中的消息展示。
 */
export interface IMessageHandler {
    /**
     * 处理API响应消息
     *
     * 根据响应的code值决定是否显示消息：
     * - code === -1: 显示错误消息
     * - code === -2 或其他负数: 显示提示消息
     * - code >= 0: 不处理，返回true表示业务层可继续处理
     *
     * @param response - API响应对象
     * @param config - 消息配置，可覆盖默认行为
     * @returns 是否应该继续处理响应（true表示业务层可继续处理）
     *
     * @example
     * ```typescript
     * const response = await fetch('/api/some-endpoint');
     * const data = await response.json();
     *
     * // 如果返回false，说明消息已被处理，业务层不需要继续处理
     * if (!messageHandler.processMessage(data)) {
     *     return;
     * }
     *
     * // 继续业务逻辑处理
     * handleBusinessLogic(data);
     * ```
     */
    processMessage(response: IApiResponse, config?: IMessageConfig): boolean;

    /**
     * 显示消息
     *
     * @param msg - 消息内容
     * @param timeout - 超时时间（毫秒），默认0表示不自动关闭
     * @param type - 消息类型，默认'info'
     * @returns 消息ID，用于后续调用hideMessage隐藏
     *
     * @example
     * ```typescript
     * // 显示一个3秒后自动关闭的错误消息
     * const id = messageHandler.showMessage('操作失败', 3000, 'error');
     *
     * // 显示一个不自动关闭的提示消息
     * const infoId = messageHandler.showMessage('请稍候...', 0, 'info');
     * // 稍后手动关闭
     * messageHandler.hideMessage(infoId);
     * ```
     */
    showMessage(msg: string, timeout?: number, type?: MessageType): string;

    /**
     * 隐藏消息
     *
     * @param id - 消息ID，由showMessage返回
     *
     * @example
     * ```typescript
     * const id = messageHandler.showMessage('加载中...');
     * // 操作完成后隐藏
     * messageHandler.hideMessage(id);
     * ```
     */
    hideMessage(id: string): void;
}

/**
 * 消息处理器接口（中文别名）
 */
export type 消息处理器接口 = IMessageHandler;

// ============================================================================
// 常量定义
// ============================================================================

/**
 * 错误消息响应码
 */
export const ERROR_CODE = -1;

/**
 * 提示消息响应码
 */
export const INFO_CODE = -2;

/**
 * 默认消息超时时间（毫秒）
 */
export const DEFAULT_MESSAGE_TIMEOUT = 0;

// ============================================================================
// 默认实现
// ============================================================================

/**
 * 生成唯一消息ID
 *
 * @returns 唯一的消息ID字符串
 */
const generateMessageId = (): string => {
    return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * 默认的消息显示函数
 *
 * 使用console输出消息，作为没有UI框架时的后备方案。
 *
 * @param msg - 消息内容
 * @param timeout - 超时时间（毫秒）
 * @param type - 消息类型
 * @returns 消息ID
 */
const defaultShowMessage = (msg: string, timeout?: number, type?: MessageType): string => {
    const id = generateMessageId();
    const prefix = type === 'error' ? '[ERROR]' : '[INFO]';
    const timeoutInfo = timeout ? ` (auto-close in ${timeout}ms)` : '';

    if (type === 'error') {
        console.error(`${prefix} ${msg}${timeoutInfo}`);
    } else {
        console.log(`${prefix} ${msg}${timeoutInfo}`);
    }

    return id;
};

/**
 * 默认的消息隐藏函数
 *
 * 控制台输出无法真正"隐藏"，此函数仅作为接口实现的占位。
 *
 * @param id - 消息ID
 */
const defaultHideMessage = (id: string): void => {
    // 控制台消息无法隐藏，仅记录日志
    console.log(`[MESSAGE] Hidden: ${id}`);
};

// ============================================================================
// 消息处理器实现
// ============================================================================

/**
 * 消息处理器类
 *
 * 实现IMessageHandler接口，提供API响应消息的处理功能。
 * 支持自定义消息显示和隐藏函数，以便集成不同的UI框架。
 *
 * @example
 * ```typescript
 * // 创建使用思源笔记UI的消息处理器
 * import { showMessage, hideMessage } from 'siyuan';
 *
 * const handler = new MessageHandler({
 *     showMessageFn: showMessage,
 *     hideMessageFn: hideMessage
 * });
 *
 * // 处理API响应
 * const response = await fetchSyncPost('/api/block/getBlockInfo', { id: blockId });
 * if (handler.processMessage(response)) {
 *     // 继续处理业务逻辑
 * }
 * ```
 */
export class MessageHandler implements IMessageHandler {
    /**
     * 显示消息函数
     */
    private readonly showMessageFn: (msg: string, timeout?: number, type?: MessageType) => string;

    /**
     * 隐藏消息函数
     */
    private readonly hideMessageFn: (id: string) => void;

    /**
     * 创建消息处理器实例
     *
     * @param config - 可选的配置对象，用于自定义消息显示和隐藏函数
     *
     * @example
     * ```typescript
     * // 使用默认配置（console输出）
     * const defaultHandler = new MessageHandler();
     *
     * // 使用自定义UI函数
     * const customHandler = new MessageHandler({
     *     showMessageFn: myShowMessage,
     *     hideMessageFn: myHideMessage
     * });
     * ```
     */
    constructor(config?: IMessageConfig) {
        this.showMessageFn = config?.showMessageFn ?? defaultShowMessage;
        this.hideMessageFn = config?.hideMessageFn ?? defaultHideMessage;
    }

    /**
     * 处理API响应消息
     *
     * 实现消息处理的核心逻辑：
     * - code === -1: 显示错误消息
     * - code < 0 且 code !== -1: 显示提示消息
     * - code >= 0: 不处理消息，返回true
     *
     * @param response - API响应对象
     * @param config - 可选的消息配置
     * @returns 是否应该继续处理响应
     */
    processMessage(response: IApiResponse, config?: IMessageConfig): boolean {
        // 如果配置禁用消息处理，直接返回true
        if (config?.processMessage === false) {
            return true;
        }

        // code >= 0 表示正常响应或需要业务层处理的错误
        if (response.code >= 0) {
            return true;
        }

        // 获取消息内容和超时时间
        const msg = response.msg ?? '';
        const timeout = response.data?.closeTimeout ?? DEFAULT_MESSAGE_TIMEOUT;

        // 确定消息类型
        const isError = response.code === ERROR_CODE;
        const messageType: MessageType = isError ? 'error' : 'info';

        // 根据配置决定是否显示消息
        if (isError && config?.showErrorMessage === false) {
            return false;
        }

        if (!isError && config?.showInfoMessage === false) {
            return false;
        }

        // 使用配置中的自定义函数或实例的默认函数
        const showFn = config?.showMessageFn ?? this.showMessageFn;
        showFn(msg, timeout, messageType);

        // 返回false表示消息已处理，业务层不需要继续处理
        return false;
    }

    /**
     * 显示消息
     *
     * @param msg - 消息内容
     * @param timeout - 超时时间（毫秒）
     * @param type - 消息类型
     * @returns 消息ID
     */
    showMessage(msg: string, timeout?: number, type?: MessageType): string {
        return this.showMessageFn(msg, timeout ?? DEFAULT_MESSAGE_TIMEOUT, type ?? 'info');
    }

    /**
     * 隐藏消息
     *
     * @param id - 消息ID
     */
    hideMessage(id: string): void {
        this.hideMessageFn(id);
    }
}

/**
 * 消息处理器类（中文别名）
 */
export const 消息处理器 = MessageHandler;

// ============================================================================
// 默认实例导出
// ============================================================================

/**
 * 默认消息处理器实例
 *
 * 使用console作为后备方案的默认实例。
 * 在集成思源笔记UI时，应创建新实例并传入自定义的showMessage和hideMessage函数。
 *
 * @example
 * ```typescript
 * import { messageHandler } from './handlers';
 *
 * // 使用默认实例处理消息
 * const response = { code: -1, msg: '错误信息' };
 * messageHandler.processMessage(response);
 * ```
 */
export const messageHandler = new MessageHandler();

/**
 * 默认消息处理器实例（中文别名）
 */
export const 消息处理器实例 = messageHandler;
