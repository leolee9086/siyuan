/**
 * 用途：导入ChatRequestParams类型用于函数参数
 * 使用范围：createMagiChatCompletion等函数的参数类型
 * 解耦评估：类型定义无法解耦
 */
import type { ChatRequestParams } from "./imports";
/**
 * 用途：导入ChatResponseData类型用于函数返回值
 * 使用范围：createMagiChatCompletion等函数的返回类型
 * 解耦评估：类型定义无法解耦
 */
import type { ChatResponseData } from "./imports";
/**
 * 用途：导入ConnectionStatus类型用于适配器参数
 * 使用范围：createMagiStandardLLMAdapter函数的参数类型
 * 解耦评估：类型定义无法解耦
 */
import type { ConnectionStatus } from "./imports";
/**
 * 用途：导入StandardLLMAdapter类型用于适配器返回值
 * 使用范围：createMagiStandardLLMAdapter函数的返回类型
 * 解耦评估：类型定义无法解耦
 */
import type { StandardLLMAdapter } from "./imports";
/**
 * 用途：导入StandardLLMStreamCallbacks类型用于流式回调
 * 使用范围：streamMagiChatCompletion函数的参数类型
 * 解耦评估：类型定义无法解耦
 */
import type { StandardLLMStreamCallbacks } from "./imports";
/**
 * 用途：导入MagiInterfaceIdentity类型用于接口身份标识
 * 使用范围：createMagiChatCompletion等函数的参数类型
 * 解耦评估：类型定义无法解耦
 */
import type { MagiInterfaceIdentity } from "./magiStandardLLMAdapter.types";
/**
 * 用途：导入extractLatestUserInput函数用于提取用户输入
 * 使用范围：createMagiChatCompletion函数中调用
 * 解耦评估：辅助函数可通过模块化解耦
 */
import { extractLatestUserInput } from "./magiStandardLLMAdapter.helpers";
/**
 * 用途：导入buildOpenAICompatibleResponse函数用于构建响应
 * 使用范围：createMagiChatCompletion函数中调用
 * 解耦评估：辅助函数可通过模块化解耦
 */
import { buildOpenAICompatibleResponse } from "./magiStandardLLMAdapter.helpers";
/**
 * 用途：导入buildFullContentChunk函数用于构建流式内容块
 * 使用范围：streamMagiChatCompletion函数中调用
 * 解耦评估：辅助函数可通过模块化解耦
 */
import { buildFullContentChunk } from "./magiStandardLLMAdapter.helpers";
/**
 * 用途：导入buildFinishChunk函数用于构建流式结束块
 * 使用范围：streamMagiChatCompletion函数中调用
 * 解耦评估：辅助函数可通过模块化解耦
 */
import { buildFinishChunk } from "./magiStandardLLMAdapter.helpers";
/**
 * 用途：导入buildRuntimeMainInterfaceIdentity函数用于构建运行时身份
 * 使用范围：createMagiStandardLLMAdapter函数中调用
 * 解耦评估：后端逻辑可通过模块化解耦
 */
import { buildRuntimeMainInterfaceIdentity } from "./magiStandardLLMAdapter.backend";
/**
 * 用途：导入tryForwardMagiRequestToBackend函数用于转发请求
 * 使用范围：createMagiChatCompletion函数中调用
 * 解耦评估：后端逻辑可通过模块化解耦
 */
import { tryForwardMagiRequestToBackend } from "./magiStandardLLMAdapter.backend";
/**
 * 用途：导入dispatchCustomEvent函数用于触发全局事件
 * 使用范围：createMagiChatCompletion函数中触发身份认证事件
 * 解耦评估：环境封装函数无法解耦
 */
import { dispatchCustomEvent } from "./window.environment";
/**
 * 用途：导入MAGI_IDENTITY_REQUIRED_EVENT常量用于触发身份认证事件
 * 使用范围：createMagiChatCompletion函数中触发事件
 * 解耦评估：事件常量无法解耦
 */
import { MAGI_IDENTITY_REQUIRED_EVENT } from "./imports";

/**
 * 创建MAGI标准LLM适配器
 *
 * 作用：将MAGI共识链路封装为标准LLM适配器接口
 * 意图：让上层以统一契约调用，不感知内部三贤人实现
 * 调用时机：在需要创建MAGI适配器时调用
 * 
 * @param params - 适配器参数
 * @returns 标准LLM适配器实例
 */
export async function createMagiStandardLLMAdapter(params: {
    model?: string;
    connectionStatus: { value: ConnectionStatus };
    mainInterfaceIdentity?: MagiInterfaceIdentity;
}) {
    const model = params.model;
    const runtimeMainInterfaceIdentity = params.mainInterfaceIdentity ?? buildRuntimeMainInterfaceIdentity();

    return {
        /**
         * 创建聊天完成
         *
         * 作用：处理聊天请求并返回完整响应
         * 意图：提供标准LLM适配器的同步接口
         * 调用时机：上层需要获取完整响应时调用
         */
        createChatCompletion: async (request) =>
            createMagiChatCompletion(request, model, runtimeMainInterfaceIdentity, params.connectionStatus),
        /**
         * 流式聊天完成
         *
         * 作用：处理聊天请求并通过回调逐步返回响应
         * 意图：提供标准LLM适配器的流式接口
         * 调用时机：上层需要流式接收响应时调用
         */
        streamChatCompletion: async (request, callbacks) =>
            streamMagiChatCompletion(
                request,
                callbacks,
                model,
                runtimeMainInterfaceIdentity,
                params.connectionStatus,
            ),
    };
}

/**
 * 解析后端失败原因中的 HTTP 状态码。
 *
 * 作用：从 `backend-http-*` 形式的失败原因中提取状态码。
 * 意图：区分“后端接口可达但请求无效”和“后端本身不可用”，避免把普通 4xx 误判成断连。
 * 调用时机：`syncBackendConnectionStatus` 判断失败类型时调用。
 */
function readBackendHttpStatus(reason: string) {
    const prefix = "backend-http-";
    if (!reason.startsWith(prefix)) {
        return null;
    }
    const status = Number.parseInt(reason.slice(prefix.length), 10);
    return Number.isFinite(status) ? status : null;
}

/**
 * 根据后端请求结果同步前端连接状态。
 *
 * 作用：把后端成功响应、认证缺失、HTTP 失败、网络异常统一映射到 `connectionStatus`。
 * 意图：让 MAGI 主界面只展示前端到 MAGI 后端接口的可达性，而不是底层 LLM 供应商状态。
 * 调用时机：每次 `tryForwardMagiRequestToBackend` 返回后立即调用。
 */
function syncBackendConnectionStatus(
    connectionStatus: { value: ConnectionStatus },
    backendResult: { response: ChatResponseData | null; reason: string },
) {
    if (backendResult.response) {
        connectionStatus.value = "connected";
        return;
    }
    if (backendResult.reason === "magi-armor-token-missing") {
        return;
    }
    const httpStatus = readBackendHttpStatus(backendResult.reason);
    // 4xx 表示后端已经返回响应，请求或认证有问题，但链路本身仍是通的。
    if (httpStatus !== null && httpStatus < 500) {
        connectionStatus.value = "connected";
        return;
    }
    connectionStatus.value = "error";
}

/**
 * 创建MAGI聊天完成
 *
 * 作用：处理MAGI聊天请求并返回响应
 * 意图：尝试转发到后端，失败时抛出错误
 * 调用时机：在适配器的createChatCompletion方法中调用
 *
 * @param request - 聊天请求参数
 * @param model - 模型名称
 * @param runtimeMainInterfaceIdentity - 运行时主接口身份
 * @returns 聊天响应数据
 */
async function createMagiChatCompletion(
    request: ChatRequestParams,
    model: string,
    runtimeMainInterfaceIdentity: MagiInterfaceIdentity,
    connectionStatus: { value: ConnectionStatus },
) {
    const userInput = extractLatestUserInput(request.messages);
    if (!userInput) {
        return buildOpenAICompatibleResponse("", request.model ?? model, "stop");
    }
    const backendResult = await tryForwardMagiRequestToBackend(
        request,
        request.model ?? model,
        runtimeMainInterfaceIdentity,
    );
    syncBackendConnectionStatus(connectionStatus, backendResult);
    // 后端成功返回响应，直接返回
    if (backendResult.response) {
        return backendResult.response;
    }
    // 缺少armor token时触发身份认证事件并抛出错误
    if (backendResult.reason === "magi-armor-token-missing") {
        dispatchCustomEvent(MAGI_IDENTITY_REQUIRED_EVENT, { reason: "main-chat-missing-armor-session" });
        throw new Error("MAGI identity session missing. Please login in Identity Access Control panel.");
    }
    // 其他后端错误
    throw new Error(`MAGI backend request failed: ${backendResult.reason}`);
}

/**
 * 流式MAGI聊天完成
 *
 * 作用：处理MAGI流式聊天请求
 * 意图：通过回调函数逐步返回响应内容
 * 调用时机：在适配器的streamChatCompletion方法中调用
 *
 * @param request - 聊天请求参数
 * @param callbacks - 流式回调函数
 * @param model - 模型名称
 * @param runtimeMainInterfaceIdentity - 运行时主接口身份
 */
async function streamMagiChatCompletion(
    request: ChatRequestParams,
    callbacks: StandardLLMStreamCallbacks,
    model: string,
    runtimeMainInterfaceIdentity: MagiInterfaceIdentity,
    connectionStatus: { value: ConnectionStatus },
) {
    callbacks.onStart?.();
    try {
        const response = await createMagiChatCompletion(
            request,
            model,
            runtimeMainInterfaceIdentity,
            connectionStatus,
        );
        const firstChoice = response.choices?.[0];
        const content = firstChoice?.message?.content ?? "";
        callbacks.onChunk?.(buildFullContentChunk(content, response.model ?? model));
        callbacks.onChunk?.(buildFinishChunk(response.model ?? model));
        callbacks.onDone?.();
    } catch (error) {
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        callbacks.onError?.(normalizedError);
    }
}

