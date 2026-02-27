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

/**
 * 流数据处理上下文
 *
 * 用途：封装流式数据读取与处理过程中所需的读取器、解码器及回调引用
 * 使用场景：在 {@link processStreamData} 和 {@link processResponse} 内部传递，
 *   将流读取逻辑与业务回调解耦
 * 关联类型：由 {@link StreamCallbacks} 中的 onMessage / onDone 回调和内部 resetTimeout 组合而成
 */
export interface StreamProcessContext {
    /** 从 Response.body 获取的可读流读取器 */
    reader: ReadableStreamDefaultReader<Uint8Array>;
    /** UTF-8 文本解码器，用于将二进制块转为字符串 */
    decoder: TextDecoder;
    /** 收到消息时的回调，透传自 {@link StreamCallbacks.onMessage} */
    onMessage: (content: string) => void;
    /** 流结束时的回调，透传自 {@link StreamCallbacks.onDone} */
    onDone: () => void;
    /** 重置超时计时器，每次收到有效数据时调用 */
    resetTimeout: () => void;
}
