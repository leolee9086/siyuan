import { z } from "zod";
import { SafeEventEmitter } from "../../util/lib/events/eventEmitter";
import type {
    MagiEventBus,
    MagiEventName,
    MagiEventPayloadMap,
} from "./magiEventBus.types";
import {
    toEmitterListener,
} from "./magiEventBus.guard";

const baseEventShape = {
    eventId: z.string().min(1),
    seq: z.number().int().nonnegative(),
    roundId: z.string().min(1),
    timestamp: z.number().int().nonnegative(),
} as const;

const voteDetailSchema = z.object({
    name: z.string(),
    decision: z.string(),
    reason: z.string().optional(),
});

const magiMessageSchema = z.custom<MagiEventPayloadMap["CONSENSUS_EMITTED"]["message"]>();
const synthesisCompletedSchema = {
    ...baseEventShape,
    content: z.string(),
} as const;

export const magiEventDefines = {
    ROUND_STARTED: {
        ...baseEventShape,
        userInput: z.string(),
    },
    LLM_REQUEST_SENT: {
        ...baseEventShape,
        seelName: z.string(),
        displayName: z.string(),
        model: z.string(),
        messages: z.array(z.unknown()),
        toolCount: z.number().int().nonnegative(),
    },
    SEEL_REPLY_STARTED: {
        ...baseEventShape,
        seelName: z.string(),
        displayName: z.string(),
        userInput: z.string(),
        streamMessage: magiMessageSchema,
    },
    SEEL_REPLY_CHUNK: {
        ...baseEventShape,
        seelName: z.string(),
        displayName: z.string(),
        message: magiMessageSchema,
    },
    SEEL_REPLY_COMPLETED: {
        ...baseEventShape,
        seelName: z.string(),
        displayName: z.string(),
        message: magiMessageSchema,
    },
    SEEL_REPLY_FAILED: {
        ...baseEventShape,
        seelName: z.string(),
        displayName: z.string(),
        error: z.string(),
    },
    SEEL_VOTE_UPDATED: {
        ...baseEventShape,
        progress: z.number().int().nonnegative().max(100).optional(),
        details: z.array(voteDetailSchema).optional(),
        proposedAction: z.string().optional(),
        passed: z.boolean().optional(),
        seelName: z.string().optional(),
        displayName: z.string().optional(),
        decision: z.enum(["批准", "否决"]).optional(),
        decisionReason: z.string().optional(),
        reason: z.string().optional(),
        round: z.number().int().positive().optional(),
        error: z.string().optional(),
        deliberationInitiator: z.string().optional(),
        deliberationReason: z.string().optional(),
    },
    DOMINANT_SYNTHESIS_COMPLETED: synthesisCompletedSchema,
    CONSENSUS_EMITTED: {
        ...baseEventShape,
        message: magiMessageSchema,
    },
    ROUND_FAILED: {
        ...baseEventShape,
        error: z.string(),
    },
    TOOL_CALL_DETECTED: {
        ...baseEventShape,
        seelName: z.string(),
        displayName: z.string(),
        toolName: z.string(),
        toolCallIndex: z.number().int().nonnegative(),
        toolCallId: z.string(),
        rawArguments: z.string(),
        argumentsComplete: z.boolean(),
        arguments: z.record(z.string(), z.unknown()).optional(),
    },
    DELIBERATION_SIGNAL_RAISED: {
        ...baseEventShape,
        initiator: z.string(),
        displayName: z.string(),
        reason: z.string(),
        requiresDeliberation: z.boolean(),
    },
    CONTEXT_HISTORY_TRIMMED: {
        ...baseEventShape,
        seelName: z.string(),
        displayName: z.string(),
        beforeCount: z.number().int().nonnegative(),
        afterCount: z.number().int().nonnegative(),
        droppedCount: z.number().int().nonnegative(),
        strategyType: z.string().optional(),
        strategyCount: z.number().int().nonnegative().optional(),
        strategyPercent: z.number().nonnegative().optional(),
    },
    RUNTIME_STATUS_UPDATED: {
        ...baseEventShape,
        state: z.enum(["sleeping", "heartbeat", "external"]),
        awake: z.boolean(),
        wakeSource: z.string().optional(),
        reason: z.string().optional(),
        dominantSeel: z.string().optional(),
        dominantStance: z.string().optional(),
        dominantUpdatedAt: z.number().int().nonnegative().optional(),
        currentRoundId: z.string().optional(),
        currentTask: z.string().optional(),
        lastHeartbeatAt: z.number().int().nonnegative().optional(),
        lastWakeAt: z.number().int().nonnegative().optional(),
        lastSleepAt: z.number().int().nonnegative().optional(),
        lastSleepSummary: z.string().optional(),
        updatedAt: z.number().int().nonnegative().optional(),
    },
} as const;

/** 创建 MAGI 事件发射器实例。 */
function createInternalEmitter() {
    return new SafeEventEmitter(magiEventDefines, {
        runtimeCheck: true,
        validationFailure: "throw",
    });
}

/** 同步发射包含元字段的事件。 */
function emitWithMetaInternal<K extends MagiEventName>(
    emitter: SafeEventEmitter<typeof magiEventDefines>,
    event: K,
    payload: MagiEventPayloadMap[K],
): boolean {
    return emitter.emitWithMeta(event, payload);
}

/**
 * 订阅事件并把业务监听器转换为底层监听器签名。
 *
 * 作用：在对外保持业务载荷类型的同时复用 SafeEventEmitter。
 * 意图：前端当前只负责消费后端事件，不再在浏览器侧生成本地 MAGI 轮次事件。
 * 调用时机：`createMagiEventBus` 返回对象的 `subscribe` 被调用时。
 */
function subscribeInternal<K extends MagiEventName>(
    emitter: SafeEventEmitter<typeof magiEventDefines>,
    event: K,
    listener: (payload: MagiEventPayloadMap[K]) => void | Promise<void>,
) {
    const safeListener = toEmitterListener<typeof magiEventDefines, K>(listener);
    return emitter.subscribe(event, safeListener);
}

/** 创建 MAGI 事件总线。 */
export async function createMagiEventBus(): Promise<MagiEventBus> {
    const emitter = createInternalEmitter();
    return {
        emitWithMeta: emitWithMetaInternal.bind(null, emitter),
        subscribe: subscribeInternal.bind(null, emitter),
    };
}
