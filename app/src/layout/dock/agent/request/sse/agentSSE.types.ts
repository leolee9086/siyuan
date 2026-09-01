/** 用途：约束请求时冻结的浏览器能力声明；使用范围：原生 Agent SSE 请求。 */
import type {IAgentCapabilityManifest} from "../../frontendCapabilities";

/** Agent 工具对本地数据、外部网络和计费资源的潜在影响。 */
export interface IToolEffects {
    localRead?: boolean;
    localWrite?: boolean;
    dataEgress?: boolean;
    externalCost?: boolean;
}

/** Kernel 为等待用户或浏览器结果的交互发出的稳定终态。 */
export type AgentInteractionResolutionStatus =
    "approved" | "always" | "rejected" | "submitted" | "completed" | "expired" | "cancelled" | "error";

/** Agent SSE 协议中的全部已知事件；聊天流只能消费该判别联合。 */
export type ISSEResult = {
    type: "turn";
    turnID: string;
} | {
    type: "content";
    token: string;
    roundID?: string;
} | {
    type: "thinking";
    reasoning: string;
    roundID?: string;
} | {
    type: "tool_call";
    name: string;
    callID: string;
    arguments: Record<string, unknown>;
    roundID?: string;
} | {
    type: "confirm";
    name: string;
    arguments: Record<string, unknown>;
    confirmID: string;
    effects?: IToolEffects;
    forcedConfirm?: boolean;
    capabilityID?: string;
    roundID?: string;
} | {
    type: "confirm_resolved";
    confirmID: string;
    callID: string;
    status: AgentInteractionResolutionStatus;
    message: string;
} | {
    type: "tool_result";
    name: string;
    callID: string;
    result: string;
    roundID?: string;
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
    roundID?: string;
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
    roundID?: string;
} | {
    type: "question_resolved";
    questionID: string;
    callID: string;
    status: AgentInteractionResolutionStatus;
    message: string;
    answers: string[];
} | {
    type: "reasoning";
    token: string;
    roundID?: string;
} | {
    type: "snapshot";
    snapshotID: string;
    roundID?: string;
} | {
    type: "browser_capability_call";
    callID: string;
    name: string;
    capabilityID: string;
    generation: number;
    arguments: Record<string, unknown>;
} | {
    type: "permission";
    permissionMode: "confirm" | "allowSession";
} | {
    type: "frontend_tool_call";
    callID: string;
    name: string;
    arguments: Record<string, unknown>;
} | {
    type: "frontend_tool_resolved";
    callID: string;
    status: AgentInteractionResolutionStatus;
    message: string;
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
    blockHTML?: string;
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
    frontendCapabilities?: IAgentCapabilityManifest[];
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
