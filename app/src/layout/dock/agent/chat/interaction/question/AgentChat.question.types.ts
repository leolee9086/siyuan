/** 问题卡向 Agent 端点提交的稳定请求结构。 */
export interface AgentQuestionAnswerRequest {
    questionID: string;
    answers: string[];
    sessionID: string;
    questionEntryID: string;
}

/** 描述问题卡片由 Kernel 或结构化 API 失败给出的明确终态。 */
export interface AgentQuestionResolution {
    questionID: string;
    status: import("../../../request/sse/agentSSE.types").AgentInteractionResolutionStatus;
    answers?: string[];
    message?: string;
}
