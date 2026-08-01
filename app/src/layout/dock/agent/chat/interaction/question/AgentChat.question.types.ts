/** 问题卡向 Agent 端点提交的稳定请求结构。 */
export interface AgentQuestionAnswerRequest {
    questionID: string;
    answers: string[];
    sessionID: string;
    questionEntryID: string;
}
