/** 用途：约束确认流程状态；使用范围：本文件所有职责函数；解耦评估：运行时接口经目录网关隔离具体 AgentChat 门面。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：结束活动思考卡片；使用范围：确认卡片插入前；解耦评估：复用反馈领域唯一状态命令，避免确认模块复制思考状态。 */
import {finishActiveThinking} from "./imports";
/** 用途：提交当前思考步骤；使用范围：确认卡片插入前；解耦评估：复用流式领域唯一提交入口，保证事件顺序一致。 */
import {flushThinkingStep} from "./imports";
/** 用途：插入确认卡片；使用范围：确认消息创建；解耦评估：消息布局由统一 DOM 放置命令维护。 */
import {insertBeforeAI} from "./imports";
/** 用途：读取确认 API 结果；使用范围：确认和工具结果请求；解耦评估：所有交互端点共享同一结构化请求边界。 */
import {requestAgentInteraction} from "./imports";
/** 用途：读取插件执行结果；使用范围：前端工具调用；解耦评估：同目录纯守卫直接复用，避免将内部实现暴露到外部依赖网关。 */
import {readPluginActionOutcome} from "./AgentChat.confirm.guard";
/** 用途：读取终态标签；使用范围：确认卡片结算；解耦评估：状态到文案的映射由交互领域集中维护。 */
import {resolveInteractionStatusLabel} from "./imports";
/** 用途：确认卡片插入后贴底；使用范围：确认消息创建；解耦评估：复用滚动领域命令，确认模块不持有滚动策略。 */
import {scrollToBottom} from "./imports";
/** 用途：生成确认类别；使用范围：确认卡片标题；解耦评估：类别展示规则由反馈领域集中维护。 */
import {toolCategory} from "./imports";
/** 用途：渲染确认影响列表；使用范围：确认卡片创建；解耦评估：影响展示规则由反馈领域集中维护。 */
import {renderConfirmEffects} from "./imports";
/** 用途：保存确认状态；使用范围：确认请求成功后；解耦评估：通过会话持久化入口保存，不让交互模块接触仓储协议。 */
import {saveSession} from "./imports";
/** 用途：绑定确认按钮；使用范围：确认卡片创建；解耦评估：同目录 DOM 状态机保持为独立职责。 */
import {bindConfirmCardActions} from "./AgentChat.confirm.helpers";
/** 用途：创建确认卡片；使用范围：确认消息创建；解耦评估：同目录构建函数集中维护卡片结构。 */
import {createConfirmCard} from "./AgentChat.confirm.helpers";
/** 用途：约束 SSE 确认输入；使用范围：确认消息创建。 */
import type {AppendConfirmInput} from "./AgentChat.confirm.types";
/** 用途：约束确认提交；使用范围：后端确认请求。 */
import type {ConfirmRequest} from "./AgentChat.confirm.types";
/** 用途：约束确认终态；使用范围：事件和 API 失败结算。 */
import type {ConfirmResolution} from "./AgentChat.confirm.types";
/** 用途：约束前端工具结果；使用范围：结果回传。 */
import type {FrontendToolResultInput} from "./AgentChat.confirm.types";
/** 用途：解析并校验当前浏览器能力；使用范围：browser_capability_call 执行。 */
import {isCapabilityEnabled, lookupCapability} from "../../../frontendCapabilities";
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
    element.setAttribute("data-confirm-id", input.confirmID);
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
    const result = await requestAgentInteraction({
        path: "/api/ai/agent/confirm",
        body: {...body, sessionID: request.sessionID},
        requestHeaders: runtime.sessionPorts.requestHeaders,
    });
    // 结构化业务失败已经携带终态，只对生成该卡片的当前会话执行本地结算。
    if (result.state === "resolved" && runtime.sessionId === request.sessionID) {
        resolveConfirm(runtime, {confirmID: request.confirmID, status: result.status, message: result.message});
        runtime.capabilities.showMessage?.(result.message, 3000);
        return result;
    }
    // 传输异常没有可信服务端终态，保留原卡片并记录实际错误供按钮状态机恢复。
    if (result.state === "retryable") {
        console.error("agent confirm request error:", result.message);
    }
    return result;
}

/** 按 confirmID 原子结算内存条目和当前卡片，状态来源只接受协议字段。 @同步豁免: 需要绝对同步的DOM访问 - 必须一次性关闭全部确认按钮。 */
export function resolveConfirm(runtime: AgentChatRuntime, resolution: ConfirmResolution) {
    const entry = runtime.entries.find((candidate) =>
        candidate.type === "confirm" && candidate.confirmID === resolution.confirmID) ||
        runtime.pendingConfirms.find((candidate) =>
            candidate.type === "confirm" && candidate.confirmID === resolution.confirmID);
    // 命中当前内存条目时先写入协议终态，再异步保存同一会话快照。
    const isAlwaysConfirm = entry?.type === "confirm" && resolution.status === "always";
    if (entry?.type === "confirm") {
        entry.status = resolution.status;
        void saveSession(runtime).catch((error) => console.error("save agent confirmation state failed:", error));
    }
    if (isAlwaysConfirm) {
        runtime.permissionMode = "allowSession";
        runtime.permissionSelect.value = "allowSession";
    }
    const element = Array.from(runtime.messagesContainer.querySelectorAll<HTMLElement>("[data-confirm-id]"))
        .find((candidate) => candidate.getAttribute("data-confirm-id") === resolution.confirmID);
    if (!element) {
        return;
    }
    element.classList.add("agent-chat__msg--confirmed");
    for (const button of element.querySelectorAll<HTMLButtonElement>("button")) {
        button.disabled = true;
    }
    const actions = element.querySelector(".agent-chat__confirm-actions");
    // 当前卡片仍有操作区时，以服务端终态标签替换全部可点击动作。
    if (actions) {
        actions.innerHTML = '<span class="agent-chat__confirm-done">' +
            resolveInteractionStatusLabel("confirm", resolution.status) + "</span>";
    }
}

/** 执行宿主提供的前端工具能力并回传结果。 */
export async function handleFrontendToolCall(runtime: AgentChatRuntime, callID: string, args: Record<string, unknown>) {
    const sessionID = runtime.sessionId;
    const action = typeof args.action === "string" ? args.action : "";
    const reloadFrontend = runtime.capabilities.reloadFrontend;
    // 宿主不提供重载能力时，直接回传错误结果而不执行任何重载动作。
    if (action === "reload_app" && !reloadFrontend) {
        await postFrontendResult(runtime, {sessionID, callID, result: "Frontend reload is unavailable in this host.", isError: true});
        return;
    }
    // 宿主支持重载时先回传已调度结果，再触发实际重载。
    if (action === "reload_app" && reloadFrontend) {
        await postFrontendResult(runtime, {sessionID, callID, result: "Frontend reload scheduled.", isError: false});
        await reloadFrontend();
        return;
    }
    const executePluginAction = runtime.capabilities.executePluginAction;
    if (!executePluginAction) {
        await postFrontendResult(runtime, {sessionID, callID, result: `Unknown frontend action: ${action}`, isError: true});
        return;
    }
    try {
        const {result, error} = readPluginActionOutcome(await executePluginAction(action, args));
        await postFrontendResult(runtime, {sessionID, callID, result: error || result, isError: !!error});
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await postFrontendResult(runtime, {sessionID, callID, result: `Frontend action threw: ${message}`, isError: true});
    }
}

export async function handleBrowserCapabilityCall(
    runtime: AgentChatRuntime,
    callID: string,
    capabilityID: string,
    generation: number,
    args: Record<string, unknown>,
) {
    const sessionID = runtime.sessionId;
    const capability = lookupCapability(capabilityID, generation);
    if (!capability || !isCapabilityEnabled(capabilityID) || !runtime.app) {
        await postBrowserCapabilityResult(runtime, {
            sessionID, callID, result: `Browser capability is unavailable: ${capabilityID}`,
            structuredContent: undefined, structuredContentSet: false, isError: true,
        });
        return;
    }
    try {
        const outcome = await capability.handler(args, runtime.app);
        const result = outcome.error || outcome.result || "";
        await postBrowserCapabilityResult(runtime, {
            sessionID, callID, result, structuredContent: outcome.structuredContent,
            structuredContentSet: Object.prototype.hasOwnProperty.call(outcome, "structuredContent"),
            isError: !!outcome.error,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await postBrowserCapabilityResult(runtime, {
            sessionID, callID, result: `Browser capability threw: ${message}`,
            structuredContent: undefined, structuredContentSet: false, isError: true,
        });
    }
}

async function postBrowserCapabilityResult(runtime: AgentChatRuntime, input: {
    sessionID: string;
    callID: string;
    result: string;
    structuredContent: unknown;
    structuredContentSet: boolean;
    isError: boolean;
}) {
    for (let attempt = 0; attempt < 3; attempt++) {
        const outcome = await requestAgentInteraction({
            path: "/api/ai/agent/browserCapabilityResult",
            body: {
                sessionID: input.sessionID,
                callID: input.callID,
                result: input.result,
                structuredContent: input.structuredContent,
                structuredContentSet: input.structuredContentSet,
                isError: input.isError,
            },
            requestHeaders: runtime.sessionPorts.requestHeaders,
        });
        if (outcome.state !== "retryable") {
            return;
        }
        if (attempt === 2) {
            console.error("agent browser capability result request error:", outcome.message);
        }
    }
}

/** 回传前端工具结果；每次异步请求失败后直接开始下一次尝试，409 表示调用已经过期。 */
export async function postFrontendResult(runtime: AgentChatRuntime, input: FrontendToolResultInput) {
    for (let attempt = 0; attempt < 3; attempt++) {
        const outcome = await requestAgentInteraction({
            path: "/api/ai/agent/frontendToolResult",
            body: {sessionID: input.sessionID, callID: input.callID, result: input.result, isError: input.isError},
            requestHeaders: runtime.sessionPorts.requestHeaders,
        });
        if (outcome.state !== "retryable") {
            return;
        }
        // 连续三次传输失败后记录最终错误，避免每次瞬时失败产生重复日志。
        if (attempt === 2) {
            console.error("agent frontend result request error:", outcome.message);
        }
    }
}
