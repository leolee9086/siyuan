import type { EventUnsubscribe } from "../../util/lib/events/eventEmitter.types";
import type { MagiMessage } from "../utils/messageFactory.types";

/** MAGI 事件名称字典。 */
export type MagiEventName =
    | "ROUND_STARTED"
    | "SEEL_REPLY_STARTED"
    | "SEEL_REPLY_CHUNK"
    | "SEEL_REPLY_COMPLETED"
    | "SEEL_REPLY_FAILED"
    | "SEEL_VOTE_UPDATED"
    | "TRINITY_SYNTHESIS_COMPLETED"
    | "CONSENSUS_EMITTED"
    | "ROUND_FAILED";

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
    details?: Array<{ name: string; decision: string }>;
    proposedAction?: string;
    seelName?: string;
    displayName?: string;
    decision?: "批准" | "否决";
    round?: number;
    error?: string;
}

/** Trinity 统合完成事件。 */
export interface MagiTrinitySynthesisCompletedEvent extends MagiEventBase {
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

/** MAGI 事件载荷映射。 */
export interface MagiEventPayloadMap {
    ROUND_STARTED: MagiRoundStartedEvent;
    SEEL_REPLY_STARTED: MagiSeelReplyStartedEvent;
    SEEL_REPLY_CHUNK: MagiSeelReplyChunkEvent;
    SEEL_REPLY_COMPLETED: MagiSeelReplyCompletedEvent;
    SEEL_REPLY_FAILED: MagiSeelReplyFailedEvent;
    SEEL_VOTE_UPDATED: MagiSeelVoteUpdatedEvent;
    TRINITY_SYNTHESIS_COMPLETED: MagiTrinitySynthesisCompletedEvent;
    CONSENSUS_EMITTED: MagiConsensusEmittedEvent;
    ROUND_FAILED: MagiRoundFailedEvent;
}

/**
 * 事件发布入参（去掉 eventId/seq，由总线统一生成）。
 *
 * 用途：对外暴露 emit/emitAsync 时约束调用方不手工拼接元字段。
 * 使用场景：MagiEventBus.emit/emitAsync 的 payload 参数。
 * 关联类型：由 MagiEventPayloadMap 派生。
 */
export type MagiEventMetaStrippedPayload<K extends MagiEventName> =
    Omit<MagiEventPayloadMap[K], "eventId" | "seq">;

/** 对外暴露的 MAGI 事件总线接口。 */
export interface MagiEventBus {
    emit<K extends MagiEventName>(
        event: K,
        payload: MagiEventMetaStrippedPayload<K>,
    ): boolean;
    emitAsync<K extends MagiEventName>(
        event: K,
        payload: MagiEventMetaStrippedPayload<K>,
    ): Promise<boolean>;
    subscribe<K extends MagiEventName>(
        event: K,
        listener: (payload: MagiEventPayloadMap[K]) => void | Promise<void>,
    ): EventUnsubscribe;
    subscribeOnce<K extends MagiEventName>(
        event: K,
        listener: (payload: MagiEventPayloadMap[K]) => void | Promise<void>,
    ): EventUnsubscribe;
}

/** 单轮消息链路需要的事件上下文。 */
export interface MagiRoundEventContext {
    eventBus: MagiEventBus;
    roundId: string;
}
