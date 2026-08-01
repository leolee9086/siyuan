/** 用途：约束待判定的面板会话；使用范围：提示词来源资格守卫。 */
import type {AgentPanelConversation} from "./imports";
/** 用途：读取提示词目标策略；使用范围：提示词来源资格守卫。 */
import type {AgentPromptSourceDomain} from "./AgentPromptSource.types";
/** 用途：窄化为有效原生 Agent 会话；使用范围：提示词来源动作。 */
import type {NativePromptSourceConversation} from "./AgentPromptSource.types";

/** 判断当前会话是否满足文档提示词来源的领域资格。 */
/** @同步豁免: 类型守卫 - 调用方必须在读取 sessionId 前完成原生会话和目标策略窄化。 */
export function isNativePromptSourceConversation(
    context: AgentPromptSourceDomain,
    conversation: AgentPanelConversation,
): conversation is NativePromptSourceConversation {
    return conversation.kind === "native-agent" && Boolean(conversation.sessionId) &&
        context.runtime.getTargetPolicy().promptSourceVisible;
}
