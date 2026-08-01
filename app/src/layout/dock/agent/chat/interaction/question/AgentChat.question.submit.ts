import type {AgentChatRuntime} from "./imports";
import {readAPIResult} from "./imports";
import type {AgentQuestionAnswerRequest} from "./AgentChat.question.types";
import {saveSession} from "./imports";

/** 提交问题答案并持久化当前会话中的卡片状态。 */
export async function postQuestionAnswer(runtime: AgentChatRuntime, request: AgentQuestionAnswerRequest) {
    try {
        const response = await fetch("/api/ai/agent/question", {
            method: "POST",
            headers: runtime.sessionPorts.requestHeaders({
                headers: {"Content-Type": "application/json"},
            }),
            body: JSON.stringify({
                sessionID: runtime.sessionId,
                questionID: request.questionID,
                answers: request.answers,
            }),
        });
        const result = readAPIResult(await response.json());
        // HTTP 或 Kernel 业务状态任一失败时保留卡片为可重试状态。
        if (!response.ok || result?.code !== 0) {
            console.error("agent question request failed:", response.status);
            return false;
        }
    } catch (error) {
        console.error("agent question request error:", error);
        return false;
    }
    // 用户已经切换会话时，请求成功即可结束，不修改新会话的本地条目。
    if (runtime.sessionId !== request.sessionID) {
        return true;
    }
    const entry = runtime.entries.find((candidate) =>
        candidate.type === "question" && candidate.id === request.questionEntryID);
    // 原问题条目仍存在时写入已提交答案，供会话恢复时还原只读卡片。
    if (entry?.type === "question") {
        entry.status = "submitted";
        entry.answers = request.answers;
    }
    try {
        await saveSession(runtime);
    } catch (error) {
        console.error("save agent question state failed:", error);
    }
    return true;
}
