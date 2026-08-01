/** 用途：创建携带 HTTP 状态的错误；使用范围：非成功响应和 JSON 错误包络；解耦评估：同一 SSE 领域直接依赖错误工厂。 */
import {createAgentHTTPError} from "./agentSSE.error.factory";
/** 用途：创建普通流错误；使用范围：响应体缺失；解耦评估：同一 SSE 领域直接依赖错误工厂。 */
import {createAgentSSEError} from "./agentSSE.error.factory";
/** 用途：读取 Kernel 错误包络；使用范围：409 和非 SSE 响应；解耦评估：同一 SSE 领域直接依赖外部数据守卫。 */
import {readAgentResponseErrorMessage} from "./agentSSE.error.guard";

/** 读取 409 响应的后端消息，解析失败时保留本地繁忙提示。 */
async function readAgentConflictMessage(response: Response) {
    let message = window.siyuan.languages._kernel[28];
    try {
        message = readAgentResponseErrorMessage(await response.json()) || message;
    } catch {
        // 响应不是有效 JSON 时继续使用本地语言文本。
    }
    return window.siyuan.languages.agentChatBusy || message;
}

/** 把非成功 HTTP 响应结算为一次具名请求错误。 */
async function reportAgentHTTPFailure(response: Response, reportError: (error: Error) => Promise<void>) {
    const message = response.status === 409
        ? await readAgentConflictMessage(response)
        : window.siyuan.languages._kernel[28];
    await reportError(createAgentHTTPError(message, response.status));
}

/** 把 HTTP 200 JSON 错误包络结算为请求错误，避免聊天界面停在流式状态。 */
async function reportAgentJSONFailure(response: Response, reportError: (error: Error) => Promise<void>) {
    try {
        const text = await response.text();
        const data: unknown = text ? JSON.parse(text) : null;
        const message = readAgentResponseErrorMessage(data) || window.siyuan.languages._kernel[28];
        await reportError(createAgentHTTPError(message, response.status));
    } catch (error) {
        await reportError(createAgentSSEError(window.siyuan.languages._kernel[28], error));
    }
}

/** 校验 Agent 响应的 HTTP、Content-Type 与流主体，并返回唯一 reader。 */
export async function resolveAgentSSEReader(response: Response, reportError: (error: Error) => Promise<void>) {
    if (!response.ok) {
        await reportAgentHTTPFailure(response, reportError);
        return null;
    }
    const contentType = response.headers.get("Content-Type") || "";
    // Kernel 前置校验失败时会返回 HTTP 200 JSON 包络，不能把它当作空 SSE 流。
    if (!contentType.includes("text/event-stream")) {
        await reportAgentJSONFailure(response, reportError);
        return null;
    }
    const reader = response.body?.getReader() || null;
    if (!reader) {
        await reportError(createAgentSSEError(window.siyuan.languages._kernel[28]));
        return null;
    }
    return reader;
}
