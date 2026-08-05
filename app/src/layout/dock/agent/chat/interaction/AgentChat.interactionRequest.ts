/** 用途：复用 Agent 控制 API 的结构化请求；使用范围：confirm/question/frontend-tool；解耦评估：经本目录网关隔离 HTTP 实现。 */
import {requestAgentConversationControl} from "./imports";
/** 用途：识别带 reason/status 的服务端失败；使用范围：交互请求结算；解耦评估：经本目录网关复用控制层唯一错误守卫。 */
import {isAgentConversationControlError} from "./imports";
/** 用途：约束交互请求输入和结果；使用范围：公开请求函数。 */
import type {AgentInteractionRequestOptions} from "./AgentChat.interactionRequest.types";
/** 用途：固定交互请求的三态结果；使用范围：所有交互提交调用方。 */
import type {AgentInteractionRequestResult} from "./AgentChat.interactionRequest.types";
/** 用途：约束 Kernel 交互终态；使用范围：未知服务端状态收窄；解耦评估：通过网关复用协议类型，避免本层重复声明。 */
import type {AgentInteractionResolutionStatus} from "./imports";

/** 将服务端扩展状态收窄到当前 UI 支持的终态，未知值按 error 前向兼容。 */
function normalizeResolutionStatus(value: string | undefined) {
    const resolutionStatuses: Record<string, AgentInteractionResolutionStatus> = {
        approved: "approved",
        always: "always",
        rejected: "rejected",
        submitted: "submitted",
        completed: "completed",
        expired: "expired",
        cancelled: "cancelled",
        error: "error",
    };
    return value ? resolutionStatuses[value] || "error" : "error";
}

/**
 * 通过既有控制请求设施提交交互结果。HTTP/业务失败是明确终态；仅传输异常保留重试入口。
 * @显式返回类型原因 该公开边界的判别联合驱动按钮状态机，必须固定三态契约而不能随分支推导漂移。
 */
export async function requestAgentInteraction(
    options: AgentInteractionRequestOptions,
): Promise<AgentInteractionRequestResult> {
    try {
        await requestAgentConversationControl<unknown>({
            path: options.path,
            body: options.body,
            requestHeaders: options.requestHeaders,
        });
        return {state: "accepted"};
    } catch (error) {
        if (isAgentConversationControlError(error)) {
            return {
                state: "resolved",
                status: normalizeResolutionStatus(error.resolutionStatus),
                message: error.message,
            };
        }
        return {state: "retryable", message: error instanceof Error ? error.message : String(error)};
    }
}
