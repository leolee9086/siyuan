/** 用途：约束思考反馈函数读写的状态；使用范围：本文件全部导出函数。 */
import type {AgentChatRuntime} from "./imports";

/** 刷新所有未完成思考卡片的标题文本为当前耗时。 */
function renderThinkingFrame(runtime: AgentChatRuntime, seconds: number) {
    const languages = window.siyuan.languages;
    const liveText = (languages.agentThinking || "Thinking") + " " + seconds + "s";
    const cards = runtime.messagesContainer.querySelectorAll<HTMLElement>(
        ".agent-chat__msg--thinking:not(.agent-chat__msg--thinking-done) .agent-chat__thinking-text"
    );
    for (let index = 0; index < cards.length; index++) {
        cards.item(index).textContent = liveText;
    }
}

/** 在浏览器布局帧到达时继续思考标题刷新，只在显示秒数变化时写入 DOM。 */
function requestThinkingFrame(runtime: AgentChatRuntime, previousSeconds: number) {
    const seconds = Math.floor((Date.now() - runtime.requestStartTime) / 1000);
    // 展示秒数变化时才写入标题，避免每个布局帧重复修改同一段 DOM 文本。
    if (seconds !== previousSeconds) {
        renderThinkingFrame(runtime, seconds);
    }
    runtime.thinkingFrameID = requestAnimationFrame(() => requestThinkingFrame(runtime, seconds));
}

/**
 * 移除仍处于流式状态的思考卡片。
 * @同步豁免: UI构建
 */
export function clearThinking(runtime: AgentChatRuntime) {
    const items = runtime.messagesContainer.querySelectorAll(
        ".agent-chat__msg--thinking:not(.agent-chat__msg--thinking-done)"
    );
    for (let index = 0; index < items.length; index++) {
        items.item(index).remove();
    }
}

/**
 * 停止当前思考帧刷新循环。
 * @同步豁免: 生命周期
 */
export function stopThinkingUpdates(runtime: AgentChatRuntime) {
    // 已登记帧回调时立即取消，避免销毁后的 DOM 写入。
    if (runtime.thinkingFrameID) {
        cancelAnimationFrame(runtime.thinkingFrameID);
        runtime.thinkingFrameID = 0;
    }
}

/**
 * 启动由浏览器布局帧驱动的思考耗时刷新。
 * @同步豁免: UI构建
 */
export function startThinkingUpdates(runtime: AgentChatRuntime) {
    stopThinkingUpdates(runtime);
    // 请求尚未登记开始时间时不创建帧刷新循环。
    if (!runtime.requestStartTime) {
        return;
    }
    runtime.thinkingFrameID = requestAnimationFrame(() => requestThinkingFrame(runtime, -1));
}

/**
 * 完成当前思考卡片并记录本轮思考耗时。
 * @同步豁免: 生命周期
 */
export function finishActiveThinking(runtime: AgentChatRuntime) {
    stopThinkingUpdates(runtime);
    const languages = window.siyuan.languages;
    const duration = runtime.requestStartTime ? (Date.now() - runtime.requestStartTime) / 1000 : 0;
    runtime.currentThinkingDuration = duration;
    const doneText = duration > 0
        ? (languages.agentThinkingDoneTime?.replace("%s", Math.round(duration) + "s") || languages.agentThinking || "Thinking")
        : (languages.agentThinking || "Thinking");
    const items = runtime.messagesContainer.querySelectorAll<HTMLElement>(
        ".agent-chat__msg--thinking:not(.agent-chat__msg--thinking-done)"
    );
    for (let index = 0; index < items.length; index++) {
        const element = items.item(index);
        // 最后一张卡片可能仍包含流式占位，结束时只清理这一活动占位。
        if (index === items.length - 1) {
            const streamingChat = element.querySelector(".agent-chat__thinking-chat--streaming");
            streamingChat?.remove();
        }
        // 用户未手动改变展开状态时，结束后恢复默认折叠状态。
        if (!element.hasAttribute("data-user-interacted")) {
            const body = element.querySelector(".agent-chat__thinking-body");
            body?.classList.remove("agent-chat__thinking-body--preview");
        }
        element.classList.add("agent-chat__msg--thinking-done");
        const textElement = element.querySelector(".agent-chat__thinking-text");
        // 标题元素存在时写入最终耗时文本。
        if (textElement) {
            textElement.textContent = doneText;
        }
    }
}
