import type { ConnectionStatus, WrappedSeel } from "../composables/useMagi.types";
import { createMagiStandardLLMAdapter } from "./magiStandardLLMAdapter";
import { createRawOpenAIStandardLLMAdapter } from "./rawOpenAIStandardLLMAdapter";
import type { MagiEventBus } from "../events/magiEventBus.types";
import type { StandardLLMAdapter, StandardLLMAdapterMode } from "../types/llmAdapter.types";
import type { MagiMessage } from "../utils/messageFactory.types";

/**
 * 标准 LLM 适配器工厂参数
 *
 * 用途：统一承载两类适配器所需上下文。
 * 使用场景：useMagi 初始化阶段调用工厂创建会话适配器。
 */
export interface StandardLLMAdapterFactoryParams {
    mode: StandardLLMAdapterMode;
    model?: string;
    connectionStatus: { value: ConnectionStatus };
    consensusMessages: MagiMessage[];
    seels: WrappedSeel[];
    eventBus?: MagiEventBus;
}

/**
 * 创建标准 LLM 适配器
 *
 * 作用：根据模式返回 `magi` 或 `raw-openai` 适配器实现。
 * 意图：让上层调用仅依赖统一接口，隔离底层实现差异。
 * 调用时机：会话初始化时创建一次并复用。
 */
export async function createStandardLLMAdapter(
    params: StandardLLMAdapterFactoryParams,
): Promise<StandardLLMAdapter> {
    if (params.mode === "raw-openai") {
        return createRawOpenAIStandardLLMAdapter();
    }
    return createMagiStandardLLMAdapter({
        model: params.model,
        connectionStatus: params.connectionStatus,
        consensusMessages: params.consensusMessages,
        seels: params.seels,
        eventBus: params.eventBus,
    });
}

