/** 用途：约束请求错误回调；使用范围：请求级错误去重器；解耦评估：同一 SSE 领域的数据契约直接依赖。 */
import type {AgentSSERequest} from "./agentSSE.types";

/** @同步豁免: 生命周期 - 协议错误必须在当前解析调用栈内创建并立即抛出，异步工厂会丢失原始帧栈。 */
export function createAgentSSEProtocolError(message: string, cause?: unknown) {
    const error = new Error(message, cause === undefined ? undefined : {cause});
    error.name = "AgentSSEProtocolError";
    return error;
}

/** @同步豁免: 生命周期 - HTTP 响应分类与错误回调处于同一请求步骤，必须同步保留状态码。 */
export function createAgentHTTPError(message: string, status: number) {
    const error = new Error(message);
    error.name = "AgentHttpError";
    Reflect.set(error, "status", status);
    return error;
}

/** @同步豁免: 生命周期 - 普通请求错误必须在捕获点同步建立，确保 cause 和调用栈对应当前失败。 */
export function createAgentSSEError(message: string, cause?: unknown) {
    return new Error(message, cause === undefined ? undefined : {cause});
}

/** @同步豁免: 生命周期 - 每个请求在发出前同步创建独立报告器，闭包状态只属于该请求并确保 onError 最多结算一次。 */
export function createAgentSSEErrorReporter(onError: AgentSSERequest["onError"]) {
    let reported = false;
    return async (error: Error) => {
        if (reported) {
            return;
        }
        reported = true;
        try {
            await onError(error);
        } catch (handlerError) {
            console.error("agent SSE error handler failed:", handlerError);
        }
    };
}

/** @同步豁免: 生命周期 - 每条响应流需要独立增量解码器，必须在开始读取前同步创建。 */
export function createAgentSSEDecoder() {
    return new TextDecoder();
}
