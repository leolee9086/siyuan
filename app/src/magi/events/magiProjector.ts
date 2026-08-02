/**
 * MAGI 事件到界面状态的总投影器。
 *
 * 本文件只保留回复/轮次生命周期与订阅装配；监控、投票和工具语义由 projector 子模块负责。
 */

/** 用途：取消订阅契约。使用范围：投影器生命周期返回值。解耦评估：仅用于静态类型。 */
import type { EventUnsubscribe } from "../../util/lib/events/eventEmitter.types";
/** 用途：共识消息事件。使用范围：主消息流投影。解耦评估：仅用于静态类型。 */
import type { MagiConsensusEmittedEvent } from "./magiEventBus.types";
/** 用途：上下文裁剪事件。使用范围：贤人活动投影。解耦评估：仅用于静态类型。 */
import type { MagiContextHistoryTrimmedEvent } from "./magiEventBus.types";
/** 用途：事件订阅端口。使用范围：投影器装配。解耦评估：仅用于静态类型。 */
import type { MagiEventBus } from "./magiEventBus.types";
/** 用途：LLM 请求事件。使用范围：原始监控投影。解耦评估：仅用于静态类型。 */
import type { MagiLLMRequestSentEvent } from "./magiEventBus.types";
/** 用途：轮次失败事件。使用范围：错误活动投影。解耦评估：仅用于静态类型。 */
import type { MagiRoundFailedEvent } from "./magiEventBus.types";
/** 用途：轮次开始事件。使用范围：原始监控投影。解耦评估：仅用于静态类型。 */
import type { MagiRoundStartedEvent } from "./magiEventBus.types";
/** 用途：运行态事件。使用范围：Trinity 监控投影。解耦评估：仅用于静态类型。 */
import type { MagiRuntimeStatusUpdatedEvent } from "./magiEventBus.types";
/** 用途：回复增量事件。使用范围：流式消息原位更新。解耦评估：仅用于静态类型。 */
import type { MagiSeelReplyChunkEvent } from "./magiEventBus.types";
/** 用途：回复完成事件。使用范围：流式消息收尾。解耦评估：仅用于静态类型。 */
import type { MagiSeelReplyCompletedEvent } from "./magiEventBus.types";
/** 用途：回复失败事件。使用范围：错误活动投影。解耦评估：仅用于静态类型。 */
import type { MagiSeelReplyFailedEvent } from "./magiEventBus.types";
/** 用途：回复开始事件。使用范围：用户输入和流消息初始化。解耦评估：仅用于静态类型。 */
import type { MagiSeelReplyStartedEvent } from "./magiEventBus.types";
/** 用途：主导统合事件。使用范围：原始监控投影。解耦评估：仅用于静态类型。 */
import type { MagiSynthesisCompletedEvent } from "./magiEventBus.types";
/** 用途：投影幂等状态。使用范围：全部事件处理器。解耦评估：仅用于静态类型。 */
import type { MagiProjectorRuntimeState } from "./magiProjector.types";
/** 用途：投影目标容器。使用范围：绑定入口。解耦评估：仅用于静态类型。 */
import type { MagiProjectorTarget } from "./magiProjector.types";
/** 用途：用户消息契约。使用范围：回复开始投影。解耦评估：仅用于静态类型。 */
import type { MagiMessage } from "../utils/messageFactory.types";
/** 用途：创建绑定独享状态。使用范围：投影器初始化。解耦评估：共享模块集中幂等状态规则，不适合重复实现。 */
import { createRuntimeState } from "./projector/magiProjector.shared";
/** 用途：构造稳定消息 ID。使用范围：回复与裁剪活动。解耦评估：共享模块统一 ID 规则，避免跨投影冲突。 */
import { buildProjectedMessageId } from "./projector/magiProjector.shared";
/** 用途：解析贤者身份。使用范围：回复与裁剪活动。解耦评估：共享模块统一后端别名兼容。 */
import { findSeelByName } from "./projector/magiProjector.shared";
/** 用途：枚举三贤人卡片。使用范围：轮次失败收尾。解耦评估：共享模块统一排除 Trinity。 */
import { listSageSeels } from "./projector/magiProjector.shared";
/** 用途：写入原始诊断事件。使用范围：全部生命周期处理器。解耦评估：共享模块确保只进入 Trinity。 */
import { projectRawEventToMonitor } from "./projector/magiProjector.shared";
/** 用途：事件幂等登记。使用范围：全部生命周期处理器。解耦评估：共享状态必须集中维护。 */
import { shouldProcessEvent } from "./projector/magiProjector.shared";
/** 用途：稳定排序并原位更新消息。使用范围：回复与错误活动。解耦评估：共享模块统一流式顺序。 */
import { upsertMessage } from "./projector/magiProjector.shared";
/** 用途：保留流式思考快照。使用范围：回复增量与完成事件。解耦评估：回复持久化规则由专用模块维护。 */
import { preserveReplyThinking } from "./projector/magiProjector.reply";
/** 用途：审慎信号处理器。使用范围：事件订阅装配。解耦评估：工具模块拥有审慎工具语义。 */
import { projectDeliberationSignal } from "./projector/magiProjector.tool";
/** 用途：工具生命周期处理器。使用范围：事件订阅装配。解耦评估：工具模块拥有单条活动更新规则。 */
import { projectSeelToolActivity } from "./projector/magiProjector.tool";
/** 用途：工具调用处理器。使用范围：事件订阅装配。解耦评估：工具模块拥有包装器解析规则。 */
import { projectToolCall } from "./projector/magiProjector.tool";
/** 用途：投票处理器。使用范围：事件订阅装配。解耦评估：投票模块拥有快照聚合规则。 */
import { projectVoteUpdated } from "./projector/magiProjector.vote";

/** 投影贤者开始回复事件。 */
function projectSeelReplyStarted(
    state: MagiProjectorRuntimeState,
    event: MagiSeelReplyStartedEvent,
) {
    if (!shouldProcessEvent(state, event.eventId)) {
        return;
    }
    projectRawEventToMonitor(state, "SEEL_REPLY_STARTED", event);
    const seel = findSeelByName(state.target.seels, event.seelName, event.displayName);
    if (!seel) {
        return;
    }
    seel.loading = true;
    const userMessage: MagiMessage = {
        id: buildProjectedMessageId(event.eventId, "user"),
        type: "user",
        content: event.userInput,
        status: "success",
        timestamp: event.timestamp,
    };
    upsertMessage(seel.messages, userMessage);
    upsertMessage(seel.messages, event.streamMessage);
}

/** 投影贤者流式增量事件。 */
function projectSeelReplyChunk(
    state: MagiProjectorRuntimeState,
    event: MagiSeelReplyChunkEvent,
) {
    if (!shouldProcessEvent(state, event.eventId)) {
        return;
    }
    projectRawEventToMonitor(state, "SEEL_REPLY_CHUNK", event);
    const seel = findSeelByName(state.target.seels, event.seelName, event.displayName);
    if (seel) {
        upsertMessage(seel.messages, preserveReplyThinking(seel.messages, event.message));
    }
}

/** 投影贤者回复完成事件。 */
function projectSeelReplyCompleted(
    state: MagiProjectorRuntimeState,
    event: MagiSeelReplyCompletedEvent,
) {
    if (!shouldProcessEvent(state, event.eventId)) {
        return;
    }
    projectRawEventToMonitor(state, "SEEL_REPLY_COMPLETED", event);
    const seel = findSeelByName(state.target.seels, event.seelName, event.displayName);
    if (!seel) {
        return;
    }
    seel.loading = false;
    upsertMessage(seel.messages, preserveReplyThinking(seel.messages, event.message));
}

/** 投影贤者回复失败事件。 */
function projectSeelReplyFailed(
    state: MagiProjectorRuntimeState,
    event: MagiSeelReplyFailedEvent,
) {
    if (!shouldProcessEvent(state, event.eventId)) {
        return;
    }
    projectRawEventToMonitor(state, "SEEL_REPLY_FAILED", event);
    const seel = findSeelByName(state.target.seels, event.seelName, event.displayName);
    if (!seel) {
        return;
    }
    seel.loading = false;
    upsertMessage(seel.messages, {
        id: buildProjectedMessageId(event.eventId, "error"),
        type: "error",
        content: event.error,
        status: "error",
        timestamp: event.timestamp,
    });
}

/** 投影主消息流事件。 */
function projectConsensusMessage(
    state: MagiProjectorRuntimeState,
    event: MagiConsensusEmittedEvent,
) {
    if (!shouldProcessEvent(state, event.eventId)) {
        return;
    }
    projectRawEventToMonitor(state, "CONSENSUS_EMITTED", event);
    upsertMessage(state.target.consensusMessages, event.message);
}

/** 投影轮次开始事件到 Trinity 原始监控流。 */
function projectRoundStarted(state: MagiProjectorRuntimeState, event: MagiRoundStartedEvent) {
    // 首次看到该事件时写入诊断流，重复推送由幂等集合忽略。
    if (shouldProcessEvent(state, event.eventId)) {
        projectRawEventToMonitor(state, "ROUND_STARTED", event);
    }
}

/** 投影 LLM 请求发送事件到 Trinity 原始监控流。 */
function projectLLMRequestSent(state: MagiProjectorRuntimeState, event: MagiLLMRequestSentEvent) {
    // LLM 请求只保留诊断证据，不在贤人卡片制造原子活动。
    if (shouldProcessEvent(state, event.eventId)) {
        projectRawEventToMonitor(state, "LLM_REQUEST_SENT", event);
    }
}

/** 投影统合完成事件到 Trinity 原始监控流。 */
function projectSynthesisCompleted(
    state: MagiProjectorRuntimeState,
    event: MagiSynthesisCompletedEvent,
) {
    // 统合完成只保留诊断证据，最终内容由共识事件写入主消息流。
    if (shouldProcessEvent(state, event.eventId)) {
        projectRawEventToMonitor(state, "DOMINANT_SYNTHESIS_COMPLETED", event);
    }
}

/** 投影轮次失败事件并结束所有贤人加载状态。 */
function projectRoundFailed(state: MagiProjectorRuntimeState, event: MagiRoundFailedEvent) {
    if (!shouldProcessEvent(state, event.eventId)) {
        return;
    }
    projectRawEventToMonitor(state, "ROUND_FAILED", event);
    for (const seel of listSageSeels(state.target.seels)) {
        seel.loading = false;
        upsertMessage(seel.messages, {
            id: `${event.roundId}-round-failed`,
            type: "error",
            content: `本轮处理失败: ${event.error}`,
            status: "error",
            timestamp: event.timestamp,
            meta: {
                type: "round-failed",
                roundId: event.roundId,
            },
        });
    }
}

/** 投影上下文裁剪事件到对应贤者卡片。 */
function projectContextHistoryTrimmed(
    state: MagiProjectorRuntimeState,
    event: MagiContextHistoryTrimmedEvent,
) {
    if (!shouldProcessEvent(state, event.eventId)) {
        return;
    }
    projectRawEventToMonitor(state, "CONTEXT_HISTORY_TRIMMED", event);
    const seel = findSeelByName(state.target.seels, event.seelName, event.displayName);
    if (!seel) {
        return;
    }
    upsertMessage(seel.messages, {
        id: buildProjectedMessageId(event.eventId, "context-trimmed"),
        type: "system",
        content: `上下文已整理: ${event.beforeCount} 条 -> ${event.afterCount} 条，移除 ${event.droppedCount} 条历史`,
        status: "success",
        timestamp: event.timestamp,
        meta: {
            type: "context-trimmed",
            roundId: event.roundId,
            beforeCount: event.beforeCount,
            afterCount: event.afterCount,
            droppedCount: event.droppedCount,
            ...(event.strategyType ? { strategyType: event.strategyType } : {}),
        },
    });
}

/** 投影全局运行态更新事件到监控卡片。 */
function projectRuntimeStatusUpdated(
    state: MagiProjectorRuntimeState,
    event: MagiRuntimeStatusUpdatedEvent,
) {
    // 运行态事件也复用统一 Trinity 原始监控投影，不进入三贤人活动卡片。
    if (shouldProcessEvent(state, event.eventId)) {
        projectRawEventToMonitor(state, "RUNTIME_STATUS_UPDATED", event);
    }
}

/** 注册贤者事件订阅。 */
function registerSeelSubscriptions(
    eventBus: MagiEventBus,
    state: MagiProjectorRuntimeState,
    subscriptions: EventUnsubscribe[],
) {
    subscriptions.push(eventBus.subscribe("ROUND_STARTED", projectRoundStarted.bind(null, state)));
    subscriptions.push(eventBus.subscribe("LLM_REQUEST_SENT", projectLLMRequestSent.bind(null, state)));
    subscriptions.push(eventBus.subscribe("SEEL_REPLY_STARTED", projectSeelReplyStarted.bind(null, state)));
    subscriptions.push(eventBus.subscribe("SEEL_REPLY_CHUNK", projectSeelReplyChunk.bind(null, state)));
    subscriptions.push(eventBus.subscribe("SEEL_REPLY_COMPLETED", projectSeelReplyCompleted.bind(null, state)));
    subscriptions.push(eventBus.subscribe("SEEL_REPLY_FAILED", projectSeelReplyFailed.bind(null, state)));
    subscriptions.push(eventBus.subscribe("SEEL_VOTE_UPDATED", projectVoteUpdated.bind(null, state)));
    subscriptions.push(eventBus.subscribe("DOMINANT_SYNTHESIS_COMPLETED", projectSynthesisCompleted.bind(null, state)));
    subscriptions.push(eventBus.subscribe("ROUND_FAILED", projectRoundFailed.bind(null, state)));
    subscriptions.push(eventBus.subscribe("DELIBERATION_SIGNAL_RAISED", projectDeliberationSignal.bind(null, state)));
    subscriptions.push(eventBus.subscribe("TOOL_CALL_DETECTED", projectToolCall.bind(null, state)));
    subscriptions.push(eventBus.subscribe("SEEL_TOOL_ACTIVITY_UPDATED", projectSeelToolActivity.bind(null, state)));
    subscriptions.push(eventBus.subscribe("CONTEXT_HISTORY_TRIMMED", projectContextHistoryTrimmed.bind(null, state)));
    subscriptions.push(eventBus.subscribe("RUNTIME_STATUS_UPDATED", projectRuntimeStatusUpdated.bind(null, state)));
}

/** 构造统一取消订阅函数。 */
function composeUnsubscribe(subscriptions: EventUnsubscribe[]) {
    return () => {
        for (const unsubscribe of subscriptions) {
            unsubscribe();
        }
    };
}

/** 订阅事件并把状态投影到 UI 容器。 */
export async function bindMagiProjector(
    eventBus: MagiEventBus,
    target: MagiProjectorTarget,
) {
    const state = createRuntimeState(target);
    const subscriptions: EventUnsubscribe[] = [];
    registerSeelSubscriptions(eventBus, state, subscriptions);
    subscriptions.push(eventBus.subscribe("CONSENSUS_EMITTED", projectConsensusMessage.bind(null, state)));
    return composeUnsubscribe(subscriptions);
}
