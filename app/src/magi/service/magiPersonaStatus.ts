import { getSafeSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";

const MAGI_PERSONA_STATUS_ENDPOINT = "/api/s-forge/magi/v1/persona/status";

export interface MagiPersonaStatus {
    subjectName: string;
    subjectId: string;
    isComplete: boolean;
    usingPreset: boolean;
    presetName: string;
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

    return {
        subjectName,
        subjectId,
        isComplete,
        usingPreset,
        presetName,
    };
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
