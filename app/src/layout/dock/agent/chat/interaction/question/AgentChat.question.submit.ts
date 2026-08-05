/** 用途：约束问题提交运行时；使用范围：答案请求与结算；解耦评估：运行时接口经目录网关隔离具体门面。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：提交结构化交互请求；使用范围：问题答案端点；解耦评估：复用统一请求边界避免复制 HTTP 错误处理。 */
import {requestAgentInteraction} from "./imports";
/** 用途：约束问题答案请求；使用范围：公开提交入口；解耦评估：类型契约与卡片协议放在独立类型文件。 */
import type {AgentQuestionAnswerRequest} from "./AgentChat.question.types";
/** 用途：结算问题卡片；使用范围：结构化业务失败；解耦评估：同目录唯一结算命令原子更新条目和 DOM。 */
import {resolveQuestion} from "./AgentChat.question.resolution";

/** 提交问题答案并持久化当前会话中的卡片状态。 */
export async function postQuestionAnswer(runtime: AgentChatRuntime, request: AgentQuestionAnswerRequest) {
    const result = await requestAgentInteraction({
        path: "/api/ai/agent/question",
        body: {sessionID: request.sessionID, questionID: request.questionID, answers: request.answers},
        requestHeaders: runtime.sessionPorts.requestHeaders,
    });
    // 结构化业务失败已经携带终态，只对生成该卡片的当前会话执行本地结算。
    if (result.state === "resolved" && runtime.sessionId === request.sessionID) {
        resolveQuestion(runtime, {questionID: request.questionID, status: result.status, message: result.message});
        runtime.capabilities.showMessage?.(result.message, 3000);
        return result;
    }
    // 传输异常没有可信服务端终态，保留原卡片并记录实际错误供按钮状态机恢复。
    if (result.state === "retryable") {
        console.error("agent question request error:", result.message);
    }
    return result;
}
