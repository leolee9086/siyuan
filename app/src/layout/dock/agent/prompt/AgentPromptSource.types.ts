/** 用途：表示提示词来源控件可执行的确定动作；使用场景：菜单构建与串行操作分派；关联类型：由 AgentPromptSourceDomain 的实现消费。 */
export type AgentPromptSourceAction = "bind-document" | "refresh-document" | "keep-snapshot" | "create-document";

/** Kernel 持有的系统提示词来源元数据；正文不发送到浏览器。 */
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

/** 当前会话的提示词来源资格、变更状态和服务端修订。 */
export interface AgentPromptSourceState {
    state: "eligible" | "bound" | "locked" | "source-changed";
    source: AgentPromptSourceMetadata;
    revision: number;
    currentVersion?: string;
}

/** 可由 Kernel 读取并绑定为提示词来源的文档。 */
export interface AgentPromptSourceDocument {
    id: string;
    notebookId: string;
    title: string;
    hPath: string;
}

/** 文件树文档搜索返回的候选；选择后再解析根块 ID。 */
export interface AgentPromptSourceDocumentCandidate {
    notebookId: string;
    path: string;
    hPath: string;
    title: string;
}

/** 提示词来源领域的完整查询和生命周期能力。 */
export interface AgentPromptSourceRepository {
    getPromptSource(id: string): Promise<AgentPromptSourceState>;
    searchPromptSourceDocuments(keyword: string): Promise<AgentPromptSourceDocumentCandidate[]>;
    resolvePromptSourceDocument(candidate: AgentPromptSourceDocumentCandidate): Promise<AgentPromptSourceDocument>;
    bindPromptSourceDocument(input: Readonly<{
        id: string;
        document: AgentPromptSourceDocument;
        expectedRevision: number;
    }>): Promise<AgentPromptSourceState>;
    refreshPromptSourceDocument(input: Readonly<{id: string; expectedRevision: number}>): Promise<AgentPromptSourceState>;
    keepPromptSourceDocument(input: Readonly<{id: string; expectedRevision: number}>): Promise<AgentPromptSourceState>;
    createPromptSourceDocument(id: string): Promise<AgentPromptSourceDocument>;
}

/** 提示词来源与会话聚合根之间的唯一协作边界。 */
export interface AgentPromptSourceSessionRuntime {
    getConversation: () => AgentPanelConversation;
    ensurePersisted: (sessionID: string) => Promise<void>;
    refreshSessionPanel: () => Promise<void>;
    isStreaming: () => boolean;
    isDestroyed: () => boolean;
    getTargetPolicy: () => AgentPanelResolvedTargetPolicy;
    getSessionRevision: (sessionID: string) => number;
    sourceRepository: AgentPromptSourceRepository;
}

/** 提示词来源视图拥有的稳定 DOM 引用；由界面装配边界一次性提供。 */
export interface AgentPromptSourceElements {
    row: HTMLElement;
    label: HTMLElement;
    selectButton: HTMLButtonElement;
    actionsButton: HTMLButtonElement;
}

/** 可由测试和调试器直接观察的提示词来源运行状态。 */
export interface AgentPromptSourceControllerState {
    elements: AgentPromptSourceElements | null;
    sourceState: AgentPromptSourceState | null;
    errorMessage: string;
    loadSerial: number;
    operationSerial: number;
    operationPending: boolean;
    destroyed: boolean;
}

/** 从权威状态派生出的完整视图模型。 */
export interface AgentPromptSourceView {
    visible: boolean;
    label: string;
    tooltip: string;
    selectDisabled: boolean;
    actionsVisible: boolean;
    actionsDisabled: boolean;
    sourceChanged: boolean;
    locked: boolean;
}

/** 已通过目标与会话标识检查的原生 Agent 会话。 */
export type NativePromptSourceConversation = AgentPanelConversation & {kind: "native-agent"; sessionId: string};

/**
 * 提示词来源领域对 AgentChat 暴露的完整公共表面。
 * 消费方通过该接口观察生命周期和操作状态，不加载具体控制器实现。
 */
export interface AgentPromptSourceDomain {
    readonly capabilities: AgentPanelCapabilities;
    readonly runtime: AgentPromptSourceSessionRuntime;
    readonly state: AgentPromptSourceControllerState;
    attach(elements: AgentPromptSourceElements): void;
    reset(): void;
    closeActions(): void;
    destroy(): void;
    refresh(): Promise<void>;
    ensureDecisionBeforeFirstTurn(): Promise<boolean>;
    updatePresentation(): void;
    isOperationPending(): boolean;
}

/** 用途：约束宿主能力；使用范围：显式控制器上下文；解耦评估：纯类型依赖。 */
import type {AgentPanelCapabilities} from "./imports";
/** 用途：约束提示词来源会话定位；使用范围：会话一致性判断；解耦评估：纯类型依赖。 */
import type {AgentPanelConversation} from "./imports";
/** 用途：约束提示词来源资格策略；使用范围：交互可用性判断；解耦评估：纯类型依赖，不加载策略实现。 */
import type {AgentPanelResolvedTargetPolicy} from "./imports";
