import type { ChatRequestParams, ChatResponseData } from "../../ai/types";

/**
 * 标准 LLM 流式 chunk（OpenAI-compatible）
 *
 * 用途：适配器在流式模式下向上层回调增量结果。
 * 使用场景：UI 或会话编排层消费流式回复。
 */
export interface StandardLLMStreamChunk {
    id?: string;
    object?: "chat.completion.chunk" | string;
    created?: number;
    model?: string;
    choices?: Array<{
        index?: number;
        delta?: {
            role?: string;
            content?: string;
            reasoning_content?: string;
        };
        finish_reason?: string | null;
    }>;
}

/**
 * 标准 LLM 流式回调集合
 */
export interface StandardLLMStreamCallbacks {
    onStart?: () => void;
    onChunk?: (chunk: StandardLLMStreamChunk) => void;
    onDone?: () => void;
    onError?: (error: Error) => void;
}

/**
 * 标准 LLM 适配器接口（OpenAI-compatible）
 *
 * 约束：契约形态与常见 LLM 适配器一致，调用方无需感知底层是否为 MAGI。
 */
export interface StandardLLMAdapter {
    createChatCompletion(request: ChatRequestParams, signal?: AbortSignal): Promise<ChatResponseData>;
    streamChatCompletion(
        request: ChatRequestParams,
        callbacks: StandardLLMStreamCallbacks,
        signal?: AbortSignal,
    ): Promise<void>;
}
