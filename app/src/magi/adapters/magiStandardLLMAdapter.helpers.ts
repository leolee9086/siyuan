/**
 * 用途：导入ChatRequestParams类型用于消息解析
 * 使用范围：parseSourceSimulationFromSystemMessages等函数的参数类型
 * 解耦评估：类型定义无法解耦
 */
import type { ChatRequestParams } from "./imports";
/**
 * 用途：导入SourceSimulationContext类型用于源模拟上下文
 * 使用范围：parseSourceSimulationFromSystemMessages函数的返回类型
 * 解耦评估：类型定义无法解耦
 */
import type { SourceSimulationContext } from "./imports";
/**
 * 用途：导入ChatResponseData类型用于响应构建
 * 使用范围：buildOpenAICompatibleResponse函数的返回类型
 * 解耦评估：类型定义无法解耦
 */
import type { ChatResponseData } from "./imports";
/**
 * 用途：导入StandardLLMStreamChunk类型用于流式数据块
 * 使用范围：buildFullContentChunk等函数的返回类型
 * 解耦评估：类型定义无法解耦
 */
import type { StandardLLMStreamChunk } from "./imports";
/**
 * 用途：导入isSafeSourceChannel类型守卫函数
 * 使用范围：normalizeSourceChannel函数中验证源通道类型
 * 解耦评估：类型守卫逻辑无法解耦
 */
import { isSafeSourceChannel } from "./magiStandardLLMAdapter.guard";
/**
 * 用途：导入SafeSourceChannel类型用于源通道类型
 * 使用范围：normalizeSourceChannel函数的返回类型
 * 解耦评估：类型定义无法解耦
 */
import type { SafeSourceChannel } from "./magiStandardLLMAdapter.types";

const SOURCE_SIMULATION_TAG = "magi_request_source";
const SOURCE_SIMULATION_OPEN = `<${SOURCE_SIMULATION_TAG}>`;
const SOURCE_SIMULATION_CLOSE = `</${SOURCE_SIMULATION_TAG}>`;

/**
 * 规范化源通道值
 * 
 * @同步豁免: 性能考虑 - 简单的类型检查和转换，无需异步操作
 */
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
 * 验证源模拟必需字段
 * 
 * @同步豁免: 性能考虑 - 简单的类型检查，无需异步
 */
function validateSourceFields(
    requestId: unknown,
    callerId: unknown,
    source: unknown,
    trustBase: unknown,
    riskLevel: unknown,
    profileId: unknown,
    profileLabel: unknown,
): boolean {
    return typeof requestId === "string"
        && typeof callerId === "string"
        && (source === "guardian" || source === "external-agent" || source === "system-cron" || source === "unknown")
        && (trustBase === "low" || trustBase === "medium" || trustBase === "high")
        && (riskLevel === "low" || riskLevel === "medium" || riskLevel === "high")
        && typeof profileId === "string"
        && typeof profileLabel === "string";
}

/**
 * 构建源模拟上下文对象
 * 
 * @同步豁免: 性能考虑 - 纯数据组装，无需异步
 */
function buildSourceContext(
    requestId: string,
    callerId: string,
    source: SourceSimulationContext["source"],
    trustBase: SourceSimulationContext["trustBase"],
    riskLevel: SourceSimulationContext["riskLevel"],
    profileId: string,
    profileLabel: string,
    rawSourceChannel: unknown,
    sourcePanelId: unknown,
    sourcePanelTitle: unknown,
): SourceSimulationContext {
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
}

/**
 * 尝试解析单条消息的源模拟信息
 * 
 * @同步豁免: 性能考虑 - JSON解析和数据提取，无需异步
 */
function tryParseMessageSource(content: string): SourceSimulationContext | null {
    const start = content.indexOf(SOURCE_SIMULATION_OPEN);
    const end = content.indexOf(SOURCE_SIMULATION_CLOSE);
    if (start < 0 || end <= start) {
        return null;
    }
    const rawPayload = content.slice(start + SOURCE_SIMULATION_OPEN.length, end).trim();
    if (!rawPayload) {
        return null;
    }
    try {
        const parsed: unknown = JSON.parse(rawPayload);
        if (!parsed || typeof parsed !== "object") {
            return null;
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
        
        if (!validateSourceFields(requestId, callerId, source, trustBase, riskLevel, profileId, profileLabel)) {
            return null;
        }
        
        return buildSourceContext(
            String(requestId),
            String(callerId),
            source,
            trustBase,
            riskLevel,
            String(profileId),
            String(profileLabel),
            rawSourceChannel,
            sourcePanelId,
            sourcePanelTitle,
        );
    } catch {
        return null;
    }
}

/**
 * 从系统消息中解析源模拟上下文
 * 
 * @同步豁免: 性能考虑 - 纯数据解析操作，无需异步
 */
export function parseSourceSimulationFromSystemMessages(
    messages: ChatRequestParams["messages"],
): SourceSimulationContext | undefined {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
        const message = messages[i];
        if (!message || message.role !== "system") {
            continue;
        }
        const content = String(message.content ?? "");
        const result = tryParseMessageSource(content);
        if (result) {
            return result;
        }
    }
    return undefined;
}

/**
 * 构建OpenAI兼容的响应
 * 
 * @同步豁免: 性能考虑 - 纯数据组装操作，无需异步
 */
export function buildOpenAICompatibleResponse(
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

/**
 * 构建完整内容流式数据块
 *
 * @同步豁免: 性能考虑 - 纯数据组装操作，无需异步
 */
export function buildFullContentChunk(content: string, model: string): StandardLLMStreamChunk {
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

/**
 * 构建结束流式数据块
 *
 * @同步豁免: 性能考虑 - 纯数据组装操作，无需异步
 */
export function buildFinishChunk(model: string): StandardLLMStreamChunk {
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

/**
 * 提取最新用户输入
 * 
 * @同步豁免: 性能考虑 - 简单的数组遍历，无需异步
 */
export function extractLatestUserInput(messages: ChatRequestParams["messages"]): string {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
        const message = messages[i];
        if (message && message.role === "user") {
            return String(message.content ?? "").trim();
        }
    }
    return "";
}
