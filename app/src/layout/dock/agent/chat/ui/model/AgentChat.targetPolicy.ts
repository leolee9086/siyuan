/** 用途：读取当前身份快照；使用范围：AgentChat 目标策略计算。 */
import {getActiveMagiArmorSession} from "./imports";
/** 用途：计算共享面板策略；使用范围：AgentChat 目标策略计算。 */
import {resolveAgentPanelTargetPolicy} from "./imports";
/** 用途：读取当前界面语言；使用范围：原生 Agent 标题。 */
import {getAgentChatLanguages} from "./imports";
/** 用途：约束策略输入状态；使用范围：AgentChat 核心策略边界。 */
import type {AgentChatRuntime} from "./imports";

/**
 * 计算当前目标可用的操作、标题与身份展示策略。
 * @同步豁免: 目标策略必须在同一界面更新帧内读取当前身份和运行时状态，供控件状态立即一致地刷新。
 */
export function resolveTargetPolicy(runtime: AgentChatRuntime) {
    const identity = getActiveMagiArmorSession();
    const magiIdentityReady = identity?.routeClass === "guardian" && identity.channel === "magi-main-ui";
    const input: Parameters<typeof resolveAgentPanelTargetPolicy>[0] = {
        kind: runtime.conversationKind,
        nativeTitle: getAgentChatLanguages().agentChat || "Agent",
        magiIdentityReady,
        magiConversationLoading: runtime.magiConversationLoading,
    };
    const displayName = identity?.displayName || identity?.nickname;
    // 身份存在可读名称时才覆盖默认展示，避免把空值写入共享策略输入。
    if (displayName) {
        input.magiIdentityDisplayName = displayName;
    }
    return resolveAgentPanelTargetPolicy(input);
}
