import { getActiveMagiArmorSession } from "./magiIdentitySession";

const MAGI_RUNTIME_MONITOR_HISTORY_ENDPOINT = "/api/s-forge/magi/v1/runtime/monitor/history";
const DEFAULT_RUNTIME_MONITOR_HISTORY_LIMIT = 400;
const DEFAULT_RUNTIME_MONITOR_HISTORY_MAX_BYTES = 2 * 1024 * 1024;
const MAX_RUNTIME_MONITOR_HISTORY_LIMIT = 1000;
const MAX_RUNTIME_MONITOR_HISTORY_MAX_BYTES = 4 * 1024 * 1024;

export type MagiRuntimeMonitorHistoryEvent = Record<string, unknown>;

export interface MagiRuntimeMonitorHistoryResponse {
    events: MagiRuntimeMonitorHistoryEvent[];
    oldestSeq: number;
    latestSeq: number;
    truncated: boolean;
    hasMoreBefore: boolean;
}

export interface MagiRuntimeMonitorHistoryOptions {
    beforeSeq?: number;
    limit?: number;
    maxBytes?: number;
    signal?: AbortSignal;
}

function emptyRuntimeMonitorHistory(): MagiRuntimeMonitorHistoryResponse {
    return {
        events: [],
        oldestSeq: 0,
        latestSeq: 0,
        truncated: false,
        hasMoreBefore: false,
    };
}

function resolveMainUIArmorToken(): string {
    const session = getActiveMagiArmorSession();
    if (session?.routeClass !== "guardian" || session.channel !== "magi-main-ui") {
        return "";
    }
    return session.armorToken.trim();
}

function buildRuntimeMonitorHistoryHeaders(): Record<string, string> | null {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = resolveMainUIArmorToken();
    if (!token) {
        return null;
    }
    headers.Authorization = `Bearer ${token}`;
    return headers;
}

function normalizeRuntimeMonitorHistory(raw: unknown): MagiRuntimeMonitorHistoryResponse {
    if (!raw || typeof raw !== "object") {
        return emptyRuntimeMonitorHistory();
    }
    const rawEvents = Reflect.get(raw, "events");
    if (!Array.isArray(rawEvents)) {
        return emptyRuntimeMonitorHistory();
    }
    const events = rawEvents.filter(
        (item): item is MagiRuntimeMonitorHistoryEvent => typeof item === "object" && item !== null,
    );
    const oldestSeq = Reflect.get(raw, "oldestSeq");
    const latestSeq = Reflect.get(raw, "latestSeq");
    return {
        events,
        oldestSeq: typeof oldestSeq === "number" && Number.isFinite(oldestSeq) ? oldestSeq : 0,
        latestSeq: typeof latestSeq === "number" && Number.isFinite(latestSeq) ? latestSeq : 0,
        truncated: Reflect.get(raw, "truncated") === true,
        hasMoreBefore: Reflect.get(raw, "hasMoreBefore") === true,
    };
}

function clampRuntimeMonitorHistoryBudget(value: number | undefined, fallback: number, maximum: number): number {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        return fallback;
    }
    return Math.min(Math.floor(value), maximum);
}

export async function fetchMagiRuntimeMonitorHistory(
    afterSeq = 0,
    options: MagiRuntimeMonitorHistoryOptions = {},
): Promise<MagiRuntimeMonitorHistoryResponse> {
    try {
        const headers = buildRuntimeMonitorHistoryHeaders();
        if (!headers) {
            return emptyRuntimeMonitorHistory();
        }
        const beforeSeq = typeof options.beforeSeq === "number" && Number.isFinite(options.beforeSeq) && options.beforeSeq > 0
            ? Math.floor(options.beforeSeq)
            : 0;
        const normalizedAfterSeq = Number.isFinite(afterSeq) && afterSeq > 0 ? Math.floor(afterSeq) : 0;
        const limit = clampRuntimeMonitorHistoryBudget(
            options.limit,
            DEFAULT_RUNTIME_MONITOR_HISTORY_LIMIT,
            MAX_RUNTIME_MONITOR_HISTORY_LIMIT,
        );
        const maxBytes = clampRuntimeMonitorHistoryBudget(
            options.maxBytes,
            DEFAULT_RUNTIME_MONITOR_HISTORY_MAX_BYTES,
            MAX_RUNTIME_MONITOR_HISTORY_MAX_BYTES,
        );
        const response = await fetch(MAGI_RUNTIME_MONITOR_HISTORY_ENDPOINT, {
            method: "POST",
            credentials: "include",
            headers,
            body: JSON.stringify({
                afterSeq: beforeSeq > 0 ? 0 : normalizedAfterSeq,
                ...(beforeSeq > 0 ? { beforeSeq } : {}),
                limit,
                maxBytes,
            }),
            ...(options.signal ? { signal: options.signal } : {}),
        });
        if (!response.ok) {
            return emptyRuntimeMonitorHistory();
        }
        const payload = await response.json().catch(() => ({}));
        return normalizeRuntimeMonitorHistory(payload);
    } catch {
        return emptyRuntimeMonitorHistory();
    }
}
