/** 用途：发送标准 Agent 控制请求；使用范围：交互结果提交；解耦评估：复用控制请求边界可避免交互层复制 HTTP 协议。 */
import {requestAgentConversationControl} from "../../request/control/AgentConversationControl.request";
/** 导出标准 Agent 控制请求。 */
export {requestAgentConversationControl};

/** 用途：识别结构化控制错误；使用范围：交互请求失败结算；解耦评估：统一守卫可保持 queue 与交互端点的错误语义一致。 */
import {isAgentConversationControlError} from "../../request/control/AgentConversationControl.guard";
/** 导出结构化控制错误守卫。 */
export {isAgentConversationControlError};

/** 用途：约束 Kernel 交互终态；使用范围：请求归一化与状态标签；解耦评估：直接复用 SSE 协议类型可防止两套状态集合漂移。 */
import type {AgentInteractionResolutionStatus} from "../../request/sse/agentSSE.types";
/** 导出 Kernel 交互终态。 */
export type {AgentInteractionResolutionStatus};
