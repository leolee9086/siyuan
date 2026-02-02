/**
 * SDK 钩子系统类型定义
 *
 * 本文件定义了 SDK 钩子系统的所有类型接口，支持在请求生命周期的各个阶段
 * 注入自定义逻辑，实现灵活的扩展机制。
 *
 * @module hooks/types
 */

import type { IWebSocketData, ISDKResponse } from '../types/config';

// ============================================================================
// 钩子上下文类型
// ============================================================================

/**
 * 请求前钩子上下文
 * 包含即将发送的请求信息
 */
export interface IBeforeRequestContext {
    /** 请求的完整 URL */
    url: string;
    /** 请求数据 */
    data: unknown;
    /** 请求头 */
    headers: Record<string, string>;
}

/** IBeforeRequestContext 的中文别名 */
export type 请求前上下文 = IBeforeRequestContext;

/**
 * 响应后钩子上下文
 * 包含已解析的响应信息
 */
export interface IAfterResponseContext<T = unknown> {
    /** 请求的完整 URL */
    url: string;
    /** 解析后的响应数据 */
    response: ISDKResponse<T>;
    /** 原始 Response 对象 */
    rawResponse: Response;
}

/** IAfterResponseContext 的中文别名 */
export type 响应后上下文<T = unknown> = IAfterResponseContext<T>;

/**
 * 竞态检查钩子上下文
 * 用于判断是否应该丢弃过期响应
 */
export interface IRaceConditionCheckContext {
    /** 请求的完整 URL */
    url: string;
    /** 响应携带的请求 ID */
    responseReqId: number;
    /** 当前最新的请求 ID */
    currentReqId: number;
}

/** IRaceConditionCheckContext 的中文别名 */
export type 竞态检查上下文 = IRaceConditionCheckContext;

/**
 * 网络错误钩子上下文
 * 包含 fetch 异常时的信息
 */
export interface INetworkErrorContext {
    /** 请求的完整 URL */
    url: string;
    /** 请求数据 */
    data: unknown;
    /** 错误对象 */
    error: Error;
}

/** INetworkErrorContext 的中文别名 */
export type 网络错误上下文 = INetworkErrorContext;

/**
 * HTTP 错误钩子上下文
 * 包含 HTTP 非 2xx 响应时的信息
 */
export interface IHttpErrorContext {
    /** 请求的完整 URL */
    url: string;
    /** HTTP 状态码 */
    status: number;
    /** HTTP 状态文本 */
    statusText: string;
    /** 原始 Response 对象 */
    rawResponse: Response;
}

/** IHttpErrorContext 的中文别名 */
export type HTTP错误上下文 = IHttpErrorContext;

/**
 * 消息处理钩子上下文
 * 包含 processMessage 前的响应信息
 */
export interface IMessageContext<T = unknown> {
    /** 响应数据 */
    response: IWebSocketData<T>;
}

/** IMessageContext 的中文别名 */
export type 消息上下文<T = unknown> = IMessageContext<T>;

/**
 * 显示消息钩子上下文
 * 包含即将显示的消息信息
 */
export interface IShowMessageContext {
    /** 消息内容 */
    msg: string;
    /** 消息类型 */
    type: 'info' | 'error';
    /** 超时时间（毫秒） */
    timeout: number;
}

/** IShowMessageContext 的中文别名 */
export type 显示消息上下文 = IShowMessageContext;

/**
 * 内核错误钩子上下文
 * 包含内核通信异常时的信息
 */
export interface IKernelErrorContext {
    /** 请求的完整 URL */
    url: string;
    /** 错误对象 */
    error: Error;
}

/** IKernelErrorContext 的中文别名 */
export type 内核错误上下文 = IKernelErrorContext;

/**
 * 认证过期钩子上下文
 * 包含 401 认证失效时的信息
 */
export interface IAuthExpiredContext {
    /** 原始 Response 对象 */
    response: Response;
}

/** IAuthExpiredContext 的中文别名 */
export type 认证过期上下文 = IAuthExpiredContext;

// ============================================================================
// 钩子函数类型定义
// ============================================================================

/**
 * 请求前钩子函数
 *
 * 在 fetch 调用前触发，可用于修改请求配置或取消请求。
 *
 * @param context - 请求前上下文
 * @returns 修改后的配置对象，或 false 取消请求，或 void/undefined 继续原请求
 *
 * @example
 * ```typescript
 * const addTimestamp: BeforeRequestHook = (context) => {
 *     return {
 *         ...context,
 *         headers: {
 *             ...context.headers,
 *             'X-Timestamp': Date.now().toString(),
 *         },
 *     };
 * };
 *
 * const blockSensitiveApi: BeforeRequestHook = (context) => {
 *     if (context.url.includes('/api/system/exit')) {
 *         console.warn('阻止退出请求');
 *         return false;
 *     }
 * };
 * ```
 */
export type BeforeRequestHook = (
    context: IBeforeRequestContext
) => IBeforeRequestContext | false | void | Promise<IBeforeRequestContext | false | void>;

/** BeforeRequestHook 的中文别名 */
export type 请求前钩子 = BeforeRequestHook;

/**
 * 响应后钩子函数
 *
 * 在响应解析后触发，可用于修改响应数据或进行日志记录。
 *
 * @param context - 响应后上下文
 * @returns 修改后的响应数据，或 void/undefined 使用原响应
 *
 * @example
 * ```typescript
 * const logResponse: AfterResponseHook = (context) => {
 *     console.log(`[${context.url}] 响应码: ${context.response.code}`);
 * };
 *
 * const transformResponse: AfterResponseHook = (context) => {
 *     if (context.response.code === 0) {
 *         return {
 *             ...context.response,
 *             data: { ...context.response.data, _timestamp: Date.now() },
 *         };
 *     }
 * };
 * ```
 */
export type AfterResponseHook<T = unknown> = (
    context: IAfterResponseContext<T>
) => ISDKResponse<T> | void | Promise<ISDKResponse<T> | void>;

/** AfterResponseHook 的中文别名 */
export type 响应后钩子<T = unknown> = AfterResponseHook<T>;

/**
 * 竞态检查钩子函数
 *
 * 在竞态检查时触发，用于自定义竞态判断逻辑。
 *
 * @param context - 竞态检查上下文
 * @returns true 表示应该丢弃响应，false 表示保留响应，void 使用默认逻辑
 *
 * @example
 * ```typescript
 * const customRaceCheck: RaceConditionCheckHook = (context) => {
 *     // 对于搜索 API，只保留最新请求的响应
 *     if (context.url.includes('/api/search/')) {
 *         return context.responseReqId < context.currentReqId;
 *     }
 * };
 * ```
 */
export type RaceConditionCheckHook = (
    context: IRaceConditionCheckContext
) => boolean | void | Promise<boolean | void>;

/** RaceConditionCheckHook 的中文别名 */
export type 竞态检查钩子 = RaceConditionCheckHook;

/**
 * 网络错误钩子函数
 *
 * 在 fetch 异常时触发，用于错误日志记录或自定义错误处理。
 *
 * @param context - 网络错误上下文
 * @returns void，此钩子仅用于通知，不影响错误处理流程
 *
 * @example
 * ```typescript
 * const logNetworkError: NetworkErrorHook = (context) => {
 *     console.error(`网络请求失败: ${context.url}`, context.error);
 *     // 上报错误到监控系统
 *     errorReporter.capture(context.error, { url: context.url });
 * };
 * ```
 */
export type NetworkErrorHook = (
    context: INetworkErrorContext
) => void | Promise<void>;

/** NetworkErrorHook 的中文别名 */
export type 网络错误钩子 = NetworkErrorHook;

/**
 * HTTP 错误钩子函数
 *
 * 在 HTTP 非 2xx 响应时触发，可用于自定义错误响应。
 *
 * @param context - HTTP 错误上下文
 * @returns 自定义响应数据，或 void/undefined 使用默认错误处理
 *
 * @example
 * ```typescript
 * const handleHttpError: HttpErrorHook = (context) => {
 *     if (context.status === 503) {
 *         return {
 *             code: -503,
 *             msg: '服务暂时不可用，请稍后重试',
 *             data: null,
 *         };
 *     }
 * };
 * ```
 */
export type HttpErrorHook = (
    context: IHttpErrorContext
) => ISDKResponse | void | Promise<ISDKResponse | void>;

/** HttpErrorHook 的中文别名 */
export type HTTP错误钩子 = HttpErrorHook;

/**
 * 消息处理钩子函数
 *
 * 在 processMessage 前触发，可用于过滤或预处理消息。
 *
 * @param context - 消息上下文
 * @returns true 继续处理消息，false 跳过消息处理，void 使用默认行为
 *
 * @example
 * ```typescript
 * const filterMessage: MessageHook = (context) => {
 *     // 跳过特定命令的消息处理
 *     if (context.response.cmd === 'syncProgress') {
 *         return false;
 *     }
 *     return true;
 * };
 * ```
 */
export type MessageHook<T = unknown> = (
    context: IMessageContext<T>
) => boolean | void | Promise<boolean | void>;

/** MessageHook 的中文别名 */
export type 消息钩子<T = unknown> = MessageHook<T>;

/**
 * 显示消息钩子函数
 *
 * 在显示消息前触发，可用于修改消息内容或阻止显示。
 *
 * @param context - 显示消息上下文
 * @returns 修改后的消息配置，或 false 阻止显示，或 void 使用原配置
 *
 * @example
 * ```typescript
 * const translateMessage: ShowMessageHook = (context) => {
 *     return {
 *         ...context,
 *         msg: i18n.translate(context.msg),
 *     };
 * };
 *
 * const suppressInfoMessages: ShowMessageHook = (context) => {
 *     if (context.type === 'info') {
 *         return false; // 阻止所有 info 类型消息
 *     }
 * };
 * ```
 */
export type ShowMessageHook = (
    context: IShowMessageContext
) => IShowMessageContext | false | void | Promise<IShowMessageContext | false | void>;

/** ShowMessageHook 的中文别名 */
export type 显示消息钩子 = ShowMessageHook;

/**
 * 内核错误钩子函数
 *
 * 在内核通信异常时触发，用于错误通知或自定义处理。
 *
 * @param context - 内核错误上下文
 * @returns void，此钩子仅用于通知
 *
 * @example
 * ```typescript
 * const handleKernelError: KernelErrorHook = (context) => {
 *     showDialog({
 *         title: '内核通信异常',
 *         content: `请求 ${context.url} 失败: ${context.error.message}`,
 *     });
 * };
 * ```
 */
export type KernelErrorHook = (
    context: IKernelErrorContext
) => void | Promise<void>;

/** KernelErrorHook 的中文别名 */
export type 内核错误钩子 = KernelErrorHook;

/**
 * 认证过期钩子函数
 *
 * 在 401 认证失效时触发，可用于自定义认证刷新逻辑。
 *
 * @param context - 认证过期上下文
 * @returns false 阻止自动刷新行为，void/true 执行默认刷新
 *
 * @example
 * ```typescript
 * const customAuthRefresh: AuthExpiredHook = async (context) => {
 *     // 尝试使用 refresh token 刷新认证
 *     const success = await refreshAuthToken();
 *     if (success) {
 *         return false; // 阻止默认的页面刷新
 *     }
 *     // 返回 void 执行默认刷新行为
 * };
 * ```
 */
export type AuthExpiredHook = (
    context: IAuthExpiredContext
) => boolean | void | Promise<boolean | void>;

/** AuthExpiredHook 的中文别名 */
export type 认证过期钩子 = AuthExpiredHook;

// ============================================================================
// 钩子集合接口
// ============================================================================

/**
 * SDK 钩子集合接口
 *
 * 定义了 SDK 支持的所有钩子类型，每种钩子可注册多个处理函数。
 * 钩子按注册顺序依次执行。
 *
 * @example
 * ```typescript
 * const hooks: ISDKHooks = {
 *     beforeRequest: [addAuthHeader, logRequest],
 *     afterResponse: [logResponse],
 *     onNetworkError: [reportError],
 * };
 * ```
 */
export interface ISDKHooks {
    // ========== 请求生命周期钩子 ==========

    /**
     * 请求前钩子列表
     * 在 fetch 调用前依次执行
     */
    beforeRequest?: BeforeRequestHook[];

    /**
     * 响应后钩子列表
     * 在响应解析后依次执行
     */
    afterResponse?: AfterResponseHook[];

    // ========== 竞态控制钩子 ==========

    /**
     * 竞态检查钩子列表
     * 在竞态检查时依次执行
     */
    onRaceConditionCheck?: RaceConditionCheckHook[];

    // ========== 错误处理钩子 ==========

    /**
     * 网络错误钩子列表
     * 在 fetch 异常时依次执行
     */
    onNetworkError?: NetworkErrorHook[];

    /**
     * HTTP 错误钩子列表
     * 在 HTTP 非 2xx 响应时依次执行
     */
    onHttpError?: HttpErrorHook[];

    // ========== 消息处理钩子 ==========

    /**
     * 消息处理钩子列表
     * 在 processMessage 前依次执行
     */
    onMessage?: MessageHook[];

    /**
     * 显示消息钩子列表
     * 在显示消息前依次执行
     */
    onShowMessage?: ShowMessageHook[];

    // ========== 特殊事件钩子 ==========

    /**
     * 内核错误钩子列表
     * 在内核通信异常时依次执行
     */
    onKernelError?: KernelErrorHook[];

    /**
     * 认证过期钩子列表
     * 在 401 认证失效时依次执行
     */
    onAuthExpired?: AuthExpiredHook[];
}

/** ISDKHooks 的中文别名 */
export type SDK钩子集合 = ISDKHooks;

// ============================================================================
// 钩子执行结果类型
// ============================================================================

/**
 * 钩子执行结果类型映射
 * 用于类型安全地获取各钩子的返回值类型
 */
export interface IHookResultMap {
    beforeRequest: IBeforeRequestContext | false | void;
    afterResponse: ISDKResponse | void;
    onRaceConditionCheck: boolean | void;
    onNetworkError: void;
    onHttpError: ISDKResponse | void;
    onMessage: boolean | void;
    onShowMessage: IShowMessageContext | false | void;
    onKernelError: void;
    onAuthExpired: boolean | void;
}

/** IHookResultMap 的中文别名 */
export type 钩子结果映射 = IHookResultMap;

/**
 * 钩子上下文类型映射
 * 用于类型安全地获取各钩子的参数类型
 */
export interface IHookContextMap {
    beforeRequest: IBeforeRequestContext;
    afterResponse: IAfterResponseContext;
    onRaceConditionCheck: IRaceConditionCheckContext;
    onNetworkError: INetworkErrorContext;
    onHttpError: IHttpErrorContext;
    onMessage: IMessageContext;
    onShowMessage: IShowMessageContext;
    onKernelError: IKernelErrorContext;
    onAuthExpired: IAuthExpiredContext;
}

/** IHookContextMap 的中文别名 */
export type 钩子上下文映射 = IHookContextMap;
