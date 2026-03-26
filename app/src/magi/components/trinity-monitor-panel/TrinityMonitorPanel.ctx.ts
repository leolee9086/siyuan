import type { ConnectionStatus, MagiRuntimeStatus } from "../../composables/useMagi.types";
import type { MagiSeelPanelMessageView } from "../../entry/magiView.types";
import type {
    MagiMonitorFact,
    MagiMonitorStat,
    MagiMonitorStreamItem,
    MagiMonitorTone,
} from "./TrinityMonitorPanel.types";

const MAX_MONITOR_STREAM_ITEMS = 180;

function asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === "object" && value !== null
        ? value as Record<string, unknown>
        : null;
}

function readNonEmptyString(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function truncateText(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
        return value;
    }
    return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

function readRawEventMeta(message: MagiSeelPanelMessageView): Record<string, unknown> {
    return asRecord(message.meta) ?? {};
}

function readRawEventPayload(message: MagiSeelPanelMessageView): Record<string, unknown> {
    const payload = Reflect.get(readRawEventMeta(message), "eventPayload");
    return asRecord(payload) ?? {};
}

function getRawEventType(message: MagiSeelPanelMessageView): string {
    const eventType = Reflect.get(readRawEventMeta(message), "eventType");
    return readNonEmptyString(eventType) ?? "UNKNOWN_EVENT";
}

function getRawEventRoundId(message: MagiSeelPanelMessageView): string {
    const roundId = Reflect.get(readRawEventMeta(message), "roundId");
    return readNonEmptyString(roundId) ?? "-";
}

function getRawEventSeqText(message: MagiSeelPanelMessageView): string {
    const seq = Reflect.get(readRawEventMeta(message), "seq");
    return typeof seq === "number" ? `#${seq}` : "#-";
}

function resolveEventSourceLabel(payload: Record<string, unknown>): string {
    return readNonEmptyString(Reflect.get(payload, "displayName"))
        ?? readNonEmptyString(Reflect.get(payload, "seelName"))
        ?? readNonEmptyString(Reflect.get(payload, "initiator"))
        ?? readNonEmptyString(Reflect.get(payload, "state"))
        ?? "MAGI CORE";
}

function formatMonitorEventType(eventType: string): string {
    if (!eventType) {
        return "UNKNOWN_EVENT";
    }
    return eventType;
}

function resolveEventTone(
    eventType: string,
    payload: Record<string, unknown>,
): MagiMonitorTone {
    const normalizedEventType = formatMonitorEventType(eventType);
    if (normalizedEventType === "ROUND_FAILED" || normalizedEventType === "SEEL_REPLY_FAILED") {
        return "danger";
    }
    if (normalizedEventType === "TOOL_CALL_DETECTED" || normalizedEventType === "DELIBERATION_SIGNAL_RAISED") {
        return "warn";
    }
    if (normalizedEventType === "RUNTIME_STATUS_UPDATED") {
        const state = readNonEmptyString(Reflect.get(payload, "state"));
        if (state === "heartbeat" || state === "external") {
            return "good";
        }
        if (state === "sleeping") {
            return "muted";
        }
    }
    if (
        normalizedEventType === "DOMINANT_SYNTHESIS_COMPLETED"
        || normalizedEventType === "CONSENSUS_EMITTED"
        || normalizedEventType.endsWith("_COMPLETED")
    ) {
        return "good";
    }
    return "accent";
}

function buildPayloadSummary(
    eventType: string,
    payload: Record<string, unknown>,
): string {
    const normalizedEventType = formatMonitorEventType(eventType);
    switch (normalizedEventType) {
        case "RUNTIME_STATUS_UPDATED": {
            const parts = [
                readNonEmptyString(Reflect.get(payload, "state")),
                readNonEmptyString(Reflect.get(payload, "dominantSeel")),
                readNonEmptyString(Reflect.get(payload, "dominantStance")),
                readNonEmptyString(Reflect.get(payload, "currentTask")),
                readNonEmptyString(Reflect.get(payload, "reason")),
            ].filter((part): part is string => !!part);
            return parts.join(" | ") || "Runtime status updated";
        }
        case "LLM_REQUEST_SENT": {
            const seel = readNonEmptyString(Reflect.get(payload, "displayName"))
                ?? readNonEmptyString(Reflect.get(payload, "seelName"))
                ?? "UNKNOWN";
            const model = readNonEmptyString(Reflect.get(payload, "model")) ?? "unknown-model";
            const toolCount = Reflect.get(payload, "toolCount");
            return `${seel} -> ${model}${typeof toolCount === "number" ? ` | tools ${toolCount}` : ""}`;
        }
        case "SEEL_REPLY_STARTED":
            return truncateText(readNonEmptyString(Reflect.get(payload, "userInput")) ?? "Seel reply started", 120);
        case "SEEL_REPLY_COMPLETED":
        case "DOMINANT_SYNTHESIS_COMPLETED":
            return truncateText(readNonEmptyString(Reflect.get(payload, "content")) ?? "Reply completed", 120);
        case "SEEL_REPLY_FAILED":
        case "ROUND_FAILED":
            return truncateText(readNonEmptyString(Reflect.get(payload, "error")) ?? "Failure detected", 120);
        case "TOOL_CALL_DETECTED": {
            const seel = readNonEmptyString(Reflect.get(payload, "displayName"))
                ?? readNonEmptyString(Reflect.get(payload, "seelName"))
                ?? "UNKNOWN";
            const toolName = readNonEmptyString(Reflect.get(payload, "toolName")) ?? "tool";
            const complete = Reflect.get(payload, "argumentsComplete") === true ? "complete" : "streaming";
            return `${seel} | ${toolName} | ${complete}`;
        }
        case "CONTEXT_HISTORY_TRIMMED": {
            const before = Reflect.get(payload, "beforeCount");
            const after = Reflect.get(payload, "afterCount");
            const dropped = Reflect.get(payload, "droppedCount");
            return `context ${before ?? "?"} -> ${after ?? "?"} | dropped ${dropped ?? "?"}`;
        }
        default:
            return truncateText(
                readNonEmptyString(Reflect.get(payload, "reason"))
                ?? readNonEmptyString(Reflect.get(payload, "content"))
                ?? readNonEmptyString(Reflect.get(payload, "error"))
                ?? "Backend event payload available",
                120,
            );
    }
}

function getLastRawEvent(messages: readonly MagiSeelPanelMessageView[]): MagiSeelPanelMessageView | null {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (message && isRawEventMonitorMessage(message)) {
            return message;
        }
    }
    return null;
}

function resolveAlertCount(messages: readonly MagiSeelPanelMessageView[]): number {
    return messages.filter((message) => {
        if (!isRawEventMonitorMessage(message)) {
            return false;
        }
        const eventType = getRawEventType(message);
        return eventType === "ROUND_FAILED" || eventType === "SEEL_REPLY_FAILED";
    }).length;
}

export function formatMonitorTimestamp(timestamp: unknown): string {
    if (typeof timestamp !== "number" || !Number.isFinite(timestamp) || timestamp <= 0) {
        return "--:--:--";
    }
    const date = new Date(timestamp);
    const h = String(date.getHours()).padStart(2, "0");
    const m = String(date.getMinutes()).padStart(2, "0");
    const s = String(date.getSeconds()).padStart(2, "0");
    return `${h}:${m}:${s}`;
}

export function formatRuntimeState(status: MagiRuntimeStatus | null | undefined): string {
    switch (status?.state) {
        case "heartbeat":
            return "HEARTBEAT";
        case "external":
            return "AWAKE";
        case "sleeping":
            return "SLEEP";
        default:
            return "UNKNOWN";
    }
}

export function formatConnectionStatus(status: ConnectionStatus): string {
    switch (status) {
        case "connected":
            return "LINK OK";
        case "connecting":
            return "LINKING";
        case "error":
            return "LINK ERROR";
        default:
            return "OFFLINE";
    }
}

export function resolveRuntimeTone(
    status: MagiRuntimeStatus | null | undefined,
    connectionStatus: ConnectionStatus,
): MagiMonitorTone {
    if (connectionStatus === "disconnected" || connectionStatus === "error") {
        return "danger";
    }
    if (connectionStatus === "connecting") {
        return "warn";
    }
    switch (status?.state) {
        case "heartbeat":
        case "external":
            return "good";
        case "sleeping":
            return "muted";
        default:
            return "accent";
    }
}

export function isRawEventMonitorMessage(message: MagiSeelPanelMessageView): boolean {
    const meta = asRecord(message.meta);
    return message.type === "event" && meta?.type === "raw-event";
}

export function extractLatestMonitorSynthesis(
    messages: readonly MagiSeelPanelMessageView[],
): MagiSeelPanelMessageView | null {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (!message) {
            continue;
        }
        if (isRawEventMonitorMessage(message)) {
            continue;
        }
        if (message.type === "user") {
            continue;
        }
        const content = String(message.content ?? "").trim();
        if (!content) {
            continue;
        }
        return message;
    }
    return null;
}

export function buildMonitorStats(
    messages: readonly MagiSeelPanelMessageView[],
    connectionStatus: ConnectionStatus,
    runtimeStatus: MagiRuntimeStatus | null | undefined,
): MagiMonitorStat[] {
    const lastEvent = getLastRawEvent(messages);
    const lastRawEventType = lastEvent ? getRawEventType(lastEvent) : "";
    const lastEventType = lastEvent ? formatMonitorEventType(lastRawEventType) : "IDLE";
    const lastSeqText = lastEvent ? getRawEventSeqText(lastEvent) : "#-";
    const activeRoundId = runtimeStatus?.currentRoundId
        ?? (lastEvent ? getRawEventRoundId(lastEvent) : null)
        ?? "IDLE";
    const alertCount = resolveAlertCount(messages);

    return [
        {
            label: "STATE",
            value: formatRuntimeState(runtimeStatus),
            tone: resolveRuntimeTone(runtimeStatus, connectionStatus),
        },
        {
            label: "LINK",
            value: formatConnectionStatus(connectionStatus),
            tone: resolveRuntimeTone(runtimeStatus, connectionStatus),
        },
        {
            label: "ROUND",
            value: activeRoundId,
            tone: "accent",
        },
        {
            label: "LAST",
            value: lastEventType,
            tone: lastEvent ? resolveEventTone(lastRawEventType, readRawEventPayload(lastEvent)) : "muted",
        },
        {
            label: "SEQ",
            value: lastSeqText,
            tone: "accent",
        },
        {
            label: "ALERTS",
            value: String(alertCount),
            tone: alertCount > 0 ? "danger" : "muted",
        },
    ];
}

export function buildMonitorFacts(
    runtimeStatus: MagiRuntimeStatus | null | undefined,
): MagiMonitorFact[] {
    return [
        {
            label: "TASK",
            value: runtimeStatus?.currentTask?.trim() || "Awaiting backend task dispatch",
        },
        {
            label: "REASON",
            value: runtimeStatus?.reason?.trim() || runtimeStatus?.lastSleepSummary?.trim() || "No runtime annotation",
        },
        {
            label: "WAKE SOURCE",
            value: runtimeStatus?.wakeSource?.trim() || "-",
        },
        {
            label: "DOMINANT",
            value: runtimeStatus?.dominantStance?.trim()
                || runtimeStatus?.dominantSeel?.trim()
                || "-",
        },
        {
            label: "UPDATED",
            value: formatMonitorTimestamp(
                runtimeStatus?.dominantUpdatedAt
                ?? runtimeStatus?.updatedAt
                ?? runtimeStatus?.lastHeartbeatAt
                ?? runtimeStatus?.lastWakeAt
                ?? runtimeStatus?.lastSleepAt,
            ),
        },
    ];
}

export function buildMonitorStream(
    messages: readonly MagiSeelPanelMessageView[],
): MagiMonitorStreamItem[] {
    const items = messages
        .filter(isRawEventMonitorMessage)
        .map<MagiMonitorStreamItem>((message) => {
            const payload = readRawEventPayload(message);
            const rawEventType = getRawEventType(message);
            const eventType = formatMonitorEventType(rawEventType);
            return {
                id: message.id,
                eventType,
                tone: resolveEventTone(rawEventType, payload),
                timestampText: formatMonitorTimestamp(message.timestamp),
                seqText: getRawEventSeqText(message),
                roundId: getRawEventRoundId(message),
                sourceLabel: resolveEventSourceLabel(payload),
                summary: buildPayloadSummary(eventType, payload),
                payloadText: JSON.stringify(payload ?? {}, null, 2),
            };
        });

    if (items.length <= MAX_MONITOR_STREAM_ITEMS) {
        return items;
    }
    return items.slice(items.length - MAX_MONITOR_STREAM_ITEMS);
}
