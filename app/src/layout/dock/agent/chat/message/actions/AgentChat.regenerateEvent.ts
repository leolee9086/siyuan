/** 用途：约束事件分发所需的聊天容器；使用范围：重新生成按钮。 */
import type {AgentChatRuntime} from "./imports";

/** 助手动作请求重新生成时使用的结构化事件名。 */
export const agentChatRegenerateRequestEvent = "agent-chat-regenerate-request";

/** 将重新生成意图提交给统一事件层。 @同步豁免: 生命周期 */
export function dispatchAgentChatRegenerateRequest(runtime: AgentChatRuntime, userEntryID?: string) {
    const request = new CustomEvent<string | undefined>(agentChatRegenerateRequestEvent, {
        detail: userEntryID,
    });
    runtime.messagesContainer.dispatchEvent(request);
}
