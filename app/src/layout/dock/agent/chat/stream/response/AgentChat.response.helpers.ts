/** 用途：约束权威会话快照；使用范围：响应提交后的会话协调；解耦评估：纯类型经响应子领域网关提供。 */
import type {AgentSession} from "./imports";
/** 用途：约束共享聊天状态；使用范围：本文件全部响应收尾函数；解耦评估：纯类型经响应子领域网关提供。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：约束待持久化助手条目；使用范围：响应条目提交；解耦评估：纯类型经响应子领域网关提供。 */
import type {SessionEntry} from "./imports";
/** 用途：重绘权威会话；使用范围：提交结果协调；解耦评估：经响应子领域网关调用既有投影，不复制消息渲染。 */
import {renderLoadedSession} from "./imports";
/** 用途：提交流式助手正文；使用范围：响应 DOM 收尾；解耦评估：经响应子领域网关复用消息投影的统一收尾语义。 */
import {finalizeStreamingBody} from "./imports";
/** 用途：读取当前贴底状态；使用范围：权威会话重绘；解耦评估：经响应子领域网关复用会话滚动状态计算。 */
import {isScrolledToBottom} from "./imports";
/** 用途：重载后端权威会话；使用范围：提交未返回快照时；解耦评估：经响应子领域网关依赖会话仓储流程。 */
import {reloadFromDisk} from "./imports";
/** 用途：同步会话标题和时间；使用范围：权威会话重绘；解耦评估：经响应子领域网关复用会话元数据投影。 */
import {updateMetaFromSession} from "./imports";
/** 用途：渲染完成的助手 Markdown；使用范围：思考卡正文物化；解耦评估：经响应子领域网关复用消息渲染能力。 */
import {renderAssistantMarkdown} from "./imports";
/** 用途：执行助手正文后处理；使用范围：思考卡正文物化；解耦评估：经响应子领域网关保持链接和代码块处理一致。 */
import {postRenderAssistant} from "./imports";
/** 用途：追加助手消息动作；使用范围：思考卡正文物化；解耦评估：经响应子领域网关复用消息动作视图。 */
import {addCopyButton} from "./imports";
/** 用途：滚动到已完成思考卡下方；使用范围：思考卡正文物化；解耦评估：经响应子领域网关复用统一滚动策略。 */
import {scrollToThinkingCardBelow} from "./imports";
/** 用途：滚动到消息底部；使用范围：无思考锚点的响应收尾；解耦评估：经响应子领域网关复用统一滚动策略。 */
import {scrollToBottom} from "./imports";
/** 用途：压缩工具调用持久化字段；使用范围：助手条目提交；解耦评估：经响应子领域网关保持会话格式唯一。 */
import {slimToolCallsForPersistence} from "./imports";
/** 用途：更新流式贴底观察目标；使用范围：响应状态重置；解耦评估：经响应子领域网关复用滚动观察生命周期。 */
import {observeStickTarget} from "./imports";

/** 移除思考卡中的临时流式正文，避免完成消息重复显示。 */
function removeStreamingThinkingContent(runtime: AgentChatRuntime) {
    const streamingElement = runtime.messagesContainer.querySelector(
        ".agent-chat__msg--thinking:not(.agent-chat__msg--thinking-done) " +
        ".agent-chat__thinking-chat--streaming",
    );
    streamingElement?.remove();
}

/**
 * 完成当前流式 DOM；正文位于思考卡时先物化独立助手消息。
 * DOM 必须先于轮次状态重置完成，后续持久化会直接读取这里写入的当前助手状态。
 * @同步豁免: UI构建
 */
export function finalizeResponseElement(runtime: AgentChatRuntime, snapshot: {
    content: string;
    fullContent: string;
    timestamp: number;
    thinkingCard?: HTMLElement | null;
}) {
    // 尚未创建助手气泡但已有正文时，正文仍挂在思考卡中，需要先物化独立消息。
    if (!runtime.currentAIElement && snapshot.content) {
        removeStreamingThinkingContent(runtime);
        createCompletedAssistantElement(runtime, snapshot);
        scrollAfterAssistantMaterialized(runtime, snapshot.thinkingCard || null);
        return;
    }
    // 已存在助手气泡时只需提交它的流式正文和时间，避免创建重复消息。
    if (runtime.currentAIElement) {
        finalizeStreamingBody(runtime, snapshot.content, snapshot.timestamp);
    }
}

/** 把思考卡内积累的正文转成独立助手消息。 */
function createCompletedAssistantElement(
    runtime: AgentChatRuntime,
    snapshot: Parameters<typeof finalizeResponseElement>[1],
) {
    runtime.currentAssistantEntryId = runtime.sessionPorts.repository.newSessionId();
    const el = document.createElement("div");
    el.className = "agent-chat__msg agent-chat__msg--ai";
    el.setAttribute("data-message-id", runtime.currentAssistantEntryId);
    el.innerHTML = '<div class="agent-chat__body b3-typography">' +
        renderAssistantMarkdown(runtime, snapshot.content) + "</div>";
    runtime.messagesContainer.appendChild(el);
    postRenderAssistant(runtime, el);
    runtime.currentAIElement = el;
    runtime.currentContent = snapshot.content;
    runtime.fullContent = snapshot.fullContent;
    addCopyButton(runtime, el, {
        timestamp: snapshot.timestamp,
        allowRegenerate: runtime.currentToolCalls.length === 0,
    });
    return el;
}

/** 按是否存在思考锚点选择响应完成后的滚动位置。 */
function scrollAfterAssistantMaterialized(runtime: AgentChatRuntime, thinkingCard: HTMLElement | null) {
    if (thinkingCard) {
        scrollToThinkingCardBelow(runtime, thinkingCard);
        return;
    }
    scrollToBottom(runtime, true);
}

/**
 * 把流式期间暂存的确认卡依次并入会话条目，供紧随其后的单次保存读取。
 * @同步豁免: 生命周期
 */
export function flushPendingConfirmEntries(runtime: AgentChatRuntime) {
    runtime.entries.push(...runtime.pendingConfirms);
    runtime.pendingConfirms = [];
}

/**
 * 在轮次保存前把当前助手正文或工具结果同步投影为会话条目。
 * @同步豁免: 生命周期
 */
export function appendCurrentAssistantEntry(runtime: AgentChatRuntime, timestamp: number, includeToolOnly: boolean) {
    const roundID = runtime.currentRoundID || runtime.currentToolCalls[0]?.roundID;
    if (runtime.currentContent) {
        const entry: SessionEntry = {
            type: "assistant",
            content: runtime.currentContent,
            timestamp,
            ...(roundID ? {roundID} : {}),
            ...(runtime.currentAssistantEntryId ? {id: runtime.currentAssistantEntryId} : {}),
            ...(runtime.currentToolCalls.length > 0 ? {
                toolCalls: slimToolCallsForPersistence(runtime.currentToolCalls),
            } : {}),
        };
        runtime.entries.push(entry);
        return;
    }
    // 条件 includeToolOnly && runtime.currentToolCalls.length > 0 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (includeToolOnly && runtime.currentToolCalls.length > 0) {
        runtime.entries.push({
            id: runtime.sessionPorts.repository.newSessionId(),
            type: "assistant",
            toolCalls: slimToolCallsForPersistence(runtime.currentToolCalls),
            ...(roundID ? {roundID} : {}),
        });
    }
}

/**
 * 在当前轮次条目形成后清空流式 DOM 和工具状态，保留会话级统计与标题。
 * @同步豁免: 生命周期
 */
export function resetStreamingResponseState(runtime: AgentChatRuntime) {
    runtime.currentAIElement = null;
    observeStickTarget(runtime, null);
    runtime.currentAssistantEntryId = "";
    runtime.currentContent = "";
    runtime.fullContent = "";
    runtime.currentToolCalls = [];
    runtime.currentRoundID = "";
    runtime.lastStepToolCount = 0;
    runtime.renderedToolNames = {};
    runtime.requestStartTime = 0;
}

/** 用提交返回的权威会话重绘当前视图，并保持用户滚动位置。 */
export async function reconcileCanonicalSession(runtime: AgentChatRuntime, canonicalSession: AgentSession | null,
                                                sessionID: string) {
    if (runtime.sessionId !== sessionID) {
        return;
    }
    if (!canonicalSession) {
        await reloadFromDisk(runtime, true);
        return;
    }
    const atBottom = isScrolledToBottom(runtime);
    const savedScroll = runtime.messagesContainer.scrollTop;
    runtime.entries = runtime.sessionPorts.projection.buildEntries(canonicalSession);
    updateMetaFromSession(runtime, canonicalSession);
    runtime.messagesContainer.innerHTML = "";
    renderLoadedSession(runtime, canonicalSession);
    if (atBottom) {
        scrollToBottom(runtime, true);
        return;
    }
    runtime.messagesContainer.scrollTop = savedScroll;
}

/**
 * 在一轮响应完成时按当前窗口可见性立即决定是否发送通知。
 * @同步豁免: 生命周期
 */
export function notifyFinishedResponse(runtime: AgentChatRuntime, notify: boolean, savedContent: string) {
    // 仅对有正文且窗口不活跃的已完成响应发通知，避免空响应或前台会话产生噪声。
    if (notify && savedContent && (!document.hasFocus() || document.hidden)) {
        runtime.capabilities.notify?.({title: window.siyuan.languages.agentNotifyDone});
    }
}
