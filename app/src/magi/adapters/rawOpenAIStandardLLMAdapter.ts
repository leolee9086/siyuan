import type { ChatRequestParams, ChatResponseData } from "../../ai/types";
import { getAIConfigFromSiyuan } from "../../ai/utils.config";
import { universalStreamRequest } from "../../util/network/fetchStream";
import type { StandardLLMAdapter, StandardLLMStreamCallbacks } from "../types/llmAdapter.types";

function buildOpenAIRequestBody(
    request: ChatRequestParams,
    stream: boolean,
    fallbackModel: string,
) {
    return {
        model: request.model ?? fallbackModel,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.max_tokens,
        stream,
    };
}

function buildHeaders(apiKey: string): Record<string, string> {
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
    };
}

/**
 * 创建裸 OpenAI-compatible 适配器
 *
 * 作用：直接请求标准 `/chat/completions` 端点。
 * 意图：与 MAGI 适配器共享统一契约，支持无 UI 改动切换。
 */
export async function createRawOpenAIStandardLLMAdapter(): Promise<StandardLLMAdapter> {
    const aiConfig = getAIConfigFromSiyuan();
    const endpoint = `${aiConfig.apiBaseURL.replace(/\/$/, "")}/chat/completions`;
    const model = aiConfig.apiModel;

    return {
        createChatCompletion: async (request) => {
            const body = buildOpenAIRequestBody(request, false, model);
            const response = await fetch(endpoint, {
                method: "POST",
                headers: buildHeaders(aiConfig.apiKey),
                body: JSON.stringify(body),
            });
            if (!response.ok) {
                throw new Error(`RawOpenAIAdapter HTTP ${response.status}`);
            }
            const data = await response.json() as ChatResponseData;
            return data;
        },
        streamChatCompletion: async (request, callbacks) => {
            callbacks.onStart?.();
            const abortController = new AbortController();
            let done = false;
            await universalStreamRequest(
                {
                    url: endpoint,
                    method: "POST",
                    headers: buildHeaders(aiConfig.apiKey),
                    body: buildOpenAIRequestBody(request, true, model),
                    timeout: aiConfig.apiTimeout,
                    signal: abortController.signal,
                },
                {
                    onMessage(content: string) {
                        try {
                            const chunk = JSON.parse(content) as ChatResponseData;
                            callbacks.onChunk?.(chunk);
                        } catch {
                            // 忽略非 JSON chunk，维持与现有流处理容错一致。
                        }
                    },
                    onDone() {
                        if (done) {
                            return;
                        }
                        done = true;
                        callbacks.onDone?.();
                    },
                    onError(error: Error) {
                        callbacks.onError?.(error);
                    },
                },
            );
        },
    };
}

