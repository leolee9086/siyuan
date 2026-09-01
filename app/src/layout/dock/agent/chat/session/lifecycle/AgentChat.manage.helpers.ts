/** 用途：约束会话创建准备与重置状态；使用范围：本文件全部函数；解耦评估：通过本目录网关依赖公开运行时接口。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：保存无活跃轮次的旧会话；使用范围：创建准备；解耦评估：持久化子域经网关暴露。 */
import {saveSession} from "./imports";

/** 停止当前轮次并在可直接提交时保存旧会话。 */
export async function prepareAgentChatSessionCreation(runtime: AgentChatRuntime) {
    runtime.pendingEditDraft = null;
    const previousSessionID = runtime.sessionId;
    const hadActiveTurn = runtime.isStreaming || !!runtime.currentTurnID;
    if (hadActiveTurn) {
        runtime.pendingRecoverySessionIDs.add(previousSessionID);
    }
    if (runtime.abortController) {
        runtime.abortController.abort();
        runtime.abortController = null;
    }
    runtime.sessionPorts.turnLifecycle.setStreaming(runtime, false);
    runtime.mirrorLocked = false;
    runtime.sessionPorts.presentation.removeMirror(runtime);
    runtime.sessionPorts.turnLifecycle.finishThinking(runtime);
    runtime.sessionPorts.turnLifecycle.flushThinkingStep(runtime);
    // 只有没有活动轮次且不等待权威恢复时，当前内存状态才允许直接覆盖磁盘会话。
    if (!hadActiveTurn && !runtime.pendingRecoverySessionIDs.has(runtime.sessionId)) {
        await saveSession(runtime);
    }
}

/** 重置新会话的数据状态，并清除上一会话的流式与令牌信息。 */
const resetAgentChatSessionState = (chat: AgentChatRuntime, sessionID: string) => {
    chat.sessionId = sessionID;
    chat.promptSourceController.reset();
    chat.currentTurnID = "";
    chat.currentRoundID = "";
    chat.sessionCreatedAt = Date.now();
    chat.sessionTitle = chat.defaultTitle;
    chat.pendingSessionTitle = null;
    chat.entries = [];
    chat.hasTitled = false;
    chat.currentAIElement = null;
    chat.currentContent = "";
    chat.fullContent = "";
    chat.contextTokens = 0;
    chat.contextTokenBreakdown = {};
    chat.contextCachedTokens = 0;
    chat.contextLimit = 0;
    chat.permissionMode = "confirm";
    chat.permissionSelect.value = chat.permissionMode;
    chat.currentToolCalls = [];
    chat.lastStepToolCount = 0;
    chat.renderedToolNames = {};
    chat.hasInterveningCard = false;
    chat.currentThinkingSteps = [];
    chat.currentThinkingStepContent = "";
    chat.pendingConfirms = [];
    chat.sessionPorts.projection.resetWebReferences(chat);
};

/** 将界面切到空白新会话并恢复输入焦点。 */
export async function resetAgentChatSession(runtime: AgentChatRuntime, sessionID: string) {
    resetAgentChatSessionState(runtime, sessionID);
    await runtime.conversationController?.activate(runtime.conversationKind, sessionID, {subscribe: false});
    runtime.composer?.clearHistory();
    runtime.tokenDisplayEl?.classList.add("fn__none");
    runtime.messagesContainer.innerHTML = "";
    runtime.sessionPorts.presentation.rebuildNavigation(runtime);
    runtime.titleElement.textContent = runtime.defaultTitle;
    runtime.composer?.clear();
    runtime.composer?.focus();
    runtime.sessionPorts.presentation.updateSendButton(runtime);
    runtime.sessionPorts.presentation.showWelcome(runtime);
    runtime.sessionPorts.presentation.scrollToBottom(runtime, true);
}
