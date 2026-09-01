/** 用途：创建移动 Agent 容器；使用范围：首次打开流程；解耦评估：实例化集中在 factory，避免 UI 文件直接构造对象。 */
import {createMobileAgentChat} from "./MobileAgentChat.factory";
/** 用途：创建移动 Agent 容器；使用范围：首次打开流程；解耦评估：实例化集中在 factory，避免 UI 文件直接构造对象。 */
import {createMobileAgentTab} from "./MobileAgentChat.factory";
/** 用途：校验跨 HMR 状态注册表；使用范围：状态读取与初始化；解耦评估：运行时守卫隔离于业务装配，避免不安全断言。 */
import {isMobileAgentChatState} from "./MobileAgentChat.guard";
/** 用途：提供移动 Agent 状态契约；使用范围：Symbol 注册表与状态访问；解耦评估：纯类型集中在 types 文件，避免业务模块重复声明。 */
import type {AgentChatNotification} from "./MobileAgentChat.types";
/** 用途：提供移动 Agent 流式状态契约；使用范围：菜单旋转状态；解耦评估：纯类型集中在 types 文件，避免业务模块重复声明。 */
import type {AgentChatStatus} from "./MobileAgentChat.types";
/** 用途：提供移动 Agent 注册表状态契约；使用范围：所有状态访问；解耦评估：纯类型集中在 types 文件，避免业务模块重复声明。 */
import type {MobileAgentChatState} from "./MobileAgentChat.types";
/** 用途：打开移动模型容器；使用范围：显示 Agent 面板；解耦评估：经 imports.ts 复用统一移动菜单生命周期。 */
import {openModel} from "./imports";
/** 用途：关闭移动模型；使用范围：Agent 面板隐藏；解耦评估：经 imports.ts 复用统一关闭流程。 */
import {closeModel} from "./imports";
/** 用途：关闭当前移动面板；使用范围：打开 Agent 前收拢其它面板；解耦评估：经 imports.ts 维护面板栈状态。 */
import {closePanel} from "./imports";
/** 用途：显示应用内通知；使用范围：页面可见时的 Agent 通知；解耦评估：经 imports.ts 复用全局消息设施。 */
import {showMessage} from "./imports";
/** 用途：发送系统通知；使用范围：页面失焦时的 Agent 通知；解耦评估：经 imports.ts 复用平台通知桥接。 */
import {sendNotification} from "./imports";
/** 用途：判断 AI 功能是否被禁用；使用范围：移动 Agent 入口 guard；解耦评估：经 imports.ts 统一读取功能开关。 */
import {isDisabledFeature} from "./imports";
/** 用途：打开移动设置并登记返回回调；使用范围：Agent 能力设置入口；解耦评估：经 imports.ts 维护移动返回栈。 */
import {getMobileSettingOpener} from "./imports";
/** 用途：注册移动 Agent 打开能力；使用范围：移动菜单初始化；解耦评估：运行时端口负责跨模块绑定。 */
import {setMobileAgentOpen} from "./agent.port";
/** 用途：约束移动 Agent 应用上下文；使用范围：打开和设置回调；解耦评估：纯类型依赖，不复制宿主状态。 */
import type {AppFacade} from "./imports";

/** 移动 Agent 状态的全局注册键，跨 HMR 保持同一面板实例。 */
const mobileAgentStateKey = Symbol.for("sforge.mobile.agent.state");

/** 读取或初始化移动 Agent 的跨 HMR 状态。 */
const getMobileAgentState = () => {
    const current = Reflect.get(globalThis, mobileAgentStateKey);
    // 旧模块未注册或结构不完整时创建新的最小状态对象。
    if (isMobileAgentChatState(current)) {
        return current;
    }
    const nextState: MobileAgentChatState = {
        visible: false,
        running: false,
        unread: undefined,
    };
    if (!Reflect.set(globalThis, mobileAgentStateKey, nextState)) {
        throw new Error("Unable to register mobile Agent state");
    }
    return nextState;
};

/** 更新移动 Agent 菜单的未读和运行状态；在状态事件与轮询回调中调用。 */
const updateMenuStatus = () => {
    const state = getMobileAgentState();
    const item = document.getElementById("menuAgentChat");
    if (!item) {
        return;
    }
    const icon = item.querySelector(".b3-menu__icon");
    icon?.classList.toggle("fn__rotate", state.running);
    const status = item.querySelector('[data-type="agent-status"]');
    if (!status) {
        return;
    }
    status.classList.toggle("fn__none", !state.unread);
    status.classList.toggle("agent-menu-status--warning", state.unread === "confirm");
    status.textContent = state.unread === "confirm" ? window.siyuan.languages.agentConfirmPending : "●";
};

/** 从移动端模型容器分离 Agent 面板，以便关闭后复用同一实例。 */
const detach = () => {
    const state = getMobileAgentState();
    state.visible = false;
    const modelElement = document.getElementById("model");
    // 模型容器可能尚未创建，存在时才移除 Agent 样式。
    if (modelElement) {
        modelElement.classList.remove("model--agent");
    }
    const rootElement = state.rootElement;
    // 仅当面板仍挂在 DOM 中时移动到文档片段，避免重复插入。
    if (!rootElement?.parentElement) {
        return;
    }
    const detachedRoot = state.detachedRoot || document.createDocumentFragment();
    state.detachedRoot = detachedRoot;
    detachedRoot.appendChild(rootElement);
};

/** 处理隐藏面板期间的 Agent 通知，并更新菜单提示。 */
const notify = (type: AgentChatNotification) => {
    const state = getMobileAgentState();
    if (state.visible) {
        return;
    }
    state.unread = type;
    updateMenuStatus();
    const title = type === "confirm" ?
        window.siyuan.languages.agentNotifyConfirm : window.siyuan.languages.agentNotifyDone;
    // 页面不可见时交给系统通知，页面可见时使用应用内消息。
    if (!document.hasFocus() || document.hidden) {
        void sendNotification({title, timeoutType: "default"});
        return;
    }
    showMessage(title, 3000, "info");
};

/** 将 Agent 流式状态投影到移动菜单图标。 */
const setStatus = (status: AgentChatStatus) => {
    const state = getMobileAgentState();
    state.running = status === "running";
    updateMenuStatus();
};

/** 轮询 Agent 流式状态；实例销毁后清理对应定时器。 */
const pollAgentStatus = (statusPoll: number) => {
    const state = getMobileAgentState();
    if (!state.agentChat) {
        window.clearInterval(statusPoll);
        return;
    }
    setStatus(state.agentChat.isStreaming ? "running" : "idle");
};

/** 懒创建并挂载移动 Agent 实例，确保重复打开复用同一 Tab。 */
const ensureAgentChat = (currentApp: AppFacade) => {
    const state = getMobileAgentState();
    const mobile = window.siyuan.mobile;
    if (!mobile) {
        return;
    }
    state.app = currentApp;
    if (state.agentChat && state.rootElement) {
        return;
    }
    const tab = createMobileAgentTab();
    tab.panelElement.classList.add("agent-panel-runtime");
    state.agentTab = tab;
    state.rootElement = tab.panelElement;
    const detachedRoot = document.createDocumentFragment();
    state.detachedRoot = detachedRoot;
    detachedRoot.appendChild(tab.panelElement);
    const chat = createMobileAgentChat(currentApp, tab, {
        capabilities: {
            /** 将 Agent 能力层通知映射为移动菜单的两种未读状态。 */
            notify: (notification: {title: string; body?: string}) => {
                const type: AgentChatNotification = notification.title === window.siyuan.languages.agentNotifyConfirm ? "confirm" : "done";
                notify(type);
            },
            showMessage,
            /** 设置入口关闭 Agent 后登记回调，以便返回时恢复面板。 */
            openAISettings: () => {
                hideMobileAgent();
                getMobileSettingOpener()(currentApp, "ai", reopenMobileAgent);
            },
            minimizeDock: hideMobileAgent,
        },
    });
    state.agentChat = chat;
    tab.addModel(chat);
    // 兼容旧状态回调：轮询 isStreaming 更新菜单旋转状态。
    const statusPoll = window.setInterval(() => pollAgentStatus(statusPoll), 500);
    mobile.agentChat = chat;
    mobile.agentChatController = {
        handleBack: handleMobileAgentBack,
        refreshStatus: updateMenuStatus,
    };
};

/** 打开移动端 Agent 面板；由菜单、快捷入口和提及操作调用。 */
/** @同步豁免: UI构建 */
export const openMobileAgent = (currentApp: AppFacade) => {
    if (isDisabledFeature("ai")) {
        return;
    }
    ensureAgentChat(currentApp);
    const state = getMobileAgentState();
    const panelElement = state.rootElement;
    if (!state.agentChat || !panelElement) {
        return;
    }
    closePanel();
    openModel({
        title: "",
        html: "",
        /** 打开模型后立即恢复已分离的面板节点。 */
        bindEvent(modelMainElement) {
            modelMainElement.appendChild(panelElement);
        },
        destroyCallback: detach,
    });
    const modelElement = document.getElementById("model");
    // openModel 通常已创建容器，但移动端冷启动允许它暂时不存在。
    if (modelElement) {
        modelElement.classList.add("model--agent");
    }
    state.visible = true;
    state.unread = undefined;
    updateMenuStatus();
};

/** 隐藏移动端 Agent 面板并保留实例；由返回键和最小化动作调用。 */
/** @同步豁免: UI构建 */
export const hideMobileAgent = () => {
    const state = getMobileAgentState();
    if (!state.visible) {
        return;
    }
    state.visible = false;
    const modelElement = document.getElementById("model");
    // 隐藏操作可能发生在模型已销毁之后，存在时才清理样式。
    if (modelElement) {
        modelElement.classList.remove("model--agent");
    }
    closeModel();
};

/** 响应移动端返回手势并报告是否消费了 Agent 面板。 */
/** @同步豁免: UI构建 */
export const handleMobileAgentBack = () => {
    if (!getMobileAgentState().visible) {
        return false;
    }
    hideMobileAgent();
    return true;
};

/** 打开移动 Agent 并插入块提及；由搜索/引用入口在有选中项时调用。 */
/** @同步豁免: UI构建 */
export const insertMobileAgentMentions = (currentApp: AppFacade, mentions: Array<{id: string; label: string}>) => {
    if (mentions.length === 0 || isDisabledFeature("ai")) {
        return;
    }
    openMobileAgent(currentApp);
    getMobileAgentState().agentChat?.insertBlockMentions(mentions);
};

/** 同步读取移动 Agent 可见状态；供返回路由和手势协调器即时判断。 */
/** @同步豁免: 性能考虑 */
export const isMobileAgentVisible = () => getMobileAgentState().visible;

// Agent 模块装配后发布打开能力，供菜单和底栏通过端口调用。
setMobileAgentOpen(openMobileAgent);

/** 从设置页返回后重新打开此前的移动 Agent 面板。 */
/** @同步豁免: UI构建 */
export const reopenMobileAgent = () => {
    const state = getMobileAgentState();
    if (state.app) {
        openMobileAgent(state.app);
    }
};
