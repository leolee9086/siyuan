/** 用途：约束初始化流程可写状态；使用范围：本文件会话初始化；解耦评估：通过本目录网关依赖公开运行时接口。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：应用指定初始会话；使用范围：浮窗或布局恢复；解耦评估：切换子域接口经网关暴露。 */
import {loadSessionForFloating} from "./imports";
/** 用途：加载 MAGI 身份会话；使用范围：MAGI 初始化；解耦评估：同目录生命周期职责直接导入。 */
import {loadMagiIdentityConversation} from "./AgentChat.magi";

/** 初始化目标对应的首个会话视图。 */
export async function initSessions(runtime: AgentChatRuntime) {
    if (runtime.conversationKind === "magi") {
        await loadMagiIdentityConversation(runtime);
        return;
    }
    await runtime.sessionPorts.repository.list({page: 1, pageSize: 1, targetKind: runtime.conversationKind});
    const initialSession = runtime.initialSessionId
        ? await runtime.sessionPorts.repository.load(runtime.initialSessionId)
        : null;
    if (initialSession && (initialSession.targetKind ?? "native-agent") === runtime.conversationKind) {
        loadSessionForFloating(runtime, initialSession);
        return;
    }
    runtime.sessionId = runtime.sessionPorts.repository.newSessionId();
    runtime.sessionCreatedAt = Date.now();
    runtime.sessionTitle = runtime.defaultTitle;
    runtime.pendingSessionTitle = null;
    runtime.entries = [];
    runtime.promptSourceController.reset();
    runtime.sessionPorts.presentation.showWelcome(runtime);
    runtime.sessionPorts.presentation.scrollToBottom(runtime, true);
}
