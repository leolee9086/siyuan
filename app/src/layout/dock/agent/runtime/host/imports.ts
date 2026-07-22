/** 用途：收口 App 类型；使用范围：App capability 参数；解耦评估：纯类型边界，面板核心不依赖 App。 */
import type {App} from "../../../../../index";
/** 用途：收口 Tab 类型；使用范围：Tab 与浮窗 capability 参数；解耦评估：纯类型边界，具体动作由 Port 隔离。 */
import type {Tab} from "../../../../Tab";
/** 用途：收口确认框；使用范围：App ConfirmPort；解耦评估：仅宿主适配器依赖具体 Dialog。 */
import {confirmDialog} from "../../../../../dialog/confirmDialog";
/** 用途：收口短消息提示；使用范围：App MessagePort；解耦评估：仅宿主适配器依赖具体 Dialog。 */
import {showMessage} from "../../../../../dialog/message";
/** 用途：收口系统通知；使用范围：App NotificationPort；解耦评估：平台实现经 Port 注入。 */
import {sendNotification} from "../../../../../plugin/platformUtils";
/** 用途：收口面板聚焦动作；使用范围：App PanelFocusPort；解耦评估：布局动作留在宿主。 */
import {setPanelFocus} from "../../../../util";
/** 用途：收口 Dock 查询；使用范围：App DockVisibilityPort；解耦评估：Dock 注册表不进入面板核心。 */
import {getDockByType} from "../../../../tabUtil";
/** 用途：收口浮窗打开 Port；使用范围：App PanelFloatOpenPort；解耦评估：复用既有布局边界。 */
import {requestOpenTabAsDialog} from "../../../../tabFloat.port";
/** 用途：收口 Tab 打开 Port；使用范围：App PanelTabOpenPort；解耦评估：复用既有布局边界。 */
import {requestOpenTabAsTab} from "../../../../tabOpen.port";
/** 用途：收口插件动作列表；使用范围：App PluginActionPort；解耦评估：注册表访问限制在宿主。 */
import {listActions} from "../../frontendActions";
/** 用途：收口插件动作查询；使用范围：App PluginActionPort；解耦评估：注册表访问限制在宿主。 */
import {lookupAction} from "../../frontendActions";
/** 用途：收口身份入口；使用范围：App IdentityAccessPort；解耦评估：具体 Tab 导航留在宿主。 */
import {openIdentityAccessTab} from "../../../../../magi/identity-access/adapters/open";
/** 用途：收口身份访问请求；使用范围：App IdentityAccessPort；解耦评估：身份服务调用留在宿主。 */
import {requestMagiIdentityAccess} from "../../../../../magi/service/magiIdentitySession";
/** 用途：收口富内容渲染；使用范围：App ContentRenderPort；解耦评估：绑定 App 后注入核心。 */
import {postRender} from "../../AgentMessageRenderer";
/** 用途：收口菜单项类型；使用范围：App 菜单 factory；解耦评估：纯类型边界。 */
import type {PanelMenuItem} from "../agentPanel.ports.types";
/** 用途：收口菜单类；使用范围：App 菜单 factory；解耦评估：实例化集中在 factory。 */
import {MenuItem} from "../../../../../menus/Menu";

/** 延迟加载设置模块，避免宿主 capability 在布局初始化时引入配置循环。 */
export const loadOpenSetting = async () => import("../../../../../config");
/** 导出 App 类型。 */
export type {App};
/** 导出 Tab 类型。 */
export type {Tab};
/** 导出菜单项类型。 */
export type {PanelMenuItem};
/** 导出确认框能力。 */
export {confirmDialog};
/** 导出短消息能力。 */
export {showMessage};
/** 导出通知能力。 */
export {sendNotification};
/** 导出聚焦能力。 */
export {setPanelFocus};
/** 导出 Dock 查询能力。 */
export {getDockByType};
/** 导出浮窗打开能力。 */
export {requestOpenTabAsDialog};
/** 导出 Tab 打开能力。 */
export {requestOpenTabAsTab};
/** 导出插件动作列表能力。 */
export {listActions};
/** 导出插件动作查询能力。 */
export {lookupAction};
/** 导出身份入口能力。 */
export {openIdentityAccessTab};
/** 导出身份访问请求能力。 */
export {requestMagiIdentityAccess};
/** 导出富内容渲染能力。 */
export {postRender};
/** 导出菜单类。 */
export {MenuItem};
