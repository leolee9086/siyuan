/** 用途：识别旧链路会话互斥错误；使用范围：重新生成失败回调；解耦评估：复用纯错误守卫，避免复制状态码规则。 */
import {isAgentHTTPConflictError} from "./imports";
/** 用途：发起旧链路重新生成 SSE；使用范围：未注册执行 adapter 的原生目标；解耦评估：请求实现经目录网关隔离。 */
import {fetchAgentSSE} from "./imports";
/** 用途：过滤会话切换后的迟到事件；使用范围：旧链路重新生成回调；解耦评估：复用纯身份守卫保持比较规则唯一。 */
import {isActiveAgentPanelRequest} from "./imports";
/** 用途：过滤编辑后失效的块引用；使用范围：重新生成目标更新；解耦评估：复用历史领域纯函数。 */
import {filterAgentReferencesForContent} from "./imports";
/** 用途：定位目标用户条目；使用范围：重新生成准备；解耦评估：复用历史领域唯一查找规则。 */
import {findAgentUserEntryIndex} from "./imports";
/** 用途：核对异步准备后的会话修订；使用范围：重新生成竞争守卫；解耦评估：纯状态守卫避免本模块复制版本规则。 */
import {isAgentRegenerateStateCurrent} from "./imports";
/** 用途：约束重新生成状态；使用范围：本文件全部步骤；解耦评估：纯协议避免依赖具体门面。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：约束重新生成目标；使用范围：历史裁剪和提交；解耦评估：复用上游兼容 Entry 类型。 */
import type {UserEntry} from "./imports";
/** 用途：读取请求语言配置；使用范围：旧链路重新生成参数；解耦评估：环境读取继续由既有边界集中维护。 */
import {requireSiyuanConfig} from "./imports";
/** 用途：判断目标是否允许重新生成；使用范围：准备守卫；解耦评估：目标差异集中在既有策略边界。 */
import {resolveTargetPolicy} from "./imports";
/** 用途：读取重新生成模型；使用范围：旧链路请求参数；解耦评估：模型选择规则仍由既有 UI 模块拥有。 */
import {getSelectedModel} from "./imports";
/** 用途：冻结本轮浏览器能力声明；使用范围：旧链路重新生成请求。 */
import {listCapabilityManifests} from "./imports";
/** 用途：移除跨实例流式占位；使用范围：重新生成启动；解耦评估：镜像 DOM 由会话视图领域集中维护。 */
import {removeMirrorPlaceholder} from "./imports";
/** 用途：提交待恢复轮次；使用范围：重新生成前；解耦评估：commit barrier 继续复用会话持久化流程。 */
import {prepareForNewTurn} from "./imports";
/** 用途：校验历史裁剪资格；使用范围：准备守卫；解耦评估：复用消息动作领域规则。 */
import {canRegenerateHistoryFrom} from "./imports";
/** 用途：恢复编辑草稿；使用范围：竞争失败路径；解耦评估：用户编辑状态由唯一动作模块维护。 */
import {restorePendingEditDraft} from "./imports";
/** 用途：创建编辑后的用户 DOM；使用范围：历史重写；解耦评估：用户消息结构由唯一工厂维护。 */
import {createUserMessage} from "./imports";
/** 用途：完成编辑后用户 DOM；使用范围：历史重写；解耦评估：复用唯一用户消息渲染入口。 */
import {renderUserMessage} from "./imports";
/** 用途：更新贴底观察目标；使用范围：重新生成视图重置；解耦评估：滚动资源由反馈领域集中所有。 */
import {observeStickTarget} from "./imports";
/** 用途：重建裁剪后的导航；使用范围：视图重置；解耦评估：导航索引由既有领域集中维护。 */
import {rebuildNavMarkers} from "./imports";
/** 用途：同步重新生成控件状态；使用范围：adapter admission 前；解耦评估：流式状态由反馈领域集中维护。 */
import {setStreaming} from "./imports";
/** 用途：通过活动 adapter 提交重新生成；使用范围：历史裁剪完成后；解耦评估：目标传输差异由统一 conversation 边界隔离。 */
import {submitAgentChatRegeneration} from "./imports";
/** 用途：保留既有 MAGI 重新生成链路；使用范围：未注册本轮 controller 的 MAGI 分支；解耦评估：继续调用原发送入口，不把 MAGI 协议复制进 native controller。 */
import {sendMagiMessage} from "./imports";
/** 用途：投影旧链路 SSE 事件；使用范围：重新生成流回调；解耦评估：消息语义继续由唯一协议处理器维护。 */
import {handleSSEEvent} from "./imports";
/** 用途：恢复旧链路会话冲突；使用范围：重新生成 409 回调；解耦评估：冲突恢复保留在既有发送领域。 */
import {handleConflictReject} from "./imports";
/** 用途：结算旧链路请求错误；使用范围：重新生成失败回调；解耦评估：错误呈现和会话恢复由响应领域集中维护。 */
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
 * @同步豁免: 生命周期 - Entry 修改、历史裁剪和 DOM 重写必须在同一交互周期完成，避免 adapter 观察半截历史。
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

/**
 * `resetRegenerationView` 负责流式响应流程中的对应步骤，由上层流程或事件回调调用并集中维护状态变化。
 * @同步豁免: UI构建 - 裁剪后的流式字段和导航必须在 admission 前一次性重置，异步化会让首帧写入旧容器。
 */
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

/** 为已注册执行 adapter 建立稳定的重新生成输入。 */
function createAdapterRegenerationSubmission(runtime: AgentChatRuntime, targetEntry: UserEntry) {
    setStreaming(runtime, true);
    removeMirrorPlaceholder(runtime);
    const editorContext = runtime.capabilities.captureEditorContext?.();
    delete targetEntry.editorContext;
    if (editorContext) {
        targetEntry.editorContext = editorContext;
    }
    const pluginActions = runtime.capabilities.listPluginActions?.() ?? [];
    if (!targetEntry.id) {
        targetEntry.id = runtime.sessionPorts.repository.newSessionId();
    }
    return {
        userEntryID: targetEntry.id,
        request: {
            text: targetEntry.content,
            blockHTML: targetEntry.blockHTML || "",
            references: targetEntry.references || [],
            editorContext,
            pluginActions,
        },
    };
}

/** `dispatchRegeneration` 负责流式响应流程中的对应步骤，由上层流程或事件回调调用并集中维护状态变化。 */
export async function dispatchRegeneration(runtime: AgentChatRuntime, targetEntry: UserEntry) {
    if (runtime.conversationController) {
        const submission = createAdapterRegenerationSubmission(runtime, targetEntry);
        await submitAgentChatRegeneration(runtime, submission.request, submission.userEntryID);
        return;
    }
    const request = startRegenerationRequest(runtime, targetEntry);
    // 条件 runtime.conversationKind === "magi" 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (runtime.conversationKind === "magi") {
        await sendMagiMessage(runtime, request.sessionId, request.signal);
        return;
    }
    await fetchAgentSSE({
        message: targetEntry.content,
        ...(targetEntry.blockHTML !== undefined ? {blockHTML: targetEntry.blockHTML} : {}),
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
        frontendCapabilities: listCapabilityManifests(),
        ...(targetEntry.id ? {userEntryID: targetEntry.id} : {}),
        contentRevision: runtime.sessionPorts.repository.getRevision(runtime.sessionId),
        requestHeaders: runtime.sessionPorts.requestHeaders({
            scope: "app",
            headers: {"Content-Type": "application/json"},
        }),
    });
}
