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
 * 用途：导入标准流式 chunk 类型，约束 SSE 消费回调。
 * 使用范围：仅用于 tryStreamMagiRequestToBackend 的参数对象。
 * 解耦评估：这是编译期协议依赖，无法通过运行时注入替代。
 */
import type { StandardLLMStreamChunk } from "./imports";
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
 * 用途：导入流式后端结果类型，区分完整成功与明确失败原因。
 * 使用范围：tryStreamMagiRequestToBackend 的返回契约。
 * 解耦评估：类型与 adapter 边界一致，直接导入不增加运行时耦合。
 */
import type { BackendStreamResult } from "./magiStandardLLMAdapter.types";
/**
 * 用途：从目录依赖网关导入共享 SSE data 解析器，顺序消费任意网络分块。
 * 使用范围：仅用于 MAGI 后端成功响应的 body。
 * 解耦评估：通用协议实现应直接复用，不适合在 MAGI 内再次编写或注入。
 */
import { consumeSSEDataStream } from "./imports";
/**
 * 用途：导入流式 chunk 类型守卫，校验 JSON 边界。
 * 使用范围：每个 MAGI SSE data 事件解析后调用。
 * 解耦评估：守卫是 adapter 的协议边界，与业务宿主无关。
 */
import { isStandardLLMStreamChunk } from "./magiStandardLLMAdapter.guard";
/**
 * 用途：导入 MAGI 接口身份类型。
 * 使用范围：运行时主界面身份构建与主聊天 `user` 镜像拼装。
 * 解耦评估：类型定义无法解耦。
 */
import type { MagiInterfaceIdentity } from "./magiStandardLLMAdapter.types";

const SOURCE_SIMULATION_BACKEND_ENDPOINT_PATH = "/api/s-forge/magi/v1/chat/completions";
/** MAGI 监控 WebSocket 使用的固定运行时会话标识。 */
export const MAGI_RUNTIME_MONITOR_SESSION_ID = "magi-main-runtime";

/**
 * 构建随机身份段
 *
 * @同步豁免: 性能考虑 - 简单字符串生成，无需异步。
 */
function buildRandomIdentitySegment() {
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
 * @同步豁免: 性能考虑 - 仅组装本地身份值，不执行 I/O，调用方需要立即获得初始化身份。
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

/**
 * 作用：将面板接口身份和当前 armor 身份合并为 OpenAI user 字段载荷。
 * 意图：让后端以标准字段恢复来源身份，不依赖私有 header。
 * 调用时机：每个 MAGI 主聊天请求准备阶段调用。
 */
function buildMainRequestIdentityPayload(
    mainIdentity: MagiInterfaceIdentity,
    activeSession: MagiArmorSession | null,
) {
    return {
        ...(activeSession?.identityId
            ? { principal: activeSession.identityId }
            : {}),
        interface: mainIdentity.interfaceId,
        kind: mainIdentity.interfaceKind,
        conversation: mainIdentity.conversationId,
    };
}

/**
 * 作用：序列化当前主聊天接口身份。
 * 意图：确保同步和流式请求共享完全相同的 user 字段格式。
 * 调用时机：准备后端请求且调用方未显式提供 user 时调用。
 */
function buildRuntimeMainRequestUser(mainIdentity: MagiInterfaceIdentity) {
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
    stream: boolean,
) {
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
        stream,
    };
}

/**
 * 构建 MAGI 后端请求头
 *
 * @同步豁免: 性能考虑 - 纯数据组装操作，无需异步。
 */
function buildMagiBackendHeaders(armorToken: string) {
    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${armorToken}`,
    };
}

/**
 * 作用：集中准备 MAGI 同步和流式 fetch 请求。
 * 意图：认证、身份、端点和请求体只保留一套实现，stream 仅控制协议模式。
 * 调用时机：两个后端发送入口在 fetch 前调用。
 */
function prepareMagiBackendRequest(params: {
    request: ChatRequestParams;
    fallbackModel: string;
    mainIdentity: MagiInterfaceIdentity;
    stream: boolean;
    signal?: AbortSignal;
}) {
    const armorToken = getActiveMagiArmorToken();
    if (!armorToken) {
        return {prepared: null, reason: "magi-armor-token-missing"};
    }

    let apiBaseURL = "";
    try {
        apiBaseURL = String(getAIConfigFromSiyuan().apiBaseURL ?? "").trim();
    } catch {
        // baseURL 缺失时使用同源后端。
    }
    const headers: Record<string, string> = buildMagiBackendHeaders(armorToken);
    if (params.stream) {
        headers.Accept = "text/event-stream";
    }
    return {
        prepared: {
            endpoint: buildSourceSimulationBackendEndpoint(apiBaseURL),
            init: {
                method: "POST",
                credentials: "include",
                headers,
                body: JSON.stringify(buildMagiBackendRequestBody({
                    ...params.request,
                    user: params.request.user ?? buildRuntimeMainRequestUser(params.mainIdentity),
                }, params.fallbackModel, params.stream)),
                signal: params.signal,
            },
        },
        reason: "prepared",
    };
}

/**
 * 作用：解析并校验一条 SSE data，随后等待上层完成当前 chunk 消费。
 * 意图：保证畸形 JSON 不进入消息状态，并保持 chunk 与完成事件的严格顺序。
 * 调用时机：共享 SSE 解析器每识别出一条 data 事件时调用。
 */
async function consumeMagiSSEData(
    data: string,
    onChunk: (chunk: StandardLLMStreamChunk) => void | Promise<void>,
) {
    let chunk: unknown;
    try {
        chunk = JSON.parse(data);
    } catch (error) {
        throw new Error(`MAGI backend returned invalid SSE JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!isStandardLLMStreamChunk(chunk)) {
        throw new Error("MAGI backend returned an invalid SSE chunk shape");
    }
    if (chunk.error) {
        throw new Error(chunk.error.message);
    }
    await onChunk(chunk);
}

/**
 * 尝试转发 MAGI 请求到后端
 *
 * 作用：以标准 OpenAI-compatible body 调用 MAGI 后端统一聊天接口。
 * 意图：当前前端只负责 UI 与身份镜像，不再在浏览器端执行本地共识/投票链路。
 * 调用时机：createMagiChatCompletion 每次发起主聊天请求时调用。
 * @显式返回类型原因: 公开后端边界必须固定 BackendForwardResult 契约。
 */
export async function tryForwardMagiRequestToBackend(params: {
    request: ChatRequestParams;
    fallbackModel: string;
    mainIdentity: MagiInterfaceIdentity;
    signal?: AbortSignal;
}): Promise<BackendForwardResult> {
    const requestState = prepareMagiBackendRequest({...params, stream: false});
    if (!requestState.prepared) {
        return {response: null, reason: requestState.reason};
    }

    try {
        const response = await fetch(requestState.prepared.endpoint, requestState.prepared.init);
        if (!response.ok) {
            return {response: null, reason: `backend-http-${response.status}`};
        }
        const data: ChatResponseData = await response.json();
        return {response: data, reason: "backend-forwarded"};
    } catch (error) {
        return {
            response: null,
            reason: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * 作用：以 OpenAI SSE 协议转发 MAGI 请求并顺序交付每个 chunk。
 * 意图：让 Agent Panel 直接消费后端流，缺失 body、结束标记或合法 JSON 时明确失败。
 * 调用时机：StandardLLMAdapter.streamChatCompletion 发起 MAGI 对话时调用。
 * @显式返回类型原因: 公开后端边界必须固定 BackendStreamResult 契约。
 */
export async function tryStreamMagiRequestToBackend(params: {
    request: ChatRequestParams;
    fallbackModel: string;
    mainIdentity: MagiInterfaceIdentity;
    onChunk: (chunk: StandardLLMStreamChunk) => void | Promise<void>;
    signal?: AbortSignal;
}): Promise<BackendStreamResult> {
    const requestState = prepareMagiBackendRequest({...params, stream: true});
    if (!requestState.prepared) {
        return {success: false, reason: requestState.reason};
    }

    try {
        const response = await fetch(requestState.prepared.endpoint, requestState.prepared.init);
        if (!response.ok) {
            return {success: false, reason: `backend-http-${response.status}`};
        }
        const contentType = response.headers.get("Content-Type")?.toLowerCase() ?? "";
        if (!contentType.includes("text/event-stream")) {
            return {success: false, reason: "backend-stream-content-type-invalid"};
        }
        if (!response.body) {
            return {success: false, reason: "backend-stream-body-missing"};
        }

        const streamResult = await consumeSSEDataStream(response.body, (data) => consumeMagiSSEData(data, params.onChunk));
        if (!streamResult.receivedDone) {
            return {success: false, reason: "backend-stream-done-missing"};
        }
        if (streamResult.eventCount === 0) {
            return {success: false, reason: "backend-stream-empty"};
        }
        return {success: true, reason: "backend-streamed"};
    } catch (error) {
        return {
            success: false,
            reason: error instanceof Error ? error.message : String(error),
        };
    }
}
