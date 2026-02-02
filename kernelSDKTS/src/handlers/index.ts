/**
 * 处理器模块统一导出
 *
 * 本模块汇总导出所有处理器相关的类型、接口和实现，
 * 提供统一的导入入口。
 *
 * @module handlers
 *
 * @example
 * ```typescript
 * // 导入所有处理器
 * import {
 *     transactionHandler,
 *     electronHandler,
 *     ITransactionHandler,
 *     IElectronHandler,
 * } from './handlers';
 *
 * // 使用事务处理器
 * transactionHandler.handleTransactionError(url, error, kernelErrorFn);
 *
 * // 使用Electron处理器
 * if (electronHandler.isElectron()) {
 *     electronHandler.handleExitError(url, port);
 * }
 * ```
 */

// ============================================================================
// 事务处理器导出
// ============================================================================

// 类型导出（使用 export type 以兼容 isolatedModules）
export type {
    ITransactionHandler,
    事务处理器接口,
} from './transactionHandler';

// 值导出（类、实例、常量）
export {
    TransactionHandler,
    事务处理器,
    transactionHandler,
    事务处理器实例,
    TRANSACTION_API_PATH,
    KERNEL_ERROR_MESSAGES,
} from './transactionHandler';

// ============================================================================
// Electron处理器导出
// ============================================================================

// 类型导出
export type {
    IElectronHandler,
    Electron处理器接口,
    IIPCSender,
    IWindowMessage,
    窗口消息,
} from './electronHandler';

// 值导出
export {
    ElectronHandler,
    Electron处理器,
    electronHandler,
    Electron处理器实例,
    SIYUAN_QUIT_CHANNEL,
    SIYUAN_SEND_WINDOWS_CHANNEL,
    EXIT_API_PATHS,
    CONDITIONAL_EXIT_API_PATHS,
} from './electronHandler';

// ============================================================================
// 消息处理器导出
// ============================================================================

// 类型导出
export type {
    IMessageHandler,
    消息处理器接口,
    IMessageConfig,
    消息配置,
    IApiResponse,
    API响应,
    MessageType,
    消息类型,
} from './messageHandler';

// 值导出
export {
    MessageHandler,
    消息处理器,
    messageHandler,
    消息处理器实例,
    ERROR_CODE,
    INFO_CODE,
    DEFAULT_MESSAGE_TIMEOUT,
} from './messageHandler';

// ============================================================================
// 响应验证器导出
// ============================================================================

// 类型导出
export type {
    IResponseValidatorService,
    响应验证器服务接口,
    IValidationResult,
    验证结果,
} from './responseValidator';

// 值导出
export {
    ResponseValidator,
    响应验证器,
    responseValidator,
    响应验证器实例,
    // 错误码常量
    ERROR_CODE_FORBIDDEN,
    ERROR_CODE_NOT_FOUND,
    ERROR_CODE_NETWORK,
    ERROR_CODE_VALIDATION,
    禁止访问错误码,
    资源不存在错误码,
    网络错误码,
    验证错误码,
    // 验证错误消息
    VALIDATION_ERROR_MESSAGES,
    验证错误消息,
    // 错误响应工厂函数
    createForbiddenResponse,
    创建禁止访问响应,
    createNotFoundResponse,
    创建资源不存在响应,
    createNetworkErrorResponse,
    创建网络错误响应,
    createHttpErrorResponse,
    创建HTTP错误响应,
} from './responseValidator';
