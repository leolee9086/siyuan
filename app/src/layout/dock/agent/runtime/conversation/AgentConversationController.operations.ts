/** 用途：约束 activation 选项；使用范围：会话切换。 */
import type {AgentConversationActivationOptions} from "./agentConversation.types";
/** 用途：约束 controller 共享依赖；使用范围：全部操作。 */
import type {AgentConversationControllerRuntime} from "./agentConversation.types";
/** 用途：约束 turn 中断；使用范围：adapter 命令。 */
import type {AgentConversationInterruptInput} from "./agentConversation.types";
/** 用途：约束提交观察器；使用范围：adapter submit。 */
import type {AgentConversationObserver} from "./agentConversation.types";
/** 用途：约束 queue 身份；使用范围：取消命令。 */
import type {AgentConversationQueueIdentity} from "./agentConversation.types";
/** 用途：约束 queue 编辑；使用范围：更新命令。 */
import type {AgentConversationQueueMutation} from "./agentConversation.types";
/** 用途：约束 queue 提升；使用范围：steer 转换。 */
import type {AgentConversationQueuePromotion} from "./agentConversation.types";
/** 用途：约束统一输入；使用范围：adapter submit。 */
import type {AgentConversationSubmitInput} from "./agentConversation.types";
/** 用途：约束目标键；使用范围：adapter 解析。 */
import type {AgentPanelConversationKind} from "./imports";
/** 用途：应用 admission；使用范围：HTTP/事件乱序对账；解耦评估：状态函数显式接收 runtime。 */
import {applyAgentConversationAdmission} from "./AgentConversationController.state";
/** 用途：创建乐观 queue 项；使用范围：提交即时反馈；解耦评估：纯投影不访问 DOM。 */
import {createOptimisticQueueItem} from "./AgentConversationController.state";
/** 用途：建立事件订阅；使用范围：激活和首条提交；解耦评估：订阅生命周期独立模块所有。 */
import {connectAgentConversationController} from "./AgentConversationSubscription.factory";
/** 用途：重载权威 queue；使用范围：激活和冲突恢复；解耦评估：协议读取独立模块所有。 */
import {refreshAgentConversationController} from "./AgentConversationSubscription.factory";
/** 用途：释放旧订阅；使用范围：会话切换和销毁；解耦评估：资源所有权集中在订阅模块。 */
import {stopAgentConversationSubscription} from "./AgentConversationSubscription.factory";
/** 用途：识别控制冲突；使用范围：提交失败后的异步重同步；解耦评估：纯守卫不持有状态。 */
import {isAgentConversationControlError} from "./imports";

/**
 * 统一提交入口，native admission 在事件到达前显示 optimistic queue 项。
 * @参数豁免: 第三方接口适配 - 该边界原样组合 adapter 的 input、observer 与 AbortSignal，runtime 仅由 controller 工厂绑定。
 */
export async function submitAgentConversation(
    runtime: AgentConversationControllerRuntime,
    input: AgentConversationSubmitInput,
    observer: AgentConversationObserver,
    signal: AbortSignal,
) {
    const optimistic = runtime.state.adapter.capabilities.usesSessionEvents;
    if (optimistic) {
        runtime.state.queueItems.push(createOptimisticQueueItem(input));
        runtime.hooks.onStateChange(runtime.state);
    }
    runtime.state.submittingInputIDs.add(input.inputID);
    try {
        const admission = await runtime.state.adapter.submit(input, observer, signal);
        applyAgentConversationAdmission(runtime, admission);
        return admission;
    } catch (error) {
        runtime.state.queueItems = runtime.state.queueItems.filter(
            (item) => item.input.id !== input.inputID || !item.optimistic,
        );
        runtime.hooks.onStateChange(runtime.state);
        // 服务端冲突携带不旧于本地的版本时，异步读取权威队列消除 optimistic 残留。
        if (isAgentConversationControlError(error) && error.queueVersion >= runtime.state.queueVersion) {
            void refreshAgentConversationController(runtime);
        }
        throw error;
    } finally {
        runtime.state.submittingInputIDs.delete(input.inputID);
    }
}

/**
 * 激活新的目标和 session，先丢弃所有旧订阅及迟到回调。
 * @参数豁免: 生命周期 - kind、sessionID 与订阅策略共同定义一次不可拆分的 activation，runtime 由实例工厂预绑定。
 */
export async function activateAgentConversation(
    runtime: AgentConversationControllerRuntime,
    kind: AgentPanelConversationKind,
    sessionID: string,
    options: AgentConversationActivationOptions = {},
) {
    stopAgentConversationSubscription(runtime);
    runtime.state.activation++;
    runtime.state.adapter = runtime.adapters.resolve(kind);
    runtime.state.sessionID = sessionID;
    runtime.state.eventSeq = 0;
    runtime.state.queueVersion = 0;
    runtime.state.queueItems = [];
    runtime.state.turnID = "";
    runtime.state.phase = "idle";
    runtime.state.steerable = false;
    runtime.state.selectedDelivery = "queue";
    runtime.hooks.onStateChange(runtime.state);
    if (options.subscribe === false) {
        return;
    }
    await refreshAgentConversationController(runtime);
    await connectAgentConversationController(runtime);
}

/** 更新 pending queue 项并让权威事件覆盖本地结果。 */
export async function updateAgentConversationQueue(
    runtime: AgentConversationControllerRuntime,
    mutation: AgentConversationQueueMutation,
    signal?: AbortSignal,
) {
    const updateQueue = runtime.state.adapter.updateQueue;
    if (!updateQueue) {
        throw new Error("Queue editing is not supported by the active conversation adapter");
    }
    const admission = await updateQueue(mutation, signal);
    applyAgentConversationAdmission(runtime, admission);
    return admission;
}

/** 取消当前 session 的指定 pending queue 项。 */
export async function cancelAgentConversationQueue(
    runtime: AgentConversationControllerRuntime,
    input: Omit<AgentConversationQueueIdentity, "sessionID">,
    signal?: AbortSignal,
) {
    const cancelQueue = runtime.state.adapter.cancelQueue;
    if (!cancelQueue) {
        throw new Error("Queue cancellation is not supported by the active conversation adapter");
    }
    const admission = await cancelQueue({...input, sessionID: runtime.state.sessionID}, signal);
    applyAgentConversationAdmission(runtime, admission);
    return admission;
}

/** 将当前 queue 项提升到活动 turn 的 steer。 */
export async function promoteAgentConversationQueue(
    runtime: AgentConversationControllerRuntime,
    input: Omit<AgentConversationQueuePromotion, "sessionID">,
    signal?: AbortSignal,
) {
    const promoteQueue = runtime.state.adapter.promoteQueue;
    if (!promoteQueue) {
        throw new Error("Queue promotion is not supported by the active conversation adapter");
    }
    const admission = await promoteQueue({...input, sessionID: runtime.state.sessionID}, signal);
    applyAgentConversationAdmission(runtime, admission);
    return admission;
}

/** 中断当前 turn，并保留未投递 queue。 */
export async function interruptAgentConversation(
    runtime: AgentConversationControllerRuntime,
    input: Omit<AgentConversationInterruptInput, "sessionID">,
    signal?: AbortSignal,
) {
    const interrupt = runtime.state.adapter.interrupt;
    if (!interrupt) {
        throw new Error("Turn interruption is not supported by the active conversation adapter");
    }
    const admission = await interrupt({...input, sessionID: runtime.state.sessionID}, signal);
    applyAgentConversationAdmission(runtime, admission);
    return admission;
}

/**
 * 选择下一次运行中输入的 delivery 方式。
 * @同步豁免: UI构建 - segmented control 的选中态必须在点击调用栈内更新，提交处理器会紧接着读取该状态。
 */
export function setAgentConversationDelivery(runtime: AgentConversationControllerRuntime, delivery: "steer" | "queue") {
    runtime.state.selectedDelivery = delivery;
    runtime.hooks.onStateChange(runtime.state);
}

/**
 * 释放当前实例的网络订阅、重连器和事件接收能力。
 * @同步豁免: 生命周期 - dispose 必须立即封闭事件入口并撤销资源，异步等待会允许迟到事件继续写入已销毁视图。
 */
export function disposeAgentConversationController(runtime: AgentConversationControllerRuntime) {
    if (runtime.state.disposed) {
        return;
    }
    runtime.state.disposed = true;
    runtime.state.activation++;
    stopAgentConversationSubscription(runtime);
    runtime.state.submittingInputIDs.clear();
}
