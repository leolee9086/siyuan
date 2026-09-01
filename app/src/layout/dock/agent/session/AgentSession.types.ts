/** 用途：关联会话和任务目录摘要；使用范围：会话领域持久化模型。 */
import type {TaskDirectoryBinding} from "./imports";

/** Agent 会话中后续能力调用的确认策略。 */
export type AgentPermissionMode = "confirm" | "allowSession";

/** 会话目标种类。 */
export type AgentSessionTargetKind = "native-agent" | "magi";

/** 会话索引中的元数据及可见目录摘要。 */
export interface SessionIndexItem {
    id: string;
    title: string;
    targetKind?: AgentSessionTargetKind;
    createdAt: number;
    updatedAt: number;
    agentRunning?: boolean;
    taskDirectory?: TaskDirectoryBinding;
}

/** 会话列表分页结果。 */
export interface SessionListResult {
    sessions: SessionIndexItem[];
    total: number;
    page: number;
    pageSize: number;
}

/** 会话持久化结果。 */
export interface SessionSaveResult {
    revision: number;
    session?: AgentSession;
}

/** 会话修订和保存队列的可观察所有权。 */
export interface AgentSessionRevisionState {
    revisions: Map<string, number>;
    runtimeRevisions: Map<string, number>;
    pendingSaves: Map<string, Promise<SessionSaveResult>>;
}

/** Agent 会话仓储的完整领域能力。 */
export interface AgentChatSessionRepository {
    readonly revisionState: AgentSessionRevisionState;
    list(options?: {
        page?: number;
        pageSize?: number;
        keyword?: string;
        targetKind?: AgentSessionTargetKind;
    }): Promise<SessionListResult>;
    load(id: string): Promise<AgentSession | null>;
    save(session: AgentSession): Promise<SessionSaveResult>;
    remove(id: string): Promise<void>;
    rename(input: Readonly<{id: string; title: string}>): Promise<void>;
    setPermission(id: string, permissionMode: AgentPermissionMode): Promise<AgentPermissionMode>;
    getRevision(id: string): number;
    newSessionId(): string;
}

/** Agent 会话的持久化消息、工具和上下文状态。 */
export interface AgentSession {
    id: string;
    title: string;
    targetKind?: AgentSessionTargetKind;
    titled?: boolean;
    model?: string;
    permissionMode?: AgentPermissionMode;
    taskDirectory?: TaskDirectoryBinding;
    messages?: Array<{
        role: string;
        content: string;
        toolCalls?: Array<{id?: string; name: string; arguments?: Record<string, unknown>; result?: string}>;
    }>;
    entries?: Array<{
        id?: string;
        type: "user" | "thinking" | "assistant" | "confirm" | "question" | "snapshot" | "rollback";
        content?: string;
        blockHTML?: string;
        references?: Array<{id: string; title: string}>;
        editorContext?: {
            activeDocID?: string;
            activeDocTitle?: string;
            notebookID?: string;
            focusedBlockID?: string;
            selectedBlockIDs?: string[];
            visibleBlockIDs?: string[];
        };
        steps?: Array<{
            reasoning: string;
            reasoningContent: string;
            roundID?: string;
            toolNames?: string[];
            toolCallIDs?: string[];
            content?: string;
            text?: string;
            toolCalls?: Array<{name: string; result?: string}>;
        }>;
        reasoningContent?: string;
        responseOutput?: Array<Record<string, unknown>>;
        responseOutputTokens?: number;
        roundID?: string;
        toolCalls?: Array<{
            id?: string;
            name: string;
            arguments?: Record<string, unknown>;
            argumentsJSON?: string;
            result?: string;
            state?: string;
            providerData?: {
                google?: {
                    thoughtSignature?: string;
                };
            };
        }>;
        duration?: number;
        timestamp?: number;
        name?: string;
        args?: Record<string, unknown>;
        confirmName?: string;
        confirmArgs?: Record<string, unknown>;
        confirmID?: string;
        confirmStatus?: string;
        effects?: {
            localRead?: boolean;
            localWrite?: boolean;
            dataEgress?: boolean;
            externalCost?: boolean;
        };
        status?: string;
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
    revision?: number;
    expectedRevision?: number;
    commitTurnID?: string;
    lastCommittedTurnID?: string;
    recoveryTurnID?: string;
    recoveryState?: string;
    recoveryRevision?: number;
    agentRunning?: boolean;
}
