/** 一次交互请求在 UI 层的三种结算结果。 */
export type AgentInteractionRequestResult = {
    state: "accepted";
} | {
    state: "retryable";
    message: string;
} | {
    state: "resolved";
    status: import("../../request/sse/agentSSE.types").AgentInteractionResolutionStatus;
    message: string;
};

/** 复用原生 Agent 控制请求边界所需的稳定参数。 */
export interface AgentInteractionRequestOptions {
    path: string;
    body: Record<string, unknown>;
    requestHeaders: import("../../request/AgentRequest.types").AgentRequestHeaders;
}
