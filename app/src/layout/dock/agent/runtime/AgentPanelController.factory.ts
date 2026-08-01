/** 用途：约束完整应用能力；使用范围：AgentChat 构造参数；解耦评估：工厂依赖 AppFacade 抽象，不加载 App 具体类。 */
import type {AppFacade} from "./imports";
/** 用途：创建独立面板聊天实例；使用范围：本组合工厂；解耦评估：具体类只在实例化边界出现。 */
import {AgentChat} from "./imports";
/** 用途：创建独立布局页签；使用范围：本组合工厂；解耦评估：具体类只在实例化边界出现。 */
import {Tab} from "./imports";
/** 用途：约束控制器拥有的完整布局页签；使用范围：独立面板 DOM 生命周期；解耦评估：抽象生命周期函数不依赖 Tab 具体类。 */
import type {LayoutTab} from "./imports";
/** 用途：约束控制器管理的完整聊天领域；使用范围：公开命令委托和资源释放；解耦评估：同一 runtime 领域直接依赖公共聚合接口。 */
import type {AgentChatDomain} from "./public/AgentChat.types";
/** 用途：约束宿主挂载输入；使用范围：公开挂载入口；解耦评估：同一 runtime 领域直接依赖聚合契约。 */
import type {AgentPanelMountOptions} from "./agentPanel.ports.types";

/** 从完整布局与聊天领域创建可观察的面板生命周期句柄，不加载任何具体实现。 */
function createAgentPanelLifecycle(tab: LayoutTab, chat: AgentChatDomain) {
    const controller = {
        tab,
        chat,
        destroyed: false,
        openConversation: chat.openConversation.bind(chat),
        getConversation: chat.getConversation.bind(chat),
        refreshSessions: chat.refreshSessions.bind(chat),
        setDraft: chat.setDraft.bind(chat),
        /** 幂等释放聊天资源和当前面板拥有的 DOM。 */
        destroy() {
            if (controller.destroyed) {
                return;
            }
            controller.destroyed = true;
            chat.destroy();
            tab.panelElement.remove();
            tab.headElement?.remove();
        },
    };
    return controller;
}

/** 创建相互独立的布局页签和 AgentChat，并把具体实例注入抽象控制器。 */
function createAgentPanelController(options: AgentPanelMountOptions, app?: AppFacade) {
    const tab = new Tab({});
    tab.panelElement.classList.add("agent-panel-runtime");
    options.target.replaceChildren(tab.panelElement);
    const chat = new AgentChat(app, tab, {
        ...(options.capabilities ? {capabilities: options.capabilities} : {}),
        ...(options.initialConversation ? {initialConversation: options.initialConversation} : {}),
        ...(typeof options.enableSessionWebSocket === "boolean"
            ? {enableSessionWebSocket: options.enableSessionWebSocket}
            : {}),
    });
    tab.addModel(chat);
    return createAgentPanelLifecycle(tab, chat);
}

/** 创建控制器并等待 ready；初始化失败时统一销毁已经挂载的资源。 */
export async function mountAgentPanel(options: AgentPanelMountOptions, app?: AppFacade) {
    const controller = createAgentPanelController(options, app);
    try {
        await controller.chat.ready();
        return controller;
    } catch (error) {
        controller.destroy();
        throw error;
    }
}
