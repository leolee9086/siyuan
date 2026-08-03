/**
 * MAGI系统Vue Composable
 *
 * 从 toread/MAGI/composables/useMagi.js 迁移。
 * 提供MAGI系统的响应式状态管理和初始化逻辑。
 */

// [TASK] T2.2 迁移composables和工具函数 - useMagi

import { computed, reactive, ref, watch } from "vue";
import type { ConnectionStatus, MagiRuntimeStatus, UseMagiOptions, UseMagiReturn, WrappedSeel } from "./useMagi.types";
import type { MagiMessage } from "../utils/messageFactory.types";
import { createMagiEventBus } from "../events/magiEventBus";
import { fetchMagiPersonaStatus } from "../service/magiPersonaStatus";
import { syncWrappedSeelConnectionStatus, initializeWrappedSeels } from "./useMagi.seels";
import { appendBlockedPersonaMessageIfNeeded, reinitializeMAGI, resolvePromptInjectionsForInit } from "./useMagi.reinitialize";
import type { MagiRuntimeMonitorAccess } from "./useMagi.monitorAccess";
import { createMagiRuntimeMonitorAccess } from "./useMagi.monitorAccess";
import {
    cloneRuntimeStatus,
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

async function initializeMagiRuntime(params: {
    seels: WrappedSeel[];
    connectionStatus: { value: ConnectionStatus };
    websocketConnectionStatus: { value: ConnectionStatus };
    runtimeStatus: { value: MagiRuntimeStatus | null };
    consensusMessages: MagiMessage[];
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
}

function createUseMagiReturn(params: {
    seels: WrappedSeel[];
    connectionStatus: UseMagiReturn["connectionStatus"];
    websocketConnectionStatus: UseMagiReturn["websocketConnectionStatus"];
    consensusMessages: MagiMessage[];
    isAnySeelLoading: UseMagiReturn["isAnySeelLoading"];
    runtimeStatus: UseMagiReturn["runtimeStatus"];
    monitorAccess: MagiRuntimeMonitorAccess;
    disposeRuntimeBindings: () => void;
}): UseMagiReturn {
    return {
        seels: params.seels,
        connectionStatus: params.connectionStatus,
        websocketConnectionStatus: params.websocketConnectionStatus,
        consensusMessages: params.consensusMessages,
        isAnySeelLoading: params.isAnySeelLoading,
        runtimeStatus: params.runtimeStatus,
        initializeMAGI: async (options) => {
            params.monitorAccess.pause(false);
            await reinitializeMAGI({
                seels: params.seels,
                connectionStatus: params.connectionStatus,
                websocketConnectionStatus: params.websocketConnectionStatus,
                runtimeStatus: params.runtimeStatus,
                consensusMessages: params.consensusMessages,
                ...(options ? { options } : {}),
            });
            await params.monitorAccess.resume(false);
        },
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
    let monitorAccess: MagiRuntimeMonitorAccess | null = null;
    const disposeRuntimeBindings = createMagiRuntimeDisposer([
        stopConnectionWatch,
        () => monitorAccess?.dispose(),
    ]);
    try {
        await initializeMagiRuntime({
            seels,
            connectionStatus,
            websocketConnectionStatus,
            runtimeStatus,
            consensusMessages,
            ...(options ? { options } : {}),
        });
        monitorAccess = createMagiRuntimeMonitorAccess({
            eventBus,
            seels,
            consensusMessages,
            runtimeStatus,
            websocketConnectionStatus,
        });
        await monitorAccess.refresh();
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
        monitorAccess,
        disposeRuntimeBindings,
    });
}
