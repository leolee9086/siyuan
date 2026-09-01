/** 用途：约束浮窗会话加载可写状态；使用范围：本文件加载入口；解耦评估：通过本目录网关只依赖公开运行时接口。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：约束加载输入；使用范围：浮窗会话恢复；解耦评估：纯存储领域类型。 */
import type {AgentSession} from "./imports";

/** 把持久化会话加载到当前可观察运行时状态。 */
export function loadSessionForFloating(runtime: AgentChatRuntime, session: AgentSession) {
    runtime.conversationKind = session.targetKind ?? "native-agent";
    runtime.sessionId = session.id;
    runtime.promptSourceController.reset();
    runtime.sessionPorts.presentation.applyConversationCapabilities(runtime);
    runtime.sessionCreatedAt = session.createdAt || Date.now();
    runtime.sessionTitle = session.title || runtime.defaultTitle;
    runtime.hasTitled = session.titled !== false;
    runtime.entries = runtime.sessionPorts.projection.buildEntries(session);
    runtime.contextTokens = session.contextTokens ?? 0;
    runtime.contextTokenBreakdown = session.contextTokenBreakdown ?? {};
    runtime.contextCachedTokens = session.contextCachedTokens ?? 0;
    runtime.contextLimit = session.contextLimit ?? 0;
    runtime.permissionMode = session.permissionMode ?? "confirm";
    runtime.permissionSelect.value = runtime.permissionMode;
    if (session.model) {
        runtime.sessionPorts.presentation.applySessionModel(runtime, session.model);
    }
    runtime.composer?.clearHistory();
    runtime.composer?.restoreHistory(session.messageHistory || []);
    runtime.titleElement.textContent = runtime.sessionTitle;
    runtime.messagesContainer.innerHTML = "";
    runtime.sessionPorts.projection.render(runtime, session);
    runtime.sessionPorts.presentation.rebuildNavigation(runtime);
    runtime.sessionPorts.presentation.updateTokenDisplay(runtime);
    runtime.sessionPorts.presentation.scrollToBottom(runtime, true);
    void runtime.promptSourceController.refresh();
}
