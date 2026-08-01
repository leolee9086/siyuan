/** 用途：约束 AgentChat 的完整公开领域；使用范围：浮窗副本模型识别与生命周期；解耦评估：适配器不加载具体 AgentChat 类。 */
import type {AgentChatDomain} from "../../public/AgentChat.types";
/** 用途：创建布局页签实例；使用范围：完整应用浮窗组合根；解耦评估：具体构造器仅停留在宿主装配边界。 */
import {Tab} from "../../../../../Tab";
/** 用途：登记浮窗工厂；使用范围：完整应用启动；解耦评估：复用布局既有扩展边界。 */
import {registerTabFloatFactory} from "../../../../../tabFloat.registry";
/** 用途：识别可序列化布局模型；使用范围：AgentChat 领域守卫；解耦评估：复用布局模型权威守卫。 */
import {isLayoutSerializableModel} from "../../../../../lifecycle/model.guard";
/** 用途：识别完整布局页签；使用范围：浮窗副本挂载；解耦评估：复用布局聚合根权威守卫。 */
import {isLayoutTab} from "../../../../../layout.types.guard";
/** 用途：约束布局页签句柄；使用范围：AgentChat 模型守卫；解耦评估：复用浮窗宿主既有接口。 */
import type {ILayoutTabHandle} from "../../../../../tabFloat.types";
/** 用途：约束浮窗复制结果；使用范围：Agent 浮窗工厂；解耦评估：纯布局类型。 */
import type {ILayoutTabFloatCopy} from "../../../../../tabFloat.types";
/** 用途：约束浮窗工厂；使用范围：Agent 浮窗注册；解耦评估：纯布局类型。 */
import type {ILayoutTabFloatFactory} from "../../../../../tabFloat.types";

/** 导出 AgentChat 公开领域。 */
export type {AgentChatDomain};
/** 导出布局页签构造器。 */
export {Tab};
/** 导出浮窗工厂注册入口。 */
export {registerTabFloatFactory};
/** 导出可序列化模型守卫。 */
export {isLayoutSerializableModel};
/** 导出布局页签守卫。 */
export {isLayoutTab};
/** 导出布局页签句柄。 */
export type {ILayoutTabHandle};
/** 导出浮窗复制结果。 */
export type {ILayoutTabFloatCopy};
/** 导出浮窗工厂类型。 */
export type {ILayoutTabFloatFactory};
