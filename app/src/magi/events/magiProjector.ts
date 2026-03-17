import type { EventUnsubscribe } from "../../util/lib/events/eventEmitter.types";
import type {
    MagiConsensusEmittedEvent,
    MagiContextHistoryTrimmedEvent,
    MagiDeliberationSignalRaisedEvent,
    MagiEventBus,
    MagiEventBase,
    MagiLLMRequestSentEvent,
    MagiRoundFailedEvent,
    MagiRoundStartedEvent,
    MagiSeelReplyChunkEvent,
    MagiSeelReplyCompletedEvent,
    MagiSeelReplyFailedEvent,
    MagiSeelReplyStartedEvent,
    MagiSeelVoteUpdatedEvent,
    MagiTrinitySynthesisCompletedEvent,
    MagiToolCallDetectedEvent,
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

const SAGE_SEEL_NAMES = new Set(["MELCHIOR", "BALTHASAR", "CASPER"]);

/** 返回三贤人（排除 TRINITY）。 */
function listSageSeels(seels: WrappedSeel[]): WrappedSeel[] {
    return seels.filter((seel) => SAGE_SEEL_NAMES.has(normalizeSeelIdentity(seel.config.name)));
}

/** 深拷贝事件载荷，确保消息元数据可稳定序列化。 */
function cloneEventPayloadForMeta(event: MagiEventBase): Record<string, unknown> {
    try {
        const cloned = JSON.parse(JSON.stringify(event));
        if (typeof cloned === "object" && cloned !== null) {
            return cloned as Record<string, unknown>;
        }
    } catch (error) {
        console.warn("[magi-projector] clone event payload failed", error);
    }
    return {};
}

/** 按 ID 更新或插入消息，按timestamp排序。 */
function upsertMessage(messages: MagiMessage[], incoming: MagiMessage): void {
    const index = messages.findIndex((message) => message.id === incoming.id);
    // 命中同 ID 时覆盖该消息，保持流式更新位置稳定。
    if (index >= 0) {
        messages.splice(index, 1, cloneMessage(incoming));
        return;
    }
    
    // 二分查找插入位置（按timestamp主排序，seq辅助排序）
    const incomingTimestamp = incoming.timestamp;
    const incomingMeta = incoming.meta;
    const incomingSeq = incomingMeta && typeof incomingMeta.seq === "number" ? incomingMeta.seq : undefined;
    
    let left = 0;
    let right = messages.length;
    while (left < right) {
        const mid = Math.floor((left + right) / 2);
        const midMessage = messages[mid];
        // 数组访问后必须检查是否存在
        if (!midMessage) {
            break;
        }
        const midTimestamp = midMessage.timestamp;
        const midMeta = midMessage.meta;
        const midSeq = midMeta && typeof midMeta.seq === "number" ? midMeta.seq : undefined;
        
        const timestampCompare = midTimestamp - incomingTimestamp;
        // 中间消息的timestamp更早，插入位置在右半部分
        if (timestampCompare < 0) {
            left = mid + 1;
            continue;
        }
        // 中间消息的timestamp更晚，插入位置在左半部分
        if (timestampCompare > 0) {
            right = mid;
            continue;
        }
        
        // timestamp相同时按seq排序
        const bothSeqDefined = midSeq !== undefined && incomingSeq !== undefined;
        const seqCompare = bothSeqDefined && midSeq < incomingSeq;
        // 中间消息的seq更小，插入位置在右半部分
        if (seqCompare) {
            left = mid + 1;
            continue;
        }
        right = mid;
    }
    
    messages.splice(left, 0, cloneMessage(incoming));
}

/** 按内部名称查找贤者实例。 */
function normalizeSeelIdentity(value: unknown): string {
    if (typeof value !== "string") {
        return "";
    }
    const normalized = value.trim().toUpperCase();
    if (!normalized) {
        return "";
    }

    if (normalized.includes("MELCHIOR")) {
        return "MELCHIOR";
    }
    // 后端可能使用 BALTHAZAR，前端配置使用 BALTHASAR。
    if (normalized.includes("BALTHASAR") || normalized.includes("BALTHAZAR")) {
        return "BALTHASAR";
    }
    if (normalized.includes("CASPER")) {
        return "CASPER";
    }
    if (normalized.includes("TRINITY")) {
        return "TRINITY";
    }

    return normalized.replace(/[^A-Z0-9]/g, "");
}

function findSeelByName(
    seels: WrappedSeel[],
    seelName: unknown,
    displayName?: unknown,
): WrappedSeel | null {
    if (typeof seelName === "string" && seelName) {
        const exact = seels.find((seel) => seel.config.name === seelName);
        if (exact) {
            return exact;
        }
    }

    const candidates = [seelName, displayName]
        .map((candidate) => normalizeSeelIdentity(candidate))
        .filter((candidate) => candidate.length > 0);
    if (candidates.length === 0) {
        return null;
    }

    const target = seels.find((seel) => {
        const nameKey = normalizeSeelIdentity(seel.config.name);
        const displayKey = normalizeSeelIdentity(seel.config.displayName);
        return candidates.includes(nameKey) || candidates.includes(displayKey);
    });
    return target ?? null;
}

type RawEventSeelHint = {
    seelName?: unknown;
    displayName?: unknown;
};

/** 根据事件提示解析三贤人目标；无匹配时回退广播到全部三贤人。 */
function resolveRawEventTargetSeels(
    state: MagiProjectorRuntimeState,
    hints: RawEventSeelHint[],
): WrappedSeel[] {
    const resolved: WrappedSeel[] = [];
    for (const hint of hints) {
        const seel = findSeelByName(state.target.seels, hint.seelName, hint.displayName);
        if (!seel) {
            continue;
        }
        if (SAGE_SEEL_NAMES.has(normalizeSeelIdentity(seel.config.name)) && !resolved.includes(seel)) {
            resolved.push(seel);
        }
    }
    if (resolved.length > 0) {
        return resolved;
    }
    return listSageSeels(state.target.seels);
}

/** 将原始事件完整投影到三贤人卡片。 */
function projectRawEventToSeelCards(
    state: MagiProjectorRuntimeState,
    eventType: string,
    event: MagiEventBase,
    hints: RawEventSeelHint[],
): void {
    const payload = cloneEventPayloadForMeta(event);
    const targets = resolveRawEventTargetSeels(state, hints);
    for (const target of targets) {
        const seelKey = normalizeSeelIdentity(target.config.name) || target.config.name;
        const eventMessage: MagiMessage = {
            id: buildProjectedMessageId(event.eventId, `event-${eventType}-${seelKey}`),
            type: "event",
            content: eventType,
            status: "success",
            timestamp: event.timestamp,
            meta: {
                type: "raw-event",
                eventType,
                eventPayload: payload,
                eventId: event.eventId,
                seq: event.seq,
                roundId: event.roundId,
                targetSeel: target.config.name,
            },
        };
        upsertMessage(target.messages, eventMessage);
    }
}

/** 读取非空字符串，空值返回 undefined。 */
function readNonEmptyString(value: unknown): string | undefined {
    if (typeof value !== "string") {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

/** 读取布尔值，非布尔时返回 undefined。 */
function readBoolean(value: unknown): boolean | undefined {
    return typeof value === "boolean" ? value : undefined;
}

/** 从工具参数中提取审慎信号的理由与开关。 */
function extractDeliberationSignalMeta(argumentsPayload: Record<string, unknown>): {
    reason?: string;
    requiresDeliberation?: boolean;
} {
    const reason = readNonEmptyString(Reflect.get(argumentsPayload, "reason"));
    const requiresDeliberation =
        readBoolean(Reflect.get(argumentsPayload, "requires_deliberation"))
        ?? readBoolean(Reflect.get(argumentsPayload, "requiresDeliberation"));
    return {
        ...(reason ? { reason } : {}),
        ...(requiresDeliberation !== undefined ? { requiresDeliberation } : {}),
    };
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
    
    const maxEventIds = 10000;
    // 防止内存泄漏：processedEventIds超过10000时清空
    // 触发场景：长时间运行会话中Set持续增长
    // 清空后可能短暂重复处理事件，但避免无限内存增长
    if (state.processedEventIds.size > maxEventIds) {
        state.processedEventIds.clear();
    }
    
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
    projectRawEventToSeelCards(state, "SEEL_REPLY_STARTED", event, [
        { seelName: event.seelName, displayName: event.displayName },
    ]);
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
): void {
    if (!shouldProcessEvent(state, event.eventId, event.seq)) {
        return;
    }
    projectRawEventToSeelCards(state, "SEEL_REPLY_CHUNK", event, [
        { seelName: event.seelName, displayName: event.displayName },
    ]);
    const seel = findSeelByName(state.target.seels, event.seelName, event.displayName);
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
    projectRawEventToSeelCards(state, "SEEL_REPLY_COMPLETED", event, [
        { seelName: event.seelName, displayName: event.displayName },
    ]);
    const seel = findSeelByName(state.target.seels, event.seelName, event.displayName);
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
    projectRawEventToSeelCards(state, "SEEL_REPLY_FAILED", event, [
        { seelName: event.seelName, displayName: event.displayName },
    ]);
    const seel = findSeelByName(state.target.seels, event.seelName, event.displayName);
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

    const deliberationInitiator = readNonEmptyString(event.deliberationInitiator);
    const deliberationReason = readNonEmptyString(event.deliberationReason);
    
    const voteStatus: MagiMessage = {
        id: buildProjectedMessageId(event.eventId, "vote-status"),
        type: "system",
        content: "投票进度更新",
        status: "success",
        timestamp: event.timestamp,
        meta: {
            type: "vote-status",
            roundId: event.roundId,
            progress: event.progress,
            details: event.details ?? [],
            ...(event.proposedAction ? { proposedAction: event.proposedAction } : {}),
            ...(deliberationInitiator ? { deliberationInitiator } : {}),
            ...(deliberationReason ? { deliberationReason } : {}),
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
    const seel = findSeelByName(state.target.seels, seelName, event.displayName);
    if (!seel) {
        return;
    }
    const voteReason = readNonEmptyString(event.decisionReason)
        ?? readNonEmptyString(event.reason);

    const voteMessage: MagiMessage = {
        id: buildProjectedMessageId(event.eventId, "vote"),
        type: "vote",
        content: voteReason
            ? `评估完成: ${event.decision} | 理由: ${voteReason}`
            : `评估完成: ${event.decision}`,
        status: "success",
        timestamp: event.timestamp,
        meta: {
            decision: event.decision,
            ...(typeof event.round === "number" ? { round: event.round } : {}),
            ...(voteReason ? { reason: voteReason } : {}),
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
    const seel = findSeelByName(state.target.seels, seelName, event.displayName);
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
    projectRawEventToSeelCards(state, "SEEL_VOTE_UPDATED", event, [
        { seelName: event.seelName, displayName: event.displayName },
        { seelName: event.deliberationInitiator, displayName: event.deliberationInitiator },
    ]);
    projectVoteProgress(state, event);
    projectVoteDecision(state, event);
    projectVoteError(state, event);
}

/** 投影审慎决策信号到投票状态。 */
function projectDeliberationSignal(
    state: MagiProjectorRuntimeState,
    event: MagiDeliberationSignalRaisedEvent,
): void {
    if (!shouldProcessEvent(state, event.eventId, event.seq)) {
        return;
    }
    projectRawEventToSeelCards(state, "DELIBERATION_SIGNAL_RAISED", event, [
        { seelName: event.initiator, displayName: event.displayName },
    ]);
    const initiator = readNonEmptyString(event.initiator);
    const reason = readNonEmptyString(event.reason);
    const signalContent = [
        "🔔 审慎信号已发起",
        ...(initiator ? [`发起者: ${initiator}`] : []),
        ...(reason ? [`理由: ${reason}`] : []),
    ].join(" | ");

    const consensusSignalMsg: MagiMessage = {
        id: buildProjectedMessageId(event.eventId, "deliberation-signal-consensus"),
        type: "system",
        content: signalContent,
        status: "success",
        timestamp: event.timestamp,
        meta: {
            type: "deliberation-signal",
            roundId: event.roundId,
            ...(initiator ? { initiator } : {}),
            ...(reason ? { reason } : {}),
            requiresDeliberation: event.requiresDeliberation,
        },
    };
    upsertMessage(state.target.consensusMessages, consensusSignalMsg);

    const seel = findSeelByName(state.target.seels, event.initiator, event.displayName);
    if (!seel) {
        return;
    }
    const seelSignalMsg: MagiMessage = {
        id: buildProjectedMessageId(event.eventId, "deliberation-signal-seel"),
        type: "system",
        content: signalContent,
        status: "success",
        timestamp: event.timestamp,
        meta: {
            type: "deliberation-signal",
            ...(initiator ? { initiator } : {}),
            ...(reason ? { reason } : {}),
            requiresDeliberation: event.requiresDeliberation,
        },
    };
    upsertMessage(seel.messages, seelSignalMsg);
}

/** 投影工具调用到贤者面板（支持增量更新）。 */
function projectToolCall(
    state: MagiProjectorRuntimeState,
    event: MagiToolCallDetectedEvent,
): void {
    if (!shouldProcessEvent(state, event.eventId, event.seq)) {
        return;
    }
    projectRawEventToSeelCards(state, "TOOL_CALL_DETECTED", event, [
        { seelName: event.seelName, displayName: event.displayName },
    ]);
    const seel = findSeelByName(state.target.seels, event.seelName, event.displayName);
    if (!seel) {
        return;
    }
    
    const stableId = `${event.roundId}-${event.seelName}-tool-${event.toolCallId || event.toolCallIndex}`;
    const deliberationMeta = extractDeliberationSignalMeta(event.arguments || {});

    const contentParts = [`🔧 调用工具: ${event.toolName}`];
    const statusText = event.argumentsComplete ? "(参数完整)" : "(构建中...)";
    contentParts.push(statusText);
    if (deliberationMeta.reason) {
        contentParts.push(`理由: ${deliberationMeta.reason}`);
    }
    // 如果工具参数中包含审慎标记，则在卡片中显示是否需要审慎
    if (deliberationMeta.requiresDeliberation !== undefined) {
        contentParts.push(`需要审慎: ${deliberationMeta.requiresDeliberation ? "是" : "否"}`);
    }

    const toolCallMsg: MagiMessage = {
        id: stableId,
        type: "system",
        content: contentParts.join(" | "),
        status: event.argumentsComplete ? "success" : "streaming",
        timestamp: event.timestamp,
        meta: {
            type: "tool-call",
            toolName: event.toolName,
            toolCallIndex: event.toolCallIndex,
            toolCallId: event.toolCallId,
            rawArguments: event.rawArguments,
            argumentsComplete: event.argumentsComplete,
            ...(event.arguments ? { arguments: event.arguments } : {}),
            ...(deliberationMeta.reason ? { reason: deliberationMeta.reason } : {}),
            ...(deliberationMeta.requiresDeliberation !== undefined
                ? { requiresDeliberation: deliberationMeta.requiresDeliberation }
                : {}),
        },
    };
    upsertMessage(seel.messages, toolCallMsg);
}

/** 投影主消息流事件。 */
function projectConsensusMessage(
    state: MagiProjectorRuntimeState,
    event: MagiConsensusEmittedEvent,
): void {
    if (!shouldProcessEvent(state, event.eventId, event.seq)) {
        return;
    }
    projectRawEventToSeelCards(state, "CONSENSUS_EMITTED", event, []);
    upsertMessage(state.target.consensusMessages, event.message);
}

/** 投影轮次开始事件到三贤人卡片。 */
function projectRoundStarted(
    state: MagiProjectorRuntimeState,
    event: MagiRoundStartedEvent,
): void {
    if (!shouldProcessEvent(state, event.eventId, event.seq)) {
        return;
    }
    projectRawEventToSeelCards(state, "ROUND_STARTED", event, []);
}

/** 投影 LLM 请求发送事件到对应贤者卡片。 */
function projectLLMRequestSent(
    state: MagiProjectorRuntimeState,
    event: MagiLLMRequestSentEvent,
): void {
    if (!shouldProcessEvent(state, event.eventId, event.seq)) {
        return;
    }
    projectRawEventToSeelCards(state, "LLM_REQUEST_SENT", event, [
        { seelName: event.seelName, displayName: event.displayName },
    ]);
}

/** 投影 TRINITY 统合事件到三贤人卡片。 */
function projectTrinitySynthesisCompleted(
    state: MagiProjectorRuntimeState,
    event: MagiTrinitySynthesisCompletedEvent,
): void {
    if (!shouldProcessEvent(state, event.eventId, event.seq)) {
        return;
    }
    projectRawEventToSeelCards(state, "TRINITY_SYNTHESIS_COMPLETED", event, []);
}

/** 投影轮次失败事件到三贤人卡片。 */
function projectRoundFailed(
    state: MagiProjectorRuntimeState,
    event: MagiRoundFailedEvent,
): void {
    if (!shouldProcessEvent(state, event.eventId, event.seq)) {
        return;
    }
    projectRawEventToSeelCards(state, "ROUND_FAILED", event, []);
}

/** 投影上下文裁剪事件到对应贤者卡片。 */
function projectContextHistoryTrimmed(
    state: MagiProjectorRuntimeState,
    event: MagiContextHistoryTrimmedEvent,
): void {
    if (!shouldProcessEvent(state, event.eventId, event.seq)) {
        return;
    }
    projectRawEventToSeelCards(state, "CONTEXT_HISTORY_TRIMMED", event, [
        { seelName: event.seelName, displayName: event.displayName },
    ]);
}

/** 注册贤者事件订阅。 */
function registerSeelSubscriptions(
    eventBus: MagiEventBus,
    state: MagiProjectorRuntimeState,
    subscriptions: EventUnsubscribe[],
): void {
    subscriptions.push(eventBus.subscribe("ROUND_STARTED", projectRoundStarted.bind(null, state)));
    subscriptions.push(eventBus.subscribe("LLM_REQUEST_SENT", projectLLMRequestSent.bind(null, state)));
    subscriptions.push(eventBus.subscribe("SEEL_REPLY_STARTED", projectSeelReplyStarted.bind(null, state)));
    subscriptions.push(eventBus.subscribe("SEEL_REPLY_CHUNK", projectSeelReplyChunk.bind(null, state)));
    subscriptions.push(eventBus.subscribe("SEEL_REPLY_COMPLETED", projectSeelReplyCompleted.bind(null, state)));
    subscriptions.push(eventBus.subscribe("SEEL_REPLY_FAILED", projectSeelReplyFailed.bind(null, state)));
    subscriptions.push(eventBus.subscribe("SEEL_VOTE_UPDATED", projectVoteUpdated.bind(null, state)));
    subscriptions.push(eventBus.subscribe("TRINITY_SYNTHESIS_COMPLETED", projectTrinitySynthesisCompleted.bind(null, state)));
    subscriptions.push(eventBus.subscribe("ROUND_FAILED", projectRoundFailed.bind(null, state)));
    subscriptions.push(eventBus.subscribe("DELIBERATION_SIGNAL_RAISED", projectDeliberationSignal.bind(null, state)));
    subscriptions.push(eventBus.subscribe("TOOL_CALL_DETECTED", projectToolCall.bind(null, state)));
    subscriptions.push(eventBus.subscribe("CONTEXT_HISTORY_TRIMMED", projectContextHistoryTrimmed.bind(null, state)));
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
