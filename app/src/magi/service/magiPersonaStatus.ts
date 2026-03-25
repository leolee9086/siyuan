import { getSafeSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import type { MagiRuntimeStatus } from "../composables/useMagi.types";

const MAGI_PERSONA_STATUS_ENDPOINT = "/api/s-forge/magi/v1/persona/status";

export interface MagiPersonaStatus {
    subjectName: string;
    subjectId: string;
    isComplete: boolean;
    usingPreset: boolean;
    presetName: string;
    runtimeStatus: MagiRuntimeStatus | null;
}

function resolveWorkspaceAPIToken(): string {
    try {
        const token = getSafeSiyuanConfig()?.api?.token;
        return String(token ?? "").trim();
    } catch {
        return "";
    }
}

function buildPersonaStatusRequestHeaders(): Record<string, string> {
    const token = resolveWorkspaceAPIToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

function normalizeMagiPersonaStatus(raw: unknown): MagiPersonaStatus | null {
    if (!raw || typeof raw !== "object") {
        return null;
    }
    const subjectName = String(Reflect.get(raw, "subject_name") ?? "").trim();
    const subjectId = String(Reflect.get(raw, "subject_id") ?? "").trim();
    const isComplete = Boolean(Reflect.get(raw, "is_complete"));
    const usingPreset = Boolean(Reflect.get(raw, "using_preset"));
    const presetName = String(Reflect.get(raw, "preset_name") ?? "").trim();
    const runtimeStatus = normalizeRuntimeStatus(Reflect.get(raw, "runtime"));

    return {
        subjectName,
        subjectId,
        isComplete,
        usingPreset,
        presetName,
        runtimeStatus,
    };
}

function normalizeRuntimeStatus(raw: unknown): MagiRuntimeStatus | null {
    if (!raw || typeof raw !== "object") {
        return null;
    }

    const state = String(Reflect.get(raw, "state") ?? "").trim();
    if (state !== "sleeping" && state !== "heartbeat" && state !== "external") {
        return null;
    }

    return {
        state,
        awake: Boolean(Reflect.get(raw, "awake")),
        wakeSource: readOptionalString(raw, "wakeSource"),
        reason: readOptionalString(raw, "reason"),
        dominantSeel: readOptionalString(raw, "dominantSeel"),
        dominantStance: readOptionalString(raw, "dominantStance"),
        dominantUpdatedAt: readOptionalNumber(raw, "dominantUpdatedAt"),
        currentRoundId: readOptionalString(raw, "currentRoundId"),
        currentTask: readOptionalString(raw, "currentTask"),
        lastHeartbeatAt: readOptionalNumber(raw, "lastHeartbeatAt"),
        lastWakeAt: readOptionalNumber(raw, "lastWakeAt"),
        lastSleepAt: readOptionalNumber(raw, "lastSleepAt"),
        lastSleepSummary: readOptionalString(raw, "lastSleepSummary"),
        updatedAt: readOptionalNumber(raw, "updatedAt"),
    };
}

function readOptionalString(raw: object, key: string): string | undefined {
    const value = String(Reflect.get(raw, key) ?? "").trim();
    return value || undefined;
}

function readOptionalNumber(raw: object, key: string): number | undefined {
    const value = Reflect.get(raw, key);
    return typeof value === "number" ? value : undefined;
}

export async function fetchMagiPersonaStatus(): Promise<MagiPersonaStatus | null> {
    try {
        const response = await fetch(MAGI_PERSONA_STATUS_ENDPOINT, {
            method: "POST",
            credentials: "include",
            headers: buildPersonaStatusRequestHeaders(),
        });
        if (!response.ok) {
            return null;
        }
        const payload = await response.json().catch(() => ({}));
        return normalizeMagiPersonaStatus(payload);
    } catch {
        return null;
    }
}
