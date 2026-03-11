import { z } from "zod";
import { SafeEventEmitter } from "../../util/lib/events/eventEmitter";
import type {
    MagiEventBus,
    MagiEventMetaStrippedPayload,
    MagiEventName,
    MagiEventPayloadMap,
} from "./magiEventBus.types";
import {
    toEmitterListener,
    toMagiEventData,
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
});

const magiMessageSchema = z.custom<MagiEventPayloadMap["CONSENSUS_EMITTED"]["message"]>();

export const magiEventDefines = {
    ROUND_STARTED: {
        ...baseEventShape,
        userInput: z.string(),
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
        seelName: z.string().optional(),
        displayName: z.string().optional(),
        decision: z.enum(["批准", "否决"]).optional(),
        round: z.number().int().positive().optional(),
        error: z.string().optional(),
    },
    TRINITY_SYNTHESIS_COMPLETED: {
        ...baseEventShape,
        content: z.string(),
    },
    CONSENSUS_EMITTED: {
        ...baseEventShape,
        message: magiMessageSchema,
    },
    ROUND_FAILED: {
        ...baseEventShape,
        error: z.string(),
    },
} as const;

let roundCounter = 0;

/** 生成本地轮次ID，供前端事件桥接层使用。 */
export async function createMagiRoundId(): Promise<string> {
    roundCounter += 1;
    return `round-${Date.now()}-${roundCounter}`;
}

/** 创建 MAGI 事件发射器实例。 */
function createInternalEmitter() {
    return new SafeEventEmitter(magiEventDefines, {
        runtimeCheck: true,
        validationFailure: "throw",
    });
}

/** 创建事件元字段生成器。 */
function createMetaGenerator() {
    let sequence = 0;
    return () => {
        sequence += 1;
        return {
            eventId: `magi-event-${Date.now()}-${sequence}`,
            seq: sequence,
        };
    };
}

/** 同步发射事件。 */
function emitInternal<K extends MagiEventName>(
    emitter: SafeEventEmitter<typeof magiEventDefines>,
    nextMeta: () => { eventId: string; seq: number },
    event: K,
    payload: MagiEventMetaStrippedPayload<K>,
): boolean {
    const eventData = toMagiEventData(payload, nextMeta);
    return emitter.emitWithMeta(event, eventData);
}

/** 异步发射事件。 */
async function emitAsyncInternal<K extends MagiEventName>(
    emitter: SafeEventEmitter<typeof magiEventDefines>,
    nextMeta: () => { eventId: string; seq: number },
    event: K,
    payload: MagiEventMetaStrippedPayload<K>,
): Promise<boolean> {
    const eventData = toMagiEventData(payload, nextMeta);
    return emitter.emitAsyncWithMeta(event, eventData);
}

/** 同步发射包含元字段的事件。 */
function emitWithMetaInternal<K extends MagiEventName>(
    emitter: SafeEventEmitter<typeof magiEventDefines>,
    event: K,
    payload: MagiEventPayloadMap[K],
): boolean {
    return emitter.emitWithMeta(event, payload);
}

/** 异步发射包含元字段的事件。 */
async function emitAsyncWithMetaInternal<K extends MagiEventName>(
    emitter: SafeEventEmitter<typeof magiEventDefines>,
    event: K,
    payload: MagiEventPayloadMap[K],
): Promise<boolean> {
    return emitter.emitAsyncWithMeta(event, payload);
}

/**
 * 订阅事件并把业务监听器转换为底层监听器签名。
 *
 * 作用：在对外保持业务载荷类型的同时复用 SafeEventEmitter。
 * 意图：避免调用方感知底层事件定义泛型细节。
 * 调用时机：`createMagiEventBus` 返回对象的 `subscribe` 被调用时。
 */
function subscribeInternal<K extends MagiEventName>(
    emitter: SafeEventEmitter<typeof magiEventDefines>,
    event: K,
    listener: (payload: MagiEventPayloadMap[K]) => void | Promise<void>,
) {
    const safeListener = toEmitterListener(listener);
    return emitter.subscribe(event, safeListener);
}

/**
 * 订阅一次性事件并转换监听器签名。
 *
 * 作用：对外提供 `subscribeOnce`，内部仍复用 SafeEventEmitter。
 * 意图：保持一次性订阅与普通订阅拥有一致的业务侧类型体验。
 * 调用时机：`createMagiEventBus` 返回对象的 `subscribeOnce` 被调用时。
 */
function subscribeOnceInternal<K extends MagiEventName>(
    emitter: SafeEventEmitter<typeof magiEventDefines>,
    event: K,
    listener: (payload: MagiEventPayloadMap[K]) => void | Promise<void>,
) {
    const safeListener = toEmitterListener(listener);
    return emitter.subscribeOnce(event, safeListener);
}

/** 创建 MAGI 事件总线（前端 TTT 过渡层）。 */
export async function createMagiEventBus(): Promise<MagiEventBus> {
    const emitter = createInternalEmitter();
    const nextMeta = createMetaGenerator();

    return {
        emit: emitInternal.bind(null, emitter, nextMeta),
        emitWithMeta: emitWithMetaInternal.bind(null, emitter),
        emitAsync: emitAsyncInternal.bind(null, emitter, nextMeta),
        emitAsyncWithMeta: emitAsyncWithMetaInternal.bind(null, emitter),
        subscribe: subscribeInternal.bind(null, emitter),
        subscribeOnce: subscribeOnceInternal.bind(null, emitter),
    };
}
