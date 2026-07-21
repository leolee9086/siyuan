/**
 * 用途：导入标准聊天请求、响应类型以定义 MAGI LLM adapter 公共契约。
 * 使用范围：仅用于本文件的接口入参与返回值，不引入运行时实现。
 * 解耦评估：类型定义必须与 AI 网络层保持一致，参数传递不能替代编译期契约。
 */
import type { ChatRequestParams } from "../../ai/types";
/**
 * 用途：导入标准聊天响应类型以定义同步 adapter 返回值。
 * 使用范围：仅用于 StandardLLMAdapter.createChatCompletion。
 * 解耦评估：这是编译期协议依赖，无法用运行时注入替代。
 */
import type { ChatResponseData } from "../../ai/types";

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
    error?: {
        message: string;
        type?: string;
    };
}

/**
 * 标准 LLM 流式回调集合
 */
export interface StandardLLMStreamCallbacks {
    onStart?: () => void | Promise<void>;
    onChunk?: (chunk: StandardLLMStreamChunk) => void | Promise<void>;
    onDone?: () => void | Promise<void>;
    onError?: (error: Error) => void | Promise<void>;
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
