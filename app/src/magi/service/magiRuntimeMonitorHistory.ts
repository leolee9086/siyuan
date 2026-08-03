import { getActiveMagiArmorSession } from "./magiIdentitySession";

const MAGI_RUNTIME_MONITOR_HISTORY_ENDPOINT = "/api/s-forge/magi/v1/runtime/monitor/history";

export type MagiRuntimeMonitorHistoryEvent = Record<string, unknown>;

export interface MagiRuntimeMonitorHistoryResponse {
    events: MagiRuntimeMonitorHistoryEvent[];
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
        return { events: [] };
    }
    const rawEvents = Reflect.get(raw, "events");
    if (!Array.isArray(rawEvents)) {
        return { events: [] };
    }
    const events = rawEvents.filter(
        (item): item is MagiRuntimeMonitorHistoryEvent => typeof item === "object" && item !== null,
    );
    return { events };
}

export async function fetchMagiRuntimeMonitorHistory(afterSeq = 0): Promise<MagiRuntimeMonitorHistoryResponse> {
    try {
        const headers = buildRuntimeMonitorHistoryHeaders();
        if (!headers) {
            return { events: [] };
        }
        const response = await fetch(MAGI_RUNTIME_MONITOR_HISTORY_ENDPOINT, {
            method: "POST",
            credentials: "include",
            headers,
            body: JSON.stringify({ afterSeq }),
        });
        if (!response.ok) {
            return { events: [] };
        }
        const payload = await response.json().catch(() => ({}));
        return normalizeRuntimeMonitorHistory(payload);
    } catch {
        return { events: [] };
    }
}
