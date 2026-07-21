/**
 * 用途：描述 Agent Panel 会话交互锁所需的最小控件集合。
 * 使用场景：流式请求开始和结束时同步目标选择器、会话动作与会话弹层。
 * 关联类型：不依赖具体宿主或 `AgentChat`，便于使用轻量假控件测试。
 */
export interface AgentPanelInteractionLockControls {
    /** 目标选择器；初始化前允许为空。 */
    targetSelect: HTMLSelectElement | undefined;
    /** 新会话与会话列表动作。 */
    conversationButtons: Array<HTMLElement | undefined>;
    /** 已打开会话弹层的关闭动作。 */
    closeSessionPanel: (() => void) | undefined;
}
