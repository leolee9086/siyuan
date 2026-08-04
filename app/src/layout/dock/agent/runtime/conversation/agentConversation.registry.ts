/** 用途：约束 adapter；使用范围：注册表存储值。 */
import type {AgentConversationAdapter} from "./agentConversation.types";
/** 用途：约束注册表；使用范围：工厂返回协议。 */
import type {AgentConversationAdapterRegistry} from "./agentConversation.types";

/**
 * 由组合根注册 adapter；共享面板不维护目标类型分支。
 * @同步豁免: 生命周期 - AgentChat 构造前必须同步取得稳定 registry，异步化会暴露半初始化实例。
 */
export function createAgentConversationAdapterRegistry(adapters: AgentConversationAdapter[]) {
    const registered = new Map(adapters.map((adapter) => [adapter.kind, adapter]));
    return {
        /** 查询当前面板目标是否注册了执行 adapter；未注册目标继续沿用其既有传输链路。 */
        find(kind) {
            return registered.get(kind);
        },
        /** 在会话激活时按协议键解析唯一 adapter，缺失注册立即暴露组合错误。 */
        resolve(kind) {
            const adapter = registered.get(kind);
            // 未注册目标属于组合根错误，不能退回其他 adapter 后误投递消息。
            if (!adapter) {
                throw new Error(`Agent conversation adapter is not registered: ${kind}`);
            }
            return adapter;
        },
    } satisfies AgentConversationAdapterRegistry;
}
