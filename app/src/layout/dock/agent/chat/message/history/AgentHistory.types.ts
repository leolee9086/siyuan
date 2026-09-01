/** 历史呈现所需的宽松工具调用结构。 */
export type AgentHistoryToolCall = {
    id?: string;
    name?: string;
    result?: string;
    state?: string;
    [key: string]: unknown;
};

/** 历史呈现所需的思考步骤结构。 */
export type AgentHistoryThinkingStep = {
    reasoning?: string;
    reasoningContent?: string;
    roundID?: string;
    toolNames?: string[];
    toolCallIDs?: string[];
    content?: string;
    [key: string]: unknown;
};

/** 消息历史检查与呈现所需的宽松条目结构。 */
export type AgentHistoryEntry = {
    id?: string;
    type: string;
    status?: string;
    content?: string;
    result?: string;
    callID?: string;
    reasoningContent?: string;
    roundID?: string;
    duration?: number;
    steps?: AgentHistoryThinkingStep[];
    toolCalls?: AgentHistoryToolCall[];
    [key: string]: unknown;
};

/** 富文本用户消息编辑时的完整更新载荷。 */
export type AgentHistoryUserEntry = {
    content: string;
    blockHTML?: string;
    references?: AgentHistoryReference[];
};

export type AgentHistoryEditData = {
    text: string;
    blockHTML: string;
    references: AgentHistoryReference[];
};

/** 编辑消息时用于保留仍出现在正文中的块引用。 */
export type AgentHistoryReference = {id: string; title: string};
