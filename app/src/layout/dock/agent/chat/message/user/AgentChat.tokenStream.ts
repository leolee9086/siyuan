/** 用途：生成助手条目标识；使用范围：流式占位创建。 */
/** 用途：约束流式正文状态；使用范围：本文件全部函数。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：观察流式卡片尺寸；使用范围：助手占位创建。 */
import {observeStickTarget} from "./imports";
/** 用途：维持消息贴底；使用范围：每帧正文更新。 */
import {scrollToBottom} from "./imports";

/** 取得或创建思考卡片中的流式正文容器。 */
function ensureThinkingChat(thinkingBody: HTMLElement) {
    const existing = thinkingBody.querySelector<HTMLElement>(".agent-chat__thinking-chat--streaming");
    if (existing) {
        return existing;
    }
    const chat = document.createElement("div");
    chat.className = "agent-chat__thinking-chat b3-typography agent-chat__thinking-chat--streaming";
    thinkingBody.appendChild(chat);
    return chat;
}

/** 在合并帧中提交思考卡片正文，并保持卡片与消息区贴底。 */
function applyThinkingTokenFrame(runtime: AgentChatRuntime, chat: HTMLElement) {
    runtime.pendingTokenUpdate = false;
    chat.textContent = runtime.currentContent;
    const body = chat.closest<HTMLElement>(".agent-chat__thinking-body");
    // 思考正文仍挂载时同步其内部滚动位置。
    if (body) {
        body.scrollTop = body.scrollHeight;
    }
    scrollToBottom(runtime);
}

/** 合并思考卡片的流式正文更新。 */
function scheduleThinkingTokenUpdate(runtime: AgentChatRuntime, chat: HTMLElement) {
    if (runtime.pendingTokenUpdate) {
        return;
    }
    runtime.pendingTokenUpdate = true;
    runtime.rafId = requestAnimationFrame(() => applyThinkingTokenFrame(runtime, chat));
}

/** 在合并帧中提交普通助手正文，活动占位仍存在时保持消息区贴底。 */
function applyAssistantTokenFrame(runtime: AgentChatRuntime) {
    runtime.pendingTokenUpdate = false;
    const body = runtime.currentAIElement?.querySelector<HTMLElement>(".agent-chat__body");
    // 助手占位仍属于当前响应时才提交累计正文。
    if (body) {
        body.textContent = runtime.currentContent;
        scrollToBottom(runtime);
    }
}

/** 合并普通助手消息的流式正文更新。 */
function scheduleAssistantTokenUpdate(runtime: AgentChatRuntime) {
    if (runtime.pendingTokenUpdate) {
        return;
    }
    runtime.pendingTokenUpdate = true;
    runtime.rafId = requestAnimationFrame(() => applyAssistantTokenFrame(runtime));
}

/** 立即写入思考卡片的待处理正文。 */
function flushThinkingTokenUpdate(runtime: AgentChatRuntime, chat: HTMLElement | null) {
    if (!chat) {
        return false;
    }
    chat.textContent = runtime.currentContent;
    const body = chat.parentElement;
    if (body) {
        body.scrollTop = body.scrollHeight;
    }
    return true;
}

/**
 * 创建流式助手消息占位。
 * @同步豁免: 首个正文令牌处理期间必须同步建立活动元素和观察目标。
 */
export function createAIMessagePlaceholder(runtime: AgentChatRuntime) {
    runtime.currentContent = "";
    runtime.currentAssistantEntryId = runtime.sessionPorts.repository.newSessionId();
    const element = document.createElement("div");
    element.className = "agent-chat__msg agent-chat__msg--ai";
    element.setAttribute("data-message-id", runtime.currentAssistantEntryId);
    element.innerHTML = '<div class="agent-chat__body b3-typography agent-chat__body--streaming"></div>';
    runtime.messagesContainer.appendChild(element);
    scrollToBottom(runtime);
    observeStickTarget(runtime, element);
    return element;
}

/**
 * 追加正文令牌，并把 DOM 更新合并到下一渲染帧。
 * @同步豁免: SSE 事件必须立即累积完整正文，DOM 写入已经由 requestAnimationFrame 合并。
 */
export function appendToken(runtime: AgentChatRuntime, token: string) {
    runtime.currentContent += token;
    runtime.fullContent += token;
    const thinkingBody = runtime.messagesContainer.querySelector<HTMLElement>(
        ".agent-chat__msg--thinking:not(.agent-chat__msg--thinking-done) .agent-chat__thinking-body");
    if (thinkingBody) {
        scheduleThinkingTokenUpdate(runtime, ensureThinkingChat(thinkingBody));
        return;
    }
    if (!runtime.currentAIElement) {
        runtime.currentAIElement = createAIMessagePlaceholder(runtime);
    }
    scheduleAssistantTokenUpdate(runtime);
}

/**
 * 在响应完成或错误前立即提交待处理的正文帧。
 * @同步豁免: 完成流程必须在富文本渲染前同步取消待处理帧并写入最后正文。
 */
export function flushTokenUpdate(runtime: AgentChatRuntime) {
    if (!runtime.pendingTokenUpdate) {
        return;
    }
    runtime.pendingTokenUpdate = false;
    cancelAnimationFrame(runtime.rafId);
    const thinkingChat = runtime.messagesContainer.querySelector<HTMLElement>(
        ".agent-chat__msg--thinking:not(.agent-chat__msg--thinking-done) .agent-chat__thinking-chat--streaming");
    if (flushThinkingTokenUpdate(runtime, thinkingChat)) {
        return;
    }
    const body = runtime.currentAIElement?.querySelector<HTMLElement>(".agent-chat__body");
    if (body) {
        body.textContent = runtime.currentContent;
    }
}
