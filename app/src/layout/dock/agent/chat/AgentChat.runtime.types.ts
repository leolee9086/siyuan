/** 用途：约束应用能力入口；使用范围：运行时 app 字段；解耦评估：AppFacade 是完整应用抽象，不加载具体 App class。 */
import type {AppFacade} from "./imports";
/** 用途：约束运行时所属页签；使用范围：面板 DOM 宿主；解耦评估：LayoutTab 是布局公开领域表面，不加载具体 Tab class。 */
import type {LayoutTab} from "./imports";
/** 用途：约束编辑器句柄；使用范围：composer 字段；解耦评估：ComposerHandle 统一两种编辑器实现，不导入挂载工厂。 */
import type {ComposerHandle} from "./imports";
/** 用途：约束提示词来源领域；使用范围：运行时提示词生命周期；解耦评估：只依赖公开领域接口，不加载控制器 class。 */
import type {AgentPromptSourceDomain} from "./imports";
/** 用途：约束会话面板领域；使用范围：运行时会话列表生命周期；解耦评估：控制器接口隔离具体创建实现。 */
import type {AgentSessionPanelController} from "./imports";
/** 用途：约束宿主能力集合；使用范围：运行时 capability 字段；解耦评估：细粒度 Port 由宿主注入。 */
import type {AgentPanelCapabilities} from "./imports";
/** 用途：约束会话目标类型；使用范围：运行时 conversationKind 字段；解耦评估：纯类型协议。 */
import type {AgentPanelConversationKind} from "./imports";
/** 用途：约束会话仓储读写数据；使用范围：sessionPorts 仓储接口；解耦评估：纯类型不加载具体实现。 */
import type {AgentSession} from "./imports";
/** 用途：复用完整会话仓储抽象；使用范围：sessionPorts。 */
import type {AgentChatSessionRepository} from "./imports";
/** 用途：约束任务目录仓储；使用范围：sessionPorts。 */
import type {AgentTaskDirectoryRepository} from "./imports";
/** 用途：约束提示词来源仓储；使用范围：sessionPorts。 */
import type {AgentPromptSourceRepository} from "./imports";
/** 用途：约束附件上传结果；使用范围：sessionPorts。 */
import type {AgentFileUploadResult} from "./imports";
/** 用途：约束动态请求头生成能力；使用范围：sessionPorts。 */
import type {AgentRequestHeaders} from "./imports";
/** 用途：约束工具调用条目；使用范围：运行时 currentToolCalls 字段类型。 */
import type {AgentToolCall} from "./message/AgentChat.entries.types";
/** 用途：约束会话条目；使用范围：运行时 entries 字段类型。 */
import type {SessionEntry} from "./message/AgentChat.entries.types";
/** 用途：约束思考步骤；使用范围：运行时 currentThinkingSteps 字段类型。 */
import type {ThinkingStep} from "./message/AgentChat.entries.types";
/** 用途：约束实例级执行控制器；使用范围：AgentChatRuntime；解耦评估：纯协议不加载 controller 实现。 */
import type {AgentConversationAdapterRegistry} from "../runtime/conversation/agentConversation.types";
/** 用途：约束实例级执行控制器命令；使用范围：AgentChatRuntime；解耦评估：纯协议不加载 controller 实现。 */
import type {AgentConversationController} from "../runtime/conversation/agentConversation.types";

/** 重新导出会话条目相关类型，供职责模块共享。 */
export type {
    AgentReference,
    AgentToolCall,
    EntryBase,
    SessionEntry,
    ThinkingStep,
    UserEntry,
} from "./message/AgentChat.entries.types";
/** 单一消息中最多保留的可见块引用数量。 */
export const maxVisibleBlockIDs = 50;

/** 会话消息投影端口；持久化流程不加载具体消息渲染模块。 */
export interface AgentChatSessionProjectionPort {
    buildEntries(session: AgentSession): SessionEntry[];
    render(runtime: AgentChatRuntime, session: AgentSession): void;
    resetWebReferences(runtime: AgentChatRuntime): void;
}

/** 会话界面呈现端口；会话状态机只发出确定的同步命令。 */
export interface AgentChatSessionPresentationPort {
    getSelectedModel(runtime: AgentChatRuntime): string;
    applySessionModel(runtime: AgentChatRuntime, modelID?: string): void;
    updateTokenDisplay(runtime: AgentChatRuntime): void;
    observeStickTarget(runtime: AgentChatRuntime, element: HTMLElement | null): void;
    rebuildNavigation(runtime: AgentChatRuntime): void;
    scrollToBottom(runtime: AgentChatRuntime, force?: boolean, smooth?: boolean): void;
    restoreScrollBottom(runtime: AgentChatRuntime, scrollBottom: number, duration?: number): void;
    showWelcome(runtime: AgentChatRuntime): void;
    appendError(runtime: AgentChatRuntime, message: string): void;
    applyConversationCapabilities(runtime: AgentChatRuntime): void;
    updateSendButton(runtime: AgentChatRuntime): void;
    showMirror(runtime: AgentChatRuntime): void;
    removeMirror(runtime: AgentChatRuntime): void;
}

/** 活跃轮次生命周期端口；会话切换不加载流式和用户消息具体实现。 */
export interface AgentChatTurnLifecyclePort {
    setStreaming(runtime: AgentChatRuntime, streaming: boolean): void;
    finishThinking(runtime: AgentChatRuntime): void;
    flushThinkingStep(runtime: AgentChatRuntime): void;
    restorePendingEditDraft(runtime: AgentChatRuntime): void;
}

/** 当前 MAGI 身份的最小可观察快照。 */
export interface AgentChatMagiIdentitySnapshot {
    ready: boolean;
    identityId: string;
}

/** MAGI 主界面历史中的稳定消息结构。 */
export interface AgentChatMagiConversationMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    createdAt: number;
}

/** MAGI 主界面历史的抽象输入，不暴露 Armor 会话实现。 */
export interface AgentChatMagiConversationHistory {
    conversationId: string;
    messages: AgentChatMagiConversationMessage[];
}

/** MAGI 会话源端口；生命周期流程不加载身份服务或适配器。 */
export interface AgentChatMagiConversationPort {
    readActiveIdentity(): AgentChatMagiIdentitySnapshot;
    loadConversation(identityId: string, signal: AbortSignal): Promise<AgentChatMagiConversationHistory>;
}

/** AgentChat 会话领域的完整抽象依赖，由门面组合根一次性装配。 */
export interface AgentChatSessionPorts {
    repository: AgentChatSessionRepository;
    taskDirectories: AgentTaskDirectoryRepository;
    promptSources: AgentPromptSourceRepository;
    uploadFiles(files: File[]): Promise<AgentFileUploadResult>;
    requestHeaders: AgentRequestHeaders;
    projection: AgentChatSessionProjectionPort;
    presentation: AgentChatSessionPresentationPort;
    turnLifecycle: AgentChatTurnLifecyclePort;
    magiConversation: AgentChatMagiConversationPort;
}

/** AgentChat 方法模块共享的完整内部状态与调用契约。 */
export interface AgentChatRuntime {
    app: AppFacade | undefined;
    ws?: WebSocket;
    parent: LayoutTab;
    messagesContainer: HTMLElement;
    composerHost: HTMLElement;
    composer: ComposerHandle | null;
    sendBtn: HTMLElement;
    stopBtn: HTMLElement;
    deliveryControl: HTMLElement;
    steerDeliveryBtn: HTMLButtonElement;
    queueDeliveryBtn: HTMLButtonElement;
    queueDock: HTMLElement;
    editingQueueInputID: string;
    sessionFilesBtn: HTMLButtonElement;
    sessionFilesInput: HTMLInputElement;
    promptSourceController: AgentPromptSourceDomain;
    sessionFileOperationSerial: number;
    sessionFileOperationPending: boolean;
    newSessionBtn: HTMLElement;
    guardianAuthBtn: HTMLElement;
    identityLabelElement: HTMLElement;
    titleElement: HTMLElement;
    sessionMenuBtn: HTMLElement;
    floatingBtn: HTMLElement;
    tabBtn: HTMLElement;
    /** 在标签页新建空白会话面板的标题栏按钮。 */
    tabNewBtn: HTMLElement;
    sessionPanel: AgentSessionPanelController;
    sessionPorts: AgentChatSessionPorts;
    sessionId: string;
    sessionTitle: string;
    pendingSessionTitle: string | null;
    entries: SessionEntry[];
    hasTitled: boolean;
    isStreaming: boolean;
    currentAIElement: HTMLElement | null;
    currentAssistantEntryId: string;
    currentThinkingEntryId: string;
    currentTurnID: string;
    currentRoundID: string;
    recoveryCommitTurnIDs: Map<string, string>;
    pendingRecoverySessionIDs: Set<string>;
    recoveryInFlightSessionIDs: Set<string>;
    lute: Lute;
    currentContent: string;
    fullContent: string;
    contextTokens: number;
    contextTokenBreakdown: Record<string, number>;
    contextCachedTokens: number;
    contextLimit: number;
    tokenPopup: HTMLElement | null;
    tokenPopupOutsideClickHandler: (() => void) | null;
    tokenPopupResizeHandler: (() => void) | null;
    sessionCreatedAt: number;
    requestStartTime: number;
    tokenDisplayEl: HTMLElement;
    defaultTitle: string;
    currentToolCalls: AgentToolCall[];
    toolCallStartedAt: Map<string, number>;
    abortController: AbortController | null;
    currentThinkingText: string;
    currentThinkingReasoning: string;
    currentThinkingReasoningContent: string;
    editingUserEntryID: string;
    pendingEditDraft: { entryID: string; content: string } | null;
    currentThinkingSteps: ThinkingStep[];
    currentThinkingDuration: number;
    currentThinkingStepContent: string;
    pendingConfirms: SessionEntry[];
    renderedToolNames: Record<string, boolean>;
    hasInterveningCard: boolean;
    modelSelect: HTMLSelectElement;
    targetSelect: HTMLSelectElement;
    selectedModel: string;
    modelOptions: Array<{ id: string; name: string }>;
    modelOptionsSignature: string;
    reasoningEffortSelect: HTMLSelectElement;
    selectedReasoningEffort: string;
    permissionSelect: HTMLSelectElement;
    permissionMode: NonNullable<AgentSession["permissionMode"]>;
    userScrolledUp: boolean;
    programmaticScroll: boolean;
    stickResizeObserver: ResizeObserver | null;
    scrollBottomBySession: Map<string, number>;
    layoutVisible: boolean;
    layoutResizeObserver: ResizeObserver | null;
    settingDialogObserver: MutationObserver | null;
    scrollBottomBtn: HTMLElement;
    navRail: HTMLElement;
    mirrorLocked: boolean;
    mirrorPlaceholderEl: HTMLElement | null;
    thinkingFrameID: number;
    lastStepToolCount: number;
    isFloatingCopy: boolean;
    floatingCloseHandler: (() => void) | null;
    initialization: Promise<void>;
    agentDestroyed: boolean;
    webReferenceMap: Record<string, string>;
    webReferenceURLs: Set<string>;
    conversationKind: AgentPanelConversationKind;
    capabilities: AgentPanelCapabilities;
    enableSessionWebSocket: boolean;
    initialSessionId: string;
    magiIdentityId: string;
    magiConversationLoading: boolean;
    magiConversationLoadVersion: number;
    magiConversationLoadController: AbortController | null;
    conversationAdapters: AgentConversationAdapterRegistry;
    conversationController: AgentConversationController | null;
    checkConfigChangedHandler: () => void;
    handleMagiIdentitySessionChanged: () => void;
    pendingTokenUpdate: boolean;
    pendingReasoningUpdate: boolean;
    rafId: number;
}
