/** 用途：约束控制错误元数据；使用范围：错误实例构造。 */
import type {AgentConversationControlErrorOptions} from "./AgentConversationControl.types";

/** 构造控制 API 错误；集中实例化以满足业务模块的工厂边界。 @同步豁免: 生命周期 */
export function createAgentConversationControlError(message: string, options: AgentConversationControlErrorOptions) {
    const error = new Error(message);
    error.name = "AgentConversationControlError";
    return Object.assign(error, options);
}
