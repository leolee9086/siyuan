/** 用途：约束会话切换所需的运行时契约；使用范围：本文件全部切换与恢复函数。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：约束持久化会话结构；使用范围：切换目标会话的元数据与条目应用。 */
import type {AgentSession} from "./imports";
/** 用途：保存可直接提交的当前会话；使用范围：无活跃轮次时的切换前落盘；解耦评估：保存属于会话职责，集中调用避免重复实现。 */
import {saveSession} from "./imports";
/** 用途：后台恢复被中断轮次；使用范围：切换后目标会话的恢复轮询；解耦评估：恢复协议独立成模块，本文件只触发其公开入口。 */
import {recoverInterruptedTurn} from "./imports";

/** 中止旧轮次并保存可直接提交的当前会话。 */
async function prepareAgentChatSessionSwitch(runtime: AgentChatRuntime) {
    runtime.pendingEditDraft = null;
    const previousSessionID = runtime.sessionId;
    // 与基线一致：流式中或存在未提交轮次都视为活跃轮次，切换时标记后台恢复并中断当前请求。
    const hadActiveTurn = runtime.isStreaming || !!runtime.currentTurnID;
    if (hadActiveTurn) {
        // 活跃轮次不立即保存，交由后台恢复流程以磁盘权威状态提交。
        runtime.pendingRecoverySessionIDs.add(previousSessionID);
        runtime.abortController?.abort();
        runtime.abortController = null;
    }
    runtime.sessionPorts.turnLifecycle.setStreaming(runtime, false);
    runtime.mirrorLocked = false;
    runtime.sessionPorts.presentation.removeMirror(runtime);
    runtime.sessionPorts.projection.resetWebReferences(runtime);
    runtime.sessionPorts.turnLifecycle.finishThinking(runtime);
    runtime.sessionPorts.turnLifecycle.flushThinkingStep(runtime);
    // 无活跃轮次且本会话未被标记恢复时才直接保存，避免覆盖后台恢复中的状态。
    if (!hadActiveTurn && !runtime.pendingRecoverySessionIDs.has(runtime.sessionId)) {
        await saveSession(runtime);
    }
}

/** 将持久化会话元数据和编辑器历史应用到当前状态。 */
function applyAgentChatSession(runtime: AgentChatRuntime, session: AgentSession) {
    runtime.sessionId = session.id;
    runtime.conversationKind = session.targetKind ?? "native-agent";
    runtime.promptSourceController.reset();
    runtime.sessionPorts.presentation.applyConversationCapabilities(runtime);
    runtime.currentTurnID = "";
    runtime.currentRoundID = "";
    if (session.recoveryTurnID) {
        runtime.recoveryCommitTurnIDs.set(session.id, session.recoveryTurnID);
    }
    if (!session.recoveryTurnID) {
        runtime.recoveryCommitTurnIDs.delete(session.id);
    }
    runtime.composer?.clearHistory();
    runtime.composer?.restoreHistory(session.messageHistory || []);
    runtime.sessionCreatedAt = session.createdAt || Date.now();
    runtime.sessionTitle = session.title;
    runtime.pendingSessionTitle = null;
    runtime.titleElement.textContent = session.title || runtime.defaultTitle;
    runtime.entries = runtime.sessionPorts.projection.buildEntries(session);
    runtime.hasTitled = session.titled !== false;
    runtime.currentAIElement = null;
    runtime.currentContent = "";
    runtime.fullContent = "";
    runtime.contextTokens = session.contextTokens ?? 0;
    runtime.contextTokenBreakdown = session.contextTokenBreakdown ?? {};
    runtime.contextCachedTokens = session.contextCachedTokens ?? 0;
    runtime.contextLimit = session.contextLimit ?? 0;
    runtime.permissionMode = session.permissionMode ?? "confirm";
    runtime.permissionSelect.value = runtime.permissionMode;
    if (session.model) {
        runtime.sessionPorts.presentation.applySessionModel(runtime, session.model);
    }
    if (runtime.tokenDisplayEl) {
        runtime.sessionPorts.presentation.updateTokenDisplay(runtime);
    }
}

/** 在切换动画结束后重绘会话并恢复滚动位置。 */
function renderSwitchedAgentChatSession(runtime: AgentChatRuntime, session: AgentSession) {
    runtime.messagesContainer.innerHTML = "";
    runtime.titleElement.textContent = session.title;
    runtime.sessionPorts.projection.render(runtime, session);
    runtime.sessionPorts.presentation.rebuildNavigation(runtime);
    // 该会话有滚动记录时恢复上次位置，保持阅读位置连续性。
    if (runtime.scrollBottomBySession.has(session.id)) {
        runtime.sessionPorts.presentation.restoreScrollBottom(
            runtime,
            runtime.scrollBottomBySession.get(session.id) ?? 0,
        );
    }
    // 新会话无滚动记录时默认贴底显示。
    if (!runtime.scrollBottomBySession.has(session.id)) {
        runtime.sessionPorts.presentation.scrollToBottom(runtime, true);
    }
    runtime.messagesContainer.classList.remove("agent-chat__messages--switching");
    void runtime.promptSourceController.refresh();
    // 切换前被标记待恢复的会话在重绘后启动后台轮询恢复。
    if (runtime.pendingRecoverySessionIDs.has(session.id)) {
        void recoverInterruptedTurn(runtime, session.id);
    }
}

/** 清空已被其他实例删除的当前会话。 @同步豁免: 生命周期 */
export function handleCurrentSessionDeleted(runtime: AgentChatRuntime) {
    runtime.pendingEditDraft = null;
    const deletedSessionID = runtime.sessionId;
    runtime.sessionPorts.presentation.removeMirror(runtime);
    runtime.entries = [];
    runtime.sessionId = runtime.sessionPorts.repository.newSessionId();
    runtime.promptSourceController.reset();
    runtime.currentTurnID = "";
    runtime.currentRoundID = "";
    runtime.sessionCreatedAt = Date.now();
    runtime.sessionTitle = runtime.defaultTitle;
    runtime.pendingSessionTitle = null;
    runtime.pendingRecoverySessionIDs.delete(deletedSessionID);
    runtime.recoveryCommitTurnIDs.delete(deletedSessionID);
    runtime.hasTitled = false;
    runtime.currentAIElement = null;
    runtime.currentContent = "";
    runtime.fullContent = "";
    runtime.permissionMode = "confirm";
    runtime.permissionSelect.value = runtime.permissionMode;
    runtime.currentToolCalls = [];
    runtime.sessionPorts.projection.resetWebReferences(runtime);
    runtime.pendingConfirms = [];
    runtime.messagesContainer.innerHTML = "";
    runtime.sessionPorts.presentation.rebuildNavigation(runtime);
    runtime.titleElement.textContent = runtime.defaultTitle;
    runtime.sessionPorts.presentation.showWelcome(runtime);
    runtime.sessionPorts.presentation.scrollToBottom(runtime, true);
    void runtime.conversationController?.activate(runtime.conversationKind, runtime.sessionId, {subscribe: false});
}

/** 切换到指定持久化会话。 */
export async function switchSession(runtime: AgentChatRuntime, id: string) {
    // 与基线一致：流式中切换会话时允许切换，旧会话由 pendingRecoverySessionIDs 标记并在后台恢复。
    await prepareAgentChatSessionSwitch(runtime);
    const session = await runtime.sessionPorts.repository.load(id);
    if (!session) {
        return;
    }
    applyAgentChatSession(runtime, session);
    await runtime.conversationController?.activate(runtime.conversationKind, session.id);
    runtime.messagesContainer.classList.add("agent-chat__messages--switching");
    runtime.messagesContainer.addEventListener("transitionend", () => {
        renderSwitchedAgentChatSession(runtime, session);
    }, {once: true});
}
