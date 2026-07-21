/**
 * network 模块的类型定义集合
 * 包含 fetch、fetchStream 和 cronjob 相关的所有类型定义
 */

// ============================================================================
// fetch 相关类型
// ============================================================================

/**
 * 通用的请求数据对象接口
 * 包含已知的可选属性，同时允许扩展其他属性
 */
export interface IFetchRequestObject {
    /** 请求 ID，用于请求追踪 */
    reqId?: number;
    /** 类型标识 */
    type?: string;
    /** 错误时是否退出 */
    errorExit?: boolean;
    /** 允许其他任意属性 */
    [key: string]: unknown;
}

/**
 * fetch 请求数据类型联合
 *
 * 用途：表示 fetchPost 等函数接受的请求数据
 * 使用场景：所有 HTTP POST 请求的 body 数据
 * 关联类型：IFetchRequestObject（普通对象）、FormData（文件上传）
 */
export type TFetchRequestData = IFetchRequestObject | FormData;

/**
 * 请求上下文对象，用于在中间件之间传递和修改请求数据
 *
 * 用途：在请求发送前的中间件管道中传递状态
 * 使用场景：injectReqIdMiddleware、serializeRequestDataMiddleware 等中间件
 */
export interface FetchContext {
    url: string;
    data: TFetchRequestData | undefined;
    serializedBody: string | FormData | null;
}

/**
 * 中间件函数签名
 *
 * 用途：定义请求前处理中间件的统一接口
 * 使用场景：所有需要在请求发送前修改上下文的中间件函数
 */
export type FetchMiddleware = (ctx: FetchContext) => void;

// ============================================================================
// fetchStream 相关类型
// ============================================================================

/**
 * 流式请求配置接口
 *
 * 用途：定义流式 HTTP 请求所需的全部参数配置
 * 使用场景：作为 {@link universalStreamRequest} 的第一个参数，配置请求的 URL、方法、请求头、请求体、超时及中止信号
 * 关联类型：与 {@link StreamCallbacks} 配合使用，共同构成流式请求的完整参数
 */
export interface StreamRequestConfig {
    /** 请求目标 URL */
    url: string;
    /** HTTP 方法，默认 POST */
    method?: "GET" | "POST" | "PUT" | "DELETE";
    /** 自定义请求头，会与默认 Content-Type 合并 */
    headers?: Record<string, string>;
    /** 请求体，对象会被自动 JSON 序列化 */
    body?: unknown;
    /** 超时时间（毫秒），默认 10000 */
    timeout?: number;
    /** 外部传入的 AbortSignal，用于取消请求 */
    signal: AbortSignal;
}

/**
 * 流式请求回调函数集合
 *
 * 用途：定义流式请求生命周期中各阶段的回调处理函数
 * 使用场景：作为 {@link universalStreamRequest} 的第二个参数，处理消息接收、完成、错误和中止事件
 * 关联类型：与 {@link StreamRequestConfig} 配合使用，共同构成流式请求的完整参数
 */
export interface StreamCallbacks {
    /** 收到流数据时触发，content 为单条 SSE data 字段的原始字符串 */
    onMessage: (content: string) => void;
    /** 流正常结束（收到 [DONE] 或读取完毕）时触发 */
    onDone: () => void;
    /** 发生错误（网络异常、超时等）时触发 */
    onError: (error: Error) => void;
    /** 请求被外部 AbortSignal 中止后触发（可选） */
    onAbort?: () => void;
}

// ============================================================================
// cronjob 相关类型
// ============================================================================

/**
 * 任务状态类型
 * - idle: 未运行
 * - running: 运行中
 * - paused: 已暂停
 * - error: 出错
 */
export type 任务状态类型 = "idle" | "running" | "paused" | "error";

/**
 * 任务运行时信息
 * 描述一个定时任务的当前状态和配置
 */
export interface 任务运行时信息 {
    /** 文档ID */
    docId: string;
    /** 任务名称 */
    name: string;
    /** 调度表达式 (cron 格式) */
    schedule: string;
    /** 任务描述 */
    description: string;
    /** 当前状态 */
    status: 任务状态类型;
    /** 上次运行时间戳 (秒) */
    lastRun: number;
    /** 下次运行时间戳 (秒) */
    nextRun: number;
    /** 上次错误信息 */
    lastError: string;
    /** 累计运行次数 */
    runCount: number;
}

/**
 * 执行日志条目
 * 记录任务执行的日志信息
 */
export interface 执行日志 {
    /** 时间戳 */
    time: number;
    /** 日志内容 */
    message: string;
    /** 日志级别 */
    level: "info" | "error" | "warn";
}

/**
 * 编译结果
 * 文档编译后的结果信息
 */
export interface 编译结果 {
    /** 编译后的代码 */
    code: string;
    /** 文档ID */
    docId: string;
    /** 输出文件路径 */
    output: string;
}

// 英文别名导出

/**
 * CronJob 鉴权请求数据结构
 * 由后端通过 WebSocket 发送给前端
 */
export interface ICronjobAuthRequest {
    /** 请求唯一标识 */
    reqId: string;
    /** 任务所属文档ID */
    docId: string;
    /** 任务名称 */
    taskName: string;
    /** 请求原因描述 */
    reason: string;
}

/**
 * CronJob 鉴权确认对话框端口
 *
 * 用途：抽象 UI 确认交互，避免业务逻辑直接依赖具体 dialog 实现。
 * 使用场景：注入到 handleCronjobAuthRequest 中作为确认交互能力。
 * 关联类型：ICronjobAuthDependencies。
 */
export type ConfirmDialogPort = (
    title: string,
    text: string,
    confirm?: (...args: unknown[]) => void,
    cancel?: (...args: unknown[]) => void
) => void;

/**
 * CronJob 鉴权响应发送端口
 *
 * 用途：抽象“把授权结果发回后端”的行为接口。
 * 使用场景：注入到 handleCronjobAuthRequest 中作为响应发送能力。
 * 关联类型：ICronjobAuthDependencies。
 */
export type SendAuthResponsePort = (reqId: string, allow: boolean) => void;

/**
 * CronJob 鉴权依赖集合（必须注入）
 *
 * 用途：定义 handleCronjobAuthRequest 所需的外部能力。
 * 使用场景：由调用方（如 processMessage）显式构造并传入。
 * 关联类型：ConfirmDialogPort、SendAuthResponsePort。
 */
export interface ICronjobAuthDependencies {
    confirmDialog: ConfirmDialogPort;
    sendAuthResponse: SendAuthResponsePort;
}

export type MaybePromise<T> = T | Promise<T>;

export type FetchPostPort = (
    url: string,
    data?: TFetchRequestData,
    cb?: (response: IWebSocketData) => void,
    headers?: IObject,
    failCallback?: (response: IWebSocketData) => void,
    signal?: AbortSignal,
    bypassSemaphore?: boolean,
) => MaybePromise<void>;

export type ExportLayoutPort = (options: {
    cb: () => void;
    errorExit: boolean;
}) => MaybePromise<void>;

export type ShowMessagePort = (
    message: string,
    timeout?: number,
    type?: string,
    messageId?: string,
) => MaybePromise<string | undefined>;

export type HideMessagePort = (id?: string) => MaybePromise<void>;

export interface IProcessMessageUIDependencies {
    exportLayout: ExportLayoutPort;
    showMessage: ShowMessagePort;
    hideMessage: HideMessagePort;
    confirmDialog: ConfirmDialogPort;
}

export interface IProcessMessageDependencies extends Partial<IProcessMessageUIDependencies> {
    fetchPost: FetchPostPort;
}
