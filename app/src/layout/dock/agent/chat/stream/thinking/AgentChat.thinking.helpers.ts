import {escapeHtml} from "./imports";
import {bindThinkingCardToggle} from "./imports";
import {renderToolsLineHTML} from "./imports";
import type {AgentChatRuntime} from "./imports";
import type {SessionEntry} from "./imports";
import type {ThinkingStep} from "./imports";
import {attachStepContent} from "./AgentChat.thinkingStep";
import {slimToolCallsForPersistence} from "./imports";
import {scrollToBottom} from "./imports";
import {startThinkingUpdates} from "./imports";
import {insertBeforeAI} from "./imports";
import {observeStickTarget} from "./imports";

/** `commitPreviousThinkingStep` 负责流式响应流程中的对应步骤，由上层流程或事件回调调用并集中维护状态变化。 */
export function commitPreviousThinkingStep(runtime: AgentChatRuntime) {
    if (!runtime.currentThinkingText) {
        return;
    }
    const toolNames = runtime.currentToolCalls.slice(runtime.lastStepToolCount).map((toolCall) => toolCall.name);
    const step: ThinkingStep = {
        reasoning: runtime.currentThinkingReasoning,
        reasoningContent: runtime.currentThinkingReasoningContent,
        ...(toolNames.length > 0 ? {toolNames} : {}),
    };
    runtime.currentThinkingSteps.push(step);
    runtime.lastStepToolCount = runtime.currentToolCalls.length;
}

/**
 * `renderNewThinkingTools` 负责流式响应流程中的对应步骤，由上层流程或事件回调调用。
 * @显式返回类型原因 该签名跨职责模块或运行时契约使用，需固定返回边界，避免推导随实现细节漂移。
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
    // 条件 runtime.currentToolCalls.length > 0 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (runtime.currentToolCalls.length > 0) {
        runtime.entries.push({
            id: runtime.sessionPorts.repository.newSessionId(),
            type: "assistant",
            toolCalls: slimToolCallsForPersistence(runtime.currentToolCalls),
        });
        runtime.currentToolCalls = [];
        runtime.lastStepToolCount = 0;
    }
    runtime.entries.push(...runtime.pendingConfirms);
    runtime.pendingConfirms = [];
}

/** `settleInterveningThinkingCard` 负责流式响应流程中的对应步骤，由上层流程或事件回调调用并集中维护状态变化。 */
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

/** `renderActiveThinkingCard` 负责流式响应流程中的对应步骤，由上层流程或事件回调调用并集中维护状态变化。 */
export function renderActiveThinkingCard(runtime: AgentChatRuntime, text: string, detailLines: string) {
    const existingCard = runtime.messagesContainer.querySelector<HTMLElement>(
        ".agent-chat__msg--thinking:not(.agent-chat__msg--thinking-done)"
    );
    const existingBody = existingCard?.querySelector(".agent-chat__thinking-body");
    const textElement = existingCard?.querySelector(".agent-chat__thinking-text");
    if (textElement) {
        textElement.textContent = text;
    }
    // 条件 existingCard && existingBody 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (existingCard && existingBody) {
        // 与基线一致：通过 innerHTML 追加重建细节子树，基线行为即在此重建过程。
        existingBody.innerHTML += detailLines;
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
