/**
 * 用途：约束会话重载流程所需的运行时契约。
 * 使用范围：仅限本文件全部重载函数。
 * 解耦评估：经本目录网关隔离上级核心目录，业务文件不直接跨目录依赖。
 */
import type {AgentChatRuntime} from "./imports";
/**
 * 用途：引入统一会话条目类型，供条目序列比较复用。
 * 使用范围：仅限本文件条目比较与重建逻辑。
 * 解耦评估：条目结构由核心契约统一声明，经网关转发保持单一来源。
 */
import type {SessionEntry} from "./imports";
/**
 * 用途：引入持久化会话的权威数据结构。
 * 使用范围：仅限本文件元数据同步与视图重绘。
 * 解耦评估：会话结构由存储契约统一声明，集中复用可防止字段漂移。
 */
import type {AgentSession} from "./imports";

/** 清除强制重绘前仍指向旧 DOM 和旧流式轮次的状态。 */
function resetAgentChatReloadState(runtime: AgentChatRuntime) {
    runtime.currentAIElement = null;
    runtime.sessionPorts.presentation.observeStickTarget(runtime, null);
    runtime.currentAssistantEntryId = "";
    runtime.currentContent = "";
    runtime.fullContent = "";
    runtime.currentRoundID = "";
    runtime.currentToolCalls = [];
    runtime.pendingConfirms = [];
    runtime.currentThinkingSteps = [];
    runtime.currentThinkingEntryId = "";
    runtime.currentThinkingStepContent = "";
    runtime.currentThinkingText = "";
    runtime.currentThinkingReasoning = "";
    runtime.currentThinkingReasoningContent = "";
    runtime.currentThinkingDuration = 0;
    runtime.lastStepToolCount = 0;
    runtime.renderedToolNames = {};
    runtime.hasInterveningCard = false;
}

/**
 * 比较两个持久化条目序列。
 * @同步豁免: 性能考虑 - 重载热路径需要同步比较序列以决定是否重建 DOM，序列化比较不含可异步化的工作。
 */
export function entriesEqual(left: SessionEntry[], right: SessionEntry[]) {
    if (left === right) {
        return true;
    }
    if (left.length !== right.length) {
        return false;
    }
    return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * 判断消息视图是否仍接近底部。
 * @同步豁免: 需要绝对同步的DOM访问 - 重载前必须同步读取滚动位置快照，以便重绘后原样恢复。
 */
export function isScrolledToBottom(runtime: AgentChatRuntime) {
    const {scrollTop, scrollHeight, clientHeight} = runtime.messagesContainer;
    return scrollHeight - scrollTop - clientHeight <= 60;
}

/**
 * 从权威会话更新标题、令牌、恢复标记和模型。
 * @同步豁免: UI构建 - 元数据必须与视图重绘在同一界面更新周期内落地，异步化会造成标题与消息错位。
 */
export function updateMetaFromSession(runtime: AgentChatRuntime, session: AgentSession) {
    runtime.sessionTitle = runtime.pendingSessionTitle || session.title || runtime.defaultTitle;
    runtime.hasTitled = session.titled !== false;
    runtime.sessionCreatedAt = session.createdAt || runtime.sessionCreatedAt;
    runtime.contextTokens = session.contextTokens ?? 0;
    runtime.contextTokenBreakdown = session.contextTokenBreakdown ?? {};
    runtime.contextCachedTokens = session.contextCachedTokens ?? 0;
    runtime.contextLimit = session.contextLimit ?? 0;
    runtime.permissionMode = session.permissionMode ?? "confirm";
    runtime.permissionSelect.value = runtime.permissionMode;
    if (session.recoveryTurnID) {
        runtime.recoveryCommitTurnIDs.set(session.id, session.recoveryTurnID);
    }
    if (!session.recoveryTurnID) {
        runtime.recoveryCommitTurnIDs.delete(session.id);
    }
    if (session.model) {
        runtime.sessionPorts.presentation.applySessionModel(runtime, session.model);
    }
    runtime.titleElement.textContent = runtime.sessionTitle;
    runtime.sessionPorts.presentation.updateTokenDisplay(runtime);
}

/** 从磁盘权威会话重绘当前视图。 */
export async function reloadFromDisk(runtime: AgentChatRuntime, forceRender = false) {
    const targetSessionID = runtime.sessionId;
    const session = await runtime.sessionPorts.repository.load(targetSessionID);
    if (targetSessionID !== runtime.sessionId || !session) {
        return;
    }
    const newEntries = runtime.sessionPorts.projection.buildEntries(session);
    // 非强制重绘且条目无变化时仅刷新元数据，避免无意义的 DOM 重建导致视图闪烁或滚动跳动。
    if (!forceRender && entriesEqual(newEntries, runtime.entries)) {
        updateMetaFromSession(runtime, session);
        return;
    }
    const atBottom = isScrolledToBottom(runtime);
    const savedScroll = runtime.messagesContainer.scrollTop;
    if (forceRender) {
        resetAgentChatReloadState(runtime);
    }
    runtime.entries = newEntries;
    updateMetaFromSession(runtime, session);
    runtime.messagesContainer.innerHTML = "";
    runtime.sessionPorts.projection.render(runtime, session);
    runtime.sessionPorts.presentation.rebuildNavigation(runtime);
    if (atBottom) {
        runtime.sessionPorts.presentation.scrollToBottom(runtime, true);
    }
    if (!atBottom) {
        runtime.messagesContainer.scrollTop = savedScroll;
    }
    if (runtime.mirrorLocked) {
        runtime.sessionPorts.presentation.showMirror(runtime);
    }
    if (!runtime.mirrorLocked) {
        runtime.sessionPorts.presentation.removeMirror(runtime);
    }
}
