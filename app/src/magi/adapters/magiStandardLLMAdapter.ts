import type { ChatRequestParams, ChatResponseData } from "../../ai/types";
import { getAIConfigFromSiyuan } from "../../ai/utils.config";
import { createAvatarRuntime } from "../core/nerv/avatarRuntime/avatar.runtime";
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
import type { AvatarRuntime } from "../core/nerv/avatarRuntime/avatar.runtime.types";
import type { ReplyOptions } from "../core/core.types";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";

const SOURCE_SIMULATION_TAG = "magi_request_source";
const SOURCE_SIMULATION_OPEN = `<${SOURCE_SIMULATION_TAG}>`;
const SOURCE_SIMULATION_CLOSE = `</${SOURCE_SIMULATION_TAG}>`;
const BLOCKED_RESPONSE_CONTENT = "Request blocked by MAGI ingress policy.";
const BLOCKED_ALERT_CONTENT = "Ingress blocked: external source connection attempt denied.";
const INTERNAL_SERVER_ERROR_CONTENT = "Internal Server Error";
const SOURCE_SIMULATION_BACKEND_ENDPOINT_PATH = "/api/s-forge/magi/v1/chat/completions";

interface IngressRuleDecision {
    allowed: boolean;
    reason: string;
}

interface BackendForwardResult {
    response: ChatResponseData | null;
    reason: string;
}

interface MagiInterfaceIdentity {
    principalId: string;
    interfaceId: string;
    interfaceKind: "magi-main-ui" | "magi-source-panel";
    interfaceLabel: string;
    conversationId: string;
}

type SafeSourceChannel = "guardian" | "external-agent" | "system-cron" | "unknown";

function isSafeSourceChannel(value: unknown): value is SafeSourceChannel {
    return value === "guardian"
        || value === "external-agent"
        || value === "system-cron"
        || value === "unknown";
}

function normalizeSourceChannel(
    rawSourceChannel: unknown,
    source: SourceSimulationContext["source"],
): SafeSourceChannel {
    if (isSafeSourceChannel(rawSourceChannel)) {
        return rawSourceChannel;
    }
    if (isSafeSourceChannel(source)) {
        return source;
    }
    return "unknown";
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
    sessionId?: string;
}): Promise<StandardLLMAdapter> {
    const model = params.model ?? "magi-trinity";
    const runtimeMainInterfaceIdentity = buildRuntimeMainInterfaceIdentity();
    const sessionId = typeof params.sessionId === "string" ? params.sessionId.trim() : "";

    return {
        createChatCompletion: async (request) =>
            createMagiChatCompletion(request, model, runtimeMainInterfaceIdentity, sessionId),
        streamChatCompletion: async (request, callbacks) =>
            streamMagiChatCompletion(
                request,
                callbacks,
                model,
                runtimeMainInterfaceIdentity,
                sessionId,
            ),
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

function buildAvatarToolOptions(
    request: ChatRequestParams,
): Pick<ReplyOptions, "tools" | "toolChoice"> | undefined {
    const hasTools = Array.isArray(request.tools) && request.tools.length > 0;
    const hasToolChoice = request.tool_choice !== undefined;
    if (!hasTools && !hasToolChoice) {
        return undefined;
    }
    return {
        ...(hasTools ? { tools: request.tools } : {}),
        ...(hasToolChoice ? { toolChoice: request.tool_choice } : {}),
    };
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
            const rawSourceChannel = Reflect.get(parsed, "sourceChannel");
            const sourcePanelId = Reflect.get(parsed, "sourcePanelId");
            const sourcePanelTitle = Reflect.get(parsed, "sourcePanelTitle");
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
                sourceChannel: normalizeSourceChannel(rawSourceChannel, source),
                ...(typeof sourcePanelId === "string" ? { sourcePanelId } : {}),
                ...(typeof sourcePanelTitle === "string" ? { sourcePanelTitle } : {}),
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
                ...(source.sourceChannel ? { sourceChannel: source.sourceChannel } : {}),
                ...(source.sourcePanelId ? { sourcePanelId: source.sourcePanelId } : {}),
                ...(source.sourcePanelTitle ? { sourcePanelTitle: source.sourcePanelTitle } : {}),
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

function buildInternalServerErrorResponse(model: string): ChatResponseData {
    return {
        id: `chatcmpl-magi-${Date.now()}`,
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
            {
                index: 0,
                message: {
                    role: "assistant",
                    content: INTERNAL_SERVER_ERROR_CONTENT,
                },
                finish_reason: "error",
            },
        ],
        error: {
            message: INTERNAL_SERVER_ERROR_CONTENT,
            type: "server_error",
            code: "500",
        },
    };
}

function buildRandomIdentitySegment(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function resolveMagiTargetLabel(): string {
    try {
        const target = Reflect.get(getSiyuanConfig()?.magi ?? {}, "target");
        const targetLabel = typeof target === "string" ? target.trim() : "";
        if (targetLabel) {
            return targetLabel;
        }
    } catch {
        // ignore
    }
    return "magi";
}

function buildRuntimeMainInterfaceIdentity(): MagiInterfaceIdentity {
    const suffix = buildRandomIdentitySegment();
    return {
        principalId: "workspace-admin",
        interfaceId: `main-${suffix}`,
        interfaceKind: "magi-main-ui",
        interfaceLabel: resolveMagiTargetLabel(),
        conversationId: `main-conv-${suffix}`,
    };
}

function resolveRuntimeOrigin(): string {
    if (typeof location === "undefined") {
        return "";
    }
    return String(location.origin ?? "").trim();
}

function buildSourceSimulationBackendEndpoint(apiBaseURL: string): string {
    const runtimeOrigin = resolveRuntimeOrigin();
    if (runtimeOrigin) {
        return `${runtimeOrigin}${SOURCE_SIMULATION_BACKEND_ENDPOINT_PATH}`;
    }
    const normalizedBaseURL = String(apiBaseURL ?? "").trim();
    if (!normalizedBaseURL) {
        return SOURCE_SIMULATION_BACKEND_ENDPOINT_PATH;
    }
    try {
        const parsed = new URL(normalizedBaseURL);
        return `${parsed.origin}${SOURCE_SIMULATION_BACKEND_ENDPOINT_PATH}`;
    } catch {
        return SOURCE_SIMULATION_BACKEND_ENDPOINT_PATH;
    }
}

function resolveWorkspaceAPIToken(): string {
    try {
        const token = getSiyuanConfig()?.api?.token;
        return String(token ?? "").trim();
    } catch {
        return "";
    }
}

function resolveMagiSourceKey(requestContext: ConsensusRequestContext): string {
    const workspaceToken = resolveWorkspaceAPIToken();
    if (workspaceToken) {
        return workspaceToken;
    }
    if (!requestContext.sourceSimulation) {
        return "";
    }
    try {
        const aiConfig = getAIConfigFromSiyuan();
        return String(aiConfig.apiKey ?? "").trim();
    } catch {
        return "";
    }
}

function buildRequestInterfaceIdentity(
    requestContext: ConsensusRequestContext,
    mainIdentity: MagiInterfaceIdentity,
): MagiInterfaceIdentity {
    const source = requestContext.sourceSimulation;
    if (!source) {
        return mainIdentity;
    }
    const panelId = String(source.sourcePanelId ?? "").trim();
    const panelTitle = String(source.sourcePanelTitle ?? source.profileLabel ?? "").trim();
    const conversationSeed = panelId || String(source.requestId ?? "").trim();
    return {
        principalId: String(source.callerId ?? "").trim() || mainIdentity.principalId,
        interfaceId: panelId || `source-panel-${buildRandomIdentitySegment()}`,
        interfaceKind: "magi-source-panel",
        interfaceLabel: panelTitle || "source-panel",
        conversationId: conversationSeed || `source-conv-${buildRandomIdentitySegment()}`,
    };
}

function buildRequestIdentityUserField(identity: MagiInterfaceIdentity): string {
    return JSON.stringify({
        principal: identity.principalId,
        interface: identity.interfaceId,
        kind: identity.interfaceKind,
        conversation: identity.conversationId,
        interfaceLabel: identity.interfaceLabel,
    });
}

function buildMagiBackendRequestBody(
    request: ChatRequestParams,
    fallbackModel: string,
    identity: MagiInterfaceIdentity,
): Record<string, unknown> {
    return {
        model: request.model ?? fallbackModel,
        messages: request.messages,
        user: buildRequestIdentityUserField(identity),
        temperature: request.temperature,
        max_tokens: request.max_tokens,
        ...(Array.isArray(request.tools) ? { tools: request.tools } : {}),
        ...(request.tool_choice !== undefined ? { tool_choice: request.tool_choice } : {}),
        stream: false,
    };
}

function buildMagiBackendHeaders(
    sourceKey: string,
    identity: MagiInterfaceIdentity,
    sessionId: string,
): Record<string, string> {
    return {
        "Content-Type": "application/json",
        "X-MAGI-Source-Key": sourceKey,
        ...(sessionId ? { "X-MAGI-Session-ID": sessionId } : {}),
        "X-MAGI-Principal-ID": identity.principalId,
        "X-MAGI-Interface-ID": identity.interfaceId,
        "X-MAGI-Interface-Kind": identity.interfaceKind,
        "X-MAGI-Conversation-ID": identity.conversationId,
        "X-MAGI-Interface-Label": identity.interfaceLabel,
    };
}

async function tryForwardMagiRequestToBackend(
    request: ChatRequestParams,
    fallbackModel: string,
    requestContext: ConsensusRequestContext,
    mainIdentity: MagiInterfaceIdentity,
    sessionId: string,
): Promise<BackendForwardResult> {
    const sourceKey = resolveMagiSourceKey(requestContext);
    if (!sourceKey) {
        return { response: null, reason: "source-key-missing" };
    }

    let apiBaseURL = "";
    try {
        apiBaseURL = String(getAIConfigFromSiyuan().apiBaseURL ?? "").trim();
    } catch {
        // baseURL 缺失时回退到相对路径，仍可在同源场景命中后端。
    }
    const endpoint = buildSourceSimulationBackendEndpoint(apiBaseURL);
    const identity = buildRequestInterfaceIdentity(requestContext, mainIdentity);
    const requestBody = buildMagiBackendRequestBody(request, fallbackModel, identity);

    try {
        const response = await fetch(endpoint, {
            method: "POST",
            credentials: "include",
            headers: buildMagiBackendHeaders(sourceKey, identity, sessionId),
            body: JSON.stringify(requestBody),
        });
        if (!response.ok) {
            return { response: null, reason: `backend-http-${response.status}` };
        }
        const data = await response.json() as ChatResponseData;
        return { response: data, reason: "backend-forwarded" };
    } catch (error) {
        return {
            response: null,
            reason: error instanceof Error ? error.message : String(error),
        };
    }
}

function isAbsoluteTrustedSource(requestContext: ConsensusRequestContext): boolean {
    const source = requestContext.sourceSimulation;
    if (!source) {
        return false;
    }
    return source.trustBase === "high"
        && source.riskLevel === "low"
        && source.source === "guardian";
}

async function createMagiChatCompletion(
    request: ChatRequestParams,
    model: string,
    runtimeMainInterfaceIdentity: MagiInterfaceIdentity,
    sessionId: string,
): Promise<ChatResponseData> {
    const userInput = extractLatestUserInput(request.messages);
    if (!userInput) {
        return buildOpenAICompatibleResponse("", request.model ?? model, "stop");
    }
    const requestContext = buildConsensusRequestContext(request.messages);
    const backendResult = await tryForwardMagiRequestToBackend(
        request,
        request.model ?? model,
        requestContext,
        runtimeMainInterfaceIdentity,
        sessionId,
    );
    if (backendResult.response) {
        return backendResult.response;
    }
    throw new Error(`MAGI backend request failed: ${backendResult.reason}`);
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
    request: ChatRequestParams,
    callbacks: StandardLLMStreamCallbacks,
    model: string,
    runtimeMainInterfaceIdentity: MagiInterfaceIdentity,
    sessionId: string,
): Promise<void> {
    callbacks.onStart?.();
    try {
        const response = await createMagiChatCompletion(
            request,
            model,
            runtimeMainInterfaceIdentity,
            sessionId,
        );
        const content = response.choices?.[0]?.message?.content ?? "";
        callbacks.onChunk?.(buildFullContentChunk(content, response.model ?? model));
        callbacks.onChunk?.(buildFinishChunk(response.model ?? model));
        callbacks.onDone?.();
    } catch (error) {
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        callbacks.onError?.(normalizedError);
    }
}
