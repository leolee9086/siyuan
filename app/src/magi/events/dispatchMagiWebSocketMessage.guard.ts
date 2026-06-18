/**
 * 用途：导入 MAGI 事件名称类型，用于类型守卫函数的参数约束。
 * 使用范围：仅在 isValidMagiEventPayload 函数签名中使用。
 * 解耦评估：无法解耦，类型守卫必须引用事件名称类型以提供类型安全。
 */
import type { MagiEventName } from "./magiEventBus.types";
/**
 * 用途：导入 MAGI 事件载荷映射类型，用于类型守卫的返回类型断言。
 * 使用范围：仅在 isValidMagiEventPayload 函数的返回类型谓词中使用。
 * 解耦评估：无法解耦，类型守卫必须引用载荷映射以正确收窄类型。
 */
import type { MagiEventPayloadMap } from "./magiEventBus.types";

/**
 * 验证 payload 是否包含所有 MAGI 事件共有的基础字段。
 */
function hasBaseFields(payload: Record<string, unknown>): boolean {
    return (
        typeof payload.eventId === "string" &&
        typeof payload.seq === "number" &&
        typeof payload.roundId === "string" &&
        typeof payload.timestamp === "number"
    );
}

/**
 * 验证 ROUND_STARTED 事件的特定字段。
 */
function isRoundStartedPayload(payload: Record<string, unknown>): boolean {
    return typeof payload.userInput === "string";
}

/**
 * 验证 LLM_REQUEST_SENT 事件的特定字段。
 */
function isLlmRequestSentPayload(payload: Record<string, unknown>): boolean {
    return (
        typeof payload.seelName === "string" &&
        typeof payload.displayName === "string" &&
        typeof payload.model === "string" &&
        Array.isArray(payload.messages) &&
        typeof payload.toolCount === "number"
    );
}

/**
 * 验证 SEEL_REPLY_STARTED 事件的特定字段。
 */
function isSeelReplyStartedPayload(payload: Record<string, unknown>): boolean {
    return (
        typeof payload.seelName === "string" &&
        typeof payload.displayName === "string" &&
        typeof payload.userInput === "string" &&
        typeof payload.streamMessage === "object" &&
        payload.streamMessage !== null
    );
}

/**
 * 验证 SEEL_REPLY_CHUNK 事件的特定字段。
 */
function isSeelReplyChunkPayload(payload: Record<string, unknown>): boolean {
    return (
        typeof payload.seelName === "string" &&
        typeof payload.displayName === "string" &&
        typeof payload.message === "object" &&
        payload.message !== null
    );
}

/**
 * 验证 SEEL_REPLY_COMPLETED 事件的特定字段。
 */
function isSeelReplyCompletedPayload(payload: Record<string, unknown>): boolean {
    return (
        typeof payload.seelName === "string" &&
        typeof payload.displayName === "string" &&
        typeof payload.message === "object" &&
        payload.message !== null
    );
}

/**
 * 验证 SEEL_REPLY_FAILED 事件的特定字段。
 */
function isSeelReplyFailedPayload(payload: Record<string, unknown>): boolean {
    return (
        typeof payload.seelName === "string" &&
        typeof payload.displayName === "string" &&
        typeof payload.error === "string"
    );
}

/**
 * 验证 SEEL_VOTE_UPDATED 事件的特定字段。
 * 该事件有多种字段组合：投票开始、投票进度、投票结果、投票失败。
 * 至少需要包含以下字段之一：progress、proposedAction、decision、details、error。
 */
function isSeelVoteUpdatedPayload(payload: Record<string, unknown>): boolean {
    return (
        typeof payload.progress === "number" ||
        typeof payload.proposedAction === "string" ||
        typeof payload.decision === "string" ||
        Array.isArray(payload.details) ||
        typeof payload.error === "string"
    );
}

/**
 * 验证统合完成事件的特定字段。
 */
function isSynthesisCompletedPayload(payload: Record<string, unknown>): boolean {
    return typeof payload.content === "string";
}

/**
 * 验证 CONSENSUS_EMITTED 事件的特定字段。
 */
function isConsensusEmittedPayload(payload: Record<string, unknown>): boolean {
    return typeof payload.message === "object" && payload.message !== null;
}

/**
 * 验证 ROUND_FAILED 事件的特定字段。
 */
function isRoundFailedPayload(payload: Record<string, unknown>): boolean {
    return typeof payload.error === "string";
}

/**
 * 验证 TOOL_CALL_DETECTED 事件的特定字段（支持增量参数）。
 */
function isToolCallDetectedPayload(payload: Record<string, unknown>): boolean {
    return (
        typeof payload.seelName === "string" &&
        typeof payload.displayName === "string" &&
        typeof payload.toolName === "string" &&
        typeof payload.toolCallIndex === "number" &&
        typeof payload.toolCallId === "string" &&
        typeof payload.rawArguments === "string" &&
        typeof payload.argumentsComplete === "boolean" &&
        (payload.arguments === undefined ||
         (typeof payload.arguments === "object" && payload.arguments !== null))
    );
}

/**
 * 验证 DELIBERATION_SIGNAL_RAISED 事件的特定字段。
 */
function isDeliberationSignalRaisedPayload(payload: Record<string, unknown>): boolean {
    return (
        typeof payload.initiator === "string" &&
        typeof payload.displayName === "string" &&
        typeof payload.reason === "string" &&
        typeof payload.requiresDeliberation === "boolean"
    );
}

/**
 * 验证 CONTEXT_HISTORY_TRIMMED 事件的特定字段。
 */
function isContextHistoryTrimmedPayload(payload: Record<string, unknown>): boolean {
    return (
        typeof payload.seelName === "string" &&
        typeof payload.displayName === "string" &&
        typeof payload.beforeCount === "number" &&
        typeof payload.afterCount === "number" &&
        typeof payload.droppedCount === "number"
    );
}

/**
 * 类型守卫：检查 payload 是否包含运行时状态更新必需字段（state + awake）。
 * 调用时机：Magi 运行时状态消息分发前校验消息结构。
 */
function isRuntimeStatusUpdatedPayload(payload: Record<string, unknown>) {
    return (
        typeof payload.state === "string" &&
        typeof payload.awake === "boolean"
    );
}

/**
 * 事件类型到验证函数的映射表。
 */
const eventValidators: Record<MagiEventName, (payload: Record<string, unknown>) => boolean> = {
    ROUND_STARTED: isRoundStartedPayload,
    LLM_REQUEST_SENT: isLlmRequestSentPayload,
    SEEL_REPLY_STARTED: isSeelReplyStartedPayload,
    SEEL_REPLY_CHUNK: isSeelReplyChunkPayload,
    SEEL_REPLY_COMPLETED: isSeelReplyCompletedPayload,
    SEEL_REPLY_FAILED: isSeelReplyFailedPayload,
    SEEL_VOTE_UPDATED: isSeelVoteUpdatedPayload,
    DOMINANT_SYNTHESIS_COMPLETED: isSynthesisCompletedPayload,
    CONSENSUS_EMITTED: isConsensusEmittedPayload,
    ROUND_FAILED: isRoundFailedPayload,
    TOOL_CALL_DETECTED: isToolCallDetectedPayload,
    DELIBERATION_SIGNAL_RAISED: isDeliberationSignalRaisedPayload,
    CONTEXT_HISTORY_TRIMMED: isContextHistoryTrimmedPayload,
    RUNTIME_STATUS_UPDATED: isRuntimeStatusUpdatedPayload,
};

/**
 * 验证 payload 是否符合指定 MAGI 事件类型的完整结构要求。
 *
 * 根据后端 websocket/events.go 中的事件定义，验证每种事件类型的必需字段。
 */
export function isValidMagiEventPayload<K extends MagiEventName>(
    eventType: K,
    payload: unknown
): payload is MagiEventPayloadMap[K] {
    if (!payload || typeof payload !== "object") {
        return false;
    }

    const record = payload as Record<string, unknown>;

    // 验证基础字段
    if (!hasBaseFields(record)) {
        return false;
    }

    // 根据事件类型验证特定字段
    const validator = eventValidators[eventType];
    return validator ? validator(record) : false;
}
