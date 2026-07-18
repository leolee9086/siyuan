/** 表示会话已绑定的外部任务目录摘要，路径和所有者身份由后端主动隐藏。 */
export interface TaskDirectoryGrant {
    id: string;
    name: string;
    permission: "read-only" | "read-write" | "command";
    external: boolean;
    boundAt: number;
}

export interface TaskDirectoryBinding {
    main?: TaskDirectoryGrant;
    directories?: TaskDirectoryGrant[];
}

/** 表示 Agent 会话列表中的元数据及可见的任务目录摘要。 */
export interface SessionIndexItem {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    taskDirectory?: TaskDirectoryBinding;
}

/** 表示后端分页返回的 Agent 会话列表。 */
export interface SessionListResult {
    sessions: SessionIndexItem[];
    total: number;
    page: number;
    pageSize: number;
}

/** 表示 Agent 会话的持久化消息、工具和上下文状态。 */
export interface AgentSession {
    id: string;
    title: string;
    titled?: boolean;
    model?: string;
    taskDirectory?: TaskDirectoryBinding;
    messages?: Array<{role: string; content: string; toolCalls?: Array<{id?: string; name: string; arguments?: Record<string, unknown>; result?: string}>}>;
    entries?: Array<{
        id?: string;
        type: "user" | "thinking" | "assistant" | "confirm" | "question" | "snapshot" | "rollback";
        content?: string;
        steps?: Array<{
            reasoning: string;
            reasoningContent: string;
            toolNames?: string[];
            content?: string;
            text?: string;
            toolCalls?: Array<{name: string; result?: string}>
        }>;
        reasoningContent?: string;
        toolCalls?: Array<{id?: string; name: string; arguments?: Record<string, unknown>; result?: string}>;
        duration?: number;
        confirmName?: string;
        confirmArgs?: Record<string, unknown>;
        confirmID?: string;
        confirmStatus?: string;
        questionID?: string;
        questions?: Array<Record<string, unknown>>;
        questionStatus?: string;
        answers?: string[];
        snapshotID?: string;
    }>;
    snapshots?: string[];
    promptTokens?: number;
    completionTokens?: number;
    totalDuration?: number;
    contextTokens?: number;
    contextTokenBreakdown?: Record<string, number>;
    contextCachedTokens?: number;
    contextLimit?: number;
    messageHistory?: string[];
    createdAt: number;
    updatedAt: number;
}
