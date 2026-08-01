import {isAgentHTTPConflictError} from "./imports";
import {fetchAgentSSE} from "./imports";
import {isActiveAgentPanelRequest} from "./imports";
import {filterAgentReferencesForContent} from "./imports";
import {findAgentUserEntryIndex} from "./imports";
import {isAgentRegenerateStateCurrent} from "./imports";
import type {AgentChatRuntime} from "./imports";
import type {UserEntry} from "./imports";
import {requireSiyuanConfig} from "./imports";
import {resolveTargetPolicy} from "./imports";
import {getSelectedModel} from "./imports";
import {removeMirrorPlaceholder} from "./imports";
import {prepareForNewTurn} from "./imports";
import {canRegenerateHistoryFrom} from "./imports";
import {restorePendingEditDraft} from "./imports";
import {createUserMessage} from "./imports";
import {renderUserMessage} from "./imports";
import {observeStickTarget} from "./imports";
import {rebuildNavMarkers} from "./imports";
import {setStreaming} from "./imports";
import {sendMagiMessage} from "./imports";
import {handleSSEEvent} from "./imports";
import {handleConflictReject} from "./imports";
import {handleConfigError} from "./imports";

/**
 * `prepareRegeneration` 负责流式响应流程中的对应步骤，由上层流程或事件回调调用。
 * @显式返回类型原因 该签名跨职责模块或运行时契约使用，需固定返回边界，避免推导随实现细节漂移。
 */
export async function prepareRegeneration(runtime: AgentChatRuntime, userEntryID?: string,
                                          /**
                                           * `prepareRegeneration` 负责流式响应流程中的对应步骤，由上层流程或事件回调调用。
                                           * @显式返回类型原因 该签名跨职责模块或运行时契约使用，需固定返回边界，避免推导随实现细节漂移。
                                           */
                                          editedContent?: string): Promise<number | null> {
    if (runtime.isStreaming || runtime.mirrorLocked || !resolveTargetPolicy(runtime).regenerationVisible ||
        (runtime.conversationKind === "native-agent" && runtime.modelOptions.length === 0)) {
        return null;
    }
    const requestSessionID = runtime.sessionId;
    const requestRevision = runtime.sessionPorts.repository.getRevision(requestSessionID);
    const initialTargetIndex = findAgentUserEntryIndex(runtime.entries, userEntryID);
    if (initialTargetIndex < 0) {
        return null;
    }
    // 条件 editedContent !== undefined && userEntryID 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (editedContent !== undefined && userEntryID) {
        runtime.pendingEditDraft = {entryID: userEntryID, content: editedContent};
    }
    // 条件 !runtime.canRegenerateHistoryFrom(initialTargetIndex) |... 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (!canRegenerateHistoryFrom(runtime, initialTargetIndex) || !await prepareForNewTurn(runtime)) {
        restorePendingEditDraft(runtime);
        return null;
    }
    const stateCurrent = isAgentRegenerateStateCurrent(
        {sessionID: requestSessionID, revision: requestRevision},
        {
            sessionID: runtime.sessionId,
            revision: runtime.sessionPorts.repository.getRevision(requestSessionID),
            isStreaming: runtime.isStreaming,
            mirrorLocked: runtime.mirrorLocked,
        },
    );
    // 条件 !stateCurrent && runtime.sessionId === requestSessionID 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (!stateCurrent && runtime.sessionId === requestSessionID) {
        restorePendingEditDraft(runtime);
    }
    // 条件 !stateCurrent && runtime.sessionId !== requestSessionID 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (!stateCurrent && runtime.sessionId !== requestSessionID) {
        runtime.pendingEditDraft = null;
    }
    if (!stateCurrent) {
        return null;
    }
    const targetIndex = findAgentUserEntryIndex(runtime.entries, userEntryID);
    // 条件 targetIndex < 0 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (targetIndex < 0) {
        restorePendingEditDraft(runtime);
        return null;
    }
    return targetIndex;
}

/** `updateRegenerationTarget` 负责流式响应流程中的对应步骤，由上层流程或事件回调调用并集中维护状态变化。 */
function updateRegenerationTarget(targetEntry: UserEntry, editedContent?: string) {
    if (editedContent === undefined) {
        return;
    }
    const contentChanged = editedContent !== targetEntry.content;
    targetEntry.content = editedContent;
    if (contentChanged) {
        delete targetEntry.blockHTML;
    }
    const references = filterAgentReferencesForContent(targetEntry.references || [], editedContent);
    delete targetEntry.references;
    // 条件 references.length > 0 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (references.length > 0) {
        targetEntry.references = references;
    }
}

/** `rewriteRegenerationDOM` 负责流式响应流程中的对应步骤，由上层流程或事件回调调用并集中维护状态变化。 */
function rewriteRegenerationDOM(runtime: AgentChatRuntime, targetEntry: UserEntry, editedContent?: string) {
    const targetElement = runtime.messagesContainer.querySelector<HTMLElement>(
        '.agent-chat__msg--user[data-message-id="' + targetEntry.id + '"]'
    );
    if (!targetElement) {
        return;
    }
    let sibling = targetElement.nextElementSibling;
    while (sibling) {
        const next = sibling.nextElementSibling;
        sibling.remove();
        sibling = next;
    }
    if (editedContent !== undefined) {
        const replacement = createUserMessage(runtime, targetEntry.content, {
            ...(targetEntry.timestamp !== undefined ? {timestamp: targetEntry.timestamp} : {}),
            ...(targetEntry.id !== undefined ? {entryId: targetEntry.id} : {}),
            ...(targetEntry.blockHTML !== undefined ? {blockHTML: targetEntry.blockHTML} : {}),
        });
        targetElement.replaceWith(replacement);
        renderUserMessage(runtime, replacement);
    }
}

/**
 * `applyRegenerationEdit` 负责流式响应流程中的对应步骤，由上层流程或事件回调调用。
 * @显式返回类型原因 该签名跨职责模块或运行时契约使用，需固定返回边界，避免推导随实现细节漂移。
 */
export function applyRegenerationEdit(runtime: AgentChatRuntime, targetIndex: number,
                                      /**
                                       * `applyRegenerationEdit` 负责流式响应流程中的对应步骤，由上层流程或事件回调调用。
                                       * @显式返回类型原因 该签名跨职责模块或运行时契约使用，需固定返回边界，避免推导随实现细节漂移。
                                       */
                                      editedContent?: string): UserEntry | null {
    const targetEntry = runtime.entries[targetIndex];
    if (!targetEntry || targetEntry.type !== "user") {
        return null;
    }
    runtime.editingUserEntryID = "";
    runtime.pendingEditDraft = editedContent === undefined ? null : {
        entryID: targetEntry.id || "",
        content: editedContent,
    };
    updateRegenerationTarget(targetEntry, editedContent);
    runtime.entries.splice(targetIndex + 1);
    rewriteRegenerationDOM(runtime, targetEntry, editedContent);
    return targetEntry;
}

/** `resetRegenerationView` 负责流式响应流程中的对应步骤，由上层流程或事件回调调用并集中维护状态变化。 */
export function resetRegenerationView(runtime: AgentChatRuntime) {
    runtime.currentAIElement = null;
    observeStickTarget(runtime, null);
    runtime.currentContent = "";
    runtime.fullContent = "";
    runtime.currentToolCalls = [];
    runtime.lastStepToolCount = 0;
    runtime.renderedToolNames = {};
    runtime.hasInterveningCard = false;
    runtime.currentThinkingSteps = [];
    runtime.currentThinkingStepContent = "";
    runtime.currentThinkingText = "";
    runtime.currentThinkingReasoning = "";
    runtime.currentThinkingReasoningContent = "";
    rebuildNavMarkers(runtime);
}

/**
 * `startRegenerationRequest` 负责流式响应流程中的对应步骤，由上层流程或事件回调调用。
 * @显式返回类型原因 该签名跨职责模块或运行时契约使用，需固定返回边界，避免推导随实现细节漂移。
 */
function startRegenerationRequest(runtime: AgentChatRuntime, targetEntry: UserEntry) {
    setStreaming(runtime, true);
    removeMirrorPlaceholder(runtime);
    runtime.requestStartTime = Date.now();
    runtime.currentThinkingDuration = 0;
    runtime.currentTurnID = "";
    const editorContext = runtime.capabilities.captureEditorContext?.();
    delete targetEntry.editorContext;
    if (editorContext) {
        targetEntry.editorContext = editorContext;
    }
    const pluginActions = runtime.capabilities.listPluginActions?.() ?? [];
    runtime.abortController = new AbortController();
    const conversation = {kind: runtime.conversationKind, sessionId: runtime.sessionId};
    return {
        conversation,
        sessionId: conversation.sessionId || "",
        signal: runtime.abortController.signal,
        editorContext,
        pluginActions,
    };
}

/** `dispatchRegeneration` 负责流式响应流程中的对应步骤，由上层流程或事件回调调用并集中维护状态变化。 */
export async function dispatchRegeneration(runtime: AgentChatRuntime, targetEntry: UserEntry) {
    const request = startRegenerationRequest(runtime, targetEntry);
    // 条件 runtime.conversationKind === "magi" 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (runtime.conversationKind === "magi") {
        await sendMagiMessage(runtime, request.sessionId, request.signal);
        return;
    }
    await fetchAgentSSE({
        message: targetEntry.content,
        language: requireSiyuanConfig().appearance.lang,
        references: targetEntry.references || [],
        /** 仅提交仍属于当前会话和当前中止信号的重新生成事件。 */
        onEvent: (event) => isActiveAgentPanelRequest(
            {kind: runtime.conversationKind, sessionId: runtime.sessionId},
            request.conversation,
            runtime.agentDestroyed || request.signal.aborted,
        ) ? handleSSEEvent(runtime, event) : undefined,
        /** 重新生成错误只结算到发起请求的会话。 */
        onError: (error) => {
            const active = isActiveAgentPanelRequest(
                {kind: runtime.conversationKind, sessionId: runtime.sessionId},
                request.conversation,
                runtime.agentDestroyed || request.signal.aborted,
            );
            if (!active) {
                return;
            }
            if (isAgentHTTPConflictError(error)) {
                return handleConflictReject(runtime);
            }
            return handleConfigError(runtime, error, {restoreSession: true});
        },
        signal: request.signal,
        sessionID: runtime.sessionId,
        model: getSelectedModel(runtime),
        reasoningEffort: runtime.selectedReasoningEffort,
        regenerate: true,
        ...(request.editorContext ? {editorContext: request.editorContext} : {}),
        pluginActions: request.pluginActions,
        ...(targetEntry.id ? {userEntryID: targetEntry.id} : {}),
        contentRevision: runtime.sessionPorts.repository.getRevision(runtime.sessionId),
        requestHeaders: runtime.sessionPorts.requestHeaders({
            scope: "app",
            headers: {"Content-Type": "application/json"},
        }),
    });
}
