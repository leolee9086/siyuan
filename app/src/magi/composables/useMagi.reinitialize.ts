import type { ConnectionStatus, MagiRuntimeStatus, WrappedSeel } from "./useMagi.types";
import type { MagiPromptSet } from "../core/wise/wise.types";
import type { MagiMessage } from "../utils/messageFactory.types";
import { getMagiI18nText } from "../utils/magiI18n";
import { resolveStartupPromptInjectionsByActiveSeed } from "../prompts/personaRuntimePromptBuilder";
import { fetchMagiPersonaStatus } from "../service/magiPersonaStatus";
import { appendConsensusMessage } from "./useMagi.consensus";
import { initializeWrappedSeels } from "./useMagi.seels";
import {
    cloneRuntimeStatus,
    resolveConnectionStatusFromPersonaStatus,
    resolvePersonaNameFromStatus,
} from "./useMagi.runtime";

export async function resolvePromptInjectionsForInit(
    explicitPromptInjections?: MagiPromptSet,
): Promise<MagiPromptSet | undefined> {
    if (explicitPromptInjections) {
        return explicitPromptInjections;
    }
    const activeSeed = await resolveStartupPromptInjectionsByActiveSeed();
    return activeSeed?.promptInjections;
}

async function clearReactiveArrays(
    seels: WrappedSeel[],
    consensusMessages: MagiMessage[],
    clearMessages = true,
): Promise<void> {
    seels.splice(0, seels.length);
    if (clearMessages) {
        consensusMessages.splice(0, consensusMessages.length);
    }
}

export async function appendBlockedPersonaMessageIfNeeded(
    consensusMessages: MagiMessage[],
    status: Awaited<ReturnType<typeof fetchMagiPersonaStatus>>,
): Promise<void> {
    if (!status?.blocked || !status.message) {
        return;
    }
    await appendConsensusMessage(
        consensusMessages,
        "error",
        status.message,
        status.missingFields.length > 0 ? { missingFields: status.missingFields } : undefined,
    );
}

export async function reinitializeMAGI(params: {
    seels: WrappedSeel[];
    connectionStatus: { value: ConnectionStatus };
    websocketConnectionStatus: { value: ConnectionStatus };
    runtimeStatus: { value: MagiRuntimeStatus | null };
    consensusMessages: MagiMessage[];
    options?: { promptInjections?: MagiPromptSet; preserveConsensusMessages?: boolean };
}): Promise<void> {
    try {
        await clearReactiveArrays(params.seels, params.consensusMessages, !params.options?.preserveConsensusMessages);
        const promptInjections = await resolvePromptInjectionsForInit(params.options?.promptInjections);
        const personaStatus = await fetchMagiPersonaStatus();
        if (personaStatus?.runtimeStatus) {
            params.runtimeStatus.value = cloneRuntimeStatus(personaStatus.runtimeStatus);
        }
        await appendBlockedPersonaMessageIfNeeded(params.consensusMessages, personaStatus);
        await initializeWrappedSeels(
            params.seels,
            params.websocketConnectionStatus,
            promptInjections,
            resolvePersonaNameFromStatus(personaStatus),
        );
        params.connectionStatus.value = resolveConnectionStatusFromPersonaStatus(
            params.connectionStatus.value,
            personaStatus,
        );
        await appendConsensusMessage(params.consensusMessages, "system", getMagiI18nText("systemInitCompleted"));
    } catch (error) {
        params.connectionStatus.value = "error";
        const message = error instanceof Error ? error.message : String(error);
        await appendConsensusMessage(
            params.consensusMessages,
            "error",
            `${getMagiI18nText("systemInitFailedPrefix")}: ${message}`,
        );
    }
}
