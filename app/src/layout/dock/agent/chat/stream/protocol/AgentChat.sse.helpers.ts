/** 用途：约束 SSE 事件载荷；使用范围：SSE 分派与类型窄化；解耦评估：经目录网关复用唯一判别联合。 */
import type {ISSEResult} from "./imports";
/** 用途：约束流式会话状态；使用范围：全部 SSE 事件处理器；解耦评估：运行时协议经目录网关隔离具体 AgentChat 门面。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：追加问题卡片；使用范围：问题事件分派。解耦评估：命令函数保持导入即可，事件内容由参数传递，无额外硬耦合。 */
import {appendQuestion} from "./imports";
/** 用途：结算问题卡片；使用范围：question_resolved 事件；解耦评估：复用问题领域唯一终态命令，事件层不直接改 DOM。 */
import {resolveQuestion} from "./imports";
/** 用途：恢复权威会话；使用范围：事件处理器异常恢复。解耦评估：需访问会话仓储，保持模块导入，边界清晰。 */
import {reloadFromDisk} from "./imports";
/** 用途：恢复中断轮次；使用范围：事件处理器异常恢复。解耦评估：需访问会话仓储，保持模块导入，边界清晰。 */
import {recoverInterruptedTurn} from "./imports";
/** 用途：追加令牌用量；使用范围：用量事件分派。解耦评估：命令函数保持导入即可，事件内容由参数传递，无额外硬耦合。 */
import {appendUsage} from "./imports";
/** 用途：追加确认卡片；使用范围：确认事件分派。解耦评估：命令函数保持导入即可，事件内容由参数传递，无额外硬耦合。 */
import {appendConfirm} from "./imports";
/** 用途：结算确认卡片；使用范围：confirm_resolved 事件；解耦评估：复用确认领域唯一终态命令，事件层不直接改 DOM。 */
import {resolveConfirm} from "./imports";
/** 用途：追加运行中工具徽标；使用范围：工具开始事件。解耦评估：命令函数保持导入即可，事件内容由参数传递，无额外硬耦合。 */
import {appendRunningToolBadge} from "./imports";
/** 用途：查找当前工具调用；使用范围：工具结果事件。解耦评估：需查询工具状态，保持模块导入，边界清晰。 */
import {findCurrentToolCall} from "./imports";
/** 用途：完成工具状态；使用范围：工具结果事件。解耦评估：命令函数保持导入即可，事件内容由参数传递，无额外硬耦合。 */
import {finishToolCall} from "./imports";
/** 用途：标记工具运行中；使用范围：确认事件分派。解耦评估：命令函数保持导入即可，事件内容由参数传递，无额外硬耦合。 */
import {setToolCallRunning} from "./imports";
/** 用途：投影工具卡片事件；使用范围：工具开始、进度和结果事件。解耦评估：命令函数保持导入即可，事件内容由参数传递，无额外硬耦合。 */
import {applyToolCardEvent} from "./imports";
/** 用途：追加快照信息；使用范围：快照事件处理。解耦评估：命令函数保持导入即可，事件内容由参数传递，无额外硬耦合。 */
import {appendSnapshotInfo} from "./imports";
/** 用途：提交待处理令牌；使用范围：事件边界。解耦评估：命令函数保持导入即可，无额外硬耦合。 */
import {flushTokenUpdate} from "./imports";
/** 用途：追加流式令牌；使用范围：内容事件分派。解耦评估：命令函数保持导入即可，事件内容由参数传递，无额外硬耦合。 */
import {appendToken} from "./imports";
/** 用途：处理错误事件；使用范围：错误与中断事件。解耦评估：命令函数保持导入即可，事件内容由参数传递，无额外硬耦合。 */
import {handleError} from "./imports";
/** 用途：完成响应；使用范围：结束事件。解耦评估：命令函数保持导入即可，事件内容由参数传递，无额外硬耦合。 */
import {finishResponse} from "./imports";
/** 用途：追加错误卡片；使用范围：错误事件。解耦评估：命令函数保持导入即可，事件内容由参数传递，无额外硬耦合。 */
import {appendError} from "./imports";
/** 用途：追加思考正文；使用范围：思考事件分派。解耦评估：命令函数保持导入即可，事件内容由参数传递，无额外硬耦合。 */
import {appendThinking} from "./imports";
/** 用途：追加推理正文；使用范围：推理事件分派。解耦评估：命令函数保持导入即可，事件内容由参数传递，无额外硬耦合。 */
import {appendReasoning} from "./imports";
/** 用途：追加重试状态；使用范围：重试事件分派。解耦评估：命令函数保持导入即可，事件内容由参数传递，无额外硬耦合。 */
import {appendRetry} from "./imports";
/** 用途：执行前端工具；使用范围：前端工具事件。解耦评估：需访问浏览器能力，保持模块导入，边界清晰。 */
import {handleFrontendToolCall} from "./imports";
/** 用途：执行已声明的浏览器能力；使用范围：browser_capability_call 事件。 */
import {handleBrowserCapabilityCall} from "./imports";
/** 用途：切换流式状态；使用范围：事件处理器异常恢复。解耦评估：命令函数保持导入即可，无额外硬耦合。 */
import {setStreaming} from "./imports";

/** `handleToolCall` 负责流式响应流程中的对应步骤，由上层流程或事件回调调用并集中维护状态变化。 */
function handleToolCall(runtime: AgentChatRuntime, event: Extract<ISSEResult, {type: "tool_call"}>) {
    if (event.roundID) {
        runtime.currentRoundID = event.roundID;
    }
    runtime.currentToolCalls.push({
        id: event.callID,
        name: event.name,
        ...(event.roundID ? {roundID: event.roundID} : {}),
        arguments: event.arguments,
        state: "executing",
    });
    appendRunningToolBadge(runtime, event.name);
    applyToolCardEvent(runtime, event);
}

/** `handleToolResult` 负责流式响应流程中的对应步骤，由上层流程或事件回调调用并集中维护状态变化。 */
function handleToolResult(runtime: AgentChatRuntime, event: Extract<ISSEResult, {type: "tool_result"}>) {
    const toolCall = findCurrentToolCall(runtime, event.callID, event.name);
    if (toolCall) {
        toolCall.result = event.result;
        toolCall.state = "completed";
        if (event.roundID) {
            toolCall.roundID = event.roundID;
        }
    }
    finishToolCall(runtime, event.name);
    applyToolCardEvent(runtime, event);
}

/** `handleErrorEvent` 负责流式响应流程中的对应步骤，由上层流程或事件回调调用并集中维护状态变化。 */
async function handleErrorEvent(runtime: AgentChatRuntime, message: string) {
    flushTokenUpdate(runtime);
    runtime.requestStartTime = 0;
    if (!runtime.currentTurnID) {
        await handleError(runtime, new Error(message));
        return;
    }
    await finishResponse(runtime, false);
    appendError(runtime, message);
}

/** `handleSnapshot` 负责流式响应流程中的对应步骤，由上层流程或事件回调调用并集中维护状态变化。 */
function handleSnapshot(runtime: AgentChatRuntime, snapshotID: string, roundID?: string) {
    const snapshotEntryId = runtime.sessionPorts.repository.newSessionId();
    runtime.entries.push({id: snapshotEntryId, type: "snapshot", snapshotID,
        ...(roundID ? {roundID} : {})});
    appendSnapshotInfo(runtime, snapshotID, snapshotEntryId);
}

/** 分派只更新当前文本流状态的事件，并报告事件是否已经消费。 */
function dispatchTextSSEEvent(runtime: AgentChatRuntime, event: ISSEResult) {
    // 条件 event.type === "turn" 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (event.type === "turn") {
        runtime.currentTurnID = event.turnID;
        return true;
    }
    // 条件 event.type === "content" 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (event.type === "content") {
        appendToken(runtime, event.token);
        return true;
    }
    // 条件 event.type === "thinking" 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (event.type === "thinking") {
        appendThinking(runtime, event.reasoning, event.roundID || "");
        return true;
    }
    // 条件 event.type === "reasoning" 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (event.type === "reasoning") {
        appendReasoning(runtime, event.token);
        return true;
    }
    return false;
}

/** 分派工具调用生命周期事件，并报告事件是否已经消费。 */
function dispatchToolSSEEvent(runtime: AgentChatRuntime, event: ISSEResult) {
    // 条件 event.type === "tool_call" 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (event.type === "tool_call") {
        handleToolCall(runtime, event);
        return true;
    }
    // 条件 event.type === "tool_progress" 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (event.type === "tool_progress") {
        applyToolCardEvent(runtime, event);
        return true;
    }
    // 条件 event.type === "confirm" 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (event.type === "confirm") {
        setToolCallRunning(runtime, event.name, false);
        void appendConfirm(runtime, {
            name: event.name,
            args: event.arguments,
            confirmID: event.confirmID,
            ...(event.effects ? {effects: event.effects} : {}),
        });
        return true;
    }
    // confirm_resolved 只按协议终态关闭对应确认卡，不从后续工具文本反推决定。
    if (event.type === "confirm_resolved") {
        resolveConfirm(runtime, {
            confirmID: event.confirmID,
            status: event.status,
            ...(event.message ? {message: event.message} : {}),
        });
        return true;
    }
    // 条件 event.type === "tool_result" 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (event.type === "tool_result") {
        handleToolResult(runtime, event);
        return true;
    }
    // 条件 event.type === "question" 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (event.type === "question") {
        appendQuestion(runtime, event.questionID, event.arguments, event.roundID);
        return true;
    }
    // question_resolved 同时投影服务端状态与答案，确保持久化卡片可准确重建。
    if (event.type === "question_resolved") {
        resolveQuestion(runtime, {
            questionID: event.questionID,
            status: event.status,
            answers: event.answers,
            ...(event.message ? {message: event.message} : {}),
        });
        return true;
    }
    // 前端工具没有独立交互卡；tool_result 负责可见结算，此事件只阻止未知事件降级。
    if (event.type === "frontend_tool_resolved") {
        return true;
    }
    return false;
}

/** 分派不需要等待的会话状态事件，并报告事件是否已经消费。 */
function dispatchStateSSEEvent(runtime: AgentChatRuntime, event: ISSEResult) {
    // 条件 event.type === "usage" 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (event.type === "usage") {
        appendUsage(runtime, event);
        return true;
    }
    // 条件 event.type === "retry" 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (event.type === "retry") {
        appendRetry(runtime, event.attempt, event.maxRetries);
        return true;
    }
    if (event.type === "permission") {
        runtime.permissionMode = event.permissionMode;
        runtime.permissionSelect.value = event.permissionMode;
        return true;
    }
    // 条件 event.type === "snapshot" 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (event.type === "snapshot") {
        handleSnapshot(runtime, event.snapshotID, event.roundID);
        return true;
    }
    return false;
}

/** 将单个 SSE 事件路由到同步更新、响应收尾或异常处理路径。 */
export async function dispatchSSEEvent(runtime: AgentChatRuntime, event: ISSEResult) {
    if (dispatchTextSSEEvent(runtime, event) || dispatchToolSSEEvent(runtime, event) ||
        dispatchStateSSEEvent(runtime, event)) {
        return;
    }
    // 条件 event.type === "done" 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (event.type === "done") {
        runtime.currentTurnID = event.turnID || runtime.currentTurnID;
        flushTokenUpdate(runtime);
        await finishResponse(runtime);
        return;
    }
    // 条件 event.type === "error" 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (event.type === "error") {
        await handleErrorEvent(runtime, event.message);
        return;
    }
    // 条件 event.type === "interrupted" 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (event.type === "interrupted") {
        await handleError(runtime, new Error(event.message));
        return;
    }
    // 浏览器能力必须立即执行并回传，内核会在该结果到达前暂停当前工具调用。
    if (event.type === "browser_capability_call") {
        await handleBrowserCapabilityCall(runtime, event.callID, event.capabilityID, event.generation, event.arguments);
        return;
    }
    // 前述分派器已消费其他同步事件，剩余的前端工具事件交给浏览器能力处理。
    if (event.type === "frontend_tool_call") {
        void handleFrontendToolCall(runtime, event.callID, event.arguments);
    }
}

/** `recoverSSEHandlerFailure` 负责流式响应流程中的对应步骤，由上层流程或事件回调调用并集中维护状态变化。 */
export async function recoverSSEHandlerFailure(runtime: AgentChatRuntime, error: unknown, event: ISSEResult) {
    console.error("agent SSE event handler error:", error, event);
    runtime.abortController?.abort();
    runtime.abortController = null;
    flushTokenUpdate(runtime);
    runtime.requestStartTime = 0;
    setStreaming(runtime, false);
    const sessionID = runtime.sessionId;
    const turnID = runtime.currentTurnID;
    try {
        await reloadFromDisk(runtime, true);
    } catch (reloadError) {
        console.error("reload agent session after event failure failed:", reloadError);
    }
    // 条件 runtime.sessionId === sessionID 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (runtime.sessionId === sessionID) {
        appendError(runtime, error instanceof Error ? error.message : String(error));
    }
    // 条件 runtime.sessionId === sessionID && turnID 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (runtime.sessionId === sessionID && turnID) {
        void recoverInterruptedTurn(runtime, sessionID, turnID);
    }
}
