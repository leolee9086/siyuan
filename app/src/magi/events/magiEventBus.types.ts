/** 用途：EventUnsubscribe 事件取消订阅类型。使用范围：MAGI 事件总线定义。解耦评估：类型导入，不涉及运行时耦合。 */
import type { EventUnsubscribe } from "../../util/lib/events/eventEmitter.types";
/** 用途：MagiMessage 消息视图类型。使用范围：MAGI 事件载荷定义。解耦评估：类型导入，不涉及运行时耦合。 */
import type { MagiMessage } from "../utils/messageFactory.types";

/** 导出 MagiEventName：MAGI 系统所有已知事件名称的联合类型，用于约束事件发射和监听的名称参数。 */
export type MagiEventName =
    | "ROUND_STARTED"
    | "LLM_REQUEST_SENT"
    | "SEEL_REPLY_STARTED"
    | "SEEL_REPLY_CHUNK"
    | "SEEL_REPLY_COMPLETED"
    | "SEEL_REPLY_FAILED"
    | "SEEL_VOTE_UPDATED"
    | "DOMINANT_SYNTHESIS_COMPLETED"
    | "CONSENSUS_EMITTED"
    | "ROUND_FAILED"
    | "TOOL_CALL_DETECTED"
    | "DELIBERATION_SIGNAL_RAISED"
    | "CONTEXT_HISTORY_TRIMMED"
    | "RUNTIME_STATUS_UPDATED";

/** 事件公共字段。 */
export interface MagiEventBase {
    eventId: string;
    seq: number;
    roundId: string;
    timestamp: number;
}

/** 新一轮共识开始事件。 */
export interface MagiRoundStartedEvent extends MagiEventBase {
    userInput: string;
}

/** 贤者开始回复事件（含流式占位消息）。 */
export interface MagiSeelReplyStartedEvent extends MagiEventBase {
    seelName: string;
    displayName: string;
    userInput: string;
    streamMessage: MagiMessage;
}

/** LLM 请求发送事件。 */
export interface MagiLLMRequestSentEvent extends MagiEventBase {
    seelName: string;
    displayName: string;
    model: string;
    messages: unknown[];
    toolCount: number;
}

/** 贤者流式增量事件。 */
export interface MagiSeelReplyChunkEvent extends MagiEventBase {
    seelName: string;
    displayName: string;
    message: MagiMessage;
}

/** 贤者回复完成事件。 */
export interface MagiSeelReplyCompletedEvent extends MagiEventBase {
    seelName: string;
    displayName: string;
    message: MagiMessage;
}

/** 贤者回复失败事件。 */
export interface MagiSeelReplyFailedEvent extends MagiEventBase {
    seelName: string;
    displayName: string;
    error: string;
}

/** 投票进度/结果更新事件。 */
export interface MagiSeelVoteUpdatedEvent extends MagiEventBase {
    progress?: number;
    details?: Array<{ name: string; decision: string; reason?: string }>;
    proposedAction?: string;
    passed?: boolean;
    seelName?: string;
    displayName?: string;
    decision?: "批准" | "否决";
    decisionReason?: string;
    reason?: string;
    round?: number;
    error?: string;
    deliberationInitiator?: string;
    deliberationReason?: string;
}

/** 统合完成事件。 */
export interface MagiSynthesisCompletedEvent extends MagiEventBase {
    content: string;
}

/** 主消息流产出事件。 */
export interface MagiConsensusEmittedEvent extends MagiEventBase {
    message: MagiMessage;
}

/** 轮次失败事件。 */
export interface MagiRoundFailedEvent extends MagiEventBase {
    error: string;
}

/** 通用工具调用检测事件（支持增量参数）。 */
export interface MagiToolCallDetectedEvent extends MagiEventBase {
    seelName: string;
    displayName: string;
    toolName: string;
    toolCallIndex: number;
    toolCallId: string;
    rawArguments: string;
    argumentsComplete: boolean;
    arguments?: Record<string, unknown>;
}

/** 审慎决策信号事件。 */
export interface MagiDeliberationSignalRaisedEvent extends MagiEventBase {
    initiator: string;
    displayName: string;
    reason: string;
    requiresDeliberation: boolean;
}

/** 上下文历史裁剪事件。 */
export interface MagiContextHistoryTrimmedEvent extends MagiEventBase {
    seelName: string;
    displayName: string;
    beforeCount: number;
    afterCount: number;
    droppedCount: number;
    strategyType?: string;
    strategyCount?: number;
    strategyPercent?: number;
}

/** MAGI 全局运行态更新事件。 */
export interface MagiRuntimeStatusUpdatedEvent extends MagiEventBase {
    state: "sleeping" | "heartbeat" | "external";
    awake: boolean;
    wakeSource?: string;
    reason?: string;
    dominantSeel?: string;
    dominantStance?: string;
    dominantUpdatedAt?: number;
    currentRoundId?: string;
    currentTask?: string;
    lastHeartbeatAt?: number;
    lastWakeAt?: number;
    lastSleepAt?: number;
    lastSleepSummary?: string;
    updatedAt?: number;
}

/** MAGI 事件载荷映射。 */
export interface MagiEventPayloadMap {
    ROUND_STARTED: MagiRoundStartedEvent;
    LLM_REQUEST_SENT: MagiLLMRequestSentEvent;
    SEEL_REPLY_STARTED: MagiSeelReplyStartedEvent;
    SEEL_REPLY_CHUNK: MagiSeelReplyChunkEvent;
    SEEL_REPLY_COMPLETED: MagiSeelReplyCompletedEvent;
    SEEL_REPLY_FAILED: MagiSeelReplyFailedEvent;
    SEEL_VOTE_UPDATED: MagiSeelVoteUpdatedEvent;
    DOMINANT_SYNTHESIS_COMPLETED: MagiSynthesisCompletedEvent;
    CONSENSUS_EMITTED: MagiConsensusEmittedEvent;
    ROUND_FAILED: MagiRoundFailedEvent;
    TOOL_CALL_DETECTED: MagiToolCallDetectedEvent;
    DELIBERATION_SIGNAL_RAISED: MagiDeliberationSignalRaisedEvent;
    CONTEXT_HISTORY_TRIMMED: MagiContextHistoryTrimmedEvent;
    RUNTIME_STATUS_UPDATED: MagiRuntimeStatusUpdatedEvent;
}

/** 对外暴露的 MAGI 事件总线接口。 */
export interface MagiEventBus {
    emitWithMeta<K extends MagiEventName>(
        event: K,
        payload: MagiEventPayloadMap[K],
    ): boolean;
    subscribe<K extends MagiEventName>(
        event: K,
        listener: (payload: MagiEventPayloadMap[K]) => void | Promise<void>,
    ): EventUnsubscribe;
}
