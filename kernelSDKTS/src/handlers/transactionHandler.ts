/**
 * 事务API错误处理器模块
 *
 * 本模块提供事务API（/api/transactions）网络请求失败时的错误处理能力。
 * 当事务API发生网络错误或JSON解析错误时，需要触发内核错误处理流程，
 * 以便用户确认是否需要重启内核或重传数据。
 *
 * @module handlers/transactionHandler
 * @see {@link app/src/util/fetch.ts} 原始实现参考
 */

// ============================================================================
// 常量定义
// ============================================================================

/**
 * 事务API路径
 * @internal
 */
export const TRANSACTION_API_PATH = '/api/transactions';

/**
 * 需要触发内核错误的错误消息列表
 *
 * 这些错误消息表示网络请求失败或响应解析失败，
 * 需要触发内核错误处理流程。
 *
 * @internal
 */
export const KERNEL_ERROR_MESSAGES: readonly string[] = [
    'Failed to fetch',
    'Unexpected end of JSON input',
];

// ============================================================================
// 接口定义
// ============================================================================

/**
 * 事务API错误处理器接口
 *
 * 定义了处理事务API网络请求失败时的标准接口。
 * 当事务API请求失败时，需要调用 kernelError 函数通知用户
 * 内核通信异常，可能需要重启或重传数据。
 *
 * @example
 * ```typescript
 * const handler: ITransactionHandler = new TransactionHandler();
 *
 * // 在 fetch 错误处理中使用
 * try {
 *     await fetch('/api/transactions', { ... });
 * } catch (error) {
 *     handler.handleTransactionError(
 *         '/api/transactions',
 *         error as Error,
 *         () => showKernelErrorDialog()
 *     );
 * }
 * ```
 */
export interface ITransactionHandler {
    /**
     * 处理事务API错误
     *
     * 当事务API网络请求失败时调用此方法。
     * 如果错误消息匹配预定义的内核错误消息列表，
     * 则调用 kernelErrorFn 触发内核错误处理流程。
     *
     * @param url - 请求URL，用于判断是否为事务API
     * @param error - 错误对象，包含错误消息
     * @param kernelErrorFn - 内核错误回调函数，可选。
     *                        在 SDK 环境中，此函数由调用者提供；
     *                        在思源前端环境中，此函数为 kernelError()
     *
     * @example
     * ```typescript
     * handler.handleTransactionError(
     *     '/api/transactions',
     *     new Error('Failed to fetch'),
     *     () => {
     *         // 显示内核错误对话框
     *         showDialog({ title: '内核通信异常' });
     *     }
     * );
     * ```
     */
    handleTransactionError(
        url: string,
        error: Error,
        kernelErrorFn?: (msg?: string) => void
    ): void;

    /**
     * 检查是否为事务API
     *
     * @param url - 请求URL
     * @returns 如果URL为事务API路径则返回 true
     */
    isTransactionApi(url: string): boolean;

    /**
     * 检查错误是否需要触发内核错误处理
     *
     * @param error - 错误对象
     * @returns 如果错误消息匹配内核错误消息列表则返回 true
     */
    shouldTriggerKernelError(error: Error): boolean;
}

/** ITransactionHandler 的中文别名 */
export type 事务处理器接口 = ITransactionHandler;

// ============================================================================
// 实现类
// ============================================================================

/**
 * 事务API错误处理器实现
 *
 * 提供事务API错误处理的默认实现。
 * 此类是无状态的，可以安全地作为单例使用。
 *
 * @example
 * ```typescript
 * // 创建处理器实例
 * const handler = new TransactionHandler();
 *
 * // 或使用默认导出的单例
 * import { transactionHandler } from './transactionHandler';
 * ```
 */
export class TransactionHandler implements ITransactionHandler {
    /**
     * 处理事务API错误
     *
     * @param url - 请求URL
     * @param error - 错误对象
     * @param kernelErrorFn - 内核错误回调函数
     */
    public handleTransactionError(
        url: string,
        error: Error,
        kernelErrorFn?: (msg?: string) => void
    ): void {
        // 仅处理事务API的错误
        if (!this.isTransactionApi(url)) {
            return;
        }

        // 检查是否需要触发内核错误
        if (this.shouldTriggerKernelError(error)) {
            // 调用内核错误回调（如果提供）
            kernelErrorFn?.(error.message);
        }
    }

    /**
     * 检查是否为事务API
     *
     * @param url - 请求URL
     * @returns 如果URL为事务API路径则返回 true
     */
    public isTransactionApi(url: string): boolean {
        return url === TRANSACTION_API_PATH;
    }

    /**
     * 检查错误是否需要触发内核错误处理
     *
     * 匹配以下错误消息：
     * - "Failed to fetch": 网络请求失败
     * - "Unexpected end of JSON input": JSON解析失败
     *
     * @param error - 错误对象
     * @returns 如果错误消息匹配内核错误消息列表则返回 true
     */
    public shouldTriggerKernelError(error: Error): boolean {
        return KERNEL_ERROR_MESSAGES.includes(error.message);
    }
}

/** TransactionHandler 的中文别名 */
export { TransactionHandler as 事务处理器 };

// ============================================================================
// 默认实例导出
// ============================================================================

/**
 * 默认事务处理器实例
 *
 * 提供一个预创建的处理器实例，适用于大多数场景。
 * 由于 TransactionHandler 是无状态的，使用单例可以减少内存分配。
 *
 * @example
 * ```typescript
 * import { transactionHandler } from './transactionHandler';
 *
 * transactionHandler.handleTransactionError(url, error, kernelErrorFn);
 * ```
 */
export const transactionHandler = new TransactionHandler();

/** transactionHandler 的中文别名 */
export { transactionHandler as 事务处理器实例 };
