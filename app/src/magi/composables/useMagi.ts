/**
 * MAGI系统Vue Composable
 *
 * 从 toread/MAGI/composables/useMagi.js 迁移。
 * 提供MAGI系统的响应式状态管理和初始化逻辑。
 */

// [TASK] T2.2 迁移composables和工具函数 - useMagi

import { computed, reactive, ref, watch } from "vue";
import type { ConnectionStatus, MagiRuntimeStatus, UseMagiOptions, UseMagiReturn, WrappedSeel } from "./useMagi.types";
import type { MagiEventBus } from "../events/magiEventBus.types";
import type { MagiMessage } from "../utils/messageFactory.types";
import { createMagiEventBus } from "../events/magiEventBus";
import { bindMagiProjector } from "../events/magiProjector";
import { bindMagiWebSocketEventBridge } from "../events/bindMagiWebSocketEventBridge";
import { fetchMagiPersonaStatus } from "../service/magiPersonaStatus";
import { MAGI_IDENTITY_SESSION_CHANGED_EVENT } from "../service/magiIdentitySession";
import { MAGI_RUNTIME_MONITOR_SESSION_ID } from "../adapters/magiStandardLLMAdapter.backend";
import { syncWrappedSeelConnectionStatus, initializeWrappedSeels } from "./useMagi.seels";
import { appendBlockedPersonaMessageIfNeeded, reinitializeMAGI, resolvePromptInjectionsForInit } from "./useMagi.reinitialize";
import {
    applyDominantRuntimeHintFromReplyStarted,
    buildRuntimeStatusFromEvent,
    cloneRuntimeStatus,
    createRuntimeProjectionSequenceGuard,
    replayRuntimeMonitorHistory,
    resolveConnectionStatusFromPersonaStatus,
    resolvePersonaNameFromStatus,
} from "./useMagi.runtime";

function createMagiRuntimeDisposer(disposers: Array<() => void>) {
    let disposed = false;
    return () => {
        if (disposed) {
            return;
        }
        disposed = true;
        for (const dispose of disposers) {
            dispose();
        }
    };
}

function bindRuntimeWebSocket(
    eventBus: MagiEventBus,
    websocketConnectionStatus: { value: ConnectionStatus },
    runtimeStatus: { value: MagiRuntimeStatus | null },
) {
    return bindMagiWebSocketEventBridge(eventBus, {
        sessionId: MAGI_RUNTIME_MONITOR_SESSION_ID,
        onConnecting: () => {
            websocketConnectionStatus.value = "connecting";
        },
        onOpen: () => {
            websocketConnectionStatus.value = "connected";
        },
        onClose: () => {
            runtimeStatus.value = null;
            websocketConnectionStatus.value = "disconnected";
        },
    });
}

function bindRuntimeStatusSubscriptions(
    eventBus: MagiEventBus,
    runtimeStatus: { value: MagiRuntimeStatus | null },
) {
    const shouldApplyRuntimeProjection = createRuntimeProjectionSequenceGuard();
    return [
        eventBus.subscribe("RUNTIME_STATUS_UPDATED", (payload) => {
            if (shouldApplyRuntimeProjection(payload.seq)) {
                runtimeStatus.value = buildRuntimeStatusFromEvent(payload);
            }
        }),
        eventBus.subscribe("SEEL_REPLY_STARTED", (payload) => {
            if (shouldApplyRuntimeProjection(payload.seq)) {
                runtimeStatus.value = applyDominantRuntimeHintFromReplyStarted(runtimeStatus.value, payload);
            }
        }),
    ];
}

function bindRuntimeMonitorHistoryReplay(eventBus: MagiEventBus) {
    if (typeof window === "undefined") {
        return () => undefined;
    }
    const replayHistory = () => {
        void replayRuntimeMonitorHistory(eventBus);
    };
    window.addEventListener(MAGI_IDENTITY_SESSION_CHANGED_EVENT, replayHistory);
    return () => window.removeEventListener(MAGI_IDENTITY_SESSION_CHANGED_EVENT, replayHistory);
}

async function initializeMagiRuntime(params: {
    seels: WrappedSeel[];
    connectionStatus: { value: ConnectionStatus };
    websocketConnectionStatus: { value: ConnectionStatus };
    runtimeStatus: { value: MagiRuntimeStatus | null };
    consensusMessages: MagiMessage[];
    eventBus: MagiEventBus;
    options?: UseMagiOptions;
}): Promise<void> {
    const initialPersonaStatus = await fetchMagiPersonaStatus();
    if (initialPersonaStatus?.runtimeStatus) {
        params.runtimeStatus.value = cloneRuntimeStatus(initialPersonaStatus.runtimeStatus);
    }
    await appendBlockedPersonaMessageIfNeeded(params.consensusMessages, initialPersonaStatus);
    params.connectionStatus.value = resolveConnectionStatusFromPersonaStatus(
        params.connectionStatus.value,
        initialPersonaStatus,
    );
    await initializeWrappedSeels(
        params.seels,
        params.websocketConnectionStatus,
        await resolvePromptInjectionsForInit(params.options?.promptInjections),
        resolvePersonaNameFromStatus(initialPersonaStatus),
    );
    await replayRuntimeMonitorHistory(params.eventBus);
}

function createUseMagiReturn(params: {
    seels: WrappedSeel[];
    connectionStatus: UseMagiReturn["connectionStatus"];
    websocketConnectionStatus: UseMagiReturn["websocketConnectionStatus"];
    consensusMessages: MagiMessage[];
    isAnySeelLoading: UseMagiReturn["isAnySeelLoading"];
    runtimeStatus: UseMagiReturn["runtimeStatus"];
    eventBus: MagiEventBus;
    disposeRuntimeBindings: () => void;
}): UseMagiReturn {
    return {
        seels: params.seels,
        connectionStatus: params.connectionStatus,
        websocketConnectionStatus: params.websocketConnectionStatus,
        consensusMessages: params.consensusMessages,
        isAnySeelLoading: params.isAnySeelLoading,
        runtimeStatus: params.runtimeStatus,
        initializeMAGI: (options) => reinitializeMAGI({
            seels: params.seels,
            connectionStatus: params.connectionStatus,
            websocketConnectionStatus: params.websocketConnectionStatus,
            runtimeStatus: params.runtimeStatus,
            consensusMessages: params.consensusMessages,
            eventBus: params.eventBus,
            ...(options ? { options } : {}),
        }),
        destroy: () => {
            params.disposeRuntimeBindings();
            params.seels.splice(0, params.seels.length);
            params.consensusMessages.splice(0, params.consensusMessages.length);
            params.runtimeStatus.value = null;
            params.websocketConnectionStatus.value = "disconnected";
        },
    };
}

export async function useMagi(options?: UseMagiOptions): Promise<UseMagiReturn> {
    const seels: WrappedSeel[] = reactive([]);
    const connectionStatus = ref<ConnectionStatus>("connecting");
    const websocketConnectionStatus = ref<ConnectionStatus>("connecting");
    const consensusMessages: MagiMessage[] = reactive([]);
    const runtimeStatus = ref<MagiRuntimeStatus | null>(null);
    const isAnySeelLoading = computed(() => seels.some((seel) => seel.loading));
    const eventBus = await createMagiEventBus();
    const stopConnectionWatch = watch(websocketConnectionStatus, (nextStatus) => {
        syncWrappedSeelConnectionStatus(seels, nextStatus);
    }, { immediate: true });
    const websocketBridge = bindRuntimeWebSocket(eventBus, websocketConnectionStatus, runtimeStatus);
    const runtimeStatusSubscriptions = bindRuntimeStatusSubscriptions(eventBus, runtimeStatus);
    const stopProjector = await bindMagiProjector(eventBus, { seels, consensusMessages });
    const stopRuntimeHistoryReplay = bindRuntimeMonitorHistoryReplay(eventBus);
    const disposeRuntimeBindings = createMagiRuntimeDisposer([
        stopConnectionWatch,
        websocketBridge.disconnect,
        ...runtimeStatusSubscriptions,
        stopProjector,
        stopRuntimeHistoryReplay,
    ]);
    try {
        await initializeMagiRuntime({
            seels,
            connectionStatus,
            websocketConnectionStatus,
            runtimeStatus,
            consensusMessages,
            eventBus,
            ...(options ? { options } : {}),
        });
    } catch (error) {
        disposeRuntimeBindings();
        throw error;
    }
    return createUseMagiReturn({
        seels,
        connectionStatus,
        websocketConnectionStatus,
        consensusMessages,
        isAnySeelLoading,
        runtimeStatus,
        eventBus,
        disposeRuntimeBindings,
    });
}
