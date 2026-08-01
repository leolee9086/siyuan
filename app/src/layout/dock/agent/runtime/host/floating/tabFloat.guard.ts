/** 用途：约束 AgentChat 的完整公开领域；使用范围：浮窗源模型收窄；解耦评估：只加载公共领域类型。 */
import type {AgentChatDomain} from "./imports";
/** 用途：识别可序列化布局模型；使用范围：验证 AgentChat 的布局身份；解耦评估：复用布局权威守卫。 */
import {isLayoutSerializableModel} from "./imports";
/** 用途：约束布局页签句柄；使用范围：浮窗源输入；解耦评估：只加载布局公开类型。 */
import type {ILayoutTabHandle} from "./imports";

/**
 * 通过布局模型的公开身份和完整领域动作识别 AgentChat，不依赖具体实现类。
 * @显式返回类型原因 类型谓词用于把通用布局模型收窄为 AgentChatDomain，普通布尔推导无法向调用方传递该关系。
 */
export function isAgentChatDomain(tab: ILayoutTabHandle): tab is ILayoutTabHandle & {model: AgentChatDomain} {
    const model = tab.model;
    return isLayoutSerializableModel(model) && model.layoutSerialization.instance === "AgentChat" &&
        typeof Reflect.get(model, "createFloatingCopy") === "function" &&
        typeof Reflect.get(model, "setFloatingCopyOptions") === "function" &&
        typeof Reflect.get(model, "destroy") === "function";
}
