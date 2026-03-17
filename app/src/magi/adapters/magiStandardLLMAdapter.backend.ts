/**
 * 用途：导入ChatRequestParams类型用于后端请求
 * 使用范围：buildMagiBackendRequestBody等函数的参数类型
 * 解耦评估：类型定义无法解耦
 */
import type { ChatRequestParams } from "./imports";
/**
 * 用途：导入ChatResponseData类型用于后端响应
 * 使用范围：tryForwardMagiRequestToBackend函数的返回类型
 * 解耦评估：类型定义无法解耦
 */
import type { ChatResponseData } from "./imports";
/**
 * 用途：导入ConsensusRequestContext类型用于请求上下文
 * 使用范围：buildRequestInterfaceIdentity等函数的参数类型
 * 解耦评估：类型定义无法解耦
 */
import type { ConsensusRequestContext } from "./imports";
/**
 * 用途：导入getAIConfigFromSiyuan函数用于获取AI配置
 * 使用范围：tryForwardMagiRequestToBackend函数中获取apiBaseURL
 * 解耦评估：可通过依赖注入解耦，但当前实现为全局配置读取
 */
import { getAIConfigFromSiyuan } from "./imports";
/**
 * 用途：导入getActiveMagiArmorToken函数用于获取认证令牌
 * 使用范围：tryForwardMagiRequestToBackend函数中获取认证令牌
 * 解耦评估：可通过依赖注入解耦，但当前实现为全局会话管理
 */
import { getActiveMagiArmorToken } from "./imports";
/**
 * 用途：导入getSiyuanConfig函数用于获取思源配置
 * 使用范围：resolveMagiTargetLabel函数中获取magi.target配置
 * 解耦评估：可通过依赖注入解耦，但当前实现为全局配置读取
 */
import { getSiyuanConfig } from "./imports";
/**
 * 用途：导入BackendForwardResult类型用于后端转发结果
 * 使用范围：tryForwardMagiRequestToBackend函数的返回类型
 * 解耦评估：类型定义无法解耦
 */
import type { BackendForwardResult } from "./magiStandardLLMAdapter.types";
/**
 * 用途：导入MagiInterfaceIdentity类型用于接口身份标识
 * 使用范围：buildRuntimeMainInterfaceIdentity等函数的返回类型
 * 解耦评估：类型定义无法解耦
 */
import type { MagiInterfaceIdentity } from "./magiStandardLLMAdapter.types";

const SOURCE_SIMULATION_BACKEND_ENDPOINT_PATH = "/api/s-forge/magi/v1/chat/completions";

/**
 * 构建随机身份段
 * 
 * @同步豁免: 性能考虑 - 简单的字符串生成，无需异步
 */
export function buildRandomIdentitySegment(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 解析MAGI目标标签
 * 
 * @同步豁免: 性能考虑 - 简单的配置读取，无需异步
 */
export function resolveMagiTargetLabel(): string {
    try {
        const config = getSiyuanConfig();
        const magiConfig = config && typeof config === "object" ? Reflect.get(config, "magi") : undefined;
        const target = magiConfig && typeof magiConfig === "object" ? Reflect.get(magiConfig, "target") : undefined;
        const targetLabel = typeof target === "string" ? target.trim() : "";
        if (targetLabel) {
            return targetLabel;
        }
    } catch {
        // ignore
    }
    return "magi";
}

/**
 * 构建运行时主接口身份
 * 
 * @同步豁免: 性能考虑 - 纯数据组装操作，无需异步
 */
export function buildRuntimeMainInterfaceIdentity(): MagiInterfaceIdentity {
    const suffix = buildRandomIdentitySegment();
    return {
        principalId: "workspace-admin",
        interfaceId: `main-${suffix}`,
        interfaceKind: "magi-main-ui",
        interfaceLabel: resolveMagiTargetLabel(),
        conversationId: `main-conv-${suffix}`,
    };
}

/**
 * 解析运行时origin
 *
 * @同步豁免: 性能考虑 - 简单的全局变量读取，无需异步
 */
export function resolveRuntimeOrigin(): string {
    if (typeof location === "undefined") {
        return "";
    }
    return String(location.origin ?? "").trim();
}

/**
 * 构建源模拟后端端点
 * 
 * @同步豁免: 性能考虑 - URL解析和字符串拼接，无需异步
 */
export function buildSourceSimulationBackendEndpoint(apiBaseURL: string): string {
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


/**
 * 构建请求接口身份
 * 
 * @同步豁免: 性能考虑 - 纯数据组装操作，无需异步
 */
export function buildRequestInterfaceIdentity(
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

/**
 * 构建MAGI后端请求体
 * 
 * @同步豁免: 性能考虑 - 纯数据组装操作，无需异步
 */
export function buildMagiBackendRequestBody(
    request: ChatRequestParams,
    fallbackModel: string,
): Record<string, unknown> {
    return {
        model: request.model ?? fallbackModel,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.max_tokens,
        ...(Array.isArray(request.tools) ? { tools: request.tools } : {}),
        ...(request.tool_choice !== undefined ? { tool_choice: request.tool_choice } : {}),
        stream: false,
    };
}

/**
 * 构建MAGI后端请求头
 * 
 * @同步豁免: 性能考虑 - 纯数据组装操作，无需异步
 */
export function buildMagiBackendHeaders(armorToken: string, sessionId: string): Record<string, string> {
    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${armorToken}`,
        ...(sessionId ? { "X-MAGI-Session-ID": sessionId } : {}),
    };
}

/**
 * 尝试转发MAGI请求到后端
 * 
 * 作用：将请求转发到MAGI后端服务
 * 意图：支持后端处理MAGI请求
 * 调用时机：在createMagiChatCompletion函数中尝试转发请求
 */
export async function tryForwardMagiRequestToBackend(
    request: ChatRequestParams,
    fallbackModel: string,
    requestContext: ConsensusRequestContext,
    mainIdentity: MagiInterfaceIdentity,
    sessionId: string,
): Promise<BackendForwardResult> {
    const armorToken = getActiveMagiArmorToken();
    if (!armorToken) {
        return { response: null, reason: "magi-armor-token-missing" };
    }

    let apiBaseURL = "";
    try {
        apiBaseURL = String(getAIConfigFromSiyuan().apiBaseURL ?? "").trim();
    } catch {
        // baseURL 缺失时回退到相对路径，仍可在同源场景命中后端
    }
    const endpoint = buildSourceSimulationBackendEndpoint(apiBaseURL);
    buildRequestInterfaceIdentity(requestContext, mainIdentity);
    const requestBody = buildMagiBackendRequestBody(request, fallbackModel);

    try {
        const response = await fetch(endpoint, {
            method: "POST",
            credentials: "include",
            headers: buildMagiBackendHeaders(armorToken, sessionId),
            body: JSON.stringify(requestBody),
        });
        if (!response.ok) {
            return { response: null, reason: `backend-http-${response.status}` };
        }
        const data: ChatResponseData = await response.json();
        return { response: data, reason: "backend-forwarded" };
    } catch (error) {
        return {
            response: null,
            reason: error instanceof Error ? error.message : String(error),
        };
    }
}
