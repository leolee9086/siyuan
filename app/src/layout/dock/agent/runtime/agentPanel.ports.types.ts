/** 用途：复用原生 Agent 编辑器上下文结构；使用范围：EditorContextPort 快照；解耦评估：纯类型依赖，运行时由 Port 注入。 */
import type {IEditorContext} from "../agentSSE";

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

/** 提供设置页导航，供任意独立面板按需复用。 */
export interface SettingsNavigationPort {
    openAISettings: () => void | Promise<void>;
}

/** 提供身份状态入口，不暴露具体 Identity Access 界面实现。 */
export interface IdentityAccessPort {
    openIdentityAccess: () => void | Promise<void>;
}

/** 提供系统级通知，不绑定 Electron 或浏览器通知实现。 */
export interface NotificationPort {
    notify: (notification: {title: string; body?: string}) => void | Promise<void>;
}

/** 提供短消息提示，供复制、冲突和错误反馈复用。 */
export interface MessagePort {
    show: (message: string, timeout?: number) => void;
}

/** 提供确认交互，隔离具体 Dialog 和浏览器确认框。 */
export interface ConfirmPort {
    confirm: (title: string, message: string, onConfirm: () => void) => void;
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

/** 提供锚点菜单的创建、定位与关闭能力。 */
export interface PanelMenuPort {
    popup: (name: string, anchor: HTMLElement, items: PanelMenuItem[]) => void;
    close: (name?: string) => void;
}

/** 提供只读编辑器上下文快照。 */
export interface EditorContextPort {
    capture: () => IEditorContext | undefined;
}

/** 提供插件动作发现与执行边界。 */
export interface PluginActionPort {
    list: () => AgentPanelPluginAction[];
    execute: (name: string, args: Record<string, unknown>) => Promise<unknown>;
}

/** 提供宿主面板聚焦能力。 */
export interface PanelFocusPort {
    focus: (panel: HTMLElement) => void;
}

/** 提供当前浏览器宿主重载能力，不包含 Kernel 重启语义。 */
export interface FrontendReloadPort {
    reload: () => void | Promise<void>;
}

/** 提供 Dock 可见性控制，独立页面可省略。 */
export interface DockVisibilityPort {
    minimize: () => void;
}

/** 提供创建普通布局 Tab 副本的能力。 */
export interface PanelTabOpenPort {
    open: () => void | Promise<void>;
}

/** 提供创建非模态浮窗副本的能力。 */
export interface PanelFloatOpenPort {
    open: () => void | Promise<void>;
}

/** 提供目录选择，平台差异由宿主实现吸收。 */
export interface DirectoryPickerPort {
    pickDirectory: () => Promise<string>;
}

/** 提供 Markdown 和富内容的宿主后处理。 */
export interface ContentRenderPort {
    postRender: (container: HTMLElement) => void;
}

/**
 * 可选能力集合只负责组合细粒度 Port。每项能力均可被其它面板单独注入和复用。
 */
export interface AgentPanelCapabilities {
    settingsNavigation?: SettingsNavigationPort;
    identityAccess?: IdentityAccessPort;
    notification?: NotificationPort;
    message?: MessagePort;
    confirm?: ConfirmPort;
    menu?: PanelMenuPort;
    editorContext?: EditorContextPort;
    pluginActions?: PluginActionPort;
    focus?: PanelFocusPort;
    frontendReload?: FrontendReloadPort;
    dockVisibility?: DockVisibilityPort;
    tabOpen?: PanelTabOpenPort;
    floatOpen?: PanelFloatOpenPort;
    directoryPicker?: DirectoryPickerPort;
    contentRender?: ContentRenderPort;
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
