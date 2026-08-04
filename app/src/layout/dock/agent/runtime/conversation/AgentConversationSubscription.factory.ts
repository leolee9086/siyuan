/** 用途：约束 controller 共享依赖；使用范围：订阅生命周期。 */
import type {AgentConversationControllerRuntime} from "./agentConversation.types";
/** 用途：约束会话事件；使用范围：游标去重与投影。 */
import type {AgentConversationSessionEvent} from "./agentConversation.types";
/** 用途：校验 HTTP queue 快照；使用范围：激活和重同步；解耦评估：纯守卫集中协议边界。 */
import {readAgentConversationQueueSnapshot} from "./AgentConversationEvent.guard";
/** 用途：应用 queue 版本；使用范围：权威刷新；解耦评估：状态命令显式接收 runtime，不持有全局实例。 */
import {applyAgentConversationQueueSnapshot} from "./AgentConversationController.state";
/** 用途：路由可注册状态 reducer；使用范围：事件处理；解耦评估：注册表避免协议 type 分支扩散。 */
import {reduceAgentConversationState} from "./AgentConversationController.state";
/** 用途：识别结构化控制错误；使用范围：断线后的版本恢复；解耦评估：纯守卫不持有网络状态。 */
import {isAgentConversationControlError} from "./imports";

/**
 * 判断异步回调是否仍属于当前 session activation。
 * @同步豁免: 生命周期 - 每个异步边界恢复时必须立即核对 activation，任何 await 都会扩大迟到事件写入新会话的窗口。
 */
export function isActiveAgentConversation(runtime: AgentConversationControllerRuntime, activation: number) {
    return !runtime.state.disposed && runtime.state.activation === activation;
}

/**
 * 清理当前订阅和等待中的重连定时器。
 * @同步豁免: 生命周期 - 会话切换与 dispose 必须在递增 activation 后立即撤销旧资源，避免迟到事件跨会话投影。
 */
export function stopAgentConversationSubscription(runtime: AgentConversationControllerRuntime) {
    runtime.state.subscriptionController?.abort();
    runtime.state.subscriptionController = null;
    // 已安排重连时同步取消，确保旧 session 不会在新 activation 中重新订阅。
    if (runtime.state.reconnectTimer) {
        globalThis.clearTimeout(runtime.state.reconnectTimer);
        runtime.state.reconnectTimer = 0;
    }
    runtime.state.connected = false;
}

/** 读取一次权威 queue snapshot，并只接受不落后的版本。 */
export async function refreshAgentConversationController(runtime: AgentConversationControllerRuntime) {
    const activation = runtime.state.activation;
    const loadQueue = runtime.state.adapter.loadQueue;
    if (runtime.state.disposed || !runtime.state.sessionID || !loadQueue) {
        return;
    }
    const snapshot = await loadQueue(runtime.state.sessionID, runtime.hooks.requestHeaders);
    const validated = readAgentConversationQueueSnapshot(snapshot);
    if (!validated || !isActiveAgentConversation(runtime, activation)) {
        return;
    }
    // 只有快照推进或追平本地版本时才通知 UI，迟到响应保持静默。
    if (applyAgentConversationQueueSnapshot(runtime, validated)) {
        runtime.hooks.onStateChange(runtime.state);
    }
}

/** 处理单个事件：先做 session/seq 仲裁，再交给 reducer 或消息投影。 */
export async function processAgentConversationEvent(
    runtime: AgentConversationControllerRuntime,
    event: AgentConversationSessionEvent,
    activation: number,
) {
    if (!isActiveAgentConversation(runtime, activation) || event.sessionID !== runtime.state.sessionID ||
        event.eventSeq <= runtime.state.eventSeq) {
        return;
    }
    runtime.state.eventSeq = event.eventSeq;
    // Hub 明确要求重同步时先恢复 queue，再重载上游兼容会话投影。
    if (event.type === "resync_required") {
        await refreshAgentConversationController(runtime);
        await runtime.hooks.onResync(runtime.state.sessionID);
        runtime.hooks.onStateChange(runtime.state);
        return;
    }
    // 状态协议由注册 reducer 消费，其余 provider/消息事件交给 AgentChat 投影端口。
    if (!reduceAgentConversationState(runtime, event)) {
        await runtime.hooks.onEvent(event);
    }
}

/** 启动一次事件流，断开后仅为仍活动的 session 排队重连。 */
export async function runAgentConversationSubscription(
    runtime: AgentConversationControllerRuntime,
    activation: number,
    controller: AbortController,
) {
    const subscribe = runtime.state.adapter.subscribe;
    if (!subscribe) {
        return;
    }
    try {
        await subscribe({
            sessionID: runtime.state.sessionID,
            after: runtime.state.eventSeq,
            signal: controller.signal,
            requestHeaders: runtime.hooks.requestHeaders,
            /** 每帧按顺序进入实例级游标仲裁。 */
            onEvent: (event) => processAgentConversationEvent(runtime, event, activation),
        });
    } catch (error) {
        if (controller.signal.aborted || !isActiveAgentConversation(runtime, activation)) {
            return;
        }
        // 版本冲突包含可用于恢复的较新 queueVersion，先读取权威快照再进入重连。
        if (isAgentConversationControlError(error) && error.queueVersion > runtime.state.queueVersion) {
            await refreshAgentConversationController(runtime);
        }
    }
    if (controller.signal.aborted || !isActiveAgentConversation(runtime, activation)) {
        return;
    }
    // SSE 断线没有确定性的完成事件；固定退避仅用于外部网络重连，时长由 controller 组合参数提供。
    runtime.state.reconnectTimer = globalThis.setTimeout(() => {
        runtime.state.reconnectTimer = 0;
        void connectAgentConversationController(runtime);
    }, runtime.reconnectDelayMs);
}

/** 按当前 eventSeq 建立新订阅；调用方保证 session 已经持久化。 */
export async function connectAgentConversationController(runtime: AgentConversationControllerRuntime) {
    if (runtime.state.disposed || !runtime.state.sessionID ||
        !runtime.state.adapter.capabilities.usesSessionEvents || !runtime.state.adapter.subscribe) {
        return;
    }
    stopAgentConversationSubscription(runtime);
    const controller = new AbortController();
    const activation = runtime.state.activation;
    runtime.state.subscriptionController = controller;
    runtime.state.connected = true;
    void runAgentConversationSubscription(runtime, activation, controller);
}
