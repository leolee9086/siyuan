import type { EventUnsubscribe } from "../../util/lib/events/eventEmitter.types";
import type {
    MagiConsensusEmittedEvent,
    MagiEventBus,
    MagiSeelReplyChunkEvent,
    MagiSeelReplyCompletedEvent,
    MagiSeelReplyFailedEvent,
    MagiSeelReplyStartedEvent,
    MagiSeelVoteUpdatedEvent,
} from "./magiEventBus.types";
import type {
    MagiProjectorRuntimeState,
    MagiProjectorTarget,
} from "./magiProjector.types";
import type { WrappedSeel } from "../composables/useMagi.types";
import type { MagiMessage } from "../utils/messageFactory.types";

/** 为事件构造稳定消息 ID，避免重复落盘。 */
function buildProjectedMessageId(eventId: string, suffix: string): string {
    return `${eventId}:${suffix}`;
}

/** 拷贝消息对象，避免共享引用导致跨区域联动。 */
function cloneMessage(message: MagiMessage): MagiMessage {
    return {
        ...message,
        ...(message.meta ? { meta: { ...message.meta } } : {}),
    };
}

/** 按 ID 更新或插入消息。 */
function upsertMessage(messages: MagiMessage[], incoming: MagiMessage): void {
    const index = messages.findIndex((message) => message.id === incoming.id);
    // 命中同 ID 时覆盖该消息，保持流式更新位置稳定。
    if (index >= 0) {
        messages.splice(index, 1, cloneMessage(incoming));
        return;
    }
    messages.push(cloneMessage(incoming));
}

/** 按内部名称查找贤者实例。 */
function findSeelByName(seels: WrappedSeel[], seelName: string): WrappedSeel | null {
    const target = seels.find((seel) => seel.config.name === seelName);
    return target ?? null;
}

/** 创建投影运行时状态。 */
function createRuntimeState(target: MagiProjectorTarget): MagiProjectorRuntimeState {
    return {
        processedEventIds: new Set<string>(),
        latestSeq: 0,
        target,
    };
}

/** 判断事件是否应进入投影流程。 */
function shouldProcessEvent(
    state: MagiProjectorRuntimeState,
    eventId: string,
    seq: number,
): boolean {
    // 已处理事件直接忽略，保障幂等。
    if (state.processedEventIds.has(eventId)) {
        return false;
    }
    // 乱序旧事件忽略，避免状态回退。
    if (seq < state.latestSeq) {
        return false;
    }
    state.latestSeq = seq;
    state.processedEventIds.add(eventId);
    return true;
}

/** 投影贤者开始回复事件。 */
function projectSeelReplyStarted(
    state: MagiProjectorRuntimeState,
    event: MagiSeelReplyStartedEvent,
): void {
    if (!shouldProcessEvent(state, event.eventId, event.seq)) {
        return;
    }
    const seel = findSeelByName(state.target.seels, event.seelName);
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
): void {
    if (!shouldProcessEvent(state, event.eventId, event.seq)) {
        return;
    }
    const seel = findSeelByName(state.target.seels, event.seelName);
    if (!seel) {
        return;
    }
    upsertMessage(seel.messages, event.message);
}

/** 投影贤者回复完成事件。 */
function projectSeelReplyCompleted(
    state: MagiProjectorRuntimeState,
    event: MagiSeelReplyCompletedEvent,
): void {
    if (!shouldProcessEvent(state, event.eventId, event.seq)) {
        return;
    }
    const seel = findSeelByName(state.target.seels, event.seelName);
    if (!seel) {
        return;
    }
    seel.loading = false;
    upsertMessage(seel.messages, event.message);
}

/** 投影贤者回复失败事件。 */
function projectSeelReplyFailed(
    state: MagiProjectorRuntimeState,
    event: MagiSeelReplyFailedEvent,
): void {
    if (!shouldProcessEvent(state, event.eventId, event.seq)) {
        return;
    }
    const seel = findSeelByName(state.target.seels, event.seelName);
    if (!seel) {
        return;
    }
    seel.loading = false;
    const errorMessage: MagiMessage = {
        id: buildProjectedMessageId(event.eventId, "error"),
        type: "error",
        content: event.error,
        status: "error",
        timestamp: event.timestamp,
    };
    upsertMessage(seel.messages, errorMessage);
}

/** 投影投票进度到主消息流。 */
function projectVoteProgress(
    state: MagiProjectorRuntimeState,
    event: MagiSeelVoteUpdatedEvent,
): void {
    // 只有携带 progress 的事件才会生成主面板 vote-status 消息。
    if (typeof event.progress !== "number") {
        return;
    }
    const voteStatus: MagiMessage = {
        id: buildProjectedMessageId(event.eventId, "vote-status"),
        type: "system",
        content: "投票进度更新",
        status: "success",
        timestamp: event.timestamp,
        meta: {
            type: "vote-status",
            progress: event.progress,
            details: event.details ?? [],
            ...(event.proposedAction ? { proposedAction: event.proposedAction } : {}),
        },
    };
    upsertMessage(state.target.consensusMessages, voteStatus);
}

/** 投影侧面投票结果到贤者卡片。 */
function projectVoteDecision(
    state: MagiProjectorRuntimeState,
    event: MagiSeelVoteUpdatedEvent,
): void {
    const seelName = typeof event.seelName === "string" ? event.seelName : "";
    if (!seelName || !event.decision) {
        return;
    }
    const seel = findSeelByName(state.target.seels, seelName);
    if (!seel) {
        return;
    }
    const voteMessage: MagiMessage = {
        id: buildProjectedMessageId(event.eventId, "vote"),
        type: "vote",
        content: `评估完成: ${event.decision}`,
        status: "success",
        timestamp: event.timestamp,
        meta: {
            decision: event.decision,
            ...(typeof event.round === "number" ? { round: event.round } : {}),
        },
    };
    upsertMessage(seel.messages, voteMessage);
}

/** 投影侧面投票错误到贤者卡片。 */
function projectVoteError(
    state: MagiProjectorRuntimeState,
    event: MagiSeelVoteUpdatedEvent,
): void {
    const seelName = typeof event.seelName === "string" ? event.seelName : "";
    const errorText = typeof event.error === "string" ? event.error : "";
    if (!seelName || !errorText) {
        return;
    }
    const seel = findSeelByName(state.target.seels, seelName);
    if (!seel) {
        return;
    }
    const voteError: MagiMessage = {
        id: buildProjectedMessageId(event.eventId, "vote-error"),
        type: "error",
        content: errorText,
        status: "error",
        timestamp: event.timestamp,
    };
    upsertMessage(seel.messages, voteError);
}

/** 投影投票更新事件。 */
function projectVoteUpdated(
    state: MagiProjectorRuntimeState,
    event: MagiSeelVoteUpdatedEvent,
): void {
    if (!shouldProcessEvent(state, event.eventId, event.seq)) {
        return;
    }
    projectVoteProgress(state, event);
    projectVoteDecision(state, event);
    projectVoteError(state, event);
}

/** 投影主消息流事件。 */
function projectConsensusMessage(
    state: MagiProjectorRuntimeState,
    event: MagiConsensusEmittedEvent,
): void {
    if (!shouldProcessEvent(state, event.eventId, event.seq)) {
        return;
    }
    upsertMessage(state.target.consensusMessages, event.message);
}

/** 注册贤者事件订阅。 */
function registerSeelSubscriptions(
    eventBus: MagiEventBus,
    state: MagiProjectorRuntimeState,
    subscriptions: EventUnsubscribe[],
): void {
    subscriptions.push(eventBus.subscribe("SEEL_REPLY_STARTED", projectSeelReplyStarted.bind(null, state)));
    subscriptions.push(eventBus.subscribe("SEEL_REPLY_CHUNK", projectSeelReplyChunk.bind(null, state)));
    subscriptions.push(eventBus.subscribe("SEEL_REPLY_COMPLETED", projectSeelReplyCompleted.bind(null, state)));
    subscriptions.push(eventBus.subscribe("SEEL_REPLY_FAILED", projectSeelReplyFailed.bind(null, state)));
    subscriptions.push(eventBus.subscribe("SEEL_VOTE_UPDATED", projectVoteUpdated.bind(null, state)));
}

/** 构造统一取消订阅函数。 */
function composeUnsubscribe(subscriptions: EventUnsubscribe[]): EventUnsubscribe {
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
): Promise<EventUnsubscribe> {
    const state = createRuntimeState(target);
    const subscriptions: EventUnsubscribe[] = [];
    registerSeelSubscriptions(eventBus, state, subscriptions);
    subscriptions.push(eventBus.subscribe("CONSENSUS_EMITTED", projectConsensusMessage.bind(null, state)));
    return composeUnsubscribe(subscriptions);
}
