/** 用途：复用面板会话标识类型；使用范围：流式事件过期检查；解耦评估：只依赖公开会话值对象，不访问 AgentChat 状态。 */
import type {AgentPanelConversation} from "./agentPanel.ports.types";

/**
 * 作用：判断异步事件是否仍属于当前面板的目标与会话。
 * 意图：Native SSE 与后续 Target Adapter 共用同一过期事件隔离规则，避免各链路重复比较逻辑。
 * 调用时机：流式 chunk、完成或错误事件写入界面之前。
 */
/** @同步豁免: 性能考虑 */
export function isActiveAgentPanelRequest(
    current: AgentPanelConversation,
    request: AgentPanelConversation,
    inactive: boolean,
) {
    return !inactive && current.kind === request.kind && current.sessionId === request.sessionId;
}
