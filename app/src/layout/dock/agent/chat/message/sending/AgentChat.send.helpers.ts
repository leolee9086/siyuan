import type {AgentChatRuntime} from "./imports";
import {isAgentHTTPConflictError} from "./imports";
import {fetchAgentSSE} from "./imports";
import type {ISSEResult} from "./imports";
import {isActiveAgentPanelRequest} from "./imports";
import {requireSiyuanConfig} from "./imports";
import {resolveTargetPolicy} from "./imports";
import {getSelectedModel} from "./imports";
import {saveSession} from "./imports";
import {reloadFromDisk} from "./imports";
import type {AgentPanelConversation} from "./imports";
import {setStreaming} from "./imports";
import {clearThinking} from "./imports";
import {appendUserMessage} from "./imports";
import {rebuildNavMarkers} from "./imports";
import {tryGenerateTitle} from "./imports";
import {rollbackUserEntry} from "./imports";
import {handleSSEEvent} from "./imports";
import {handleConfigError} from "./imports";
import {handleConflictReject} from "./AgentChat.conflict";
import {sendMagiMessage} from "./AgentChat.magiSend";

/** 读取输入与宿主上下文，并拒绝当前不可发送的状态。 */
export const collectAgentChatSendData = (chat: AgentChatRuntime) => {
    if (!chat.composer) {
        return null;
    }
    const sendData = chat.composer.getSendData();
    const unavailable = !sendData.text || chat.isStreaming || !resolveTargetPolicy(chat).sendingAvailable ||
        chat.promptSourceController.isOperationPending() ||
        (chat.conversationKind === "native-agent" && chat.modelOptions.length === 0);
    if (unavailable) {
        return null;
    }
    return {
        ...sendData,
        editorContext: chat.capabilities.captureEditorContext?.(),
        pluginActions: chat.capabilities.listPluginActions?.() ?? [],
    };
};

/** 将用户输入加入当前会话并在请求开始前持久化。 */
export async function startOutgoingAgentTurn(
    runtime: AgentChatRuntime,
    request: NonNullable<ReturnType<typeof collectAgentChatSendData>>,
) {
    setStreaming(runtime, true);
    clearThinking(runtime);
    runtime.hasInterveningCard = false;
    runtime.composer?.clear();
    const userEntryId = runtime.sessionPorts.repository.newSessionId();
    runtime.entries.push({
        id: userEntryId,
        type: "user",
        content: request.text,
        blockHTML: request.blockHTML,
        ...(request.references.length > 0 ? {references: request.references} : {}),
        ...(request.editorContext ? {editorContext: request.editorContext} : {}),
        timestamp: Date.now(),
    });
    // 条件 this.entries.length === 1 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (runtime.entries.length === 1) {
        runtime.messagesContainer.innerHTML = "";
    }
    appendUserMessage(runtime, request.text, {
        timestamp: Date.now(),
        entryId: userEntryId,
        ...(request.blockHTML !== undefined ? {blockHTML: request.blockHTML} : {}),
    });
    rebuildNavMarkers(runtime);
    void tryGenerateTitle(runtime);
    runtime.composer?.pushHistory(request.text);
    try {
        await saveSession(runtime);
        return userEntryId;
    } catch (error) {
        rollbackUserEntry(runtime, userEntryId);
        setStreaming(runtime, false);
        await reloadFromDisk(runtime);
        return null;
    }
}

/** 创建当前请求的中止信号和会话快照。 */
export const createAgentChatRequestContext = (chat: AgentChatRuntime) => {
    chat.requestStartTime = Date.now();
    chat.currentThinkingDuration = 0;
    chat.currentTurnID = "";
    chat.abortController = new AbortController();
    return {
        conversation: {kind: chat.conversationKind, sessionId: chat.sessionId},
        signal: chat.abortController.signal,
    };
};

/** 分派原生 Agent SSE，并过滤切换会话后的迟到事件。 */
export async function dispatchAgentChatSSE(
    runtime: AgentChatRuntime,
    input: {
        request: NonNullable<ReturnType<typeof collectAgentChatSendData>>;
        userEntryId: string;
        context: ReturnType<typeof createAgentChatRequestContext>;
    },
) {
    const {request, userEntryId, context} = input;
    await fetchAgentSSE({
        message: request.text,
        language: requireSiyuanConfig().appearance.lang,
        references: request.references,
        /** 仅提交仍属于当前会话且未中止的 SSE 事件，丢弃切换后的迟到帧。 */
        onEvent: (event: ISSEResult) => isActiveAgentPanelRequest(
            {kind: runtime.conversationKind, sessionId: runtime.sessionId},
            context.conversation,
            runtime.agentDestroyed || context.signal.aborted,
        ) ? handleSSEEvent(runtime, event) : undefined,
        /** 仅在请求仍属于当前会话时分类冲突或配置错误。 */
        onError: (error: Error) => {
            const active = isActiveAgentPanelRequest(
                {kind: runtime.conversationKind, sessionId: runtime.sessionId},
                context.conversation,
                runtime.agentDestroyed || context.signal.aborted,
            );
            if (!active) {
                return;
            }
            // 会话被其他实例占用时进入冲突恢复，不把互斥状态误报为配置错误。
            if (isAgentHTTPConflictError(error)) {
                void handleConflictReject(runtime);
                return;
            }
            return handleConfigError(runtime, error, {userEntryId});
        },
        signal: context.signal,
        sessionID: runtime.sessionId,
        model: getSelectedModel(runtime),
        reasoningEffort: runtime.selectedReasoningEffort,
        ...(request.editorContext ? {editorContext: request.editorContext} : {}),
        ...(request.pluginActions ? {pluginActions: request.pluginActions} : {}),
        userEntryID: userEntryId,
        contentRevision: runtime.sessionPorts.repository.getRevision(runtime.sessionId),
        requestHeaders: runtime.sessionPorts.requestHeaders({
            scope: "app",
            headers: {"Content-Type": "application/json"},
        }),
    });
}

/** 分派欢迎页示例请求；该路径与普通发送共享同一 SSE 事件入口，但不读取 Composer。 */
export async function dispatchAgentChatWelcome(
    runtime: AgentChatRuntime,
    input: {
        text: string;
        userEntryId: string;
        requestConversation: AgentPanelConversation;
        requestSignal: AbortSignal;
    },
) {
    const {text, userEntryId, requestConversation, requestSignal} = input;
    // MAGI 使用标准模型适配器，不进入原生 Agent SSE 端点。
    if (runtime.conversationKind === "magi") {
        await sendMagiMessage(runtime, requestConversation.sessionId || "", requestSignal);
        return;
    }
    await fetchAgentSSE({
        message: text,
        language: requireSiyuanConfig().appearance.lang,
        references: [],
        /** 欢迎页请求同样丢弃会话切换或中止后的迟到帧。 */
        onEvent: (event: ISSEResult) => isActiveAgentPanelRequest(
            {kind: runtime.conversationKind, sessionId: runtime.sessionId},
            requestConversation,
            runtime.agentDestroyed || requestSignal.aborted,
        ) ? handleSSEEvent(runtime, event) : undefined,
        /** 欢迎页错误只结算到发起请求的会话。 */
        onError: (error: Error) => {
            const active = isActiveAgentPanelRequest(
                {kind: runtime.conversationKind, sessionId: runtime.sessionId},
                requestConversation,
                runtime.agentDestroyed || requestSignal.aborted,
            );
            if (!active) {
                return;
            }
            if (isAgentHTTPConflictError(error)) {
                return handleConflictReject(runtime);
            }
            return handleConfigError(runtime, error, {userEntryId});
        },
        signal: requestSignal,
        sessionID: runtime.sessionId,
        model: getSelectedModel(runtime),
        reasoningEffort: runtime.selectedReasoningEffort,
        userEntryID: userEntryId,
        contentRevision: runtime.sessionPorts.repository.getRevision(runtime.sessionId),
        requestHeaders: runtime.sessionPorts.requestHeaders({
            scope: "app",
            headers: {"Content-Type": "application/json"},
        }),
    });
}
