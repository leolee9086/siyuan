/** 用途：提供应用上下文类型；使用范围：移动 Agent 工厂；解耦评估：工厂只需既有上下文契约，集中入口避免业务文件跨层依赖。 */
import type {AppFacade} from "../../app/AppFacade.types";
/** 用途：提供 AgentChat 构造实现；使用范围：移动 Agent 工厂；解耦评估：复用桌面与移动共用模型，不能在调用端重复实例化。 */
import {AgentChat} from "../../layout/dock/agent/AgentChat";
/** 用途：提供 Tab 容器实现；使用范围：移动 Agent 工厂；解耦评估：统一布局对象负责面板生命周期，局部替代会破坏注册关系。 */
import {Tab} from "../../layout/Tab";

/** 导出工厂所需的应用上下文类型。 */
export type {AppFacade};
/** 导出工厂所需的聊天模型构造器。 */
export {AgentChat};
/** 导出工厂所需的 Tab 容器构造器。 */
export {Tab};

/** 用途：打开移动模型容器；使用范围：Agent 面板显示；解耦评估：统一移动菜单生命周期，调用方不应自行装配模型 DOM。 */
import {openModel} from "../menu/model";
/** 导出移动模型打开能力。 */
export {openModel};
/** 用途：关闭移动模型；使用范围：Agent 面板隐藏；解耦评估：统一关闭流程负责事件清理，局部实现会遗漏面板栈状态。 */
import {closeModel} from "../util/closePanel";
/** 导出移动模型关闭能力。 */
export {closeModel};
/** 用途：关闭当前移动面板；使用范围：打开 Agent 前收拢其它面板；解耦评估：面板栈状态必须由统一工具维护。 */
import {closePanel} from "../util/closePanel";
/** 导出当前面板关闭能力。 */
export {closePanel};
/** 用途：显示应用内通知；使用范围：页面可见时的 Agent 通知；解耦评估：复用全局消息设施，注入会增加能力回调参数。 */
import {showMessage} from "../../dialog/message";
/** 导出应用内消息能力。 */
export {showMessage};
/** 用途：发送系统通知；使用范围：页面失焦时的 Agent 通知；解耦评估：平台通知能力需由统一插件桥接提供。 */
import {sendNotification} from "../../plugin/platformUtils";
/** 导出系统通知能力。 */
export {sendNotification};
/** 用途：判断 AI 功能是否被禁用；使用范围：移动 Agent 入口 guard；解耦评估：功能开关由兼容层统一读取。 */
import {isDisabledFeature} from "../../protyle/util/compatibility";
/** 导出 AI 功能开关判断。 */
export {isDisabledFeature};
/** 用途：打开移动设置并登记返回回调；使用范围：Agent 设置入口；解耦评估：设置路由由移动端统一管理，局部导航会丢失返回栈。 */
import {getMobileSettingOpener} from "../setting.port";
/** 导出移动设置打开能力。 */
export {getMobileSettingOpener};
