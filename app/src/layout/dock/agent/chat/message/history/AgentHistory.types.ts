/** 消息历史检查所需的条目结构，聚合用户、确认、快照和助手工具状态。 */
export type AgentHistoryEntry = {
    id?: string;
    type: string;
    status?: string;
    toolCalls?: Array<{result?: string; state?: string}>;
};

/** 编辑消息时用于保留仍出现在正文中的块引用。 */
export type AgentHistoryReference = {id: string; title: string};
