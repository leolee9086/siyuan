import type { ConnectionStatus, MagiRuntimeStatus } from "./useMagi.types";
import type { MagiEventBus, MagiRuntimeStatusUpdatedEvent, MagiSeelReplyStartedEvent } from "../events/magiEventBus.types";
import type { MagiMessage } from "../utils/messageFactory.types";
import type { MagiPersonaStatus } from "../service/magiPersonaStatus";
import { dispatchMagiWebSocketMessage } from "../events/dispatchMagiWebSocketMessage";
import { fetchMagiRuntimeMonitorHistory } from "../service/magiRuntimeMonitorHistory";

const RUNTIME_MONITOR_REPLAY_BATCH_SIZE = 40;

export function cloneRuntimeStatus(status: MagiRuntimeStatus): MagiRuntimeStatus {
    return { ...status };
}

export function buildRuntimeStatusFromEvent(payload: MagiRuntimeStatusUpdatedEvent): MagiRuntimeStatus {
    return {
        state: payload.state,
        awake: payload.awake,
        ...(payload.wakeSource ? { wakeSource: payload.wakeSource } : {}),
        ...(payload.reason ? { reason: payload.reason } : {}),
        ...(payload.dominantSeel ? { dominantSeel: payload.dominantSeel } : {}),
        ...(payload.dominantStance ? { dominantStance: payload.dominantStance } : {}),
        ...(typeof payload.dominantUpdatedAt === "number" ? { dominantUpdatedAt: payload.dominantUpdatedAt } : {}),
        ...(payload.currentRoundId ? { currentRoundId: payload.currentRoundId } : {}),
        ...(payload.currentTask ? { currentTask: payload.currentTask } : {}),
        ...(typeof payload.lastHeartbeatAt === "number" ? { lastHeartbeatAt: payload.lastHeartbeatAt } : {}),
        ...(typeof payload.lastWakeAt === "number" ? { lastWakeAt: payload.lastWakeAt } : {}),
        ...(typeof payload.lastSleepAt === "number" ? { lastSleepAt: payload.lastSleepAt } : {}),
        ...(payload.lastSleepSummary ? { lastSleepSummary: payload.lastSleepSummary } : {}),
        ...(typeof payload.updatedAt === "number" ? { updatedAt: payload.updatedAt } : {}),
    };
}

function readMessageMetaString(message: MagiMessage | null | undefined, key: string): string | undefined {
    if (!message?.meta || typeof message.meta !== "object") {
        return undefined;
    }
    const value = Reflect.get(message.meta, key);
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export function applyDominantRuntimeHintFromReplyStarted(
    current: MagiRuntimeStatus | null,
    payload: MagiSeelReplyStartedEvent,
): MagiRuntimeStatus | null {
    const dominantSeel = readMessageMetaString(payload.streamMessage, "dominantSeel");
    if (!dominantSeel) {
        return current;
    }
    const next: MagiRuntimeStatus = current ? { ...current } : { state: "external", awake: true };
    next.state = "external";
    next.awake = true;
    next.currentRoundId = payload.roundId;
    next.dominantSeel = dominantSeel;
    const dominantStance = readMessageMetaString(payload.streamMessage, "dominantStance");
    if (dominantStance) {
        next.dominantStance = dominantStance;
    } else {
        delete next.dominantStance;
    }
    next.dominantUpdatedAt = payload.timestamp;
    next.updatedAt = Math.max(next.updatedAt ?? 0, payload.timestamp);
    return next;
}

export function createRuntimeProjectionSequenceGuard() {
    let latestSeq = 0;
    return (seq: number): boolean => {
        if (seq < latestSeq) {
            return false;
        }
        latestSeq = Math.max(latestSeq, seq);
        return true;
    };
}

export async function replayRuntimeMonitorHistory(
    eventBus: MagiEventBus,
    shouldDispatch: () => boolean = () => true,
    signal?: AbortSignal,
): Promise<void> {
    const history = await fetchMagiRuntimeMonitorHistory(0, signal ? {signal} : {});
    if (!shouldDispatch()) {
        return;
    }
    for (let eventIndex = 0; eventIndex < history.events.length; eventIndex++) {
        const event = history.events[eventIndex];
        if (!event) {
            continue;
        }
        if (!shouldDispatch()) {
            return;
        }
        dispatchMagiWebSocketMessage(eventBus, { cmd: "magiEvent", data: event });
        if ((eventIndex + 1) % RUNTIME_MONITOR_REPLAY_BATCH_SIZE === 0 && eventIndex + 1 < history.events.length) {
            await waitForRuntimeMonitorReplayFrame();
        }
    }
}

function waitForRuntimeMonitorReplayFrame(): Promise<void> {
    if (typeof requestAnimationFrame !== "function") {
        return Promise.resolve();
    }
    return new Promise((resolve) => {
        requestAnimationFrame(() => resolve());
    });
}

export function resolveConnectionStatusFromPersonaStatus(
    currentStatus: ConnectionStatus,
    status: MagiPersonaStatus | null,
): ConnectionStatus {
    if (status?.blocked) {
        return "error";
    }
    if (status) {
        return "connected";
    }
    return currentStatus === "connected" ? currentStatus : "disconnected";
}

export function resolvePersonaNameFromStatus(status: MagiPersonaStatus | null): string | undefined {
    const subjectName = status?.subjectName.trim() ?? "";
    return subjectName || undefined;
}
