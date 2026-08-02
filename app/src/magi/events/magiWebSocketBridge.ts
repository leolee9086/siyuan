import type { MagiEventName } from "./magiEventBus.types";

const MAGI_WS_APP = "magi";
export const DEFAULT_RECONNECT_DELAY_MS = 1000;
export const DEFAULT_MAX_RECONNECT_DELAY_MS = 10000;

const MAGI_EVENT_NAMES: MagiEventName[] = [
    "ROUND_STARTED",
    "LLM_REQUEST_SENT",
    "SEEL_REPLY_STARTED",
    "SEEL_REPLY_CHUNK",
    "SEEL_REPLY_COMPLETED",
    "SEEL_REPLY_FAILED",
    "SEEL_VOTE_UPDATED",
    "DOMINANT_SYNTHESIS_COMPLETED",
    "CONSENSUS_EMITTED",
    "ROUND_FAILED",
    "TOOL_CALL_DETECTED",
    "SEEL_TOOL_ACTIVITY_UPDATED",
    "DELIBERATION_SIGNAL_RAISED",
    "CONTEXT_HISTORY_TRIMMED",
    "RUNTIME_STATUS_UPDATED",
];

interface MagiEventEnvelope {
    eventType: MagiEventName;
    sessionId: string;
    payload: Record<string, unknown>;
}

export interface MagiWebSocketBridgeOptions {
    sessionId: string;
    reconnectDelayMs?: number;
    maxReconnectDelayMs?: number;
    websocketFactory?: (url: string) => WebSocket;
    onConnecting?: () => void;
    onOpen?: () => void;
    onClose?: () => void;
}

export interface MagiWebSocketBridge {
    sessionId: string;
    disconnect: () => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function readString(value: unknown): string {
    return typeof value === "string" ? value : "";
}

function isMagiEventName(value: unknown): value is MagiEventName {
    return typeof value === "string" && MAGI_EVENT_NAMES.includes(value as MagiEventName);
}

export function normalizeMagiEventEnvelope(raw: unknown): MagiEventEnvelope | null {
    if (!isRecord(raw)) {
        return null;
    }

    const cmd = readString(raw.cmd);
    if (cmd !== "magiEvent") {
        return null;
    }

    const outerData = isRecord(raw.data) ? raw.data : {};
    const nestedData = isRecord(outerData.data) ? outerData.data : {};
    const mergedPayload: Record<string, unknown> = {
        ...outerData,
        ...nestedData,
    };

    const rawEventType = readString(raw.eventType)
        || readString(outerData.eventType)
        || readString(nestedData.eventType);
    if (!isMagiEventName(rawEventType)) {
        return null;
    }

    const sessionId = readString(outerData.sessionId)
        || readString(nestedData.sessionId)
        || readString(raw.sid);
    if (!sessionId) {
        return null;
    }

    delete mergedPayload.data;
    delete mergedPayload.eventType;
    delete mergedPayload.sessionId;

    return {
        eventType: rawEventType,
        sessionId,
        payload: mergedPayload,
    };
}

export function buildMagiWebSocketURL(sessionId: string): string {
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const encodedSessionId = encodeURIComponent(sessionId);
    return `${protocol}://${location.host}/ws?app=${MAGI_WS_APP}&id=${encodedSessionId}&type=main`;
}
