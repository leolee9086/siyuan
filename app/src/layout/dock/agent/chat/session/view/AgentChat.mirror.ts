/** 用途：约束镜像占位可写状态；使用范围：本文件显示与移除流程；解耦评估：通过本目录网关依赖公开运行时接口。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：转义镜像提示文案；使用范围：占位 HTML 构建；解耦评估：纯函数经网关复用。 */
import {escapeHtml} from "./imports";

/** 显示其他实例正在响应的占位条。 */
export function showMirrorPlaceholder(runtime: AgentChatRuntime) {
    if (runtime.mirrorPlaceholderEl) {
        return;
    }
    removeMirrorPlaceholder(runtime);
    const languages = window.siyuan.languages;
    const element = document.createElement("div");
    element.className = "agent-chat__msg agent-chat__msg--mirror";
    element.innerHTML = '<div class="agent-chat__body agent-chat__body--mirror">' +
        '<span class="agent-chat__mirror-spinner"></span>' +
        "<span>" + escapeHtml(languages.agentMirrorStreaming || "Another instance is chatting...") + "</span>" +
        "</div>";
    runtime.messagesContainer.appendChild(element);
    runtime.mirrorPlaceholderEl = element;
    runtime.sessionPorts.presentation.scrollToBottom(runtime);
}

/** 移除跨实例响应占位条。 */
export function removeMirrorPlaceholder(runtime: AgentChatRuntime) {
    if (runtime.mirrorPlaceholderEl) {
        runtime.mirrorPlaceholderEl.remove();
        runtime.mirrorPlaceholderEl = null;
    }
}
