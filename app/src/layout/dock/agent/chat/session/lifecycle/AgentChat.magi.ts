/** 用途：约束 MAGI 生命周期可写状态；使用范围：本文件全部函数；解耦评估：通过本目录网关依赖公开运行时接口。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：构建 MAGI 历史条目；使用范围：历史投影；解耦评估：纯核心条目类型。 */
import type {SessionEntry} from "./imports";
/** 用途：转义 MAGI 状态文案；使用范围：状态 HTML 构建；解耦评估：纯函数经网关隔离。 */
import {escapeHtml} from "./imports";
/** 用途：约束抽象 MAGI 历史输入；使用范围：历史渲染；解耦评估：接口不暴露 Armor 会话实现。 */
import type {AgentChatMagiConversationHistory} from "./imports";

/** 清空 MAGI 会话视图与暂存响应。 */
export function resetMagiConversationView(runtime: AgentChatRuntime) {
    runtime.entries = [];
    runtime.sessionId = "";
    runtime.promptSourceController.reset();
    runtime.sessionCreatedAt = Date.now();
    runtime.sessionTitle = "MAGI";
    runtime.hasTitled = true;
    runtime.currentAIElement = null;
    runtime.currentContent = "";
    runtime.fullContent = "";
    runtime.currentToolCalls = [];
    runtime.currentThinkingSteps = [];
    runtime.currentThinkingStepContent = "";
    runtime.pendingConfirms = [];
    runtime.sessionPorts.projection.resetWebReferences(runtime);
    runtime.composer?.clear();
    runtime.composer?.clearHistory();
    runtime.messagesContainer.innerHTML = "";
    runtime.titleElement.textContent = "MAGI";
    runtime.sessionPorts.presentation.rebuildNavigation(runtime);
    runtime.sessionPorts.presentation.updateTokenDisplay(runtime);
}

/** 渲染 Guardian 主界面的 MAGI 历史。 */
export function renderMagiConversation(runtime: AgentChatRuntime, history: AgentChatMagiConversationHistory) {
    runtime.sessionId = history.conversationId;
    runtime.entries = history.messages.map((message): SessionEntry => ({
        id: message.id,
        type: message.role,
        content: message.content,
        timestamp: message.createdAt,
    }));
    runtime.composer?.restoreHistory(history.messages
        .filter((message) => message.role === "user")
        .map((message) => message.content));
    runtime.messagesContainer.innerHTML = "";
    if (runtime.entries.length === 0) {
        runtime.sessionPorts.presentation.showWelcome(runtime);
    }
    if (runtime.entries.length > 0) {
        runtime.sessionPorts.projection.render(runtime, {
            id: history.conversationId,
            title: "MAGI",
            targetKind: "magi",
            entries: runtime.entries.filter((entry): entry is Exclude<SessionEntry, {type: "todo"}> =>
                entry.type !== "todo"),
            createdAt: runtime.sessionCreatedAt,
            updatedAt: Date.now(),
        });
    }
    runtime.sessionPorts.presentation.rebuildNavigation(runtime);
    runtime.sessionPorts.presentation.scrollToBottom(runtime, true);
}

/** 渲染 MAGI 加载或授权状态。 */
export function renderMagiConversationState(runtime: AgentChatRuntime, title: string, description: string) {
    runtime.messagesContainer.innerHTML = '<div class="agent-welcome">' +
        '<div class="agent-welcome__title">' + escapeHtml(title) + "</div>" +
        '<div class="agent-welcome__desc">' + escapeHtml(description) + "</div>" +
        "</div>";
}

/** 按当前 Guardian 身份加载 MAGI 历史，并丢弃过期响应。 */
export async function loadMagiIdentityConversation(runtime: AgentChatRuntime) {
    const loadVersion = ++runtime.magiConversationLoadVersion;
    runtime.abortController?.abort();
    runtime.abortController = null;
    runtime.magiConversationLoadController?.abort();
    runtime.magiConversationLoadController = null;
    runtime.sessionPorts.turnLifecycle.setStreaming(runtime, false);
    resetMagiConversationView(runtime);

    const identity = runtime.sessionPorts.magiConversation.readActiveIdentity();
    runtime.magiIdentityId = identity.identityId;
    runtime.magiConversationLoading = identity.ready;
    runtime.sessionPorts.presentation.applyConversationCapabilities(runtime);
    runtime.sessionPorts.presentation.updateSendButton(runtime);
    if (!identity.ready) {
        renderMagiConversationState(runtime, "MAGI", "请先登录 Guardian Armor");
        return;
    }

    const controller = new AbortController();
    runtime.magiConversationLoadController = controller;
    renderMagiConversationState(runtime, "MAGI", "正在加载对话记录...");
    try {
        const history = await runtime.sessionPorts.magiConversation.loadConversation(
            identity.identityId,
            controller.signal,
        );
        const activeIdentity = runtime.sessionPorts.magiConversation.readActiveIdentity();
        if (runtime.agentDestroyed || controller.signal.aborted || loadVersion !== runtime.magiConversationLoadVersion ||
            runtime.conversationKind !== "magi" || activeIdentity.identityId !== identity.identityId) {
            return;
        }
        renderMagiConversation(runtime, history);
    } catch (error) {
        if (controller.signal.aborted || loadVersion !== runtime.magiConversationLoadVersion) {
            return;
        }
        const message = error instanceof Error ? error.message : String(error);
        renderMagiConversationState(runtime, "MAGI 对话加载失败", message);
    } finally {
        if (loadVersion === runtime.magiConversationLoadVersion) {
            runtime.magiConversationLoading = false;
            runtime.magiConversationLoadController = null;
            runtime.sessionPorts.presentation.applyConversationCapabilities(runtime);
            runtime.sessionPorts.presentation.updateSendButton(runtime);
        }
    }
}
