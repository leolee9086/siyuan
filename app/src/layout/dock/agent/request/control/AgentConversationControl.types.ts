/** Agent 控制 API 沿用的思源标准响应包络。 */
export interface AgentConversationControlEnvelope<T> {
    code?: number;
    msg?: string;
    data?: T;
}

/** 控制 API 失败时保留给冲突恢复和界面提示的结构化字段。 */
export interface AgentConversationControlErrorOptions {
    reason: string;
    queueVersion: number;
    status: number;
}

/** 结构化控制错误在原生 Error 上附加可恢复的协议元数据。 */
export type AgentConversationControlError = Error & AgentConversationControlErrorOptions;

/** 一次 Agent 控制请求的稳定网络参数。 */
export interface AgentConversationControlRequestOptions {
    path: string;
    method?: "GET" | "POST";
    body?: Record<string, unknown>;
    requestHeaders: import("../AgentRequest.types").AgentRequestHeaders;
    signal?: AbortSignal | undefined;
}

/** 增量 SSE 解码期间保存的单帧字段。 */
export interface AgentConversationEventFrame {
    event: string;
    id: string;
    data: string[];
}
