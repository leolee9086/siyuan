/** 用途：读取当前应用标识；使用范围：原生 Agent 请求默认头；解耦评估：平台常量经 Agent 外部依赖网关进入。 */
import {Constants} from "./imports";
/** 用途：约束完整请求输入；使用范围：请求体、请求头和中止信号；解耦评估：同一 SSE 领域的数据契约直接依赖。 */
import type {AgentSSERequest} from "./agentSSE.types";

/** 发出一次原生 Agent 请求；响应分类和流消费由后续职责处理。 */
export async function requestAgentSSEResponse(request: AgentSSERequest) {
    const body: Record<string, unknown> = {
        message: request.message,
        language: request.language,
        references: request.references,
    };
    if (request.sessionID) {
        body.sessionID = request.sessionID;
    }
    if (request.blockHTML !== undefined) {
        body.blockHTML = request.blockHTML;
    }
    if (request.model) {
        body.model = request.model;
    }
    if (request.reasoningEffort) {
        body.reasoningEffort = request.reasoningEffort;
    }
    if (request.regenerate) {
        body.regenerate = request.regenerate;
    }
    if (request.editorContext) {
        body.editorContext = request.editorContext;
    }
    // 宿主实际暴露插件动作时才发送摘要，避免用空数组覆盖 Kernel 默认能力。
    if (request.pluginActions && request.pluginActions.length > 0) {
        body.pluginActions = request.pluginActions;
    }
    if (request.frontendCapabilities) {
        body.frontendCapabilities = request.frontendCapabilities;
    }
    if (request.userEntryID) {
        body.userEntryID = request.userEntryID;
    }
    // 修订号允许为零，因此只按数值类型判断是否加入并发控制字段。
    if (typeof request.contentRevision === "number") {
        body.contentRevision = request.contentRevision;
    }
    return fetch("/api/ai/agent/chat", {
        method: "POST",
        headers: request.requestHeaders || {
            "Content-Type": "application/json",
            "X-SiYuan-App-ID": String(Constants.SIYUAN_APPID || ""),
        },
        body: JSON.stringify(body),
        signal: request.signal || null,
    });
}
