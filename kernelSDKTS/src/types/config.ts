/**
 * SDK 配置相关类型定义
 *
 * 本文件定义了 SDK 的可配置项接口，将 fetchPost 中的硬编码逻辑抽象为可配置项。
 * 支持全局配置、实例配置和单次请求配置三层覆盖机制。
 *
 * @module types/config
 */

// ============================================================================
// 基础响应类型
// ============================================================================

/**
 * 标准 WebSocket 数据结构
 * 对应思源内核 API 的标准响应格式
 */
export interface IWebSocketData<T = unknown> {
    /** 状态码，0 表示成功，负数表示错误 */
    code: number;
    /** 消息内容 */
    msg: string;
    /** 响应数据 */
    data: T;
    /** 命令类型（可选，用于消息处理） */
    cmd?: string;
}

/** IWebSocketData 的中文别名 */
export type 标准响应数据<T = unknown> = IWebSocketData<T>;

/**
 * SDK 响应格式接口
 * 泛型 T 用于指定 data 字段的具体类型
 */
export interface ISDKResponse<T = unknown> {
    /** 状态码，0 表示成功 */
    code: number;
    /** 消息 */
    msg: string;
    /** 响应数据，类型由泛型 T 指定 */
    data: T;
}

/** ISDKResponse 的中文别名 */
export type SDK响应<T = unknown> = ISDKResponse<T>;

// ============================================================================
// 请求上下文类型
// ============================================================================

/**
 * 请求上下文接口
 * 传递给各种处理器钩子，提供请求的完整信息
 */
export interface IRequestContext {
    /** 请求的完整 URL */
    url: string;
    /** HTTP 请求方法 */
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    /** 请求数据（POST/PUT/PATCH 请求的 body） */
    data?: unknown;
    /** 原始 Response 对象（仅在响应阶段可用） */
    response?: Response;
}

/** IRequestContext 的中文别名 */
export type 请求上下文 = IRequestContext;

// ============================================================================
// 处理器类型定义
// ============================================================================

/**
 * 401 未授权响应处理器
 *
 * @param context - 请求上下文
 * @returns 返回 true 表示已处理，SDK 不再执行默认行为（刷新页面）
 *
 * @example
 * ```typescript
 * const handler: IUnauthorizedHandler = (context) => {
 *     console.log('认证失效，跳转登录页');
 *     window.location.href = '/login';
 *     return true; // 阻止默认的页面刷新行为
 * };
 * ```
 */
export type IUnauthorizedHandler = (
    context: IRequestContext
) => boolean | void | Promise<boolean | void>;

/** IUnauthorizedHandler 的中文别名 */
export type 未授权处理器 = IUnauthorizedHandler;

/**
 * 403 禁止访问响应处理器
 *
 * @param context - 请求上下文
 * @param response - 标准响应数据（code 为 -403）
 * @returns 返回 true 表示已处理，SDK 不再执行默认行为
 *
 * @example
 * ```typescript
 * const handler: IForbiddenHandler = (context, response) => {
 *     showDialog('权限不足：' + response.msg);
 *     return true;
 * };
 * ```
 */
export type IForbiddenHandler = (
    context: IRequestContext,
    response: IWebSocketData
) => boolean | void | Promise<boolean | void>;

/** IForbiddenHandler 的中文别名 */
export type 禁止访问处理器 = IForbiddenHandler;

/**
 * 404 资源不存在响应处理器
 *
 * @param context - 请求上下文
 * @param response - 标准响应数据（code 为 -404）
 * @returns 返回 true 表示已处理，SDK 不再执行默认行为
 */
export type INotFoundHandler = (
    context: IRequestContext,
    response: IWebSocketData
) => boolean | void | Promise<boolean | void>;

/** INotFoundHandler 的中文别名 */
export type 资源不存在处理器 = INotFoundHandler;

/**
 * 202 响应处理器
 * 用于处理如 getFile 等 API 返回 202 表示资源未就绪的情况
 *
 * @param context - 请求上下文
 * @param response - 标准响应数据
 * @returns 返回 true 表示已处理，SDK 不再执行默认行为
 */
export type I202ResponseHandler = (
    context: IRequestContext,
    response: IWebSocketData
) => boolean | void | Promise<boolean | void>;

/** I202ResponseHandler 的中文别名 */
export type 响应202处理器 = I202ResponseHandler;

/**
 * 事务 API 错误处理器
 * 专门处理 /api/transactions 等事务 API 的网络失败
 *
 * @param context - 请求上下文
 * @param error - 错误对象
 * @returns 返回 true 表示已处理，SDK 不再执行默认行为（触发 kernelError）
 *
 * @example
 * ```typescript
 * const handler: ITransactionErrorHandler = (context, error) => {
 *     showDialog('数据同步失败，请检查网络连接');
 *     return true;
 * };
 * ```
 */
export type ITransactionErrorHandler = (
    context: IRequestContext,
    error: Error
) => boolean | void | Promise<boolean | void>;

/** ITransactionErrorHandler 的中文别名 */
export type 事务错误处理器 = ITransactionErrorHandler;

/**
 * 退出 API 错误处理器
 * 处理 /api/system/exit 和 /api/system/setWorkspaceDir 等 API 的失败
 *
 * @param context - 请求上下文
 * @param error - 错误对象
 * @returns 返回 true 表示已处理，SDK 不再执行默认行为（通知 Electron 退出）
 */
export type IExitApiErrorHandler = (
    context: IRequestContext,
    error: Error
) => boolean | void | Promise<boolean | void>;

/** IExitApiErrorHandler 的中文别名 */
export type 退出API错误处理器 = IExitApiErrorHandler;

/**
 * 通用网络错误处理器
 * 处理所有未被特定处理器捕获的网络错误
 *
 * @param context - 请求上下文
 * @param error - 错误对象
 * @returns 返回 true 表示已处理，SDK 不再执行默认行为
 */
export type INetworkErrorHandler = (
    context: IRequestContext,
    error: Error
) => boolean | void | Promise<boolean | void>;

/** INetworkErrorHandler 的中文别名 */
export type 网络错误处理器 = INetworkErrorHandler;

/**
 * 消息显示函数类型
 *
 * @param message - 要显示的消息内容
 * @param timeout - 消息显示超时时间（毫秒），0 表示不自动关闭
 * @param type - 消息类型：'info' 为提示信息，'error' 为错误信息
 * @returns 返回消息 ID，用于后续隐藏消息；或 void
 *
 * @example
 * ```typescript
 * const showMessage: IShowMessageFn = (msg, timeout, type) => {
 *     const id = toast[type](msg, { duration: timeout });
 *     return id;
 * };
 * ```
 */
export type IShowMessageFn = (
    message: string,
    timeout?: number,
    type?: 'info' | 'error'
) => string | void;

/** IShowMessageFn 的中文别名 */
export type 显示消息函数 = IShowMessageFn;

/**
 * 消息隐藏函数类型
 *
 * @param messageId - 要隐藏的消息 ID（由 showMessage 返回）
 */
export type IHideMessageFn = (messageId: string) => void;

/** IHideMessageFn 的中文别名 */
export type 隐藏消息函数 = IHideMessageFn;

/**
 * 响应验证函数类型
 * 用于验证响应数据是否符合 IWebSocketData 格式
 *
 * @param response - 待验证的响应数据
 * @returns 类型守卫，返回 true 表示数据符合 IWebSocketData 格式
 */
export type IResponseValidator = (
    response: unknown
) => response is IWebSocketData;

/** IResponseValidator 的中文别名 */
export type 响应验证器 = IResponseValidator;

// ============================================================================
// SDK 配置接口
// ============================================================================

/**
 * SDK 完整配置接口
 *
 * 支持三层配置覆盖机制：
 * 1. 全局默认配置
 * 2. 客户端实例配置
 * 3. 单次请求配置
 *
 * 配置优先级：单次请求配置 > 客户端实例配置 > 全局默认配置
 *
 * @example
 * ```typescript
 * const config: ISDKConfig = {
 *     baseUrl: 'http://127.0.0.1:6806',
 *     apiToken: 'your-token',
 *     timeout: 30000,
 *     onUnauthorized: (context) => {
 *         window.location.href = '/login';
 *         return true;
 *     },
 *     showMessage: (msg, timeout, type) => {
 *         toast[type](msg, { duration: timeout });
 *     },
 * };
 * ```
 */
export interface ISDKConfig {
    // ========== 连接配置 ==========

    /**
     * 服务器基础 URL
     * @default 'http://127.0.0.1:6806'
     */
    baseUrl?: string;

    /**
     * API 认证令牌
     * 用于需要认证的 API 请求
     */
    apiToken?: string;

    /**
     * 自定义 fetch 实现
     * 用于测试或特殊环境（如 Node.js）
     * @default globalThis.fetch
     */
    customFetch?: typeof fetch;

    /**
     * 请求超时时间（毫秒）
     * @default 30000
     */
    timeout?: number;

    /**
     * 自定义请求头
     * 会与默认请求头合并
     */
    headers?: Record<string, string>;

    // ========== HTTP 状态码处理钩子 ==========

    /**
     * 401 未授权响应处理
     * 默认行为：3秒后刷新页面
     */
    onUnauthorized?: IUnauthorizedHandler;

    /**
     * 403 禁止访问响应处理
     * 默认行为：返回 {code: -403} 错误响应
     */
    onForbidden?: IForbiddenHandler;

    /**
     * 404 资源不存在响应处理
     * 默认行为：返回 {code: -404} 错误响应
     */
    onNotFound?: INotFoundHandler;

    /**
     * 202 响应处理（如 getFile 文件未就绪）
     * 默认行为：调用 failCallback（如果提供）
     */
    on202Response?: I202ResponseHandler;

    // ========== 错误处理钩子 ==========

    /**
     * 事务 API 网络失败处理
     * 针对 /api/transactions 等关键 API
     * 默认行为：触发 kernelError
     */
    onTransactionError?: ITransactionErrorHandler;

    /**
     * 退出相关 API 失败处理
     * 针对 /api/system/exit 和 /api/system/setWorkspaceDir
     * 默认行为：通知 Electron 退出
     */
    onExitApiError?: IExitApiErrorHandler;

    /**
     * 通用网络错误处理
     * 处理所有未被特定处理器捕获的网络错误
     */
    onNetworkError?: INetworkErrorHandler;

    // ========== 消息处理配置 ==========

    /**
     * 是否处理后端消息（响应中的 cmd 字段）
     * @default true
     */
    processMessage?: boolean;

    /**
     * 是否显示错误消息（code < 0 时）
     * @default true
     */
    showErrorMessage?: boolean;

    /**
     * 是否显示提示消息（code === -2 时）
     * @default true
     */
    showInfoMessage?: boolean;

    /**
     * 消息显示超时时间（毫秒）
     * 0 表示不自动关闭
     * @default 0
     */
    messageTimeout?: number;

    /**
     * 自定义消息显示函数
     * 用于集成自定义 UI 组件
     */
    showMessage?: IShowMessageFn;

    /**
     * 自定义消息隐藏函数
     * 用于集成自定义 UI 组件
     */
    hideMessage?: IHideMessageFn;

    // ========== 响应验证配置 ==========

    /**
     * 是否验证响应格式符合 IWebSocketData
     * @default true
     */
    validateResponse?: boolean;

    /**
     * 自定义响应验证函数
     * 用于自定义响应格式验证逻辑
     */
    responseValidator?: IResponseValidator;

    // ========== 竞态控制配置 ==========

    /**
     * 是否启用竞态控制
     * 用于防止旧请求覆盖新请求的响应
     * @default true
     */
    enableRaceControl?: boolean;

    /**
     * 需要竞态控制的 API 列表
     * 会追加到默认列表中
     */
    raceControlApis?: string[];
}

/** ISDKConfig 的中文别名 */
export type SDK配置 = ISDKConfig;

// ============================================================================
// 单次请求配置接口
// ============================================================================

/**
 * 单次请求配置接口
 *
 * 继承 ISDKConfig 的部分字段，用于覆盖全局配置。
 * 仅包含适合在单次请求中覆盖的配置项。
 *
 * @example
 * ```typescript
 * // 某次请求禁用消息显示
 * const result = await client.getBlockInfo(
 *     { id: 'block-id' },
 *     { showErrorMessage: false }
 * );
 *
 * // 某次请求使用自定义超时
 * const result2 = await client.searchBlock(
 *     { query: 'keyword' },
 *     { timeout: 60000 }
 * );
 * ```
 */
export interface IRequestConfig {
    /**
     * 自定义请求头
     * 会与全局配置的 headers 合并，单次请求的优先级更高
     */
    headers?: Record<string, string>;

    /**
     * 请求超时时间（毫秒）
     * 覆盖全局配置的 timeout
     */
    timeout?: number;

    /**
     * 是否处理后端消息
     * 覆盖全局配置的 processMessage
     */
    processMessage?: boolean;

    /**
     * 是否显示错误消息
     * 覆盖全局配置的 showErrorMessage
     */
    showErrorMessage?: boolean;

    /**
     * 是否显示提示消息
     * 覆盖全局配置的 showInfoMessage
     */
    showInfoMessage?: boolean;

    /**
     * 是否验证响应格式
     * 覆盖全局配置的 validateResponse
     */
    validateResponse?: boolean;

    /**
     * 失败回调函数
     * 用于特殊 API（如 getFile）在失败时的自定义处理
     *
     * @param response - 失败时的响应数据
     */
    failCallback?: (response: IWebSocketData) => void;
}

/** IRequestConfig 的中文别名 */
export type 请求配置 = IRequestConfig;

// ============================================================================
// API 方法类型
// ============================================================================

/**
 * 支持配置覆盖的 API 方法签名
 *
 * @typeParam TReq - 请求参数类型
 * @typeParam TRes - 响应数据类型
 *
 * @example
 * ```typescript
 * type GetBlockInfo = ApiMethodWithConfig<
 *     { id: string },
 *     ISDKResponse<BlockInfo>
 * >;
 *
 * const getBlockInfo: GetBlockInfo = async (data, config) => {
 *     // 实现...
 * };
 * ```
 */
export type ApiMethodWithConfig<TReq, TRes> = (
    data: TReq,
    config?: IRequestConfig
) => Promise<TRes>;

/** ApiMethodWithConfig 的中文别名 */
export type 带配置的API方法<TReq, TRes> = ApiMethodWithConfig<TReq, TRes>;

// ============================================================================
// 运行时环境类型
// ============================================================================

/**
 * 运行时环境类型
 * 用于环境检测和环境特定配置
 */
export type RuntimeEnvironment = 'browser' | 'electron' | 'node';

/** RuntimeEnvironment 的中文别名 */
export type 运行时环境 = RuntimeEnvironment;

// ============================================================================
// 默认配置常量
// ============================================================================

/**
 * 默认需要竞态控制的 API 列表
 * 这些 API 可能会因为快速连续调用而产生竞态条件
 */
export const DEFAULT_RACE_CONTROL_APIS: readonly string[] = [
    '/api/search/searchRefBlock',
    '/api/graph/getGraph',
    '/api/graph/getLocalGraph',
    '/api/block/getRecentUpdatedBlocks',
    '/api/search/fullTextSearchBlock',
] as const;

/** DEFAULT_RACE_CONTROL_APIS 的中文别名 */
export const 默认竞态控制API列表 = DEFAULT_RACE_CONTROL_APIS;

// ============================================================================
// 类型守卫函数
// ============================================================================

/**
 * 检查数据是否符合 IWebSocketData 格式
 *
 * @param data - 待检查的数据
 * @returns 类型守卫结果
 *
 * @example
 * ```typescript
 * const response = await fetch('/api/block/getBlockInfo');
 * const data = await response.json();
 *
 * if (isWebSocketData(data)) {
 *     console.log('响应码:', data.code);
 *     console.log('消息:', data.msg);
 * }
 * ```
 */
export function isWebSocketData(data: unknown): data is IWebSocketData {
    if (typeof data !== 'object' || data === null) {
        return false;
    }

    const obj = data as Record<string, unknown>;

    return (
        typeof obj.code === 'number' &&
        typeof obj.msg === 'string' &&
        'data' in obj
    );
}

/** isWebSocketData 的中文别名 */
export const 是标准响应数据 = isWebSocketData;

/**
 * 检测当前运行时环境
 *
 * @returns 当前运行时环境类型
 *
 * @example
 * ```typescript
 * const env = detectEnvironment();
 * if (env === 'electron') {
 *     // Electron 特定逻辑
 * }
 * ```
 */
export function detectEnvironment(): RuntimeEnvironment {
    // Node.js 环境检测：检查是否存在 window 对象
    // 使用 globalThis 来安全地访问全局对象
    const globalWindow = typeof globalThis !== 'undefined'
        ? (globalThis as typeof globalThis & { window?: unknown }).window
        : undefined;

    if (typeof globalWindow === 'undefined') {
        return 'node';
    }

    // Electron 环境检测
    const win = globalWindow as { require?: (module: string) => unknown };
    if (typeof win.require === 'function') {
        try {
            const electron = win.require('electron') as {
                ipcRenderer?: unknown;
            } | null;
            if (electron && electron.ipcRenderer) {
                return 'electron';
            }
        } catch {
            // require 存在但无法加载 electron，视为浏览器环境
        }
    }

    return 'browser';
}

/** detectEnvironment 的中文别名 */
export const 检测运行时环境 = detectEnvironment;
