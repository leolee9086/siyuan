import type { ConnectionStatus, WrappedSeel } from "../composables/useMagi.types";
import { createMagiStandardLLMAdapter } from "./magiStandardLLMAdapter";
import type { MagiEventBus } from "../events/magiEventBus.types";
import type { StandardLLMAdapter } from "../types/llmAdapter.types";
import type { MagiMessage } from "../utils/messageFactory.types";

/**
 * 标准 LLM 适配器工厂参数
 *
 * 用途：统一承载两类适配器所需上下文。
 * 使用场景：useMagi 初始化阶段调用工厂创建会话适配器。
 */
export interface StandardLLMAdapterFactoryParams {
    model?: string;
    connectionStatus: { value: ConnectionStatus };
    consensusMessages: MagiMessage[];
    seels: WrappedSeel[];
    eventBus?: MagiEventBus;
    sessionId?: string;
}

/**
 * 创建标准 LLM 适配器
 *
 * 作用：创建后端 MAGI 统一适配器实现。
 * 意图：确保 MAGI 前端始终经由后端决策链路，不保留本地/调试切换入口。
 * 调用时机：会话初始化时创建一次并复用。
 */
export async function createStandardLLMAdapter(
    params: StandardLLMAdapterFactoryParams,
): Promise<StandardLLMAdapter> {
    return createMagiStandardLLMAdapter({
        model: params.model,
        connectionStatus: params.connectionStatus,
        consensusMessages: params.consensusMessages,
        seels: params.seels,
        eventBus: params.eventBus,
        sessionId: params.sessionId,
    });
}
