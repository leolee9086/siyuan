/** 用途：约束 AgentChat 运行时；使用范围：统一 adapter 发送；解耦评估：运行时协议经目录网关隔离具体门面。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：约束统一提交输入；使用范围：adapter admission；解耦评估：输入协议是 adapter 的稳定边界。 */
import type {AgentConversationSubmitInput} from "./imports";
/** 用途：约束请求内事件观察器；使用范围：非 session-stream adapter；解耦评估：观察器由 adapter 协议定义。 */
import type {AgentConversationObserver} from "./imports";
/** 用途：读取当前模型；使用范围：完整 queued turn 快照；解耦评估：复用现有模型选择唯一入口。 */
import {getSelectedModel} from "./imports";
/** 用途：读取界面语言；使用范围：完整 queued turn 快照；解耦评估：复用已校验环境读取入口。 */
import {requireSiyuanConfig} from "./imports";
/** 用途：判断迟到请求；使用范围：请求内流式观察器；解耦评估：复用现有会话身份比较规则。 */
import {isActiveAgentPanelRequest} from "./imports";
/** 用途：分派既有 SSE 事件；使用范围：请求内流式 adapter；解耦评估：adapter 只负责传输，消息语义由现有处理器维护。 */
import {handleSSEEvent} from "./imports";
/** 用途：结算请求错误；使用范围：admission 或流式失败；解耦评估：复用现有用户条目回滚和错误呈现。 */
import {handleConfigError} from "./imports";
/** 用途：保存上游兼容会话；使用范围：native 首次 admission 前；解耦评估：会话创建仍由唯一仓储入口维护。 */
import {saveSession} from "./imports";
/** 用途：同步已有用户条目的重新生成状态；使用范围：统一 adapter 重新生成；解耦评估：复用既有流式状态投影，不让 adapter 访问 DOM。 */
import {setStreaming} from "./imports";
/** 用途：建立请求内流式用户条目；使用范围：不使用 session events 的 adapter；解耦评估：复用现有条目与 DOM 原子投影。 */
import {startOutgoingAgentTurn} from "./AgentChat.send.helpers";
/** 用途：识别结构化控制错误；使用范围：提交修订冲突自愈；解耦评估：复用控制层唯一错误守卫。 */
import {isAgentConversationControlError} from "./imports";
/** 用途：创建请求取消上下文；使用范围：不使用 session events 的 adapter；解耦评估：复用现有迟到事件隔离协议。 */
import {createAgentChatRequestContext} from "./AgentChat.send.helpers";
/** 用途：约束 Composer 发送快照；使用范围：统一输入构造；解耦评估：直接引用收集函数的推导类型避免重复协议。 */
import type {collectAgentChatSendData} from "./AgentChat.send.helpers";
/** 用途：冻结本轮浏览器能力声明；使用范围：原生 Agent admission；解耦评估：注册表是能力清单的唯一事实源。 */
import {listCapabilityManifests} from "../../../frontendCapabilities";

/** 读取当前已注册执行控制器；目标切换后的迟到提交在这里终止。 */
function requireConversationController(runtime: AgentChatRuntime) {
    const controller = runtime.conversationController;
    if (!controller) {
        throw new Error("Agent conversation controller is not active");
    }
    return controller;
}

/** 收集 adapter 所需的纯 user/assistant 历史。 */
function collectConversationHistory(runtime: AgentChatRuntime) {
    const history: Array<{role: "user" | "assistant"; content: string}> = [];
    for (const entry of runtime.entries) {
        // 模型上下文只接受有正文的 user/assistant，工具卡、确认和快照由后端 runtime 管理。
        if ((entry.type === "user" || entry.type === "assistant") && entry.content) {
            history.push({role: entry.type, content: entry.content});
        }
    }
    return history;
}

/** 根据活动 turn 和 adapter 能力决定本次投递语义。 */
function resolveConversationDelivery(runtime: AgentChatRuntime) {
    const state = requireConversationController(runtime).state;
    const active = Boolean(state.turnID) && state.phase !== "idle" && state.phase !== "awaiting_commit";
    if (!active || !state.adapter.capabilities.usesSessionEvents) {
        return "turn";
    }
    if (state.selectedDelivery === "steer" && state.steerable && state.adapter.capabilities.supportsSteer) {
        return "steer";
    }
    return "queue";
}

/** 从 Composer 快照构造可序列化 adapter 输入。 */
function createConversationInput(
    runtime: AgentChatRuntime,
    request: NonNullable<ReturnType<typeof collectAgentChatSendData>>,
    identity: Readonly<{
        inputID: string;
        userEntryID: string;
        delivery?: AgentConversationSubmitInput["delivery"];
        regenerate?: boolean;
    }>,
) {
    const delivery = identity.delivery || resolveConversationDelivery(runtime);
    const turnID = requireConversationController(runtime).state.turnID;
    return {
        inputID: identity.inputID,
        userEntryID: identity.userEntryID,
        sessionID: runtime.sessionId,
        delivery,
        ...(delivery === "steer" && turnID ? {expectedTurnID: turnID} : {}),
        message: request.text,
        ...(request.blockHTML ? {blockHTML: request.blockHTML} : {}),
        language: requireSiyuanConfig().appearance.lang,
        references: request.references,
        ...(request.editorContext ? {editorContext: request.editorContext} : {}),
        ...(request.pluginActions.length > 0 ? {pluginActions: request.pluginActions} : {}),
        frontendCapabilities: listCapabilityManifests(),
        model: getSelectedModel(runtime),
        ...(runtime.selectedReasoningEffort ? {reasoningEffort: runtime.selectedReasoningEffort} : {}),
        ...(identity.regenerate ? {regenerate: true} : {}),
        contentRevision: runtime.sessionPorts.repository.getRevision(runtime.sessionId),
        history: collectConversationHistory(runtime),
        requestHeaders: runtime.sessionPorts.requestHeaders,
    } satisfies AgentConversationSubmitInput;
}

/** 为请求内流式 adapter 创建带会话身份隔离的观察器。 */
function createConversationObserver(
    runtime: AgentChatRuntime,
    input: Readonly<{
        userEntryID: string;
        conversation: {kind: AgentChatRuntime["conversationKind"]; sessionId: string};
        signal: AbortSignal;
        restoreSession?: boolean;
    }>,
) {
    return {
        /** 只有仍属于当前会话的增量才能进入消息投影。 */
        onEvent: (event) => isActiveAgentPanelRequest(
            {kind: runtime.conversationKind, sessionId: runtime.sessionId},
            input.conversation,
            runtime.agentDestroyed || input.signal.aborted,
        ) ? handleSSEEvent(runtime, event) : undefined,
        /** 请求错误同样只结算到发起它的会话。 */
        onError: (error) => {
            const active = isActiveAgentPanelRequest(
                {kind: runtime.conversationKind, sessionId: runtime.sessionId},
                input.conversation,
                runtime.agentDestroyed || input.signal.aborted,
            );
            if (active) {
                return handleConfigError(runtime, error, input.restoreSession ? {restoreSession: true} : {
                    userEntryId: input.userEntryID,
                });
            }
        },
    } satisfies AgentConversationObserver;
}

/** 确保持久化 native 会话已有对应的长生命周期订阅。 */
async function ensureSessionEventSubscription(runtime: AgentChatRuntime) {
    // session-event admission 只在新会话尚无 canonical 修订时执行一次初始化保存。
    if (runtime.sessionPorts.repository.getRevision(runtime.sessionId) < 1) {
        await saveSession(runtime, undefined, true);
    }
    const controller = requireConversationController(runtime);
    const state = controller.state;
    // 会话或目标刚切换时重新激活完整 controller，确保旧订阅和迟到事件被 activation 隔离。
    if (state.sessionID !== runtime.sessionId || state.adapter.kind !== runtime.conversationKind) {
        await controller.activate(runtime.conversationKind, runtime.sessionId);
        return;
    }
    if (!state.connected) {
        await controller.refresh();
        await controller.connect();
    }
}

/** 为新 admission、排队编辑和重新生成建立稳定身份字段。 */
function createSessionEventIdentity(
    runtime: AgentChatRuntime,
    options: Readonly<{userEntryID?: string; inputID?: string; delivery?: "queue" | "steer" | "turn";
        regenerate?: boolean}>,
) {
    const editingInputID = options.regenerate ? "" : runtime.editingQueueInputID;
    // 重试提交必须复用首次 inputID，服务端按 inputID 幂等去重，避免冲突重试造成重复执行。
    const inputID = options.inputID || editingInputID || runtime.sessionPorts.repository.newSessionId();
    const userEntryID = options.userEntryID || runtime.sessionPorts.repository.newSessionId();
    const identity = {
        inputID,
        userEntryID,
        ...(editingInputID ? {delivery: "queue" as const} : {}),
        ...(options.delivery ? {delivery: options.delivery} : {}),
        ...(options.regenerate ? {regenerate: true} : {}),
    };
    return {editingInputID, identity};
}

/** 提交由独立会话事件流投影的输入，admission 前不写入主历史。 */
async function submitSessionEventInput(
    runtime: AgentChatRuntime,
    request: NonNullable<ReturnType<typeof collectAgentChatSendData>>,
    options: Readonly<{userEntryID?: string; inputID?: string; delivery?: "queue" | "steer" | "turn";
        regenerate?: boolean}> = {},
    retried = false,
) {
    await ensureSessionEventSubscription(runtime);
    const conversationController = requireConversationController(runtime);
    const controller = new AbortController();
    runtime.abortController = controller;
    const {editingInputID, identity} = createSessionEventIdentity(runtime, options);
    const input = createConversationInput(runtime, request, identity);
    try {
        // 编辑命令保留既有 inputID 和稳定 EntryID，版本竞争完全由 Kernel 线性化。
        if (editingInputID) {
            await conversationController.updateQueue({
                input,
                queueVersion: conversationController.state.queueVersion,
            }, controller.signal);
            runtime.editingQueueInputID = "";
        }
        // 非编辑提交才建立新的 admission；两个路径共享后续 Composer 收尾。
        if (!editingInputID) {
            await conversationController.submit(input, {
                /** native 消息由独立 session stream 投影，请求级观察器不重复消费事件。 */
                onEvent: () => undefined,
                /** admission 错误由当前 try/catch 统一呈现，请求级观察器保持无副作用。 */
                onError: () => undefined,
            }, controller.signal);
        }
        runtime.composer?.clear();
        runtime.promptSourceController.closeActions();
        return true;
    } catch (error) {
        // 多面板展示同一会话时本地修订可能落后于磁盘权威值：先用权威会话刷新修订，
        // 再以同一输入幂等重试一次（复用首次 inputID，服务端按 inputID 去重），仍失败才提示用户。
        if (!retried && isAgentConversationRevisionConflict(error)) {
            await runtime.sessionPorts.repository.load(runtime.sessionId);
            return submitSessionEventInput(runtime, request, {
                ...options,
                inputID: identity.inputID,
                userEntryID: identity.userEntryID,
                ...(identity.delivery ? {delivery: identity.delivery} : {}),
            }, true);
        }
        const message = error instanceof Error ? error.message : String(error);
        runtime.capabilities.showMessage?.(message, 4000);
        return false;
    } finally {
        // 会话切换可能已经安装新的控制器，只清除本次 admission 仍持有的取消句柄。
        if (runtime.abortController === controller) {
            runtime.abortController = null;
        }
    }
}

/** 在重新生成 admission 失败时恢复空闲控件，成功时等待权威 turn 事件接管。 */
function settleRegenerationAdmission(runtime: AgentChatRuntime, admitted: boolean) {
    if (!admitted) {
        setStreaming(runtime, false);
    }
}

/** 判断提交失败是否为会话修订冲突（多面板并发保存/提交导致的 CAS 冲突）。 */
function isAgentConversationRevisionConflict(error: unknown) {
    if (isAgentConversationControlError(error)) {
        return error.status === 409 && error.reason === "session_revision_conflict";
    }
    return error instanceof Error && error.message.includes("revision conflict");
}

/** 提交由 adapter 请求自身产生增量事件的普通 turn。 */
async function submitRequestStreamInput(
    runtime: AgentChatRuntime,
    request: NonNullable<ReturnType<typeof collectAgentChatSendData>>,
) {
    const conversationController = requireConversationController(runtime);
    const userEntryID = await startOutgoingAgentTurn(runtime, request);
    if (!userEntryID) {
        return;
    }
    const context = createAgentChatRequestContext(runtime);
    const inputID = runtime.sessionPorts.repository.newSessionId();
    const input = createConversationInput(runtime, request, {inputID, userEntryID});
    const observer = createConversationObserver(runtime, {
        userEntryID,
        conversation: context.conversation,
        signal: context.signal,
    });
    await conversationController.submit(input, observer, context.signal);
}

/** 依据 adapter 能力选择 session-event admission 或请求内流式提交。 */
export async function submitAgentChatConversation(
    runtime: AgentChatRuntime,
    request: NonNullable<ReturnType<typeof collectAgentChatSendData>>,
) {
    const conversationController = requireConversationController(runtime);
    // usesSessionEvents 明确表示 admission 与消息投影分离，主历史必须等待权威晋升事件。
    if (conversationController.state.adapter.capabilities.usesSessionEvents) {
        await submitSessionEventInput(runtime, request);
        return;
    }
    await submitRequestStreamInput(runtime, request);
}

/** 重新生成已有用户条目，并继续通过活动 adapter 的唯一提交边界执行。 */
export async function submitAgentChatRegeneration(
    runtime: AgentChatRuntime,
    request: NonNullable<ReturnType<typeof collectAgentChatSendData>>,
    userEntryID: string,
) {
    const conversationController = requireConversationController(runtime);
    const usesSessionEvents = conversationController.state.adapter.capabilities.usesSessionEvents;
    if (usesSessionEvents) {
        const admitted = await submitSessionEventInput(runtime, request, {userEntryID, regenerate: true});
        settleRegenerationAdmission(runtime, admitted);
        return;
    }
    setStreaming(runtime, true);
    const context = createAgentChatRequestContext(runtime);
    const inputID = runtime.sessionPorts.repository.newSessionId();
    const input = createConversationInput(runtime, request, {
        inputID, userEntryID, delivery: "turn", regenerate: true,
    });
    const observer = createConversationObserver(runtime, {
        userEntryID,
        conversation: context.conversation,
        signal: context.signal,
        restoreSession: true,
    });
    await conversationController.submit(input, observer, context.signal);
}
