/** 用途：约束 AgentChat 状态；使用范围：统一会话事件投影；解耦评估：运行时协议经本目录网关隔离具体门面。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：约束统一会话事件；使用范围：协议字段读取；解耦评估：Kernel 事件结构由单一类型协议维护。 */
import type {AgentConversationSessionEvent} from "./imports";
/** 用途：约束既有流式事件；使用范围：provider 事件转换；解耦评估：复用现有判别联合可保持消息处理器兼容。 */
import type {ISSEResult} from "./imports";
/** 用途：追加晋升或注入的用户消息；使用范围：主历史投影；解耦评估：复用唯一用户消息渲染入口避免复制 DOM 规则。 */
import {appendUserMessage} from "./imports";
/** 用途：结算 steer 前的 assistant 段；使用范围：多段 assistant 投影；解耦评估：分段状态由响应领域集中维护。 */
import {finishAssistantSegment} from "./imports";
/** 用途：切换生成状态；使用范围：晋升、turn 和重连事件；解耦评估：复用既有状态命令保持控件一致。 */
import {setStreaming} from "./imports";
/** 用途：重建消息导航；使用范围：用户事件投影；解耦评估：导航索引由既有单一入口维护。 */
import {rebuildNavMarkers} from "./imports";
/** 用途：同步输入晋升产生的会话修订；使用范围：后续 checkpoint 保存；解耦评估：复用仓储修订水位避免事件层维护第二份版本。 */
import {observeAgentSessionRevision} from "./imports";
/** 用途：复用既有 provider 事件处理器；使用范围：消息、工具和完成事件；解耦评估：session stream 只做协议转换，不复制业务处理。 */
import {handleSSEEvent} from "./AgentChat.sse.methods";
/** 用途：读取数值字段；使用范围：usage/retry 投影；解耦评估：JSON 边界校验集中在独立 guard。 */
import {readSessionEventNumber} from "./AgentChat.sessionEvent.guard";
/** 用途：读取对象字段；使用范围：工具事件投影；解耦评估：JSON 边界校验集中在独立 guard。 */
import {readSessionEventRecord} from "./AgentChat.sessionEvent.guard";
/** 用途：读取字符串字段；使用范围：全部 provider 与输入事件；解耦评估：JSON 边界校验集中在独立 guard。 */
import {readSessionEventString} from "./AgentChat.sessionEvent.guard";
/** 用途：读取字符串数组字段；使用范围：question_resolved 答案；解耦评估：JSON 数组校验集中在 guard，投影层不复制逐项检查。 */
import {readSessionEventStringArray} from "./AgentChat.sessionEvent.guard";
/** 用途：读取受支持的交互终态；使用范围：resolved 事件；解耦评估：协议状态收窄集中在 guard，投影层只构造判别联合。 */
import {readSessionEventInteractionStatus} from "./AgentChat.sessionEvent.guard";
/** 用途：读取用户块引用；使用范围：input_promoted/steer_injected 用户条目；解耦评估：JSON 校验集中在 guard，投影层不做类型断言。 */
import {readSessionEventReferences} from "./AgentChat.sessionEvent.guard";
/** 用途：读取编辑器上下文；使用范围：input_promoted/steer_injected 用户条目；解耦评估：JSON 校验集中在 guard，投影层不做类型断言。 */
import {readSessionEventEditorContext} from "./AgentChat.sessionEvent.guard";
/** 用途：读取 token 分类；使用范围：usage 事件；解耦评估：数值对象校验集中在独立 guard。 */
import {readSessionEventTokenBreakdown} from "./AgentChat.sessionEvent.guard";
/** 用途：读取确认影响；使用范围：confirm 事件；解耦评估：可选字段校验集中在独立 guard。 */
import {readSessionEventToolEffects} from "./AgentChat.sessionEvent.guard";
/** 用途：读取工具进度；使用范围：tool_progress 事件；解耦评估：嵌套协议校验集中在独立 guard。 */
import {readSessionEventToolProgress} from "./AgentChat.sessionEvent.guard";

/** 投影文本、错误和 turn 生命周期事件。 */
function projectTextEvent(event: AgentConversationSessionEvent) {
    const turnID = readSessionEventString(event, "turnID") || "";
    const token = readSessionEventString(event, "token");
    if ((event.type === "content" || event.type === "reasoning") && token !== null) {
        return {type: event.type, token} satisfies ISSEResult;
    }
    const reasoning = readSessionEventString(event, "reasoning");
    const roundID = readSessionEventString(event, "roundID");
    if (event.type === "thinking" && reasoning !== null) {
        return {type: "thinking", reasoning, ...(roundID ? {roundID} : {})} satisfies ISSEResult;
    }
    if (event.type === "turn" && turnID) {
        return {type: "turn", turnID} satisfies ISSEResult;
    }
    if (event.type === "done") {
        return {type: "done", turnID} satisfies ISSEResult;
    }
    const message = readSessionEventString(event, "message");
    if ((event.type === "error" || event.type === "interrupted") && message !== null) {
        return {type: event.type, message} satisfies ISSEResult;
    }
    return null;
}

/** 投影工具、确认、问题和前端工具事件。 */
function projectToolEvent(event: AgentConversationSessionEvent) {
    const name = readSessionEventString(event, "name");
    const callID = readSessionEventString(event, "callID");
    const args = readSessionEventRecord(event, "arguments");
    const roundID = readSessionEventString(event, "roundID");
    if (event.type === "tool_call" && name !== null && callID !== null && args) {
        return {type: "tool_call", name, callID, arguments: args,
            ...(roundID ? {roundID} : {})} satisfies ISSEResult;
    }
    const result = readSessionEventString(event, "result");
    if (event.type === "tool_result" && name !== null && callID !== null && result !== null) {
        return {type: "tool_result", name, callID, result,
            ...(roundID ? {roundID} : {})} satisfies ISSEResult;
    }
    const progress = readSessionEventToolProgress(event);
    if (event.type === "tool_progress" && name !== null && callID !== null && progress) {
        return {type: "tool_progress", name, callID, progress} satisfies ISSEResult;
    }
    const confirmID = readSessionEventString(event, "confirmID");
    // 完整确认事件必须同时具备工具名、参数和确认标识，可选 effects 在同一分支内附加。
    if (event.type === "confirm" && name !== null && args && confirmID !== null) {
        const effects = readSessionEventToolEffects(event);
        return {type: "confirm", name, arguments: args, confirmID,
            ...(effects ? {effects} : {}), ...(roundID ? {roundID} : {})} satisfies ISSEResult;
    }
    const status = readSessionEventInteractionStatus(event);
    const message = readSessionEventString(event, "message") || "";
    if (event.type === "confirm_resolved" && confirmID !== null && callID !== null && status !== null) {
        return {type: "confirm_resolved", confirmID, callID, status, message} satisfies ISSEResult;
    }
    const questionID = readSessionEventString(event, "questionID");
    if (event.type === "question" && args && questionID !== null) {
        return {type: "question", questionID, arguments: args,
            ...(roundID ? {roundID} : {})} satisfies ISSEResult;
    }
    if (event.type === "question_resolved" && questionID !== null && callID !== null && status !== null) {
        return {type: "question_resolved", questionID, callID, status, message,
            answers: readSessionEventStringArray(event.answers) || []} satisfies ISSEResult;
    }
    const capabilityID = readSessionEventString(event, "capabilityID");
    const generation = readSessionEventNumber(event, "generation");
    if (event.type === "browser_capability_call" && name !== null && callID !== null && args &&
        capabilityID !== null && generation !== null) {
        return {type: "browser_capability_call", name, callID, capabilityID, generation,
            arguments: args} satisfies ISSEResult;
    }
    if (event.type === "frontend_tool_call" && name !== null && callID !== null && args) {
        return {type: "frontend_tool_call", name, callID, arguments: args} satisfies ISSEResult;
    }
    if (event.type === "frontend_tool_resolved" && callID !== null && status !== null) {
        return {type: "frontend_tool_resolved", callID, status, message} satisfies ISSEResult;
    }
    return null;
}

/** 投影用量、重试和快照事件。 */
function projectStateEvent(event: AgentConversationSessionEvent) {
    const attempt = readSessionEventNumber(event, "attempt");
    const maxRetries = readSessionEventNumber(event, "maxRetries");
    if (event.type === "retry" && attempt !== null && maxRetries !== null) {
        return {type: "retry", attempt, maxRetries} satisfies ISSEResult;
    }
    const permissionMode = readSessionEventString(event, "permissionMode");
    if (event.type === "permission" && (permissionMode === "confirm" || permissionMode === "allowSession")) {
        return {type: "permission", permissionMode} satisfies ISSEResult;
    }
    const snapshotID = readSessionEventString(event, "snapshotID");
    const roundID = readSessionEventString(event, "roundID");
    if (event.type === "snapshot" && snapshotID !== null) {
        return {type: "snapshot", snapshotID, ...(roundID ? {roundID} : {})} satisfies ISSEResult;
    }
    const tokenBreakdown = readSessionEventTokenBreakdown(event);
    const promptTokens = readSessionEventNumber(event, "promptTokens");
    const completionTokens = readSessionEventNumber(event, "completionTokens");
    const lastPromptTokens = readSessionEventNumber(event, "lastPromptTokens");
    const cachedTokens = readSessionEventNumber(event, "cachedTokens");
    const contextLimit = readSessionEventNumber(event, "contextLimit");
    if (event.type === "usage" && tokenBreakdown && promptTokens !== null && completionTokens !== null &&
        lastPromptTokens !== null && cachedTokens !== null && contextLimit !== null) {
        return {type: "usage", promptTokens, completionTokens, lastPromptTokens, tokenBreakdown,
            cachedTokens, contextLimit} satisfies ISSEResult;
    }
    return null;
}

/** 按既有协议职责依次尝试投影 provider 事件。 */
function projectProviderEvent(event: AgentConversationSessionEvent) {
    return projectTextEvent(event) || projectToolEvent(event) || projectStateEvent(event);
}

/** 读取用户事件并以稳定 EntryID 去重投影。 */
function appendConversationUserEntry(runtime: AgentChatRuntime, event: AgentConversationSessionEvent) {
    const entryID = readSessionEventString(event, "userEntryID");
    const content = readSessionEventString(event, "content");
    if (!entryID || content === null || runtime.entries.some((entry) => entry.id === entryID)) {
        return;
    }
    const blockHTML = readSessionEventString(event, "blockHTML") || undefined;
    const references = readSessionEventReferences(event);
    const editorContext = readSessionEventEditorContext(event);
    runtime.entries.push({id: entryID, type: "user", content,
        ...(blockHTML ? {blockHTML} : {}), ...(references?.length ? {references} : {}),
        ...(editorContext ? {editorContext} : {}), timestamp: event.timestamp});
    // 欢迎页没有消息节点，首条晋升消息投影前先移除其占位内容。
    if (!runtime.messagesContainer.querySelector(".agent-chat__msg")) {
        runtime.messagesContainer.innerHTML = "";
    }
    appendUserMessage(runtime, content, {entryId: entryID, timestamp: event.timestamp,
        ...(blockHTML ? {blockHTML} : {})});
    runtime.composer?.pushHistory(content);
    rebuildNavMarkers(runtime);
}

/** 将输入晋升事件携带的 canonical 修订同步到当前仓储状态。 */
function observePromotedRevision(runtime: AgentChatRuntime, event: AgentConversationSessionEvent) {
    const contentRevision = readSessionEventNumber(event, "contentRevision");
    if (contentRevision === null) {
        return;
    }
    observeAgentSessionRevision(runtime.sessionPorts.repository.revisionState, runtime.sessionId, contentRevision);
}

/** 按 eventSeq 顺序处理输入晋升、steer 分段和 provider 事件。 */
export async function handleAgentConversationSessionEvent(
    runtime: AgentChatRuntime,
    event: AgentConversationSessionEvent,
) {
    // queued 输入只有收到晋升事件后才进入主历史，并开启对应 turn 的流式界面。
    if (event.type === "input_promoted") {
        observePromotedRevision(runtime, event);
        appendConversationUserEntry(runtime, event);
        setStreaming(runtime, true);
        return;
    }
    // steer 在当前 assistant 段之后插入用户条目，后续 token 将创建新的 assistant 段。
    if (event.type === "steer_injected") {
        finishAssistantSegment(runtime);
        appendConversationUserEntry(runtime, event);
        setStreaming(runtime, true);
        return;
    }
    const projected = projectProviderEvent(event);
    if (!projected) {
        return;
    }
    // turn 事件可能早于 controller 的下一次 state 通知，先同步流式控件避免界面短暂回到空闲态。
    if (projected.type === "turn") {
        setStreaming(runtime, true);
    }
    await handleSSEEvent(runtime, projected);
}
