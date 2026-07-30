/** 表示会话已绑定的外部任务目录摘要，路径和所有者身份由后端主动隐藏。 */
export interface TaskDirectoryGrant {
    id: string;
    name: string;
    permission: "read-only" | "read-write" | "command";
    external: boolean;
    boundAt: number;
}

/** 表示一个 Agent 会话的主目录和附加目录 capability 摘要，不包含真实路径或 owner 身份。 */
export interface TaskDirectoryBinding {
    main?: TaskDirectoryGrant;
    directories?: TaskDirectoryGrant[];
}

/** 表示 Kernel 按当前连接来源和 owner 状态计算的目录管理能力，用于控制新增绑定动作显隐。 */
export interface AgentTaskDirectoryCapabilities {
    canBindTaskDirectories: boolean;
}

/** 表示 Kernel 持有的系统提示词来源元数据；有效正文始终不发送到浏览器。 */
export interface AgentPromptSourceMetadata {
    kind: "default" | "document";
    documentId?: string;
    notebookId?: string;
    titleSnapshot?: string;
    contentHash?: string;
    sourceVersion?: string;
    capturedAt?: number;
    keptVersion?: string;
    keptAt?: number;
}

/** 表示当前会话的提示词来源资格、变更状态与服务端权威 revision。 */
export interface AgentPromptSourceState {
    state: "eligible" | "bound" | "locked" | "source-changed";
    source: AgentPromptSourceMetadata;
    revision: number;
    currentVersion?: string;
}

/** 表示可由 Kernel 读取并绑定为提示词来源的文档搜索结果。 */
export interface AgentPromptSourceDocument {
    id: string;
    notebookId: string;
    title: string;
    hPath: string;
}

/** 表示已进入 AI 主笔记本附件目录的文件摘要，供聊天输入框生成附件链接。 */
export interface AgentUploadedFile {
    name: string;
    path: string;
}

/** 表示一次附件上传的完整结果，部分成功与逐文件失败必须同时保留。 */
export interface AgentFileUploadResult {
    uploaded: AgentUploadedFile[];
    failed: string[];
    message: string;
}

/** 表示会话持久化后的新 revision 及可选服务端规范化快照。 */
export interface SessionSaveResult {
    revision: number;
    session?: AgentSession;
}

/** 表示 Agent API 的统一返回包络，供成功和 data 存在性校验复用。 */
export interface AgentAPIResponse<T> {
    code: number;
    msg?: string;
    data?: T;
}

/** 表示 Agent 会话列表中的元数据及可见的任务目录摘要。 */
export interface SessionIndexItem {
    id: string;
    title: string;
    targetKind?: "native-agent" | "magi";
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

/** 表示标准会话菜单中的目录操作描述，供视图映射为命令并由后端执行授权校验。 */
export interface TaskDirectoryMenuAction {
    action: "bind-main" | "add" | "unbind" | "summary";
    icon: string;
    label: string;
    disabled?: boolean;
    permission?: "read-only" | "read-write" | "command";
    directoryID?: string;
}

/** 表示 Agent 会话的持久化消息、工具和上下文状态。 */
export interface AgentSession {
    id: string;
    title: string;
    targetKind?: "native-agent" | "magi";
    titled?: boolean;
    model?: string;
    taskDirectory?: TaskDirectoryBinding;
    messages?: Array<{role: string; content: string; toolCalls?: Array<{id?: string; name: string; arguments?: Record<string, unknown>; result?: string}>}>;
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
            toolNames?: string[];
            content?: string;
            text?: string;
            toolCalls?: Array<{name: string; result?: string}>
        }>;
        reasoningContent?: string;
        toolCalls?: Array<{id?: string; name: string; arguments?: Record<string, unknown>; result?: string; state?: string}>;
        duration?: number;
        timestamp?: number;
        name?: string;
        args?: Record<string, unknown>;
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
    revision?: number;
    expectedRevision?: number;
    commitTurnID?: string;
    lastCommittedTurnID?: string;
    recoveryTurnID?: string;
    recoveryState?: string;
    recoveryRevision?: number;
    agentRunning?: boolean;
}
