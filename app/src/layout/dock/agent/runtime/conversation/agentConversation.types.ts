/** 用途：约束编辑器上下文；使用范围：统一提交输入。 */
import type {IEditorContext} from "../../request/sse/agentSSE.types";
/** 用途：约束既有消息流事件；使用范围：adapter 观察器。 */
import type {ISSEResult} from "../../request/sse/agentSSE.types";
/** 用途：约束 adapter 目标键；使用范围：注册与解析。 */
import type {AgentPanelConversationKind} from "../agentPanel.ports.types";
/** 用途：约束宿主插件动作；使用范围：统一提交输入。 */
import type {AgentPanelPluginAction} from "../agentPanel.ports.types";
/** 用途：约束动态请求头；使用范围：全部控制请求。 */
import type {AgentRequestHeaders} from "../../request/AgentRequest.types";
/** 用途：约束随请求冻结的浏览器能力声明；使用范围：原生 Agent admission。 */
import type {IAgentCapabilityManifest} from "../../frontendCapabilities";

/** Agent 输入在当前轮次或后续轮次中的投递方式。 */
export type AgentConversationDelivery = "turn" | "steer" | "queue";

/** 会话执行器对外公开的轮次阶段。 */
export type AgentConversationTurnPhase = "idle" | "starting" | "provider_stream" | "tool_running" |
    "boundary" | "sealing" | "awaiting_commit" | string;

/** 共享面板只依据这些执行能力决定控件，不读取具体目标类型。 */
export interface AgentConversationCapabilities {
    supportsSteer: boolean;
    supportsQueue: boolean;
    supportsInterrupt: boolean;
    supportsQueueEdit: boolean;
    usesSessionEvents: boolean;
}

/** 一次提交所需的完整、可序列化输入快照。 */
export interface AgentConversationSubmitInput {
    inputID: string;
    userEntryID: string;
    sessionID: string;
    delivery: AgentConversationDelivery;
    expectedTurnID?: string;
    message: string;
    blockHTML?: string;
    language: string;
    references: Array<{id: string; title: string}>;
    editorContext?: IEditorContext;
    pluginActions?: AgentPanelPluginAction[];
    frontendCapabilities?: IAgentCapabilityManifest[];
    model?: string;
    reasoningEffort?: string;
    regenerate?: boolean;
    contentRevision: number;
    history: Array<{role: "user" | "assistant"; content: string}>;
    requestHeaders: AgentRequestHeaders;
}

/** HTTP admission 对输入幂等键与权威队列版本的确认。 */
export interface AgentConversationAdmission {
    inputID: string;
    userEntryID?: string;
    acceptedTurnID?: string;
    admittedSeq?: number;
    queueVersion?: number;
    duplicated?: boolean;
}

/** 队列项的可观察生命周期；未知扩展状态仍可展示。 */
export type AgentConversationQueueStatus = "pending" | "injecting" | "injected" | "cancelled" | "failed" |
    "blocked" | string;

/** Kernel queue 快照中的稳定输入字段。 */
export interface AgentConversationQueueInput {
    id: string;
    sessionId: string;
    semantics: string;
    content?: string;
    payload?: unknown;
    payloadVersion?: number;
    expectedTurnId?: string;
    createdAt?: number;
}

/** 队列 dock 使用的单项权威投影。 */
export interface AgentConversationQueueItem {
    input: AgentConversationQueueInput;
    state: AgentConversationQueueStatus;
    seq: number;
    queuePos: number;
    optimistic?: boolean;
}

/** 一个会话的完整队列快照。 */
export interface AgentConversationQueueSnapshot {
    queueVersion: number;
    nextSeq?: number;
    items: AgentConversationQueueItem[];
}

/** 会话事件公共元数据；具体字段由 type 判别后读取。 */
export interface AgentConversationSessionEvent extends Record<string, unknown> {
    type: string;
    sessionID: string;
    eventSeq: number;
    timestamp: number;
    turnID?: string;
}

/** 长生命周期事件订阅的输入。 */
export interface AgentConversationSubscription {
    sessionID: string;
    after: number;
    signal: AbortSignal;
    requestHeaders: AgentRequestHeaders;
    onEvent: (event: AgentConversationSessionEvent) => void | Promise<void>;
}

/** 请求内流式 adapter 向共享消息投影层发出的事件。 */
export interface AgentConversationObserver {
    onEvent: (event: ISSEResult) => void | Promise<void>;
    onError: (error: Error) => void | Promise<void>;
}

/** 编辑 pending queue 时复用首次提交的完整输入结构。 */
export interface AgentConversationQueueMutation {
    input: AgentConversationSubmitInput;
    queueVersion: number;
}

/** 取消 pending queue 项所需的版本化身份。 */
export interface AgentConversationQueueIdentity {
    sessionID: string;
    inputID: string;
    queueVersion: number;
    requestHeaders: AgentRequestHeaders;
}

/** 把 pending queue 项提升到当前 turn 所需的版本化身份。 */
export interface AgentConversationQueuePromotion extends AgentConversationQueueIdentity {
    expectedTurnID: string;
}

/** 精确中断当前 turn 所需的会话身份与动态请求头。 */
export interface AgentConversationInterruptInput {
    sessionID: string;
    expectedTurnID: string;
    requestHeaders: AgentRequestHeaders;
}

/** 可插拔会话执行边界；新增目标只需注册新的实现。 */
export interface AgentConversationAdapter {
    readonly kind: AgentPanelConversationKind;
    readonly capabilities: AgentConversationCapabilities;
    submit(input: AgentConversationSubmitInput, observer: AgentConversationObserver, signal: AbortSignal):
        Promise<AgentConversationAdmission>;
    loadQueue?(sessionID: string, requestHeaders: AgentRequestHeaders, signal?: AbortSignal):
        Promise<AgentConversationQueueSnapshot>;
    subscribe?(subscription: AgentConversationSubscription): Promise<void>;
    updateQueue?(mutation: AgentConversationQueueMutation, signal?: AbortSignal):
        Promise<AgentConversationAdmission>;
    cancelQueue?(input: AgentConversationQueueIdentity, signal?: AbortSignal): Promise<AgentConversationAdmission>;
    promoteQueue?(input: AgentConversationQueuePromotion, signal?: AbortSignal): Promise<AgentConversationAdmission>;
    interrupt?(input: AgentConversationInterruptInput, signal?: AbortSignal): Promise<AgentConversationAdmission>;
}

/** Adapter registry 是共享 UI 查找执行能力的唯一入口。 */
export interface AgentConversationAdapterRegistry {
    find(kind: AgentPanelConversationKind): AgentConversationAdapter | undefined;
    resolve(kind: AgentPanelConversationKind): AgentConversationAdapter;
}

/** 激活会话时声明当前标识是否已经具备可订阅的持久化记录。 */
export interface AgentConversationActivationOptions {
    subscribe?: boolean;
}

/** 控制器向 AgentChat 投影消息、状态与恢复动作的端口。 */
export interface AgentConversationControllerHooks {
    requestHeaders: AgentRequestHeaders;
    onEvent(event: AgentConversationSessionEvent): void | Promise<void>;
    onStateChange(state: AgentConversationState): void;
    onResync(sessionID: string): void | Promise<void>;
}

/** 控制器工厂的可替换依赖和重连策略。 */
export interface AgentConversationControllerOptions {
    adapters: AgentConversationAdapterRegistry;
    initialKind: AgentPanelConversationKind;
    hooks: AgentConversationControllerHooks;
    reconnectDelayMs?: number;
    stateReducers?: Record<string, AgentConversationStateReducer>;
}

/** 会话状态事件的可注册 reducer；返回值表示事件是否已被消费。 */
export type AgentConversationStateReducer = (
    state: AgentConversationState,
    event: AgentConversationSessionEvent,
) => boolean;

/** controller 各职责模块共享的实例级依赖。 */
export interface AgentConversationControllerRuntime {
    state: AgentConversationState;
    adapters: AgentConversationAdapterRegistry;
    hooks: AgentConversationControllerHooks;
    reconnectDelayMs: number;
    stateReducers: Record<string, AgentConversationStateReducer>;
}

/** 绑定到单个 AgentChat 实例的执行控制器公开入口。 */
export interface AgentConversationController {
    readonly state: AgentConversationState;
    activate(kind: AgentPanelConversationKind, sessionID: string,
             options?: AgentConversationActivationOptions): Promise<void>;
    connect(): Promise<void>;
    refresh(): Promise<void>;
    dispose(): void;
    submit(input: AgentConversationSubmitInput, observer: AgentConversationObserver, signal: AbortSignal):
        Promise<AgentConversationAdmission>;
    updateQueue(mutation: AgentConversationQueueMutation, signal?: AbortSignal):
        Promise<AgentConversationAdmission>;
    cancelQueue(input: Omit<AgentConversationQueueIdentity, "sessionID">, signal?: AbortSignal):
        Promise<AgentConversationAdmission>;
    promoteQueue(input: Omit<AgentConversationQueuePromotion, "sessionID">, signal?: AbortSignal):
        Promise<AgentConversationAdmission>;
    interrupt(input: Omit<AgentConversationInterruptInput, "sessionID">, signal?: AbortSignal):
        Promise<AgentConversationAdmission>;
    setDelivery(delivery: Exclude<AgentConversationDelivery, "turn">): void;
}

/** 每个 AgentChat 实例独占的事件、队列与订阅状态。 */
export interface AgentConversationState {
    adapter: AgentConversationAdapter;
    sessionID: string;
    activation: number;
    eventSeq: number;
    queueVersion: number;
    queueItems: AgentConversationQueueItem[];
    turnID: string;
    phase: AgentConversationTurnPhase;
    steerable: boolean;
    selectedDelivery: Exclude<AgentConversationDelivery, "turn">;
    subscriptionController: AbortController | null;
    reconnectTimer: ReturnType<typeof globalThis.setTimeout> | 0;
    submittingInputIDs: Set<string>;
    connected: boolean;
    disposed: boolean;
}
