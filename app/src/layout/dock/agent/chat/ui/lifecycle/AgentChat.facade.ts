import type {AgentChatRuntime} from "./imports";
import type {AgentPanelConversation} from "./imports";
import {createSession} from "./imports";
import {loadSessionForFloating} from "./imports";
import {saveSession} from "./imports";
import {loadMagiIdentityConversation} from "./imports";
import {switchSession} from "./imports";
import {applyConversationCapabilityVisibility} from "./AgentChat.shell.methods";

/** 返回当前初始化任务。 */
export function ready(runtime: AgentChatRuntime) {
    return runtime.initialization;
}

/** 刷新当前目标对应的会话列表或 MAGI 历史。 */
export async function refreshSessions(runtime: AgentChatRuntime) {
    if (runtime.conversationKind === "magi") {
        await loadMagiIdentityConversation(runtime);
        return;
    }
    await runtime.sessionPanel?.refresh();
}

/** 等待初始化后写入输入草稿。 */
export async function setDraft(runtime: AgentChatRuntime, text: string, focus = true) {
    await runtime.initialization;
    if (runtime.agentDestroyed || !runtime.composer) {
        return;
    }
    runtime.composer.setText(text);
    if (focus) {
        runtime.composer.focus();
    }
}

/** 保存当前会话并切换到指定目标。 */
export async function openConversation(runtime: AgentChatRuntime, conversation: AgentPanelConversation) {
    if (runtime.isStreaming) {
        return;
    }
    await saveSession(runtime);
    runtime.promptSourceController.reset();
    runtime.conversationKind = conversation.kind;
    applyConversationCapabilityVisibility(runtime);
    if (conversation.kind === "magi") {
        await loadMagiIdentityConversation(runtime);
        return;
    }
    const sessionID = conversation.sessionId;
    const session = sessionID ? await runtime.sessionPorts.repository.load(sessionID) : null;
    const targetKind = session?.targetKind ?? "native-agent";
    if (session && sessionID && targetKind === conversation.kind) {
        await switchSession(runtime, sessionID);
        await runtime.sessionPanel?.refresh();
        return;
    }
    await createSession(runtime);
    await runtime.sessionPanel?.refresh();
}

/** 标记浮窗副本并保存关闭回调。 */
export function setFloatingCopyOptions(runtime: AgentChatRuntime, options: { onClose?: () => void } = {}) {
    runtime.isFloatingCopy = true;
    runtime.floatingCloseHandler = options.onClose || null;
    runtime.tabBtn?.classList.add("fn__none");
    runtime.floatingBtn?.classList.add("fn__none");
}

/** 返回当前会话标识。 */
export function getSessionId(runtime: AgentChatRuntime) {
    return runtime.sessionId;
}

/** 从布局保存的会话标识恢复内容。 */
export async function restoreSessionById(runtime: AgentChatRuntime, sessionID: string) {
    if (!sessionID) {
        return;
    }
    await ready(runtime);
    const session = await runtime.sessionPorts.repository.load(sessionID);
    if (session) {
        loadSessionForFloating(runtime, session);
    }
}
