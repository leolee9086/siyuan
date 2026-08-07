/** 用途：复用原生 Agent 编辑器上下文结构；使用范围：宿主能力聚合的编辑器快照；解耦评估：纯类型依赖。 */
import type {IEditorContext} from "../request/sse/agentSSE.types";
/** 用途：约束宿主创建的 Dialog；使用范围：提示词文档选择；解耦评估：纯类型依赖不加载 runtime 组合根。 */
import type {IDialog} from "../../../../dialog/dialog.types";
/** 用途：约束宿主 Dialog 创建参数；使用范围：提示词文档选择；解耦评估：纯类型依赖不加载 runtime 组合根。 */
import type {IDialogOptions} from "../../../../dialog/dialog.types";

/** 表示面板可路由的两类会话目标。 */
export type AgentPanelConversationKind = "native-agent" | "magi";

/** 表示目标类型与可选的持久化会话标识。 */
export interface AgentPanelConversation {
    kind: AgentPanelConversationKind;
    sessionId?: string;
}

/** 表示可发送给原生 Agent 的宿主插件动作摘要。 */
export interface AgentPanelPluginAction {
    name: string;
    description: string;
}

/** 表示通用菜单中的一个动作。 */
export interface PanelMenuItem {
    label: string;
    icon?: string;
    current?: boolean;
    warning?: boolean;
    disabled?: boolean;
    click: () => void;
}

/** Agent 面板与宿主之间的完整能力聚合；调用方直接观察可用动作，不再穿过单方法对象。 */
export interface AgentPanelCapabilities {
    openAISettings?: () => void | Promise<void>;
    openIdentityAccess?: () => void | Promise<void>;
    notify?: (notification: {title: string; body?: string}) => void | Promise<void>;
    showMessage?: (message: string, timeout?: number) => void;
    confirm?: (title: string, message: string, onConfirm: () => void) => void;
    createDialog?: (options: IDialogOptions) => IDialog;
    showMenu?: (name: string, anchor: HTMLElement, items: PanelMenuItem[]) => void;
    closeMenu?: (name?: string) => void;
    captureEditorContext?: () => IEditorContext | undefined;
    listPluginActions?: () => AgentPanelPluginAction[];
    executePluginAction?: (name: string, args: Record<string, unknown>) => Promise<unknown>;
    focusPanel?: (panel: HTMLElement) => void;
    reloadFrontend?: () => void | Promise<void>;
    minimizeDock?: () => void;
    openTab?: () => void | Promise<void>;
    /** 在标签页新建一个空白会话的独立 Agent 面板，不影响当前面板的流式状态。 */
    openTabNew?: () => void | Promise<void>;
    openFloat?: () => void | Promise<void>;
    postRender?: (container: HTMLElement) => void;
}

/** 表示挂载节点、初始会话和可选宿主能力。 */
export interface AgentPanelMountOptions {
    target: HTMLElement;
    initialConversation?: AgentPanelConversation;
    capabilities?: AgentPanelCapabilities;
    enableSessionWebSocket?: boolean;
}

/** 表示挂载后可由外部宿主管理的稳定生命周期句柄。 */
export interface AgentPanelHandle {
    openConversation: (conversation: AgentPanelConversation) => Promise<void>;
    getConversation: () => AgentPanelConversation;
    refreshSessions: () => Promise<void>;
    setDraft: (text: string, focus?: boolean) => Promise<void>;
    destroy: () => void;
}
