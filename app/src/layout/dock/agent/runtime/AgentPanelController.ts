import type {AppFacade} from "../../../../app/AppFacade.types";
import {Tab} from "../../../Tab";
import {AgentChat} from "../AgentChat";
import type {
    AgentPanelConversation,
    AgentPanelHandle,
    AgentPanelMountOptions,
} from "./agentPanel.ports.types";

/** 将唯一 AgentChat 实现挂载到任意 HTMLElement，并统一管理实例生命周期。 */
export class AgentPanelController implements AgentPanelHandle {
    private readonly tab: Tab;
    private readonly chat: AgentChat;
    private destroyed = false;

    constructor(options: AgentPanelMountOptions, app?: AppFacade) {
        this.tab = new Tab({});
        this.tab.panelElement.classList.add("agent-panel-runtime");
        options.target.replaceChildren(this.tab.panelElement);
        this.chat = new AgentChat(app, this.tab, {
            ...(options.capabilities ? {capabilities: options.capabilities} : {}),
            ...(options.initialConversation ? {initialConversation: options.initialConversation} : {}),
            ...(typeof options.enableSessionWebSocket === "boolean"
                ? {enableSessionWebSocket: options.enableSessionWebSocket}
                : {}),
        });
        this.tab.addModel(this.chat);
    }

    /** 等待内部会话初始化完成，供宿主在显示面板前建立确定的 ready 边界。 */
    ready() {
        return this.chat.ready();
    }

    /** 切换目标或会话，并复用 AgentChat 自身的保存和中止语义。 */
    openConversation(conversation: AgentPanelConversation) {
        return this.chat.openConversation(conversation);
    }

    /** 返回当前目标和会话标识，供布局序列化与 URL 同步使用。 */
    getConversation() {
        return this.chat.getConversation();
    }

    /** 请求已打开的会话面板刷新索引，供宿主响应外部变化。 */
    refreshSessions() {
        return this.chat.refreshSessions();
    }

    /** 将宿主提供的文本写入 Composer，不依赖具体编辑器 DOM。 */
    setDraft(text: string, focus = true) {
        return this.chat.setDraft(text, focus);
    }

    /** 销毁网络、编辑器和 DOM；宿主卸载时调用一次。 */
    destroy() {
        if (this.destroyed) {
            return;
        }
        this.destroyed = true;
        this.chat.destroy();
        this.tab.panelElement.remove();
        this.tab.headElement?.remove();
    }
}

/** 创建控制器并等待 ready；失败时统一销毁半初始化资源。 */
export const mountAgentPanel = async (options: AgentPanelMountOptions, app?: AppFacade) => {
    const controller = new AgentPanelController(options, app);
    try {
        await controller.ready();
        return controller;
    } catch (error) {
        controller.destroy();
        throw error;
    }
};
