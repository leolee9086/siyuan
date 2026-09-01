/** 用途：约束流式思考状态；使用范围：本文件全部函数；解耦评估：类型导入在编译后消失，不增加运行时依赖。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：结束上一思考步骤；使用范围：appendThinking 开新阶段前；解耦评估：步骤函数以运行时契约为边界，无需注入。 */
import {commitPreviousThinkingStep} from "./AgentChat.thinking.helpers";
/** 用途：脱离旧流式响应占位；使用范围：appendThinking 开新阶段前；解耦评估：步骤函数以运行时契约为边界，无需注入。 */
import {detachStreamingResponse} from "./AgentChat.thinking.helpers";
/** 用途：重绘当前思考卡片；使用范围：appendThinking 收尾；解耦评估：步骤函数以运行时契约为边界，无需注入。 */
import {renderActiveThinkingCard} from "./AgentChat.thinking.helpers";
/** 用途：渲染新工具徽标；使用范围：appendThinking 开新阶段；解耦评估：步骤函数以运行时契约为边界，无需注入。 */
import {renderNewThinkingTools} from "./AgentChat.thinking.helpers";
/** 用途：结算穿插的思考卡片；使用范围：appendThinking 开新阶段；解耦评估：步骤函数以运行时契约为边界，无需注入。 */
import {settleInterveningThinkingCard} from "./AgentChat.thinking.helpers";

/** 开始新的思考阶段并重绘当前思考卡片。 @同步豁免: UI构建 */
export function appendThinking(runtime: AgentChatRuntime, reasoning: string, roundID: string) {
    commitPreviousThinkingStep(runtime);
    runtime.currentThinkingText = "";
    runtime.currentThinkingReasoning = reasoning;
    runtime.currentThinkingReasoningContent = "";
    const text = window.siyuan.languages.agentThinking || "Thinking";
    runtime.currentThinkingText = text;
    const detailLines = renderNewThinkingTools(runtime, reasoning);
    detachStreamingResponse(runtime, reasoning);
    settleInterveningThinkingCard(runtime, reasoning);
    runtime.currentRoundID = roundID;
    renderActiveThinkingCard(runtime, text, detailLines);
}

/** 把累积的推理文本写入最后一个推理元素并保持贴底。 */
function flushReasoningUpdate(runtime: AgentChatRuntime, thinking: Element) {
    runtime.pendingReasoningUpdate = false;
    // 从 runtime 状态全量重建推理正文，保证与状态一致且不丢失任何已累积内容。
    const body = thinking.querySelector<HTMLElement>(".agent-chat__thinking-body");
    if (!body) {
        return;
    }
    const allReasoning = body.querySelectorAll(".agent-chat__thinking-reasoning-text");
    const reasoningElement = allReasoning.item(allReasoning.length - 1);
    if (reasoningElement) {
        reasoningElement.textContent = runtime.currentThinkingReasoningContent;
        body.scrollTop = body.scrollHeight;
        return;
    }
    // 推理元素不存在（例如 body 被重建过）时从状态补建，避免内容只存在于状态而界面空白。
    if (!runtime.currentThinkingReasoningContent) {
        return;
    }
    const created = document.createElement("div");
    created.className = "agent-chat__thinking-reasoning-text";
    created.textContent = runtime.currentThinkingReasoningContent;
    body.appendChild(created);
    body.scrollTop = body.scrollHeight;
}

/** 把推理令牌合并到下一渲染帧。 @同步豁免: 性能考虑 - SSE 事件必须立即累积推理内容，DOM 写入已经由 requestAnimationFrame 合并。 */
export function appendReasoning(runtime: AgentChatRuntime, token: string) {
    runtime.currentThinkingReasoningContent += token;
    // 活动思考卡片不存在（尚未收到 thinking 事件或已结束）时不渲染，但状态仍完整累积。
    const thinkingElements = runtime.messagesContainer.querySelectorAll(
        ".agent-chat__msg--thinking:not(.agent-chat__msg--thinking-done) .agent-chat__thinking-body");
    const thinking = thinkingElements.item(thinkingElements.length - 1);
    if (!thinking) {
        return;
    }
    if (runtime.pendingReasoningUpdate) {
        return;
    }
    runtime.pendingReasoningUpdate = true;
    requestAnimationFrame(() => flushReasoningUpdate(runtime, thinking));
}
