/**
 * 用途：描述目标策略判断所需的当前身份与加载状态。
 * 使用场景：Agent Panel 每次切换目标、身份或持续会话状态时解析界面行为。
 * 关联类型：由 `AgentPanelResolvedTargetPolicy` 表达最终动作和文案状态。
 * 问题/改进：后续 extension registry 可以在该输入上增加自定义目标元数据。
 */
export interface AgentPanelTargetPolicyInput {
    kind: "native-agent" | "magi";
    nativeTitle: string;
    magiIdentityDisplayName?: string;
    magiIdentityReady: boolean;
    magiConversationLoading: boolean;
}

/**
 * 用途：承载目标相关的可配置 Agent Panel 界面行为。
 * 使用场景：控制会话动作、重发、发送、标题和身份标签，而非在渲染器中判断目标。
 * 关联类型：由 `AgentPanelTargetPolicyInput` 解析生成。
 * 问题/改进：消息级动作迁入 registry 后，`regenerationVisible` 将由动作策略接管。
 */
export interface AgentPanelResolvedTargetPolicy {
    title: string;
    identityLabel: string;
    identityVisible: boolean;
    sessionActionsVisible: boolean;
    regenerationVisible: boolean;
    sendingAvailable: boolean;
}
