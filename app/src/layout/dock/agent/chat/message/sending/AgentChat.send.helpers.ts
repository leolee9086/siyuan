/** 用途：约束发送流程状态；使用范围：本文件全部函数；解耦评估：纯运行时协议避免 helper 依赖具体门面。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：识别会话互斥响应；使用范围：旧请求流错误分派；解耦评估：纯错误守卫经目录网关复用，不需要注入状态。 */
import {isAgentHTTPConflictError} from "./imports";
/** 用途：发起既有 Agent SSE 请求；使用范围：未注册执行 adapter 的请求；解耦评估：请求实现经目录网关隔离，helper 只装配参数。 */
import {fetchAgentSSE} from "./imports";
/** 用途：约束既有 SSE 帧；使用范围：迟到事件过滤回调；解耦评估：纯类型依赖不会加载传输实现。 */
import type {ISSEResult} from "./imports";
/** 用途：过滤会话切换后的迟到事件；使用范围：旧请求流回调；解耦评估：纯身份守卫经网关复用，避免复制比较规则。 */
import {isActiveAgentPanelRequest} from "./imports";
/** 用途：读取请求语言配置；使用范围：旧请求流参数；解耦评估：环境读取已集中在既有边界，本 helper 不持有全局配置。 */
import {requireSiyuanConfig} from "./imports";
/** 用途：计算目标发送资格；使用范围：Composer 快照守卫；解耦评估：目标差异集中在既有纯策略函数。 */
import {resolveTargetPolicy} from "./imports";
/** 用途：读取当前模型；使用范围：旧请求流参数；解耦评估：模型选择规则由既有 UI 模块集中维护。 */
import {getSelectedModel} from "./imports";
/** 用途：保存新用户条目；使用范围：请求内流式 adapter；解耦评估：会话持久化继续走唯一仓储入口。 */
import {saveSession} from "./imports";
/** 用途：恢复保存失败的会话；使用范围：请求准备错误路径；解耦评估：权威重载继续走唯一会话入口。 */
import {reloadFromDisk} from "./imports";
/** 用途：同步流式控件；使用范围：请求内流式 adapter；解耦评估：控件状态由反馈领域集中维护。 */
import {setStreaming} from "./imports";
/** 用途：清空上一轮思考态；使用范围：新请求开始；解耦评估：思考状态由反馈领域集中维护。 */
import {clearThinking} from "./imports";
/** 用途：投影新用户消息；使用范围：请求内流式 adapter；解耦评估：复用唯一用户条目 DOM 入口。 */
import {appendUserMessage} from "./imports";
/** 用途：重建消息导航；使用范围：用户消息追加后；解耦评估：导航索引由既有领域集中维护。 */
import {rebuildNavMarkers} from "./imports";
/** 用途：生成首轮标题；使用范围：用户消息建立后；解耦评估：标题副作用由响应收尾领域集中维护。 */
import {tryGenerateTitle} from "./imports";
/** 用途：撤销保存失败的用户条目；使用范围：请求准备错误路径；解耦评估：条目和 DOM 回滚由响应错误领域集中维护。 */
import {rollbackUserEntry} from "./imports";
/** 用途：约束请求发起时的会话身份；使用范围：欢迎示例迟到事件隔离；解耦评估：纯类型依赖保持 helper 与门面解耦。 */
import type {AgentPanelConversation} from "./imports";
/** 用途：投影既有 SSE 帧；使用范围：旧请求流事件回调；解耦评估：消息语义继续由唯一协议处理器维护。 */
import {handleSSEEvent} from "./imports";
/** 用途：结算既有请求错误；使用范围：旧请求流失败回调；解耦评估：错误 UI 与回滚由响应领域集中维护。 */
import {handleConfigError} from "./imports";
/** 用途：冻结本轮浏览器能力声明；使用范围：旧请求流参数；解耦评估：纯查询经目录网关复用，不持有运行态。 */
import {listCapabilityManifests} from "./imports";
/** 用途：恢复会话互斥冲突；使用范围：旧请求流 409 回调；解耦评估：同目录冲突流程继续作为唯一恢复入口。 */
import {handleConflictReject} from "./AgentChat.conflict";
/** 用途：保留既有 MAGI 发送入口；使用范围：未注册本轮 controller 的 MAGI 分支；解耦评估：继续调用原传输边界，不经 native adapter 转发。 */
import {sendMagiMessage} from "./AgentChat.magiSend";

/**
 * 读取输入与宿主上下文，并拒绝当前不可发送的状态。
 * @同步豁免: 需要绝对同步的DOM访问 - 发送事件必须冻结当前 Composer 内容，异步读取会混入后续编辑。
 */
export const collectAgentChatSendData = (chat: AgentChatRuntime) => {
    if (!chat.composer) {
        return null;
    }
    const sendData = chat.composer.getSendData();
    const adapter = chat.conversationController?.state.adapter;
    const adapterOwnsTarget = adapter?.kind === chat.conversationKind;
    const acceptsRunningInput = adapterOwnsTarget && adapter &&
        (adapter.capabilities.supportsQueue || adapter.capabilities.supportsSteer);
    const unavailable = !sendData.text || (chat.isStreaming && !acceptsRunningInput) ||
        !resolveTargetPolicy(chat).sendingAvailable ||
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

/**
 * 创建当前请求的中止信号和会话快照。
 * @同步豁免: 生命周期 - AbortController 必须在 adapter 启动前同步归属当前实例，确保 Stop 和 dispose 可立即撤销。
 */
export const createAgentChatRequestContext = (chat: AgentChatRuntime) => {
    chat.requestStartTime = Date.now();
    chat.currentThinkingDuration = 0;
    chat.currentTurnID = "";
    chat.currentRoundID = "";
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
        ...(request.blockHTML !== undefined ? {blockHTML: request.blockHTML} : {}),
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
            // 会话互斥由专用恢复流程处理，不显示为普通配置错误。
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
        frontendCapabilities: listCapabilityManifests(),
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
        frontendCapabilities: listCapabilityManifests(),
        userEntryID: userEntryId,
        contentRevision: runtime.sessionPorts.repository.getRevision(runtime.sessionId),
        requestHeaders: runtime.sessionPorts.requestHeaders({
            scope: "app",
            headers: {"Content-Type": "application/json"},
        }),
    });
}
