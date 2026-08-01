/**
 * 表示一次 SSE usage 事件中用于覆盖当前上下文统计的字段。
 * 仅由令牌状态更新函数消费，与完整 SSE 联合类型保持结构兼容。
 */
export interface AgentChatTokenUsage {
    lastPromptTokens: number;
    tokenBreakdown: Record<string, number>;
    cachedTokens: number;
    contextLimit: number;
}
