/** 用途：构造结构化控制错误；使用范围：HTTP 和协议失败；解耦评估：实例化集中在工厂，网络层只依赖函数。 */
import {createAgentConversationControlError} from "./AgentConversationControl.error.factory";
/** 用途：读取已校验响应包络；使用范围：控制端点 JSON 边界；解耦评估：守卫是同协议纯函数，无需注入。 */
import {readAgentConversationControlEnvelope} from "./AgentConversationControl.guard";
/** 用途：约束控制请求输入；使用范围：本文件公开请求入口。 */
import type {AgentConversationControlRequestOptions} from "./AgentConversationControl.types";
/** 用途：约束控制响应包络；使用范围：失败详情读取。 */
import type {AgentConversationControlEnvelope} from "./AgentConversationControl.types";

/** 读取结构化失败信息，同时保留 HTTP 状态用于冲突恢复。 */
function createControlError(response: Response, envelope: AgentConversationControlEnvelope<unknown>) {
    const data = envelope.data && typeof envelope.data === "object" ? envelope.data : {};
    const reason = "reason" in data && typeof data.reason === "string" ? data.reason : "request_failed";
    const queueVersion = "queueVersion" in data && typeof data.queueVersion === "number" ? data.queueVersion : 0;
    return createAgentConversationControlError(envelope.msg || `Agent control request failed: ${response.status}`, {
        reason,
        queueVersion,
        status: response.status,
    });
}

/** 发起一次控制 API 请求并解开思源标准响应包络。 */
export async function requestAgentConversationControl<T>(options: AgentConversationControlRequestOptions) {
    const method = options.method || "POST";
    const response = await fetch(options.path, {
        method,
        headers: options.requestHeaders({
            scope: "app",
            ...(method === "POST" ? {headers: {"Content-Type": "application/json"}} : {}),
        }),
        ...(options.body ? {body: JSON.stringify(options.body)} : {}),
        signal: options.signal || null,
    });
    let envelope: AgentConversationControlEnvelope<T> | null;
    try {
        const value: unknown = await response.json();
        envelope = readAgentConversationControlEnvelope<T>(value);
    } catch {
        throw createAgentConversationControlError("Agent control response is not valid JSON", {
            reason: "invalid_response",
            queueVersion: 0,
            status: response.status,
        });
    }
    // 非对象 JSON 不能作为控制响应继续处理。
    if (!envelope) {
        throw createAgentConversationControlError("Agent control response is not a valid envelope", {
            reason: "invalid_response",
            queueVersion: 0,
            status: response.status,
        });
    }
    if (!response.ok || envelope.code !== 0 || envelope.data === undefined) {
        throw createControlError(response, envelope);
    }
    return envelope.data;
}
