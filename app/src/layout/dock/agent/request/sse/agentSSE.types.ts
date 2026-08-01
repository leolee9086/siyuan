/** Agent 工具对本地数据、外部网络和计费资源的潜在影响。 */
export interface IToolEffects {
    localRead?: boolean;
    localWrite?: boolean;
    dataEgress?: boolean;
    externalCost?: boolean;
}

/** Agent SSE 协议中的全部已知事件；聊天流只能消费该判别联合。 */
export type ISSEResult = {
    type: "turn";
    turnID: string;
} | {
    type: "content";
    token: string;
} | {
    type: "thinking";
    reasoning: string;
} | {
    type: "tool_call";
    name: string;
    callID: string;
    arguments: Record<string, unknown>;
} | {
    type: "confirm";
    name: string;
    arguments: Record<string, unknown>;
    confirmID: string;
    effects?: IToolEffects;
} | {
    type: "tool_result";
    name: string;
    callID: string;
    result: string;
} | {
    type: "tool_progress";
    name: string;
    callID: string;
    progress: {
        phase: string;
        done: number;
        total: number;
        current?: string;
        partialCount?: number;
        latestResults?: Array<{
            title: string;
            url: string;
            engine: string;
        }>;
    };
} | {
    type: "error";
    message: string;
} | {
    type: "interrupted";
    message: string;
} | {
    type: "done";
    turnID: string;
} | {
    type: "usage";
    promptTokens: number;
    completionTokens: number;
    lastPromptTokens: number;
    tokenBreakdown: Record<string, number>;
    cachedTokens: number;
    contextLimit: number;
} | {
    type: "retry";
    attempt: number;
    maxRetries: number;
} | {
    type: "question";
    questionID: string;
    arguments: Record<string, unknown>;
} | {
    type: "reasoning";
    token: string;
} | {
    type: "snapshot";
    snapshotID: string;
} | {
    type: "frontend_tool_call";
    callID: string;
    name: string;
    arguments: Record<string, unknown>;
};

/** 当前编辑器可提供给 Agent 的文档、块选择和可见范围快照。 */
export interface IEditorContext {
    activeDocID?: string;
    activeDocTitle?: string;
    notebookID?: string;
    focusedBlockID?: string;
    selectedBlockIDs?: string[];
    visibleBlockIDs?: string[];
}

/** 一次原生 Agent SSE 请求的完整输入、生命周期信号与回调出口。 */
export interface AgentSSERequest {
    message: string;
    language: string;
    references: Array<{id: string; title: string}>;
    onEvent: (event: ISSEResult) => void | Promise<void>;
    onError: (error: Error) => void | Promise<void>;
    signal?: AbortSignal;
    sessionID?: string;
    model?: string;
    reasoningEffort?: string;
    regenerate?: boolean;
    editorContext?: IEditorContext;
    pluginActions?: Array<{name: string; description: string}>;
    userEntryID?: string;
    contentRevision?: number;
    requestHeaders?: Record<string, string>;
}

/** 一个 SSE 响应流在分块解码期间必须共同更新的解析状态。 */
export interface AgentSSEStreamState {
    buffer: string;
    currentEvent: string;
    terminalReceived: boolean;
}
