/** 用途：绑定主应用上下文；使用范围：仅 App 宿主 capability；解耦评估：纯类型参数，面板核心不导入 App。 */
import type {AppFacade} from "./imports";
/** 用途：绑定当前面板 Tab；使用范围：Tab/浮窗打开 Port；解耦评估：纯类型参数，具体动作经细粒度 Port 注入。 */
import type {Tab} from "./imports";
/** 用途：提供主应用确认框；使用范围：ConfirmPort；解耦评估：适配器依赖 UI 实现，面板核心只依赖 Port。 */
import {confirmDialog} from "./imports";
/** 用途：提供短消息提示；使用范围：MessagePort；解耦评估：适配器保留依赖，核心不感知 Dialog。 */
import {showMessage} from "./imports";
/** 用途：发送主应用通知；使用范围：NotificationPort；解耦评估：平台实现经 Port 注入，无需下沉到核心。 */
import {sendNotification} from "./imports";
/** 用途：聚焦主应用面板；使用范围：PanelFocusPort；解耦评估：布局动作由宿主注入，核心不直接操作 Layout。 */
import {setPanelFocus} from "./imports";
/** 用途：定位并收起 Agent Dock；使用范围：DockVisibilityPort；解耦评估：仅 App 适配器依赖 Dock 注册表。 */
import {getDockByType} from "./imports";
/** 用途：打开非模态浮窗；使用范围：PanelFloatOpenPort；解耦评估：现有布局 Port 可直接复用。 */
import {requestOpenTabAsDialog} from "./imports";
/** 用途：打开普通布局 Tab；使用范围：PanelTabOpenPort；解耦评估：现有布局 Port 可直接复用。 */
import {requestOpenTabAsTab} from "./imports";
/** 用途：发现插件动作；使用范围：PluginActionPort；解耦评估：注册表仅由 App 适配器访问。 */
import {listActions} from "./imports";
/** 用途：执行插件动作；使用范围：PluginActionPort；解耦评估：注册表仅由 App 适配器访问。 */
import {lookupAction} from "./imports";
/** 用途：打开 MAGI 身份入口；使用范围：IdentityAccessPort；解耦评估：具体 Tab 入口留在 App 宿主。 */
import {openIdentityAccessTab} from "./imports";
/** 用途：通知身份服务显示访问流程；使用范围：IdentityAccessPort；解耦评估：身份服务不进入面板核心。 */
import {requestMagiIdentityAccess} from "./imports";
/** 用途：处理消息富内容；使用范围：ContentRenderPort；解耦评估：绑定 App 后注入。 */
import {postRender} from "./imports";
/** 用途：创建主应用菜单适配器；使用范围：PanelMenuPort；解耦评估：实例化集中在 factory。 */
import {createAppPanelMenuPort} from "./agentPanel.menu.app.factory";
/** 用途：创建浏览器重载动作；使用范围：FrontendReloadPort；解耦评估：共享工厂避免重复实现。 */
import {createBrowserHostReload} from "./agentPanel.reload.browser.factory";
/** 用途：延迟加载设置模块；使用范围：SettingsNavigationPort；解耦评估：网关保留动态边界，避免布局初始化循环。 */
import {loadOpenSetting} from "./imports";

/**
 * 组合主应用实际具备的细粒度宿主能力，供 Dock、Tab 和浮窗共用。
 * @同步豁免: UI构建 必须在 Agent 面板构造时同步提供 capability，对象本身不启动异步任务。
 */
export const createAppAgentPanelCapabilities = (app: AppFacade, tab: Tab) => {
    /** 打开绑定当前 Tab 的普通布局副本。 */
    // @柯里化：需要为通用 Port 绑定当前 Tab 实例。
    const openTab = () => requestOpenTabAsTab(tab);
    /** 打开绑定当前 Tab 的非模态浮窗副本。 */
    // @柯里化：需要为通用 Port 绑定当前 Tab 实例。
    const openFloat = () => requestOpenTabAsDialog(tab);
    /** 使用绑定当前 App 的渲染上下文处理消息富内容。 */
    // @柯里化：需要为通用渲染 Port 绑定当前 App 实例。
    const renderContent = (container: HTMLElement) => postRender(container, app);

    return {
        settingsNavigation: {
            /** 打开或复用主应用 AI 设置页。 */
            async openAISettings() {
                const existing = window.siyuan.dialogs.find((dialog) => dialog.element.querySelector(".config__tab-container"));
                if (!existing) {
                    const {openSetting} = await loadOpenSetting();
                    openSetting(app, "ai");
                }
            },
        },
        identityAccess: {
            /** 打开 MAGI 身份入口并发布访问请求。 */
            async openIdentityAccess() {
                await openIdentityAccessTab({app});
                requestMagiIdentityAccess();
            },
        },
        notification: {
            /** 使用主应用通知系统显示 Agent 消息。 */
            notify(notification) {
                sendNotification({...notification, timeoutType: "default"});
            },
        },
        message: {show: showMessage},
        confirm: {confirm: confirmDialog},
        menu: createAppPanelMenuPort(),
        pluginActions: {
            /** 列出已提供描述的 Agent 插件动作。 */
            list: () => listActions()
                .filter((action) => action.name.startsWith("plugin__") && action.description)
                .map((action) => ({name: action.name, description: String(action.description)})),
            /** 在当前 App 上下文中执行指定插件动作。 */
            async execute(name, args) {
                const action = lookupAction(name);
                return action?.handler(args, app);
            },
        },
        focus: {focus: setPanelFocus},
        frontendReload: {reload: createBrowserHostReload()},
        dockVisibility: {
            /** 收起当前 Agent Dock，不影响 Tab 或浮窗实例。 */
            minimize() {
                getDockByType("agentChat").toggleModel("agentChat", false, true);
            },
        },
        tabOpen: {open: openTab},
        floatOpen: {open: openFloat},
        contentRender: {postRender: renderContent},
    };
};
