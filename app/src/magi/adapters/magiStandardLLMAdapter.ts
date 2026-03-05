import type { ChatRequestParams, ChatResponseData } from "../../ai/types";
import type {
    ConnectionStatus,
    SourceSimulationContext,
    WrappedSeel,
} from "../composables/useMagi.types";
import {
    appendConsensusMessage,
    sendUserMessageWithConsensus,
    type ConsensusRequestContext,
} from "../composables/useMagi.consensus";
import type { MagiEventBus } from "../events/magiEventBus.types";
import type {
    StandardLLMAdapter,
    StandardLLMStreamCallbacks,
    StandardLLMStreamChunk,
} from "../types/llmAdapter.types";
import type { MagiMessage } from "../utils/messageFactory.types";

const SOURCE_SIMULATION_TAG = "magi_request_source";
const SOURCE_SIMULATION_OPEN = `<${SOURCE_SIMULATION_TAG}>`;
const SOURCE_SIMULATION_CLOSE = `</${SOURCE_SIMULATION_TAG}>`;
const BLOCKED_RESPONSE_CONTENT = "Request blocked by MAGI ingress policy.";
const BLOCKED_ALERT_CONTENT = "Ingress blocked: external source connection attempt denied.";

interface IngressRuleDecision {
    allowed: boolean;
    reason: string;
}

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

function buildRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseSourceSimulationFromSystemMessages(
    messages: ChatRequestParams["messages"],
): SourceSimulationContext | undefined {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
        const message = messages[i];
        if (message.role !== "system") {
            continue;
        }
        const content = String(message.content ?? "");
        const start = content.indexOf(SOURCE_SIMULATION_OPEN);
        const end = content.indexOf(SOURCE_SIMULATION_CLOSE);
        if (start < 0 || end <= start) {
            continue;
        }
        const rawPayload = content
            .slice(start + SOURCE_SIMULATION_OPEN.length, end)
            .trim();
        if (!rawPayload) {
            continue;
        }
        try {
            const parsed: unknown = JSON.parse(rawPayload);
            if (!parsed || typeof parsed !== "object") {
                continue;
            }
            const requestId = Reflect.get(parsed, "requestId");
            const callerId = Reflect.get(parsed, "callerId");
            const source = Reflect.get(parsed, "source");
            const trustBase = Reflect.get(parsed, "trustBase");
            const riskLevel = Reflect.get(parsed, "riskLevel");
            const profileId = Reflect.get(parsed, "profileId");
            const profileLabel = Reflect.get(parsed, "profileLabel");
            const isValid = typeof requestId === "string"
                && typeof callerId === "string"
                && (source === "guardian" || source === "external-agent" || source === "system-cron" || source === "unknown")
                && (trustBase === "low" || trustBase === "medium" || trustBase === "high")
                && (riskLevel === "low" || riskLevel === "medium" || riskLevel === "high")
                && typeof profileId === "string"
                && typeof profileLabel === "string";
            if (!isValid) {
                continue;
            }
            return {
                requestId,
                callerId,
                source,
                trustBase,
                riskLevel,
                profileId,
                profileLabel,
            };
        } catch {
            // 非法 payload 直接忽略，回退常规路径。
        }
    }
    return undefined;
}

function buildConsensusRequestContext(
    messages: ChatRequestParams["messages"],
): ConsensusRequestContext {
    const sourceSimulation = parseSourceSimulationFromSystemMessages(messages);
    return {
        requestId: sourceSimulation?.requestId ?? buildRequestId(),
        ...(sourceSimulation ? { sourceSimulation } : {}),
    };
}

function evaluateIngressRule(
    requestContext: ConsensusRequestContext,
): IngressRuleDecision {
    const sourceSimulation = requestContext.sourceSimulation;
    if (!sourceSimulation) {
        return { allowed: true, reason: "no-source-simulation" };
    }
    if (sourceSimulation.source === "unknown" && sourceSimulation.riskLevel === "high") {
        return { allowed: false, reason: "unknown-high-risk-source" };
    }
    if (sourceSimulation.trustBase === "low" && sourceSimulation.riskLevel !== "low") {
        return { allowed: false, reason: "low-trust-risk-not-low" };
    }
    return { allowed: true, reason: "passed" };
}

function buildBlockedAlertMeta(
    requestContext: ConsensusRequestContext,
    decision: IngressRuleDecision,
): Record<string, unknown> {
    const source = requestContext.sourceSimulation;
    return {
        type: "connection-attempt-blocked",
        internalOnly: true,
        reason: decision.reason,
        ...(requestContext.requestId ? { requestId: requestContext.requestId } : {}),
        ...(source
            ? {
                source: source.source,
                callerId: source.callerId,
                trustBase: source.trustBase,
                riskLevel: source.riskLevel,
                sourceProfileId: source.profileId,
                sourceProfileLabel: source.profileLabel,
            }
            : {}),
    };
}

async function reportBlockedConnectionAttempt(
    consensusMessages: MagiMessage[],
    requestContext: ConsensusRequestContext,
    decision: IngressRuleDecision,
): Promise<void> {
    await appendConsensusMessage(
        consensusMessages,
        "system",
        BLOCKED_ALERT_CONTENT,
        buildBlockedAlertMeta(requestContext, decision),
    );
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

function getLatestMessageByRequestId(
    consensusMessages: MagiMessage[],
    requestId: string,
): MagiMessage | null {
    for (let i = consensusMessages.length - 1; i >= 0; i -= 1) {
        const message = consensusMessages[i];
        const metaRequestId = Reflect.get(message.meta ?? {}, "requestId");
        if (metaRequestId !== requestId) {
            continue;
        }
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
    const requestContext = buildConsensusRequestContext(request.messages);
    const ingressDecision = evaluateIngressRule(requestContext);
    if (!ingressDecision.allowed) {
        await reportBlockedConnectionAttempt(
            params.consensusMessages,
            requestContext,
            ingressDecision,
        );
        return buildOpenAICompatibleResponse(
            BLOCKED_RESPONSE_CONTENT,
            request.model ?? model,
            "error",
        );
    }

    const beforeLength = params.consensusMessages.length;
    await sendUserMessageWithConsensus(
        userInput,
        params.connectionStatus,
        params.consensusMessages,
        params.seels,
        params.eventBus,
        requestContext,
    );

    const latestMessage =
        getLatestMessageByRequestId(params.consensusMessages, requestContext.requestId ?? "")
        ?? params.consensusMessages[params.consensusMessages.length - 1]
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
