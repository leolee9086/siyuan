import type { ChatRequestParams, ChatResponseData } from "../../ai/types";
import type { ConnectionStatus, WrappedSeel } from "../composables/useMagi.types";
import { sendUserMessageWithConsensus } from "../composables/useMagi.consensus";
import type { MagiEventBus } from "../events/magiEventBus.types";
import type {
    StandardLLMAdapter,
    StandardLLMStreamCallbacks,
    StandardLLMStreamChunk,
} from "../types/llmAdapter.types";
import type { MagiMessage } from "../utils/messageFactory.types";

/**
 * 创建 MAGI 标准 LLM 适配器
 *
 * 作用：将 MAGI 共识链路封装为标准 LLM 适配器接口。
 * 意图：让上层以统一契约调用，不感知内部三贤人实现。
 */
export async function createMagiStandardLLMAdapter(params: {
    model?: string;
    connectionStatus: { value: ConnectionStatus };
    consensusMessages: MagiMessage[];
    seels: WrappedSeel[];
    eventBus?: MagiEventBus;
}): Promise<StandardLLMAdapter> {
    const model = params.model ?? "magi-trinity";

    return {
        createChatCompletion: async (request) =>
            createMagiChatCompletion(params, request, model),
        streamChatCompletion: async (request, callbacks) =>
            streamMagiChatCompletion(params, request, callbacks, model),
    };
}

function extractLatestUserInput(messages: ChatRequestParams["messages"]): string {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
        const message = messages[i];
        if (message.role === "user") {
            return String(message.content ?? "").trim();
        }
    }
    return "";
}

function getLatestAssistantLikeMessage(consensusMessages: MagiMessage[]): MagiMessage | null {
    for (let i = consensusMessages.length - 1; i >= 0; i -= 1) {
        const message = consensusMessages[i];
        if (message.type === "consensus" || message.type === "error") {
            return message;
        }
    }
    return null;
}

function buildOpenAICompatibleResponse(
    content: string,
    model: string,
    finishReason: string = "stop",
): ChatResponseData {
    return {
        id: `chatcmpl-magi-${Date.now()}`,
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
            {
                index: 0,
                message: {
                    role: "assistant",
                    content,
                },
                finish_reason: finishReason,
            },
        ],
    };
}

async function createMagiChatCompletion(
    params: {
        connectionStatus: { value: ConnectionStatus };
        consensusMessages: MagiMessage[];
        seels: WrappedSeel[];
        eventBus?: MagiEventBus;
    },
    request: ChatRequestParams,
    model: string,
): Promise<ChatResponseData> {
    const userInput = extractLatestUserInput(request.messages);
    if (!userInput) {
        return buildOpenAICompatibleResponse("", request.model ?? model, "stop");
    }

    const beforeLength = params.consensusMessages.length;
    await sendUserMessageWithConsensus(
        userInput,
        params.connectionStatus,
        params.consensusMessages,
        params.seels,
        params.eventBus,
    );

    const latestMessage =
        params.consensusMessages[params.consensusMessages.length - 1]
        ?? params.consensusMessages[beforeLength]
        ?? getLatestAssistantLikeMessage(params.consensusMessages);

    return buildOpenAICompatibleResponse(
        latestMessage?.content ?? "",
        request.model ?? model,
        latestMessage?.status === "error" ? "error" : "stop",
    );
}

function buildFullContentChunk(content: string, model: string): StandardLLMStreamChunk {
    return {
        id: `chatcmplchunk-magi-${Date.now()}`,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
            {
                index: 0,
                delta: {
                    role: "assistant",
                    content,
                },
                finish_reason: null,
            },
        ],
    };
}

function buildFinishChunk(model: string): StandardLLMStreamChunk {
    return {
        id: `chatcmplchunk-magi-${Date.now()}`,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
            {
                index: 0,
                delta: {},
                finish_reason: "stop",
            },
        ],
    };
}

async function streamMagiChatCompletion(
    params: {
        connectionStatus: { value: ConnectionStatus };
        consensusMessages: MagiMessage[];
        seels: WrappedSeel[];
        eventBus?: MagiEventBus;
    },
    request: ChatRequestParams,
    callbacks: StandardLLMStreamCallbacks,
    model: string,
): Promise<void> {
    callbacks.onStart?.();
    try {
        const response = await createMagiChatCompletion(params, request, model);
        const content = response.choices?.[0]?.message?.content ?? "";
        callbacks.onChunk?.(buildFullContentChunk(content, response.model ?? model));
        callbacks.onChunk?.(buildFinishChunk(response.model ?? model));
        callbacks.onDone?.();
    } catch (error) {
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        callbacks.onError?.(normalizedError);
    }
}

