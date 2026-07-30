/**
 * 用途：引入目标策略的输入输出契约。
 * 使用范围：仅用于本文件的同步纯策略解析，不依赖 DOM、网络或会话存储。
 * 解耦评估：类型参数正是策略边界，继续注入会增加间接层而不减少耦合。
 */
import type {
    AgentPanelResolvedTargetPolicy,
    AgentPanelTargetPolicyInput,
} from "./agentPanel.targetPolicy.types";

/**
 * 作用：把目标和身份状态解析为 Agent Panel 的界面行为。
 * 意图：将 MAGI 与普通 Agent 的差异收口为可替换策略，保持渲染代码对扩展开放。
 * 调用时机：目标、身份和持续会话加载状态变化后，以及创建消息动作时。
 * 问题/改进：扩展注册表落地后，该默认策略将作为内置 provider 注册。
 * @同步豁免: UI构建 - 同一渲染帧必须获得一致的动作可见性，函数只读取不可变输入且没有 I/O。
 */
export function resolveAgentPanelTargetPolicy(input: AgentPanelTargetPolicyInput): AgentPanelResolvedTargetPolicy {
    if (input.kind === "magi") {
        const identityLabel = input.magiIdentityReady
            ? (input.magiIdentityDisplayName || "MAGI")
            : "IDENTITY REQUIRED";
        return {
            title: "MAGI",
            identityLabel,
            identityVisible: true,
            sessionActionsVisible: false,
            promptSourceVisible: false,
            regenerationVisible: false,
            sendingAvailable: input.magiIdentityReady && !input.magiConversationLoading,
        };
    }
    return {
        title: input.nativeTitle || "Agent",
        identityLabel: "",
        identityVisible: false,
        sessionActionsVisible: true,
        promptSourceVisible: true,
        regenerationVisible: true,
        sendingAvailable: true,
    };
}
