/** 用途：创建请求级错误与去重报告器；使用范围：SSE 编排的全部失败路径；解耦评估：同一 SSE 领域直接依赖对象工厂。 */
import {createAgentSSEError} from "./request/sse/agentSSE.error.factory";
/** 用途：创建请求级错误去重器；使用范围：HTTP、协议、流结束和异常路径；解耦评估：同一 SSE 领域直接依赖对象工厂。 */
import {createAgentSSEErrorReporter} from "./request/sse/agentSSE.error.factory";
/** 用途：识别主动中止；使用范围：异常分类；解耦评估：同一 SSE 领域直接依赖错误守卫。 */
import {isAgentSSEAbortError} from "./request/sse/agentSSE.error.guard";
/** 用途：识别协议错误；使用范围：保留精确协议诊断；解耦评估：同一 SSE 领域直接依赖错误守卫。 */
import {isAgentSSEProtocolError} from "./request/sse/agentSSE.error.guard";
/** 用途：读取未知错误消息；使用范围：超时与通用网络错误分类；解耦评估：同一 SSE 领域直接依赖错误守卫。 */
import {readAgentSSEErrorMessage} from "./request/sse/agentSSE.error.guard";
/** 用途：发起 HTTP 请求；使用范围：SSE 编排第一阶段；解耦评估：同一 SSE 领域直接依赖请求职责。 */
import {requestAgentSSEResponse} from "./request/sse/agentSSE.request";
/** 用途：校验 HTTP 响应并取得 reader；使用范围：SSE 编排第二阶段；解耦评估：同一 SSE 领域直接依赖响应职责。 */
import {resolveAgentSSEReader} from "./request/sse/agentSSE.response";
/** 用途：顺序消费协议流；使用范围：SSE 编排第三阶段；解耦评估：同一 SSE 领域直接依赖流职责。 */
import {consumeAgentSSEStream} from "./request/sse/agentSSE.stream";
/** 用途：约束一次请求的完整输入；使用范围：公开入口与错误分类；解耦评估：同一 SSE 领域的数据契约直接依赖。 */
import type {AgentSSERequest} from "./request/sse/agentSSE.types";

/** 把读取过程中的未知异常结算为协议错误、超时错误或通用网络错误。 */
async function reportAgentSSEFailure(error: unknown, reportError: (error: Error) => Promise<void>) {
    if (isAgentSSEAbortError(error)) {
        return;
    }
    // 协议错误已包含事件名和原始 cause，应原样交给界面诊断。
    if (isAgentSSEProtocolError(error)) {
        await reportError(error);
        return;
    }
    const message = readAgentSSEErrorMessage(error).toLowerCase();
    const languageIndex = message.includes("timeout") || message.includes("deadline") ? 24 : 28;
    await reportError(createAgentSSEError(window.siyuan.languages._kernel[languageIndex], error));
}

/** 发起并完整结算一次原生 Agent SSE 请求；所有阶段共享同一个错误出口和中止信号。 */
export async function fetchAgentSSE(request: AgentSSERequest) {
    const reportError = createAgentSSEErrorReporter(request.onError);
    try {
        const response = await requestAgentSSEResponse(request);
        const reader = await resolveAgentSSEReader(response, reportError);
        if (!reader) {
            return;
        }
        const terminalReceived = await consumeAgentSSEStream(reader, request.onEvent);
        // 未收到 done/error/interrupted 且请求未中止时，流结束属于协议级失败。
        if (!terminalReceived && !request.signal?.aborted) {
            await reportError(createAgentSSEError(window.siyuan.languages._kernel[28]));
        }
    } catch (error) {
        await reportAgentSSEFailure(error, reportError);
    }
}
