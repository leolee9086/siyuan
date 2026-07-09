/**
 * 用途：导入 ChatRequestParams 类型用于后端请求体构造。
 * 使用范围：buildMagiBackendRequestBody 与 tryForwardMagiRequestToBackend 的参数类型。
 * 解耦评估：类型定义无法解耦。
 */
import type { ChatRequestParams } from "./imports";
/**
 * 用途：导入 ChatResponseData 类型用于后端响应类型标注。
 * 使用范围：tryForwardMagiRequestToBackend 的返回值结构。
 * 解耦评估：类型定义无法解耦。
 */
import type { ChatResponseData } from "./imports";
/**
 * 用途：读取思源 AI 配置以推导 MAGI 后端目标地址。
 * 使用范围：仅在 tryForwardMagiRequestToBackend 内部读取 apiBaseURL。
 * 解耦评估：可通过依赖注入解耦，但当前 adapter 创建链路没有额外配置层，直接读取全局配置更符合现状。
 */
import { getAIConfigFromSiyuan } from "./imports";
/**
 * 用途：读取当前 armor token 用于 MAGI 后端认证。
 * 使用范围：tryForwardMagiRequestToBackend 发请求前附加 Bearer token。
 * 解耦评估：可通过依赖注入解耦，但主聊天当前固定依赖全局身份会话。
 */
import { getActiveMagiArmorToken } from "./imports";
/**
 * 用途：读取当前 armor 会话用于构建主聊天身份镜像。
 * 使用范围：buildRuntimeMainRequestUser 在拼装 OpenAI `user` 字段时读取 identityId。
 * 解耦评估：可通过依赖注入解耦，但主聊天当前没有独立于全局登录态的身份来源。
 */
import { getActiveMagiArmorSession } from "./imports";
/**
 * 用途：导入 armor 会话类型定义。
 * 使用范围：buildMainRequestIdentityPayload 的参数类型。
 * 解耦评估：类型定义无法解耦。
 */
import type { MagiArmorSession } from "./imports";
/**
 * 用途：读取思源运行时配置中的 MAGI 目标标识。
 * 使用范围：buildRuntimeMainInterfaceIdentity 生成 interfaceLabel。
 * 解耦评估：可通过依赖注入解耦，但当前仅在运行时身份构建处单点使用，保留直接读取更简洁。
 */
import { getSiyuanConfig } from "./imports";
/**
 * 用途：导入后端转发结果类型。
 * 使用范围：tryForwardMagiRequestToBackend 返回统一的成功/失败结果。
 * 解耦评估：类型定义无法解耦。
 */
import type { BackendForwardResult } from "./magiStandardLLMAdapter.types";
/**
 * 用途：导入 MAGI 接口身份类型。
 * 使用范围：运行时主界面身份构建与主聊天 `user` 镜像拼装。
 * 解耦评估：类型定义无法解耦。
 */
import type { MagiInterfaceIdentity } from "./magiStandardLLMAdapter.types";

const SOURCE_SIMULATION_BACKEND_ENDPOINT_PATH = "/api/s-forge/magi/v1/chat/completions";
export const MAGI_RUNTIME_MONITOR_SESSION_ID = "magi-main-runtime";

/**
 * 构建随机身份段
 *
 * @同步豁免: 性能考虑 - 简单字符串生成，无需异步。
 */
function buildRandomIdentitySegment(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 解析 MAGI 目标标签
 *
 * @同步豁免: 性能考虑 - 简单配置读取，无需异步。
 */
function resolveMagiTargetLabel() {
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
 * 作用：为主聊天面板生成本次会话的 interface/conversation 标识。
 * 意图：让前端通过标准 OpenAI `user` 字段把调用端身份镜像传给后端，而不是依赖私有 header。
 * 调用时机：`useMagi` 初始化适配器前与 `createMagiStandardLLMAdapter` 缺省参数回退时调用。
 */
export function buildRuntimeMainInterfaceIdentity() {
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
 * 解析运行时 origin
 *
 * @同步豁免: 性能考虑 - 简单全局变量读取，无需异步。
 */
function resolveRuntimeOrigin() {
    if (typeof location === "undefined") {
        return "";
    }
    return String(location.origin ?? "").trim();
}

/**
 * 构建 MAGI 后端端点
 *
 * 作用：优先使用当前运行页 origin 命中同源 MAGI 后端，无法获取时再回退到 apiBaseURL 的 origin。
 * 意图：让桌面/Web 入口都能复用同一条 `/api/s-forge/magi/v1/chat/completions` 转发链路。
 * 调用时机：tryForwardMagiRequestToBackend 发请求前调用。
 */
function buildSourceSimulationBackendEndpoint(apiBaseURL: string) {
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

function buildMainRequestIdentityPayload(
    mainIdentity: MagiInterfaceIdentity,
    activeSession: MagiArmorSession | null,
): Record<string, string> {
    return {
        ...(activeSession?.identityId
            ? { principal: activeSession.identityId }
            : {}),
        interface: mainIdentity.interfaceId,
        kind: mainIdentity.interfaceKind,
        conversation: mainIdentity.conversationId,
    };
}

function buildRuntimeMainRequestUser(mainIdentity: MagiInterfaceIdentity): string {
    const activeSession = getActiveMagiArmorSession();
    return JSON.stringify(buildMainRequestIdentityPayload(mainIdentity, activeSession));
}

/**
 * 构建 MAGI 后端请求体
 *
 * @同步豁免: 性能考虑 - 纯数据组装操作，无需异步。
 */
function buildMagiBackendRequestBody(
    request: ChatRequestParams,
    fallbackModel: string,
): Record<string, unknown> {
    return {
        model: request.model ?? fallbackModel,
        messages: request.messages,
        ...(typeof request.user === "string" && request.user.trim()
            ? { user: request.user.trim() }
            : {}),
        temperature: request.temperature,
        max_tokens: request.max_tokens,
        ...(Array.isArray(request.tools) ? { tools: request.tools } : {}),
        ...(request.tool_choice !== undefined ? { tool_choice: request.tool_choice } : {}),
        stream: false,
    };
}

/**
 * 构建 MAGI 后端请求头
 *
 * @同步豁免: 性能考虑 - 纯数据组装操作，无需异步。
 */
function buildMagiBackendHeaders(armorToken: string): Record<string, string> {
    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${armorToken}`,
    };
}

/**
 * 尝试转发 MAGI 请求到后端
 *
 * 作用：以标准 OpenAI-compatible body 调用 MAGI 后端统一聊天接口。
 * 意图：当前前端只负责 UI 与身份镜像，不再在浏览器端执行本地共识/投票链路。
 * 调用时机：createMagiChatCompletion 每次发起主聊天请求时调用。
 */
export async function tryForwardMagiRequestToBackend(
    request: ChatRequestParams,
    fallbackModel: string,
    mainIdentity: MagiInterfaceIdentity,
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
    const requestBody = buildMagiBackendRequestBody({
        ...request,
        /**
         * 主面板必须像普通 LLM 客户端一样，通过标准 OpenAI `user` 字段
         * 提供会话身份镜像；前端不依赖 MAGI/NERV 私有 header。
         */
        user: request.user ?? buildRuntimeMainRequestUser(mainIdentity),
    }, fallbackModel);

    try {
        const response = await fetch(endpoint, {
            method: "POST",
            credentials: "include",
            headers: buildMagiBackendHeaders(armorToken),
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
