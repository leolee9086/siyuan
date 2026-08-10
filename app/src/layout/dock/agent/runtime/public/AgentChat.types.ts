/** 用途：约束布局模型公共生命周期；使用范围：AgentChat 公开领域继承；解耦评估：只加载布局抽象，不依赖 Model 具体类。 */
import type {ModelDomain} from "./imports";
/** 用途：约束可切换的会话目标；使用范围：AgentChat 会话查询和切换；解耦评估：纯运行时端口类型。 */
import type {AgentPanelConversation} from "./imports";
/** 用途：约束 AgentChat 所属页签；使用范围：挂载和浮窗副本；解耦评估：只加载布局公开聚合，不依赖 Tab 具体类。 */
import type {LayoutTab} from "./imports";
/** 用途：约束 AgentChat 所属应用能力；使用范围：宿主泛型默认值；解耦评估：AppFacade 是应用抽象，不加载 App 具体类。 */
import type {AppFacade} from "./imports";

/** AgentChat 的完整公开领域表面；外部布局与面板工厂只依赖此聚合根。 */
export interface AgentChatDomain<
    TApplication extends object | undefined = AppFacade | undefined,
    TParent extends LayoutTab = LayoutTab,
> extends ModelDomain<TApplication, TParent> {
    parent: TParent;
    ready(): Promise<void>;
    getConversation(): AgentPanelConversation;
    refreshSessions(): Promise<void>;
    setDraft(text: string, focus?: boolean): Promise<void>;
    createTaskFromDirectory(input: Readonly<{
        rootID: string;
        path: string;
        title?: string;
    }>): Promise<void>;
    createTaskFromFiles(files: File[], title?: string): Promise<void>;
    openConversation(conversation: AgentPanelConversation): Promise<void>;
    setFloatingCopyOptions(options?: {onClose?: () => void}): void;
    setCloseHandler(handler: () => void): void;
    getSessionId(): string;
    readonly layoutSerialization: {readonly instance: "AgentChat"; readonly sessionId: string};
    restoreSessionById(sessionId: string): Promise<void>;
    createFloatingCopy(tab: TParent, options?: {blankSession?: boolean}): Promise<AgentChatDomain<TApplication, TParent>>;
    dispose(): void;
    destroy(): void;
    insertBlockMentions(mentions: Array<{id: string; label: string}>): void;
    refreshModelOptions(): void;
}
