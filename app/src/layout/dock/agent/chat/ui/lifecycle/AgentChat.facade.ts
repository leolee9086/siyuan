/** 用途：约束公开门面状态；使用范围：本文件全部入口；解耦评估：纯类型经目录网关进入，不加载具体门面。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：约束公开会话身份；使用范围：目标切换入口；解耦评估：纯类型复用既有面板协议。 */
import type {AgentPanelConversation} from "./imports";
/** 用途：创建目标会话；使用范围：打开不存在的会话；解耦评估：会话创建保持唯一领域入口。 */
import {createSession} from "./imports";
/** 用途：应用已加载会话；使用范围：布局恢复；解耦评估：会话投影保持唯一领域入口。 */
import {loadSessionForFloating} from "./imports";
/** 用途：保存当前会话；使用范围：目标切换前；解耦评估：持久化继续经显式 sessionPorts 实现。 */
import {saveSession} from "./imports";
/** 用途：加载既有身份会话；使用范围：原目标刷新和切换；解耦评估：保留既有历史入口，不复制其协议。 */
import {loadMagiIdentityConversation} from "./imports";
/** 用途：切换持久化会话；使用范围：目标会话存在时；解耦评估：切换副作用由会话领域集中维护。 */
import {switchSession} from "./imports";
/** 用途：同步已注册执行控制器；使用范围：目标或恢复会话变化后；解耦评估：注册表决定接管关系，门面不判断具体 adapter。 */
import {syncAgentChatConversationController} from "./imports";
/** 用途：同步目标能力可见性；使用范围：目标切换；解耦评估：同目录生命周期投影只接收 runtime，额外事件层会破坏切换顺序。 */
import {applyConversationCapabilityVisibility} from "./AgentChat.shell.methods";

/**
 * 返回当前初始化任务。
 * @同步豁免: 生命周期 - 调用方需要取得同一个初始化 Promise 以串行后续动作，包装成新异步任务会改变引用和错误传播时序。
 */
export function ready(runtime: AgentChatRuntime) {
    return runtime.initialization;
}

/** 刷新当前目标对应的会话列表或 MAGI 历史。 */
export async function refreshSessions(runtime: AgentChatRuntime) {
    // 既有身份目标刷新其独立历史，native 目标刷新持久化会话列表。
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
    syncAgentChatConversationController(runtime);
    applyConversationCapabilityVisibility(runtime);
    // 既有身份目标继续由原历史加载入口处理，不进入 native 会话仓储。
    if (conversation.kind === "magi") {
        await loadMagiIdentityConversation(runtime);
        return;
    }
    const sessionID = conversation.sessionId;
    const session = sessionID ? await runtime.sessionPorts.repository.load(sessionID) : null;
    const targetKind = session?.targetKind ?? "native-agent";
    // 只切换到请求目标一致的已存会话，否则创建该目标的新会话。
    if (session && sessionID && targetKind === conversation.kind) {
        await switchSession(runtime, sessionID);
        await runtime.sessionPanel?.refresh();
        return;
    }
    await createSession(runtime);
    await runtime.sessionPanel?.refresh();
}

/**
 * 标记浮窗副本并保存关闭回调。
 * @同步豁免: UI构建 - 浮窗工厂返回实例前必须同步隐藏宿主专属按钮并登记关闭所有权。
 */
export function setFloatingCopyOptions(runtime: AgentChatRuntime, options: { onClose?: () => void } = {}) {
    runtime.isFloatingCopy = true;
    runtime.floatingCloseHandler = options.onClose || null;
    runtime.tabBtn?.classList.add("fn__none");
    runtime.tabNewBtn?.classList.add("fn__none");
    runtime.floatingBtn?.classList.add("fn__none");
}

/**
 * 返回当前会话标识。
 * @同步豁免: 生命周期 - 布局序列化在当前调用栈读取实例快照，异步返回会改变框架公开协议。
 */
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
        syncAgentChatConversationController(runtime);
        await runtime.conversationController?.activate(runtime.conversationKind, session.id);
    }
}
