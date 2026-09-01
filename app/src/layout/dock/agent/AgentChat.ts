/** 用途：提供 AgentChat 所属页签类型；使用范围：门面继承与浮窗副本创建；解耦评估：该类型同时参与运行时构造，静态导入保持模型协议一致。 */
import {Tab} from "./imports";
/** 用途：复用布局模型基类；使用范围：AgentChat 公开门面；解耦评估：继承关系属于类定义约束，不能通过实例参数替代。 */
import {Model} from "./imports";
/** 用途：约束应用能力入口；使用范围：构造参数与模型泛型。 */
import type {AppFacade} from "./imports";
/** 用途：生成 WebSocket 连接标识；使用范围：AgentChat 初始化；解耦评估：仅构造阶段调用，无需扩大构造参数。 */
import {genUUID} from "./imports";
/** 用途：取得聊天 Markdown 渲染器；使用范围：AgentChat 构造阶段；解耦评估：渲染器是稳定共享设施，注入只会转移相同依赖。 */
import {getAgentLute} from "./imports";
/** 用途：监听 MAGI 身份切换；使用范围：门面生命周期；解耦评估：事件名经本目录网关转发，监听器由实例显式释放。 */
import {MAGI_IDENTITY_SESSION_CHANGED_EVENT} from "./imports";
/** 用途：约束面板能力和会话协议；使用范围：公开门面参数与字段。 */
import type {AgentPanelCapabilities} from "./runtime/agentPanel.ports.types";
/** 用途：约束公开会话参数；使用范围：门面打开与读取会话；解耦评估：纯端口类型。 */
import type {AgentPanelConversation} from "./runtime/agentPanel.ports.types";
/** 用途：约束当前目标种类；使用范围：门面公开状态；解耦评估：纯端口类型。 */
import type {AgentPanelConversationKind} from "./runtime/agentPanel.ports.types";
/** 用途：约束门面保存的会话条目；使用范围：AgentChat 内部状态。 */
import type {SessionEntry} from "./chat/AgentChat.runtime.types";
/** 用途：编译期校验公开运行时状态；使用范围：AgentChat 类声明；解耦评估：纯类型导入不会产生运行时依赖。 */
import type {AgentChatRuntime} from "./chat/AgentChat.runtime.types";
/** 用途：转发公开生命周期方法；使用范围：AgentChat 公开门面；解耦评估：方法集是门面实现，静态导入保持调用关系可追踪。 */
import {getSessionId} from "./chat/ui/lifecycle/AgentChat.facade";
/** 用途：打开指定会话；使用范围：公开门面；解耦评估：门面仅转发显式运行时。 */
import {openConversation} from "./chat/ui/lifecycle/AgentChat.facade";
/** 用途：等待异步初始化；使用范围：公开门面；解耦评估：门面仅暴露稳定 Promise。 */
import {ready} from "./chat/ui/lifecycle/AgentChat.facade";
/** 用途：刷新会话列表；使用范围：公开门面；解耦评估：门面仅转发显式运行时。 */
import {refreshSessions} from "./chat/ui/lifecycle/AgentChat.facade";
/** 用途：按标识恢复会话；使用范围：公开门面；解耦评估：门面仅转发显式运行时。 */
import {restoreSessionById} from "./chat/ui/lifecycle/AgentChat.facade";
/** 用途：写入输入草稿；使用范围：公开门面；解耦评估：门面仅转发显式运行时。 */
import {setDraft} from "./chat/ui/lifecycle/AgentChat.facade";
/** 用途：创建文件浏览器目录任务；使用范围：Agent 面板公开门面。 */
import {createTaskFromDirectory, createTaskFromFiles} from "./chat/session/files/AgentChat.taskCreation";
/** 用途：配置浮窗关闭能力；使用范围：公开门面；解耦评估：显式回调保存在公开状态。 */
import {setFloatingCopyOptions} from "./chat/ui/lifecycle/AgentChat.facade";
/** 用途：把会话加载到浮窗副本；使用范围：副本初始化；解耦评估：函数显式接收独立副本和会话。 */
/** 用途：释放运行时资源；使用范围：门面销毁；解耦评估：集中释放避免遗漏监听器。 */
import {disposeAgentChatRuntime} from "./chat/ui/lifecycle/AgentChat.dispose";
/** 用途：插入块引用；使用范围：公开门面；解耦评估：门面仅转发显式运行时。 */
import {insertBlockMentions} from "./chat/ui/composer/AgentChat.composer";
/** 用途：转发公开模型选项方法；使用范围：AgentChat 公开门面；解耦评估：职责模块由门面固定装配，不需要调用方注入。 */
import {refreshModelOptions} from "./chat/ui/model/AgentChat.model.methods";
/** 用途：执行界面初始化；使用范围：AgentChat 构造阶段；解耦评估：初始化属于实例固有生命周期，静态模块边界足够清晰。 */
import {initUI} from "./chat/ui/lifecycle/AgentChat.init.methods";
/** 用途：绑定聊天交互事件；使用范围：AgentChat 构造阶段；解耦评估：事件模块只通过运行时契约访问实例，无需额外注入。 */
import {bindEvents} from "./chat/ui/events/AgentChat.events.methods";
/** 用途：捕获编辑器上下文；使用范围：默认面板能力适配；解耦评估：无实例依赖，直接函数调用保持边界清晰。 */
import {captureEditorContext} from "./chat/message/context/AgentChat.context.methods";
/** 用途：初始化、保存和恢复会话；使用范围：构造回调与浮窗复制；解耦评估：会话方法通过共享运行时契约装配，继续静态引用避免重复代理。 */
import {loadMagiIdentityConversation} from "./chat/session/lifecycle/AgentChat.magi";
/** 用途：处理跨实例会话通知；使用范围：门面 WebSocket 回调；解耦评估：回调显式接收当前实例。 */
import {onWsMessage} from "./chat/session/switching/AgentChat.websocket";
/** 用途：保存当前会话；使用范围：浮窗复制前；解耦评估：会话仓储由显式端口持有。 */
import {saveSession} from "./chat/session/persistence/AgentChat.save";
/** 用途：刷新配置与身份相关界面；使用范围：门面的全局事件回调；解耦评估：回调生命周期由门面持有，直接调用对应职责模块最明确。 */
import {checkConfigChanged} from "./chat/ui/lifecycle/AgentChat.shell.methods";
/** 用途：刷新身份按钮；使用范围：MAGI 身份事件；解耦评估：函数显式接收公开运行时。 */
import {updateGuardianAuthButton} from "./chat/ui/lifecycle/AgentChat.shell.methods";
/** 用途：装配会话领域抽象端口；使用范围：AgentChat 构造阶段；解耦评估：具体依赖集中在会话组合根，业务文件只读取接口。 */
import {createAgentChatSessionPorts} from "./chat/session/AgentChat.sessionPorts";
/** 用途：创建观察设置关闭的 DOM 观察器；使用范围：AgentChat 构造阶段；解耦评估：具体构造留在既有 observer 工厂。 */
import {createAgentChatMutationObserver} from "./chat/ui/feedback/AgentChat.observer.factory";
/** 用途：创建独立 AgentChat 实例；使用范围：浮窗副本；解耦评估：构造器由调用方显式传入，工厂不反向依赖门面。 */
import {createAgentChatInstance} from "./AgentChat.instance.factory";
/** 用途：装配实例级会话执行控制器；使用范围：AgentChat 构造阶段；解耦评估：具体 adapter 已由 sessionPorts 注册。 */
import {createAgentChatConversationController} from "./chat/runtime/AgentChat.conversationController";
/** 用途：创建实例级执行 adapter 注册表；使用范围：AgentChat 构造阶段；解耦评估：具体注册集合只在门面组合根声明，并允许调用方注入替代注册表。 */
import {createAgentConversationAdapterRegistry} from "./runtime/conversation/agentConversation.registry";
/** 用途：创建 native Agent 执行 adapter；使用范围：默认注册集合；解耦评估：具体传输实现不进入共享 sessionPorts 或业务模块。 */
import {createNativeAgentConversationAdapter} from "./runtime/conversation/nativeAgentConversation.adapter";

/**
 * AgentChat 保留布局框架要求的模型身份，并公开其可观察运行时状态。
 * @允许类: AgentChat 是 SiYuan 布局系统已经发布并被多处调用的模型门面，它必须同时满足 Model 的连接生命周期、Tab 父子关系、布局序列化、
 * 销毁协议以及浮窗复制协议。现有布局恢复器、Dock 工厂和 AgentPanelController 都以这个构造器和实例身份作为稳定边界，直接替换成对象字面量会改变
 * instanceof、父类 connect/ws 状态以及通用布局模型读取方式。业务副作用位于按职责划分的命名函数中，类仅持有与单个 Tab 生命周期绑定的 DOM、会话、
 * 流式和资源状态，并直接实现 AgentChatRuntime。所有字段均为公开结构，测试、调试器和职责函数可直接检查；所有动作均通过显式函数调用传入实例，
 * 不存在运行时方法安装或隐式绑定。若布局框架未来提供组合式连接端口，可再迁移模型身份；当前继承仅用于保持既有框架协议。
 * 已评估闭包工厂、普通对象组合和单独控制器持有 Model：前两者会破坏 instanceof 与布局恢复，后者会复制连接和销毁所有权并产生双重生命周期。
 * @允许继承: 框架要求 (FrameworkRequired)
 */
export class AgentChat extends Model<AppFacade | undefined, Tab> implements AgentChatRuntime {
    public override parent: Tab;

    public messagesContainer!: HTMLElement;
    public composerHost!: HTMLElement;
    public composer: AgentChatRuntime["composer"] = null;
    public sendBtn!: HTMLElement;
    public stopBtn!: HTMLElement;
    public deliveryControl!: HTMLElement;
    public steerDeliveryBtn!: HTMLButtonElement;
    public queueDeliveryBtn!: HTMLButtonElement;
    public queueDock!: HTMLElement;
    public editingQueueInputID = "";
    public sessionFilesBtn!: HTMLButtonElement;
    public sessionFilesInput!: HTMLInputElement;
    public promptSourceController!: AgentChatRuntime["promptSourceController"];
    public sessionFileOperationSerial = 0;
    public sessionFileOperationPending = false;
    public newSessionBtn!: HTMLElement;
    public guardianAuthBtn!: HTMLElement;
    public identityLabelElement!: HTMLElement;
    public titleElement!: HTMLElement;
    public sessionMenuBtn!: HTMLElement;
    public floatingBtn!: HTMLElement;
    public tabBtn!: HTMLElement;
    public tabNewBtn!: HTMLElement;
    public sessionPanel!: AgentChatRuntime["sessionPanel"];
    public sessionPorts: AgentChatRuntime["sessionPorts"];
    public sessionId = "";
    public sessionTitle = "";
    public pendingSessionTitle: string | null = null;
    public entries: SessionEntry[] = [];
    public hasTitled = false;
    public isStreaming = false;
    public currentAIElement: HTMLElement | null = null;
    public currentAssistantEntryId = "";
    public currentThinkingEntryId = "";
    public currentTurnID = "";
    public currentRoundID = "";
    public recoveryCommitTurnIDs = new Map<string, string>();
    public pendingRecoverySessionIDs = new Set<string>();
    public recoveryInFlightSessionIDs = new Set<string>();
    public lute: Lute;
    public currentContent = "";
    public fullContent = "";
    public contextTokens = 0;
    public contextTokenBreakdown: Record<string, number> = {};
    public contextCachedTokens = 0;
    public contextLimit = 0;
    public tokenPopup: HTMLElement | null = null;
    public tokenPopupOutsideClickHandler: (() => void) | null = null;
    public tokenPopupResizeHandler: (() => void) | null = null;
    public sessionCreatedAt = 0;
    public requestStartTime = 0;
    public tokenDisplayEl!: HTMLElement;
    public defaultTitle = "";
    public currentToolCalls: Array<{
        id?: string;
        name: string;
        roundID?: string;
        arguments: Record<string, unknown>;
        result?: string;
        state?: string;
    }> = [];
    public toolCallStartedAt = new Map<string, number>();
    public abortController: AbortController | null = null;
    public currentThinkingText = "";
    public currentThinkingReasoning = "";
    public currentThinkingReasoningContent = "";
    public editingUserEntryID = "";
    public pendingEditDraft: { entryID: string; content: string } | null = null;
    // thinking step 只保留工具名与调用 ID（去重：arguments/result 仅在 assistant entry 存一份），
    // 不再保存 text（"已思考：Xs" 由 i18n 在渲染时从 duration 生成）。
    public currentThinkingSteps: Array<{
        reasoning: string;
        reasoningContent: string;
        roundID?: string;
        toolNames?: string[];
        toolCallIDs?: string[];
        content?: string
    }> = [];
    // 当前请求的思考耗时（秒）。持久化为 entry.duration，"已思考"文本不落盘。
    public currentThinkingDuration = 0;
    public currentThinkingStepContent = "";
    public pendingConfirms: SessionEntry[] = [];
    public renderedToolNames: Record<string, boolean> = {};
    public hasInterveningCard = false;
    public modelSelect!: HTMLSelectElement;
    public targetSelect!: HTMLSelectElement;
    public selectedModel = "";
    public modelOptions: Array<{ id: string; name: string }> = [];
    public modelOptionsSignature = "";
    // 推理努力度（iconBrain + 原生 select），仅实例记忆，刷新后回到默认。
    public reasoningEffortSelect!: HTMLSelectElement;
    public selectedReasoningEffort = "";
    public permissionSelect!: HTMLSelectElement;
    public permissionMode: "confirm" | "allowSession" = "confirm";
    public userScrolledUp = false;
    public programmaticScroll = false;
    public stickResizeObserver: ResizeObserver | null = null;
    // 按会话保存的距底部距离（scrollHeight - scrollTop），用于切换会话与开关 dock 面板后恢复滚动位置。
    // 用距底距离而非绝对 scrollTop：dock 展开/折叠有宽高过渡，期间 scrollHeight 变化，
    // 距底距离与之无关，恢复后能定位到同样的相对位置。
    public scrollBottomBySession: Map<string, number> = new Map();
    // 面板可见性：dock 关闭时容器尺寸归零、浏览器把 scrollTop 钳制到 0，折叠期间不记录滚动位置。
    public layoutVisible = true;
    public layoutResizeObserver: ResizeObserver | null = null;
    public settingDialogObserver: MutationObserver | null = null;
    public scrollBottomBtn!: HTMLElement;
    public navRail!: HTMLElement;
    // 镜像态：当前会话正由其他实例流式对话，本实例处于只读占位锁定，期间不重绘当前视图。
    // 由 ws 的 streamStart/streamEnd 事件驱动，与发起者的 isStreaming 互斥（发起者走 SSE）。
    public mirrorLocked = false;
    public mirrorPlaceholderEl: HTMLElement | null = null;
    // 思考帧回调：流式进行时仅在显示秒数变化后刷新未完成思考卡片标题。
    public thinkingFrameID = 0;
    // 上一个 thinking step 快照时 currentToolCalls 的长度基准，
    // 用于计算本轮新增的工具（避免 step.toolNames 累积重复历史工具）。
    public lastStepToolCount = 0;
    /** 浮窗副本不属于布局树，不能把焦点/最小化动作转发给原始 Dock。 */
    public isFloatingCopy = false;
    public floatingCloseHandler: (() => void) | null = null;
    public initialization: Promise<void> = Promise.resolve();
    public agentDestroyed = false;
    public webReferenceMap: Record<string, string> = {};
    public webReferenceURLs = new Set<string>();
    public conversationKind: AgentPanelConversationKind;
    public capabilities: AgentPanelCapabilities;
    public enableSessionWebSocket: boolean;
    public initialSessionId: string;
    public capabilitiesFactory: ((tab: Tab) => AgentPanelCapabilities) | undefined;
    public magiIdentityId = "";
    public magiConversationLoading = false;
    public magiConversationLoadVersion = 0;
    public magiConversationLoadController: AbortController | null = null;
    public conversationAdapters: AgentChatRuntime["conversationAdapters"];
    public conversationController: AgentChatRuntime["conversationController"];

    public checkConfigChangedHandler = () => {
        checkConfigChanged(this);
        // 原生 Agent 的提示词来源依赖 AI 配置，配置变化后同步刷新来源摘要。
        if (this.conversationKind === "native-agent") {
            void this.promptSourceController.refresh();
        }
    };

    public handleMagiIdentitySessionChanged = () => {
        updateGuardianAuthButton(this);
        // MAGI 面板展示当前守护者身份的独立会话，身份切换后必须重新加载对应历史。
        if (this.conversationKind === "magi") {
            void loadMagiIdentityConversation(this);
        }
    };

    /** 设置 Dialog 被移除后读取已提交配置，并把模型变化投影到当前公开运行时。 */
    public handleSettingDialogMutation = () => {
        // 设置面板已经关闭时配置写入完成，此时读取最终配置并刷新模型状态。
        if (!document.querySelector(".config__panel")) {
            checkConfigChanged(this);
        }
    };

    public pendingTokenUpdate = false;
    public pendingReasoningUpdate = false;
    public rafId = 0;

    constructor(app: AppFacade | undefined, tab: Tab, options: {
        capabilities?: AgentPanelCapabilities;
        initialConversation?: AgentPanelConversation;
        enableSessionWebSocket?: boolean;
        capabilitiesFactory?: (tab: Tab) => AgentPanelCapabilities;
        sessionPorts?: AgentChatRuntime["sessionPorts"];
        conversationAdapters?: AgentChatRuntime["conversationAdapters"];
    } = {}) {
        super({app});
        this.parent = tab;
        this.capabilities = options.capabilities ?? {};
        this.capabilitiesFactory = options.capabilitiesFactory;
        this.sessionPorts = options.sessionPorts ?? createAgentChatSessionPorts();
        this.conversationAdapters = options.conversationAdapters ?? createAgentConversationAdapterRegistry([
            createNativeAgentConversationAdapter(),
        ]);
        // 主应用存在且调用方未注入上下文能力时，提供与原 Agent Dock 一致的默认捕获实现。
        if (app && !this.capabilities.captureEditorContext) {
            this.capabilities.captureEditorContext = captureEditorContext;
        }
        this.conversationKind = options.initialConversation?.kind ?? "native-agent";
        this.initialSessionId = options.initialConversation?.sessionId ?? "";
        this.enableSessionWebSocket = options.enableSessionWebSocket !== false;
        this.conversationController = createAgentChatConversationController(this);
        this.lute = getAgentLute({
            emojiSite: "/emojis",
            emojis: {}
        });
        this.defaultTitle = this.conversationKind === "magi" ? "MAGI" : (window.siyuan.languages.agentChat || "Agent");
        this.sessionTitle = this.defaultTitle;
        initUI(this);
        bindEvents(this);
        // 接入 ws 以接收跨实例的会话变更通知（agentSessionChanged）。
        // AgentChat dock 是单例常驻，ws 随之常驻，与 Backlink/Bookmark 等现有 dock 一致。
        if (this.enableSessionWebSocket) {
            this.connect({
                id: genUUID(),
                type: "agentChat",
                /** 将跨实例会话事件转发给会话职责模块，门面只持有连接生命周期。 */
                msgCallback: (data) => onWsMessage(this, data),
            });
        }
        // AI 配置保存走本地 patch（aiRuntime.ts 写 window.siyuan.config.ai）不广播 ws，
        // 故用两种方式兜底：window focus（跨窗口）+ MutationObserver 监听设置对话框关闭（同窗口即时）。
        window.addEventListener("focus", this.checkConfigChangedHandler);
        // 设置对话框是 SiYuan 内部模态，关闭时 window 不失焦，focus 事件不触发。
        // 监听 body 子节点变化，当含 .config__panel 的设置 dialog 被移除时即时刷新。
        this.settingDialogObserver = createAgentChatMutationObserver(this.handleSettingDialogMutation);
        this.settingDialogObserver.observe(document.body, {childList: true, subtree: false});
        window.addEventListener(MAGI_IDENTITY_SESSION_CHANGED_EVENT, this.handleMagiIdentitySessionChanged);
    }
    /** 等待聊天面板完成异步初始化。 @显式返回类型原因 公开门面固定返回 Promise<void>，调用方不应依赖内部初始化实现的推断细节。 */
    public ready(): Promise<void> {
        return ready(this);
    }

    /** 读取当前会话的公开定位信息。 @显式返回类型原因 该返回值属于 AgentPanelController 的稳定跨模块协议。 */
    public getConversation(): AgentPanelConversation {
        return {kind: this.conversationKind, sessionId: this.sessionId};
    }

    /** 刷新会话列表并保留当前面板状态。 @显式返回类型原因 公开异步命令固定为 Promise<void>，避免实现返回值外泄。 */
    public async refreshSessions(): Promise<void> {
        return refreshSessions(this);
    }

    /** 写入输入草稿并按参数决定是否聚焦。 @显式返回类型原因 公开异步命令固定为 Promise<void>，与面板控制器协议一致。 */
    public async setDraft(text: string, focus = true): Promise<void> {
        return setDraft(this, text, focus);
    }

    /** 创建并切换到一个绑定文件浏览器目录的新 native Agent 会话。 */
    public async createTaskFromDirectory(input: {
        rootID: string;
        path: string;
        title?: string;
    }): Promise<void> {
        return createTaskFromDirectory(this, input);
    }

    /** 创建并切换到一个带真实文件附件草稿的新 native Agent 会话。 */
    public async createTaskFromFiles(files: File[], title?: string): Promise<void> {
        return createTaskFromFiles(this, files, title);
    }

    /** 切换到指定会话并等待界面恢复完成。 @显式返回类型原因 公开异步命令固定为 Promise<void>，防止内部结果成为调用契约。 */
    public async openConversation(conversation: AgentPanelConversation): Promise<void> {
        return openConversation(this, conversation);
    }

    /** 配置浮窗副本关闭回调，由浮窗工厂在副本就绪后调用。 */
    public setFloatingCopyOptions(options: { onClose?: () => void } = {}) {
        return setFloatingCopyOptions(this, options);
    }

    /** 把布局浮窗关闭动作绑定到当前副本，不暴露内部选项对象。 */
    public setCloseHandler(handler: () => void) {
        return setFloatingCopyOptions(this, {onClose: handler});
    }

    /** 返回当前会话标识。 @显式返回类型原因 会话标识是布局持久化和面板控制器共享的公开字符串协议。 */
    public getSessionId(): string {
        return getSessionId(this);
    }

    /** 按标识恢复历史会话。 @显式返回类型原因 公开异步命令固定为 Promise<void>，与浮窗恢复调用约定一致。 */
    public async restoreSessionById(sessionId: string): Promise<void> {
        return restoreSessionById(this, sessionId);
    }

    /** 释放监听器、观察器、流请求和子控制器资源，并满足布局模型统一生命周期。 */
    public override dispose() {
        disposeAgentChatRuntime(this);
        return super.dispose();
    }

    /** 保留 AgentChat 领域的显式销毁命令。 */
    public destroy() {
        return this.dispose();
    }

    /** 将块引用插入当前输入草稿，供编辑器跨面板操作调用。 */
    public insertBlockMentions(mentions: Array<{ id: string; label: string }>) {
        return insertBlockMentions(this, mentions);
    }

    /** 从最新配置重建可选模型列表。 */
    public refreshModelOptions() {
        return refreshModelOptions(this);
    }


    /** 当前 Agent Tab 的自描述布局数据，由通用模型序列化协议读取。 @显式返回类型原因 布局恢复依赖固定字面量品牌和 sessionId 字段。 */
    public get layoutSerialization(): {readonly instance: "AgentChat"; readonly sessionId: string} {
        return {instance: "AgentChat", sessionId: this.sessionId};
    }

    /**
     * 创建一个真正独立的 Agent Dock 副本。
     * 副本拥有自己的 Tab、DOM、编辑器、WebSocket 和会话状态，不共享原实例的可变数组。
     * options.blankSession 为 true 时不复制当前会话，副本初始化后落入空白欢迎会话。
     * @显式返回类型原因 浮窗工厂必须获得完整 AgentChat 门面，而不是内部初始化过程推导出的结构类型。
     */
    public async createFloatingCopy(tab: Tab, options: {blankSession?: boolean} = {}): Promise<AgentChat> {
        await this.ready();
        // 复制会话副本需要先把已持久化的内容写入存储，这样副本可以通过稳定的会话协议加载；
        // 空白会话副本不依赖当前实例状态，跳过保存避免无谓写入。
        if (!options.blankSession) {
            await saveSession(this);
        }
        const copy = createAgentChatInstance(AgentChat, this.app || undefined, tab, {
            capabilities: this.capabilitiesFactory?.(tab) ?? this.capabilities,
            ...(this.capabilitiesFactory ? {capabilitiesFactory: this.capabilitiesFactory} : {}),
            // 空白副本不传初始会话，让 initSessions 的空白分支创建全新会话。
            ...(options.blankSession ? {} : {initialConversation: this.getConversation()}),
            enableSessionWebSocket: this.enableSessionWebSocket,
            sessionPorts: this.sessionPorts,
            conversationAdapters: this.conversationAdapters,
        });
        try {
            await copy.ready();
            copy.setFloatingCopyOptions();
            // 会话副本的初始快照已由副本 initSessions 通过 initialConversation 加载；
            // 不再重复加载磁盘快照，避免覆盖副本订阅会话事件流后已投影的实时进度。
            return copy;
        } catch (error) {
            copy.destroy();
            throw error;
        }
    }
}
