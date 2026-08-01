/** 用户编辑提交事件名称，由消息 DOM 发出并由面板事件层处理。 */
export const agentChatUserEditSubmitEvent = "agent-chat:user-edit-submit";

/**
 * 创建结构化用户编辑提交事件。
 * @同步豁免: DOM 事件必须在按钮或键盘回调的当前派发周期内创建并发送，工厂只构造事件值。
 */
export function createAgentChatUserEditSubmitEvent(detail: Readonly<{entryID: string; content: string}>) {
    return new CustomEvent(agentChatUserEditSubmitEvent, {detail});
}
