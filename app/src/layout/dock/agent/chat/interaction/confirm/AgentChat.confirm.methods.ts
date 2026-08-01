/** 用途：约束确认流程状态；使用范围：本文件所有职责函数。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：结束活动思考卡片；使用范围：确认卡片插入前。 */
import {finishActiveThinking} from "./imports";
/** 用途：提交当前思考步骤；使用范围：确认卡片插入前。 */
import {flushThinkingStep} from "./imports";
/** 用途：插入确认卡片；使用范围：确认消息创建。 */
import {insertBeforeAI} from "./imports";
/** 用途：读取确认 API 结果；使用范围：确认和工具结果请求。 */
import {readAPIResult} from "./imports";
/** 用途：读取插件执行结果；使用范围：前端工具调用。 */
import {readPluginActionOutcome} from "./imports";
/** 用途：保存确认状态；使用范围：确认请求成功后。 */
/** 用途：确认卡片插入后贴底；使用范围：确认消息创建。 */
import {scrollToBottom} from "./imports";
/** 用途：生成确认类别；使用范围：确认卡片标题。 */
import {toolCategory} from "./imports";
/** 用途：渲染确认影响列表；使用范围：确认卡片创建。 */
import {renderConfirmEffects} from "./imports";
/** 用途：保存确认状态；使用范围：确认请求成功后。 */
import {saveSession} from "./imports";
/** 用途：绑定确认按钮；使用范围：确认卡片创建。 */
import {bindConfirmCardActions} from "./AgentChat.confirm.helpers";
/** 用途：创建确认卡片；使用范围：确认消息创建。 */
import {createConfirmCard} from "./AgentChat.confirm.helpers";
/** 用途：约束 SSE 确认输入；使用范围：确认消息创建。 */
import type {AppendConfirmInput} from "./AgentChat.confirm.types";
/** 用途：约束确认提交；使用范围：后端确认请求。 */
import type {ConfirmRequest} from "./AgentChat.confirm.types";
/** 用途：约束前端工具结果；使用范围：结果回传。 */
import type {FrontendToolResultInput} from "./AgentChat.confirm.types";
/** 创建待确认条目并绑定其用户决定。 */
export async function appendConfirm(runtime: AgentChatRuntime, input: AppendConfirmInput) {
    finishActiveThinking(runtime);
    flushThinkingStep(runtime);
    const element = createConfirmCard({
        name: input.name,
        args: input.args,
        category: toolCategory(input.name),
        effectsHTML: renderConfirmEffects(input.effects),
    });
    const sessionID = runtime.sessionId;
    const confirmEntryID = runtime.sessionPorts.repository.newSessionId();
    runtime.pendingConfirms.push({id: confirmEntryID, type: "confirm", name: input.name,
        args: input.args, confirmID: input.confirmID, ...(input.effects ? {effects: input.effects} : {}),
        status: "pending"});
    element.setAttribute("data-message-id", confirmEntryID);
    bindConfirmCardActions(runtime, {el: element, confirmID: input.confirmID, sessionID, confirmEntryID},
        (request) => postConfirm(runtime, request));
    insertBeforeAI(runtime, element);
    scrollToBottom(runtime, true);
    runtime.hasInterveningCard = true;
    // 页面未聚焦或已隐藏时不打断用户当前操作，改用系统通知提示确认卡片到达。
    if (!document.hasFocus() || document.hidden) {
        runtime.capabilities.notify?.({title: window.siyuan.languages.agentNotifyConfirm, body: ""});
    }
}

/** 将确认决定提交到生成该卡片的会话。 */
export async function postConfirm(runtime: AgentChatRuntime, request: ConfirmRequest) {
    const body: Record<string, unknown> = {confirmID: request.confirmID, approved: request.approved};
    if (request.always) {
        body.always = true;
    }
    try {
        const response = await fetch("/api/ai/agent/confirm", {method: "POST",
            headers: runtime.sessionPorts.requestHeaders({
                headers: {"Content-Type": "application/json"},
            }),
            body: JSON.stringify({...body, sessionID: request.sessionID})});
        const result = readAPIResult(await response.json());
        // 确认请求失败或后端返回非零码时记录错误并按失败处理。
        if (!response.ok || result.code !== 0) {
            console.error("agent confirm request failed:", response.status);
            return false;
        }
    } catch (error) {
        console.error("agent confirm request error:", error);
        return false;
    }
    if (runtime.sessionId !== request.sessionID) {
        return true;
    }
    updateConfirmEntry(runtime, request);
    try {
        await saveSession(runtime);
    } catch (error) {
        console.error("save agent confirmation state failed:", error);
    }
    return true;
}

/** 更新当前内存中的确认条目状态。 */
function updateConfirmEntry(runtime: AgentChatRuntime, request: ConfirmRequest) {
    const entry = runtime.entries.find((candidate) =>
        candidate.type === "confirm" && candidate.id === request.confirmEntryID) ||
        runtime.pendingConfirms.find((candidate) =>
            candidate.type === "confirm" && candidate.id === request.confirmEntryID);
    // 仅当命中确认条目时更新其状态，避免误改其它类型条目。
    if (entry?.type === "confirm") {
        entry.status = request.always ? "always" : (request.approved ? "approved" : "rejected");
    }
}

/** 执行宿主提供的前端工具能力并回传结果。 */
export async function handleFrontendToolCall(runtime: AgentChatRuntime, callID: string, args: Record<string, unknown>) {
    const action = typeof args.action === "string" ? args.action : "";
    const reloadFrontend = runtime.capabilities.reloadFrontend;
    // 宿主不提供重载能力时，直接回传错误结果而不执行任何重载动作。
    if (action === "reload_app" && !reloadFrontend) {
        await postFrontendResult(runtime, {callID, result: "Frontend reload is unavailable in this host.", isError: true});
        return;
    }
    // 宿主支持重载时先回传已调度结果，再触发实际重载。
    if (action === "reload_app" && reloadFrontend) {
        await postFrontendResult(runtime, {callID, result: "Frontend reload scheduled.", isError: false});
        await reloadFrontend();
        return;
    }
    const executePluginAction = runtime.capabilities.executePluginAction;
    if (!executePluginAction) {
        await postFrontendResult(runtime, {callID, result: `Unknown frontend action: ${action}`, isError: true});
        return;
    }
    try {
        const {result, error} = readPluginActionOutcome(await executePluginAction(action, args));
        await postFrontendResult(runtime, {callID, result: error || result, isError: !!error});
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await postFrontendResult(runtime, {callID, result: `Frontend action threw: ${message}`, isError: true});
    }
}

/** 回传前端工具结果；每次异步请求失败后直接开始下一次尝试，409 表示调用已经过期。 */
export async function postFrontendResult(runtime: AgentChatRuntime, input: FrontendToolResultInput) {
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const response = await fetch("/api/ai/agent/frontendToolResult", {method: "POST",
                headers: runtime.sessionPorts.requestHeaders({
                    headers: {"Content-Type": "application/json"},
                }),
                body: JSON.stringify({sessionID: runtime.sessionId, callID: input.callID,
                    result: input.result, isError: input.isError})});
            const result = readAPIResult(await response.json());
            if (response.ok && result.code === 0) {
                return;
            }
            // 与基线一致：409 表示调用已过期，不再重试，静默返回避免误报失败。
            if (response.status === 409) {
                return;
            }
        } catch (error) {
            // 最后一次尝试失败时记录错误，前几次失败仍继续重试。
            if (attempt === 2) {
                console.error("agent frontend result request error:", error);
            }
        }
    }
}
