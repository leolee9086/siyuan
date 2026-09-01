/** 用途：转义思考文本；使用范围：思考卡片构建；解耦评估：通用转义工具，保留共享工具引用。 */
import {escapeHtml} from "./imports";
/** 用途：绑定思考卡片折叠交互；使用范围：活动思考卡片渲染；解耦评估：渲染边界经目录网关集中导入。 */
import {bindThinkingCardToggle} from "./imports";
/** 用途：渲染工具名称行 HTML；使用范围：思考步骤工具明细；解耦评估：渲染边界经目录网关集中导入。 */
import {renderToolsLineHTML} from "./imports";
/** 用途：约束流式思考状态读写；使用范围：本文件全部函数；解耦评估：类型导入编译后消失。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：约束思考会话条目；使用范围：思考步骤持久化；解耦评估：类型导入编译后消失。 */
import type {SessionEntry} from "./imports";
/** 用途：约束思考步骤快照；使用范围：步骤提交；解耦评估：类型导入编译后消失。 */
import type {ThinkingStep} from "./imports";
/** 用途：把流式正文归属到思考步骤；使用范围：响应脱离；解耦评估：步骤提交集中在本领域，经公开入口调用。 */
import {attachStepContent} from "./AgentChat.thinkingStep";
/** 用途：压缩工具调用用于持久化；使用范围：穿插条目结算；解耦评估：持久化投影经目录网关集中导入。 */
import {slimToolCallsForPersistence} from "./imports";
/** 用途：保持消息贴底；使用范围：思考卡片渲染收尾；解耦评估：滚动策略经目录网关集中导入。 */
import {scrollToBottom} from "./imports";
/** 用途：启动思考耗时刷新；使用范围：活动思考卡片渲染；解耦评估：生命周期命令经目录网关集中导入。 */
import {startThinkingUpdates} from "./imports";
/** 用途：在助手消息之前插入思考卡片；使用范围：活动思考卡片渲染；解耦评估：消息放置边界经目录网关集中导入。 */
import {insertBeforeAI} from "./imports";
/** 用途：观察卡片尺寸变化；使用范围：活动思考卡片渲染；解耦评估：滚动策略经目录网关集中导入。 */
import {observeStickTarget} from "./imports";

/** `commitPreviousThinkingStep` 负责流式响应流程中的对应步骤，由上层流程或事件回调调用并集中维护状态变化。 */
/** @同步豁免: 生命周期 */
export function commitPreviousThinkingStep(runtime: AgentChatRuntime) {
    if (!runtime.currentThinkingText) {
        return;
    }
    const toolCalls = runtime.currentToolCalls.slice(runtime.lastStepToolCount);
    const toolNames = toolCalls.map((toolCall) => toolCall.name);
    const toolCallIDs = toolCalls.flatMap((toolCall) => toolCall.id ? [toolCall.id] : []);
    const step: ThinkingStep = {
        reasoning: runtime.currentThinkingReasoning,
        reasoningContent: runtime.currentThinkingReasoningContent,
        ...(runtime.currentRoundID ? {roundID: runtime.currentRoundID} : {}),
        ...(toolNames.length > 0 ? {toolNames} : {}),
        ...(toolCallIDs.length > 0 ? {toolCallIDs} : {}),
    };
    runtime.currentThinkingSteps.push(step);
    runtime.lastStepToolCount = runtime.currentToolCalls.length;
}

/**
 * `renderNewThinkingTools` 负责流式响应流程中的对应步骤，由上层流程或事件回调调用。
 * @显式返回类型原因 该签名跨职责模块或运行时契约使用，需固定返回边界，避免推导随实现细节漂移。
 * @同步豁免: UI构建
 */
export function renderNewThinkingTools(runtime: AgentChatRuntime, reasoning: string): string {
    if (reasoning !== "processing" || runtime.currentToolCalls.length === 0) {
        return "";
    }
    const newTools: Array<{ name: string; running: boolean }> = [];
    for (const toolCall of runtime.currentToolCalls) {
        if (runtime.renderedToolNames[toolCall.name]) {
            continue;
        }
        runtime.renderedToolNames[toolCall.name] = true;
        const running = toolCall.result === undefined;
        if (running) {
            runtime.toolCallStartedAt.set(toolCall.name, Date.now());
        }
        newTools.push({name: toolCall.name, running});
    }
    return newTools.length > 0 ? renderToolsLineHTML(newTools) : "";
}

/** `detachCurrentAssistant` 负责流式响应流程中的对应步骤，由上层流程或事件回调调用并集中维护状态变化。 */
function detachCurrentAssistant(runtime: AgentChatRuntime) {
    if (runtime.currentContent) {
        const body = runtime.currentAIElement?.querySelector<HTMLElement>(".agent-chat__body");
        body?.classList.remove("agent-chat__body--streaming");
        attachStepContent(runtime, runtime.currentContent);
    }
    runtime.currentAIElement?.remove();
    runtime.currentAIElement = null;
    runtime.currentAssistantEntryId = "";
    runtime.currentContent = "";
}

/** `detachStreamingResponse` 负责流式响应流程中的对应步骤，由上层流程或事件回调调用并集中维护状态变化。 */
/** @同步豁免: 生命周期 */
export function detachStreamingResponse(runtime: AgentChatRuntime, reasoning: string) {
    if (reasoning !== "processing") {
        return;
    }
    if (runtime.currentAIElement) {
        detachCurrentAssistant(runtime);
        return;
    }
    if (!runtime.currentContent) {
        return;
    }
    attachStepContent(runtime, runtime.currentContent);
    runtime.currentContent = "";
    const streamingChat = runtime.messagesContainer.querySelector<HTMLElement>(
        ".agent-chat__msg--thinking:not(.agent-chat__msg--thinking-done) .agent-chat__thinking-chat--streaming"
    );
    streamingChat?.classList.remove("agent-chat__thinking-chat--streaming");
}

/** `completeActiveThinkingCards` 负责流式响应流程中的对应步骤，由上层流程或事件回调调用并集中维护状态变化。 */
function completeActiveThinkingCards(runtime: AgentChatRuntime, duration: number) {
    const L = window.siyuan.languages;
    const doneText = duration > 0 && L.agentThinkingDoneTime
        ? L.agentThinkingDoneTime.replace("%s", Math.round(duration) + "s")
        : (L.agentThinking || "Thinking");
    const cards = runtime.messagesContainer.querySelectorAll(
        ".agent-chat__msg--thinking:not(.agent-chat__msg--thinking-done)"
    );
    for (const card of cards) {
        card.classList.add("agent-chat__msg--thinking-done");
        const textElement = card.querySelector(".agent-chat__thinking-text");
        if (textElement) {
            textElement.textContent = doneText;
        }
    }
}

/** `persistThinkingSteps` 负责流式响应流程中的对应步骤，由上层流程或事件回调调用并集中维护状态变化。 */
function persistThinkingSteps(runtime: AgentChatRuntime) {
    const lastStep = runtime.currentThinkingSteps[runtime.currentThinkingSteps.length - 1];
    // 条件 runtime.currentThinkingStepContent && lastStep 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (runtime.currentThinkingStepContent && lastStep) {
        lastStep.content = runtime.currentThinkingStepContent;
        runtime.currentThinkingStepContent = "";
    }
    if (runtime.currentThinkingSteps.length === 0) {
        return;
    }
    const entry: SessionEntry = {
        type: "thinking",
        steps: runtime.currentThinkingSteps.slice(),
        ...(runtime.currentThinkingEntryId ? {id: runtime.currentThinkingEntryId} : {}),
        ...(runtime.currentThinkingDuration ? {duration: runtime.currentThinkingDuration} : {}),
    };
    runtime.entries.push(entry);
    runtime.currentThinkingSteps = [];
    runtime.currentThinkingEntryId = "";
}

/** `flushInterveningEntries` 负责流式响应流程中的对应步骤，由上层流程或事件回调调用并集中维护状态变化。 */
function flushInterveningEntries(runtime: AgentChatRuntime) {
    runtime.renderedToolNames = {};
    const roundID = runtime.currentRoundID || runtime.currentToolCalls[0]?.roundID;
    // 条件 runtime.currentToolCalls.length > 0 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (runtime.currentToolCalls.length > 0) {
        runtime.entries.push({
            id: runtime.sessionPorts.repository.newSessionId(),
            type: "assistant",
            toolCalls: slimToolCallsForPersistence(runtime.currentToolCalls),
            ...(roundID ? {roundID} : {}),
        });
        runtime.currentToolCalls = [];
        runtime.lastStepToolCount = 0;
    }
    runtime.entries.push(...runtime.pendingConfirms);
    runtime.pendingConfirms = [];
}

/** `settleInterveningThinkingCard` 负责流式响应流程中的对应步骤，由上层流程或事件回调调用并集中维护状态变化。 */
/** @同步豁免: 生命周期 */
export function settleInterveningThinkingCard(runtime: AgentChatRuntime, reasoning: string) {
    if (reasoning !== "processing" || !runtime.hasInterveningCard) {
        return;
    }
    const duration = runtime.currentThinkingDuration ||
        (runtime.requestStartTime ? (Date.now() - runtime.requestStartTime) / 1000 : 0);
    runtime.currentThinkingDuration = duration;
    completeActiveThinkingCards(runtime, duration);
    persistThinkingSteps(runtime);
    flushInterveningEntries(runtime);
    runtime.currentThinkingDuration = 0;
    runtime.requestStartTime = Date.now();
    runtime.hasInterveningCard = false;
}

/**
 * `createActiveThinkingCard` 负责流式响应流程中的对应步骤，由上层流程或事件回调调用。
 * @显式返回类型原因 该签名跨职责模块或运行时契约使用，需固定返回边界，避免推导随实现细节漂移。
 */
function createActiveThinkingCard(runtime: AgentChatRuntime, text: string, detailLines: string): HTMLElement {
    const el = document.createElement("div");
    el.className = "agent-chat__msg agent-chat__msg--thinking";
    runtime.currentThinkingEntryId ||= runtime.sessionPorts.repository.newSessionId();
    el.setAttribute("data-message-id", runtime.currentThinkingEntryId);
    el.innerHTML = '<div class="agent-chat__thinking-card"><div class="agent-chat__thinking-header">' +
        '<span class="agent-chat__thinking-arrow">' +
        '<svg class="agent-chat__thinking-arrow--expand"><use xlink:href="#iconExpand"></use></svg>' +
        '<svg class="agent-chat__thinking-arrow--contract fn__none"><use xlink:href="#iconContract"></use></svg>' +
        '</span><span class="agent-chat__thinking-text">' + escapeHtml(text) + "</span></div>" +
        '<div class="agent-chat__thinking-body agent-chat__thinking-body--preview">' + detailLines + "</div></div>";
    return el;
}

/** 从当前 runtime 状态重建思考卡片 body 内容，保证任何重建都不丢失推理文本与工具明细。 */
function renderActiveThinkingBody(runtime: AgentChatRuntime, body: HTMLElement) {
    // 推理文本是唯一需要从状态重建的活动内容，避免 innerHTML 重建把 appendReasoning 写入的节点清掉。
    if (!runtime.currentThinkingReasoningContent) {
        return;
    }
    const allReasoning = body.querySelectorAll(".agent-chat__thinking-reasoning-text");
    const reasoningElement = allReasoning.item(allReasoning.length - 1);
    if (reasoningElement) {
        reasoningElement.textContent = runtime.currentThinkingReasoningContent;
        return;
    }
    const created = document.createElement("div");
    created.className = "agent-chat__thinking-reasoning-text";
    created.textContent = runtime.currentThinkingReasoningContent;
    body.appendChild(created);
}

/** `renderActiveThinkingCard` 负责流式响应流程中的对应步骤，由上层流程或事件回调调用并集中维护状态变化。 */
/** @同步豁免: UI构建 */
export function renderActiveThinkingCard(runtime: AgentChatRuntime, text: string, detailLines: string) {
    const existingCard = runtime.messagesContainer.querySelector<HTMLElement>(
        ".agent-chat__msg--thinking:not(.agent-chat__msg--thinking-done)"
    );
    const existingBody = existingCard?.querySelector<HTMLElement>(".agent-chat__thinking-body");
    const textElement = existingCard?.querySelector(".agent-chat__thinking-text");
    if (textElement) {
        textElement.textContent = text;
    }
    // 条件 existingCard && existingBody 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (existingCard && existingBody) {
        // 使用 insertAdjacentHTML 追加而不重建 body：innerHTML 重建会清除 appendReasoning 已写入的推理文本节点。
        existingBody.insertAdjacentHTML("beforeend", detailLines);
        renderActiveThinkingBody(runtime, existingBody);
        scrollToBottom(runtime);
        startThinkingUpdates(runtime);
        return;
    }
    existingCard?.remove();
    const el = createActiveThinkingCard(runtime, text, detailLines);
    bindThinkingCardToggle(el);
    insertBeforeAI(runtime, el);
    scrollToBottom(runtime);
    observeStickTarget(runtime, el);
    startThinkingUpdates(runtime);
}
