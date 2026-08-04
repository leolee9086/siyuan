import type { ConnectionStatus, MagiRuntimeStatus, WrappedSeel } from "./useMagi.types";
import type { MagiEventBus } from "../events/magiEventBus.types";
import type { MagiMessage } from "../utils/messageFactory.types";
import { bindMagiProjector } from "../events/magiProjector";
import { bindMagiWebSocketEventBridge } from "../events/bindMagiWebSocketEventBridge";
import {
    getActiveMagiArmorSession,
    MAGI_IDENTITY_SESSION_CHANGED_EVENT,
} from "../service/magiIdentitySession";
import { MAGI_RUNTIME_MONITOR_SESSION_ID } from "../adapters/magiStandardLLMAdapter.backend";
import {
    applyDominantRuntimeHintFromReplyStarted,
    buildRuntimeStatusFromEvent,
    createRuntimeProjectionSequenceGuard,
    replayRuntimeMonitorHistory,
} from "./useMagi.runtime";

export interface MagiRuntimeMonitorAccess {
    pause: (clearProjection?: boolean) => void;
    resume: (clearProjection?: boolean) => Promise<void>;
    refresh: (clearProjection?: boolean) => Promise<void>;
    dispose: () => void;
}

interface RuntimeMonitorAccessParams {
    eventBus: MagiEventBus;
    seels: WrappedSeel[];
    consensusMessages: MagiMessage[];
    runtimeStatus: { value: MagiRuntimeStatus | null };
    websocketConnectionStatus: { value: ConnectionStatus };
}

interface RuntimeMonitorAccessState {
    params: RuntimeMonitorAccessParams;
    disposed: boolean;
    paused: boolean;
    generation: number;
    activeDisposers: Array<() => void>;
    replayAbortController: AbortController | null;
    identitySessionChanged: () => void;
}

function resolveRuntimeMonitorArmorToken(): string {
    const session = getActiveMagiArmorSession();
    if (session?.routeClass !== "guardian" || session.channel !== "magi-main-ui") {
        return "";
    }
    return session.armorToken.trim();
}

function clearRuntimeMonitorProjection(params: RuntimeMonitorAccessParams): void {
    for (const seel of params.seels) {
        seel.loading = false;
        seel.messages.splice(0, seel.messages.length);
    }
    params.consensusMessages.splice(0, params.consensusMessages.length);
    params.runtimeStatus.value = null;
    params.websocketConnectionStatus.value = "disconnected";
}

function disposeRuntimeMonitorBindings(disposers: Array<() => void>): void {
    for (const dispose of disposers) {
        dispose();
    }
}

function stopActiveRuntimeMonitorBindings(state: RuntimeMonitorAccessState): void {
    state.replayAbortController?.abort();
    state.replayAbortController = null;
    const disposers = state.activeDisposers;
    state.activeDisposers = [];
    disposeRuntimeMonitorBindings(disposers);
}

function isRuntimeMonitorRefreshCurrent(state: RuntimeMonitorAccessState, generation: number): boolean {
    return !state.disposed && !state.paused && state.generation === generation;
}

function bindRuntimeStatusSubscriptions(
    eventBus: MagiEventBus,
    runtimeStatus: { value: MagiRuntimeStatus | null },
): Array<() => void> {
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

function bindRuntimeWebSocket(params: {
    eventBus: MagiEventBus;
    armorToken: string;
    websocketConnectionStatus: { value: ConnectionStatus };
    runtimeStatus: { value: MagiRuntimeStatus | null };
}) {
    return bindMagiWebSocketEventBridge(params.eventBus, {
        sessionId: MAGI_RUNTIME_MONITOR_SESSION_ID,
        armorToken: params.armorToken,
        onConnecting: () => {
            params.websocketConnectionStatus.value = "connecting";
        },
        onOpen: () => {
            params.websocketConnectionStatus.value = "connected";
        },
        onClose: () => {
            params.runtimeStatus.value = null;
            params.websocketConnectionStatus.value = "disconnected";
        },
    });
}

async function establishRuntimeMonitorBindings(
    state: RuntimeMonitorAccessState,
    armorToken: string,
    refreshGeneration: number,
): Promise<Array<() => void> | null> {
    const params = state.params;
    const localDisposers = bindRuntimeStatusSubscriptions(params.eventBus, params.runtimeStatus);
    try {
        localDisposers.push(await bindMagiProjector(params.eventBus, {
            seels: params.seels,
            consensusMessages: params.consensusMessages,
        }));
    } catch (error) {
        disposeRuntimeMonitorBindings(localDisposers);
        throw error;
    }
    if (!isRuntimeMonitorRefreshCurrent(state, refreshGeneration)) {
        disposeRuntimeMonitorBindings(localDisposers);
        return null;
    }
    try {
        const bridge = bindRuntimeWebSocket({
            eventBus: params.eventBus,
            armorToken,
            websocketConnectionStatus: params.websocketConnectionStatus,
            runtimeStatus: params.runtimeStatus,
        });
        localDisposers.unshift(bridge.disconnect);
    } catch (error) {
        disposeRuntimeMonitorBindings(localDisposers);
        throw error;
    }
    return localDisposers;
}

async function refreshRuntimeMonitorAccess(
    state: RuntimeMonitorAccessState,
    shouldClearProjection = true,
): Promise<void> {
    const refreshGeneration = ++state.generation;
    stopActiveRuntimeMonitorBindings(state);
    if (state.disposed || state.paused) {
        if (shouldClearProjection) {
            clearRuntimeMonitorProjection(state.params);
        }
        return;
    }
    const armorToken = resolveRuntimeMonitorArmorToken();
    if (shouldClearProjection || !armorToken) {
        clearRuntimeMonitorProjection(state.params);
    }
    if (!armorToken) {
        return;
    }
    const disposers = await establishRuntimeMonitorBindings(state, armorToken, refreshGeneration);
    if (!disposers) {
        return;
    }
    if (!isRuntimeMonitorRefreshCurrent(state, refreshGeneration)) {
        disposeRuntimeMonitorBindings(disposers);
        return;
    }
    state.activeDisposers = disposers;
    const replayAbortController = new AbortController();
    state.replayAbortController = replayAbortController;
    try {
        await replayRuntimeMonitorHistory(
            state.params.eventBus,
            () => isRuntimeMonitorRefreshCurrent(state, refreshGeneration) &&
                resolveRuntimeMonitorArmorToken() === armorToken,
            replayAbortController.signal,
        );
    } finally {
        if (state.replayAbortController === replayAbortController) {
            state.replayAbortController = null;
        }
    }
}

function pauseRuntimeMonitorAccess(state: RuntimeMonitorAccessState, shouldClearProjection = true): void {
    state.paused = true;
    state.generation += 1;
    stopActiveRuntimeMonitorBindings(state);
    if (shouldClearProjection) {
        clearRuntimeMonitorProjection(state.params);
    }
}

async function resumeRuntimeMonitorAccess(state: RuntimeMonitorAccessState, shouldClearProjection = true): Promise<void> {
    state.paused = false;
    await refreshRuntimeMonitorAccess(state, shouldClearProjection);
}

function disposeRuntimeMonitorAccess(state: RuntimeMonitorAccessState): void {
    if (state.disposed) {
        return;
    }
    state.disposed = true;
    state.generation += 1;
    stopActiveRuntimeMonitorBindings(state);
    if (typeof window !== "undefined") {
        window.removeEventListener(MAGI_IDENTITY_SESSION_CHANGED_EVENT, state.identitySessionChanged);
    }
}

function handleIdentitySessionChanged(state: RuntimeMonitorAccessState): void {
    void refreshRuntimeMonitorAccess(state).catch((error: unknown) => {
        console.warn("[magi-runtime-monitor] failed to refresh protected monitor access", error);
    });
}

export function createMagiRuntimeMonitorAccess(params: RuntimeMonitorAccessParams): MagiRuntimeMonitorAccess {
    const state: RuntimeMonitorAccessState = {
        params,
        disposed: false,
        paused: false,
        generation: 0,
        activeDisposers: [],
        replayAbortController: null,
        identitySessionChanged: () => undefined,
    };
    state.identitySessionChanged = handleIdentitySessionChanged.bind(null, state);
    if (typeof window !== "undefined") {
        window.addEventListener(MAGI_IDENTITY_SESSION_CHANGED_EVENT, state.identitySessionChanged);
    }
    return {
        pause: pauseRuntimeMonitorAccess.bind(null, state),
        resume: resumeRuntimeMonitorAccess.bind(null, state),
        refresh: refreshRuntimeMonitorAccess.bind(null, state),
        dispose: disposeRuntimeMonitorAccess.bind(null, state),
    };
}
