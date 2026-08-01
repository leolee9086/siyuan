/** 用途：收口 AppFacade 类型；使用范围：App capability 参数；解耦评估：纯类型边界，面板核心不依赖具体 App class。 */
import type {AppFacade} from "../../../../../app/AppFacade.types";
/** 用途：收口 Tab 类型；使用范围：Tab capability 参数；解耦评估：纯类型边界，具体动作由 Port 隔离。 */
import type {Tab} from "../../../../Tab";
/** 用途：收口确认框；使用范围：App 能力聚合；解耦评估：仅宿主适配器依赖具体 Dialog。 */
import {confirmDialog} from "../../../../../dialog/confirmDialog";
/** 用途：创建标准对话框；使用范围：App 能力聚合；解耦评估：具体 UI 实现只停留在宿主组合根。 */
import {Dialog} from "../../../../../dialog";
/** 用途：收口短消息提示；使用范围：App 能力聚合；解耦评估：仅宿主适配器依赖具体 Dialog。 */
import {showMessage} from "../../../../../dialog/message";
/** 用途：收口系统通知；使用范围：App 能力聚合；解耦评估：平台实现只停留在宿主。 */
import {sendNotification} from "../../../../../plugin/platformUtils";
/** 用途：收口面板聚焦动作；使用范围：App 能力聚合；解耦评估：布局动作留在宿主。 */
import {setPanelFocus} from "../../../../utils/setPanelFocus";
/** 用途：收口 Dock 查询；使用范围：App 能力聚合；解耦评估：Dock 注册表不进入面板核心。 */
import {getDockByType} from "../../../../query/dockByType";
/** 用途：收口浮窗打开动作；使用范围：App 能力聚合；解耦评估：复用既有布局边界。 */
import {requestOpenTabAsDialog} from "../../../../tabFloat.port";
/** 用途：收口 Tab 打开动作；使用范围：App 能力聚合；解耦评估：复用既有布局边界。 */
import {requestOpenTabAsTab} from "../../../../tabOpen.port";
/** 用途：收口插件动作列表；使用范围：App 能力聚合；解耦评估：注册表访问限制在宿主。 */
import {listActions} from "../../frontendActions";
/** 用途：收口插件动作查询；使用范围：App 能力聚合；解耦评估：注册表访问限制在宿主。 */
import {lookupAction} from "../../frontendActions";
/** 用途：收口身份入口；使用范围：App 能力聚合；解耦评估：具体 Tab 导航留在宿主。 */
import {openIdentityAccessTab} from "../../../../../magi/identity-access/adapters/open";
/** 用途：收口身份访问请求；使用范围：App 能力聚合；解耦评估：身份服务调用留在宿主。 */
import {requestMagiIdentityAccess} from "../../../../../magi/service/magiIdentitySession";
/** 用途：收口富内容渲染；使用范围：App 能力聚合；解耦评估：绑定 App 后注入核心。 */
import {postRender} from "../../AgentMessageRenderer";
/** 用途：收口菜单项类型；使用范围：App 菜单 factory；解耦评估：纯类型边界。 */
import type {PanelMenuItem} from "../agentPanel.ports.types";
/** 用途：收口面板宿主能力；使用范围：App capability 工厂返回值；解耦评估：复用面板既有完整能力接口。 */
import type {AgentPanelCapabilities} from "../agentPanel.ports.types";
/** 用途：收口菜单类；使用范围：App 菜单 factory；解耦评估：实例化集中在 factory。 */
import {MenuItem} from "../../../../../menus/Menu";

/** 导出 AppFacade 类型。 */
export type {AppFacade};
/** 导出 Tab 类型。 */
export type {Tab};
/** 导出菜单项类型。 */
export type {PanelMenuItem};
/** 导出面板宿主能力。 */
export type {AgentPanelCapabilities};
/** 导出确认框能力。 */
export {confirmDialog};
/** 导出标准对话框构造器供宿主装配。 */
export {Dialog};
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
