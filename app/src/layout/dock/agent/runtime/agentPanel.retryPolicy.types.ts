/**
 * 用途：表示重发策略读取的最小会话事件结构。
 * 使用场景：屏蔽 Agent 会话持久化模型中与重发判断无关的字段。
 * 关联类型：`AgentPanelRetryPolicyState.entries` 由该类型组成。
 * 问题/改进：工具元数据支持可信副作用声明后可补充 effect 字段。
 */
export interface AgentPanelRetryPolicyEntry {
    type: string;
    toolCalls?: readonly unknown[];
}

/**
 * 用途：汇总最近一轮重发决策所需的持久化事件与运行中副作用状态。
 * 使用场景：Agent Panel 渲染重发入口和执行重发前的二次校验。
 * 关联类型：`entries` 使用 `AgentPanelRetryPolicyEntry`；运行中计数补足尚未落盘的事件。
 * 问题/改进：引入事务检查点后，可扩展为基于工具副作用元数据的细粒度策略。
 */
export interface AgentPanelRetryPolicyState {
    entries: readonly AgentPanelRetryPolicyEntry[];
    activeToolCallCount?: number;
    pendingConfirmationCount?: number;
}
