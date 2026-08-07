/** 用途：绑定主应用上下文；使用范围：仅 App 宿主 capability；解耦评估：纯类型参数，面板核心不导入 App。 */
import type {AppFacade} from "./imports";
/** 用途：绑定当前面板 Tab；使用范围：Tab/浮窗打开 Port；解耦评估：纯类型参数，具体动作经细粒度 Port 注入。 */
import type {Tab} from "./imports";
/** 用途：约束完整能力工厂返回值；使用范围：主应用宿主装配；解耦评估：复用面板既有完整能力接口。 */
import type {AgentPanelCapabilities} from "./imports";
/** 用途：提供主应用确认框；使用范围：App 能力聚合；解耦评估：具体 UI 实现留在宿主。 */
import {confirmDialog} from "./imports";
/** 用途：创建主应用标准对话框；使用范围：App 能力聚合；解耦评估：具体类不进入 Agent 面板领域。 */
import {Dialog} from "./imports";
/** 用途：提供短消息提示；使用范围：App 能力聚合；解耦评估：核心不感知 Dialog。 */
import {showMessage} from "./imports";
/** 用途：发送主应用通知；使用范围：App 能力聚合；解耦评估：平台实现无需下沉到核心。 */
import {sendNotification} from "./imports";
/** 用途：聚焦主应用面板；使用范围：App 能力聚合；解耦评估：核心不直接操作 Layout。 */
import {setPanelFocus} from "./imports";
/** 用途：定位并收起 Agent Dock；使用范围：App 能力聚合；解耦评估：仅宿主依赖 Dock 注册表。 */
import {getDockByType} from "./imports";
/** 用途：打开非模态浮窗；使用范围：App 能力聚合；解耦评估：复用现有布局边界。 */
import {requestOpenTabAsDialog} from "./imports";
/** 用途：打开普通布局 Tab；使用范围：App 能力聚合；解耦评估：复用现有布局边界。 */
import {requestOpenTabAsTab} from "./imports";
/** 用途：发现插件动作；使用范围：App 能力聚合；解耦评估：注册表仅由宿主访问。 */
import {listActions} from "./imports";
/** 用途：执行插件动作；使用范围：App 能力聚合；解耦评估：注册表仅由宿主访问。 */
import {lookupAction} from "./imports";
/** 用途：打开 MAGI 身份入口；使用范围：App 能力聚合；解耦评估：具体 Tab 入口留在宿主。 */
import {openIdentityAccessTab} from "./imports";
/** 用途：通知身份服务显示访问流程；使用范围：App 能力聚合；解耦评估：身份服务不进入面板核心。 */
import {requestMagiIdentityAccess} from "./imports";
/** 用途：处理消息富内容；使用范围：App 能力聚合；解耦评估：绑定 App 后注入。 */
import {postRender} from "./imports";
/** 用途：展示主应用菜单；使用范围：Agent 面板菜单能力；解耦评估：命名函数直接进入完整能力聚合。 */
import {showAppPanelMenu} from "./agentPanel.menu.app";
/** 用途：关闭主应用菜单；使用范围：Agent 面板菜单能力；解耦评估：命名函数直接进入完整能力聚合。 */
import {closeAppPanelMenu} from "./agentPanel.menu.app";
/** 用途：创建浏览器重载动作；使用范围：App 能力聚合；解耦评估：共享工厂避免重复实现。 */
import {createBrowserHostReload} from "./agentPanel.reload.browser.factory";

/**
 * 在主应用组合根创建完整宿主能力，供 Dock、Tab 和浮窗共用。
 * @显式返回类型原因: 组合根必须校验其返回对象始终满足唯一的 AgentPanelCapabilities 公共契约。
 * @同步豁免: UI构建 必须在 Agent 面板构造时同步提供 capability，对象本身不启动异步任务。
 */
export const createAppAgentPanelCapabilities = (app: AppFacade, tab: Tab): AgentPanelCapabilities => {
    /** 打开绑定当前 Tab 的普通布局副本。 */
    // @柯里化：需要为通用 Port 绑定当前 Tab 实例。
    const openTab = () => {
        void requestOpenTabAsTab(tab);
    };
    /** 在标签页新建一个空白会话的独立 Agent 面板，复用同一 Port 并声明 new 模式。 */
    // @柯里化：需要为通用 Port 绑定当前 Tab 实例。
    const openTabNew = () => {
        void requestOpenTabAsTab(tab, "agent-dock", "new");
    };
    /** 打开绑定当前 Tab 的非模态浮窗副本。 */
    // @柯里化：需要为通用 Port 绑定当前 Tab 实例。
    const openFloat = () => requestOpenTabAsDialog(tab);
    /** 使用绑定当前 App 的渲染上下文处理消息富内容。 */
    // @柯里化：需要为通用渲染 Port 绑定当前 App 实例。
    const renderContent = (container: HTMLElement) => postRender(container, app);

    return {
        /** 打开或复用主应用 AI 设置页。 */
        openAISettings() {
            const existing = window.siyuan.dialogs.find((dialog) => dialog.element.querySelector(".config__tab-container"));
            if (!existing) {
                app.openSettings("ai");
            }
        },
        /** 打开 MAGI 身份入口并发布访问请求。 */
        async openIdentityAccess() {
            await openIdentityAccessTab({app});
            requestMagiIdentityAccess();
        },
        /** 使用主应用通知系统显示 Agent 消息。 */
        notify(notification) {
            sendNotification({...notification, timeoutType: "default"});
        },
        showMessage,
        confirm: confirmDialog,
        /** 将标准 Dialog 构造限制在 App 宿主边界。 */
        createDialog(options) {
            return new Dialog(options);
        },
        showMenu: showAppPanelMenu,
        closeMenu: closeAppPanelMenu,
        /** 列出已提供描述的 Agent 插件动作。 */
        listPluginActions: () => listActions()
            .filter((action) => action.name.startsWith("plugin__") && action.description)
            .map((action) => ({name: action.name, description: String(action.description)})),
        /** 在当前 App 上下文中执行指定插件动作。 */
        async executePluginAction(name, args) {
            const action = lookupAction(name);
            return action?.handler(args, app);
        },
        focusPanel: setPanelFocus,
        reloadFrontend: createBrowserHostReload(),
        /** 收起当前 Agent Dock，不影响 Tab 或浮窗实例。 */
        minimizeDock() {
            getDockByType("agentChat")?.toggleModel("agentChat", false, true);
        },
        openTab,
        openTabNew,
        openFloat,
        postRender: renderContent,
    };
};
