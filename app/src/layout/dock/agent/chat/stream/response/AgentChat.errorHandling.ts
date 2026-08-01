import type {AgentChatRuntime} from "./imports";
import {escapeHtml} from "./imports";
import {restorePendingEditDraft} from "./imports";
import {flushTokenUpdate} from "./imports";
import {recoverInterruptedTurn} from "./imports";
import {reloadFromDisk} from "./imports";
import {saveSession} from "./imports";
import {rebuildNavMarkers} from "./imports";
import {scrollToBottom} from "./imports";
import {setStreaming} from "./imports";
import {clearThinking} from "./imports";
import {finishActiveThinking} from "./imports";
import {finalizeStreamingBody} from "./imports";
import {flushThinkingStep} from "./imports";

/** 处理流式连接失败并启动中断轮次恢复。 */
export async function handleError(runtime: AgentChatRuntime, error: Error) {
    flushTokenUpdate(runtime);
    runtime.requestStartTime = 0;
    setStreaming(runtime, false);
    const sessionID = runtime.sessionId;
    const turnID = runtime.currentTurnID;
    try {
        await reloadFromDisk(runtime, true);
    } catch (reloadError) {
        console.error("reload agent session after stream failure failed:", reloadError);
    }
    if (runtime.sessionId !== sessionID) {
        return;
    }
    if (!turnID) {
        restorePendingEditDraft(runtime);
    }
    runtime.sessionPorts.presentation.appendError(runtime, error.message);
    void recoverInterruptedTurn(runtime, sessionID, turnID);
}

/** 回滚尚未建立有效响应的用户条目和 DOM。 */
export function rollbackUserEntry(runtime: AgentChatRuntime, userEntryId: string) {
    const index = runtime.entries.findIndex((entry) => entry.id === userEntryId);
    // 条目仍存在时从权威内存序列删除，避免保存失败请求。
    if (index >= 0) {
        runtime.entries.splice(index, 1);
    }
    const userElement = runtime.messagesContainer.querySelector(
        '.agent-chat__msg--user[data-message-id="' + userEntryId + '"]',
    );
    userElement?.remove();
    rebuildNavMarkers(runtime);
}

/** 追加带配置入口的错误卡片。 */
export async function appendConfigurableError(runtime: AgentChatRuntime, message: string) {
    finishActiveThinking(runtime);
    clearThinking(runtime);
    // 空助手占位没有可保留正文，错误卡片插入前先移除。
    if (runtime.currentAIElement && !runtime.currentContent) {
        runtime.currentAIElement.remove();
    }
    runtime.currentAIElement = null;
    const element = document.createElement("div");
    element.className = "agent-chat__msg agent-chat__msg--error";
    element.innerHTML = '<div class="agent-chat__body agent-chat__body--error">' +
        '<svg class="agent-chat__error-icon"><use xlink:href="#iconTriangleAlert"></use></svg>' +
        "<span>" + escapeHtml(message) + "</span></div>";
    runtime.messagesContainer.appendChild(element);
    scrollToBottom(runtime, true);
    flushThinkingStep(runtime);
}

/** 处理模型配置错误，并在需要时恢复重新生成前的会话。 */
export async function handleConfigError(
    runtime: AgentChatRuntime,
    error: Error,
    options: Readonly<{userEntryId?: string; restoreSession?: boolean}> = {},
) {
    const {userEntryId, restoreSession = false} = options;
    flushTokenUpdate(runtime);
    if (runtime.currentContent) {
        finalizeStreamingBody(runtime, runtime.currentContent, Date.now());
    }
    runtime.requestStartTime = 0;
    const configMessage = window.siyuan.languages._kernel[193] || "";
    // 只有精确匹配 Kernel 配置错误文案时才展示设置入口，其余错误走通用恢复流程。
    if (!configMessage || error.message !== configMessage) {
        await handleError(runtime, error);
        return;
    }
    if (restoreSession) {
        await reloadFromDisk(runtime, true);
    }
    // 普通发送失败时撤回尚未形成响应的用户条目，重新生成失败则由磁盘快照恢复。
    if (!restoreSession && userEntryId) {
        rollbackUserEntry(runtime, userEntryId);
    }
    // 新会话首条请求失败且没有可保存条目时删除空会话文件并恢复默认标题。
    if (!restoreSession && runtime.entries.length === 0) {
        await runtime.sessionPorts.repository.remove(runtime.sessionId);
        runtime.sessionTitle = runtime.defaultTitle;
        runtime.pendingSessionTitle = null;
        runtime.hasTitled = false;
        runtime.titleElement.textContent = runtime.defaultTitle;
        void runtime.sessionPanel?.refresh();
    }
    // 普通发送失败但仍有历史时保存回滚后的有效条目序列。
    if (!restoreSession && runtime.entries.length > 0) {
        await saveSession(runtime);
    }
    await appendConfigurableError(runtime, configMessage);
    setStreaming(runtime, false);
    if (restoreSession) {
        restorePendingEditDraft(runtime);
    }
}
