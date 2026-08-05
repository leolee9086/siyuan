import type { MagiEventBus } from "./magiEventBus.types";
import {
    MagiWebSocketBridgeOptions,
    MagiWebSocketBridge,
    DEFAULT_RECONNECT_DELAY_MS,
    DEFAULT_MAX_RECONNECT_DELAY_MS,
    buildMagiWebSocketURL,
} from "./magiWebSocketBridge";
import { dispatchMagiWebSocketMessage } from "./dispatchMagiWebSocketMessage";

const MAGI_RUNTIME_MONITOR_WEBSOCKET_PROTOCOL = "magi-runtime-monitor-v1";

interface MagiWebSocketBridgeRuntime {
    eventBus: MagiEventBus;
    options: MagiWebSocketBridgeOptions;
    sessionId: string;
    armorToken: string;
    reconnectDelay: number;
    maxReconnectDelay: number;
    createWebSocket: (url: string, protocols?: string | string[]) => WebSocket;
    ws: WebSocket | null;
    disposed: boolean;
    reconnectTimer: ReturnType<typeof setTimeout> | null;
    currentDelay: number;
    bridgeOpen: boolean;
}

function clearReconnectTimer(runtime: MagiWebSocketBridgeRuntime): void {
    if (!runtime.reconnectTimer) {
        return;
    }
    clearTimeout(runtime.reconnectTimer);
    runtime.reconnectTimer = null;
}

function markBridgeOpen(runtime: MagiWebSocketBridgeRuntime, socket: WebSocket): boolean {
    if (runtime.disposed || runtime.ws !== socket || runtime.bridgeOpen || socket.readyState !== WebSocket.OPEN) {
        return false;
    }
    runtime.bridgeOpen = true;
    clearReconnectTimer(runtime);
    runtime.currentDelay = runtime.reconnectDelay;
    runtime.options.onOpen?.();
    return true;
}

function markBridgeClosed(runtime: MagiWebSocketBridgeRuntime, socket: WebSocket): boolean {
    if (runtime.ws !== socket) {
        return false;
    }
    runtime.bridgeOpen = false;
    runtime.ws = null;
    return true;
}

function scheduleReconnect(runtime: MagiWebSocketBridgeRuntime): void {
    if (runtime.disposed) {
        return;
    }
    clearReconnectTimer(runtime);
    runtime.reconnectTimer = setTimeout(() => connectWebSocket(runtime), runtime.currentDelay);
    runtime.currentDelay = Math.min(runtime.currentDelay * 2, runtime.maxReconnectDelay);
}

function handleSocketMessage(runtime: MagiWebSocketBridgeRuntime, socket: WebSocket, event: MessageEvent<string>): void {
    markBridgeOpen(runtime, socket);
    try {
        const payload: unknown = JSON.parse(event.data);
        dispatchMagiWebSocketMessage(runtime.eventBus, payload);
    } catch (error) {
        console.warn("[magi-ws-bridge] invalid ws payload", error);
    }
}

function connectWebSocket(runtime: MagiWebSocketBridgeRuntime): void {
    if (runtime.disposed) {
        return;
    }
    runtime.bridgeOpen = false;
    runtime.options.onConnecting?.();
    const websocketURL = buildMagiWebSocketURL(runtime.sessionId);
    const nextSocket = runtime.armorToken
        ? runtime.createWebSocket(websocketURL, [
            MAGI_RUNTIME_MONITOR_WEBSOCKET_PROTOCOL,
            runtime.armorToken,
        ])
        : runtime.createWebSocket(websocketURL);
    runtime.ws = nextSocket;
    nextSocket.onopen = () => markBridgeOpen(runtime, nextSocket);
    nextSocket.onmessage = (event) => handleSocketMessage(runtime, nextSocket, event);
    nextSocket.onclose = () => {
        const closedCurrentSocket = markBridgeClosed(runtime, nextSocket);
        if (!closedCurrentSocket || runtime.disposed) {
            return;
        }
        runtime.options.onClose?.();
        scheduleReconnect(runtime);
    };
    nextSocket.onerror = () => {
        // onclose 负责重连调度，这里仅保留占位避免浏览器默认报错中断。
    };
    markBridgeOpen(runtime, nextSocket);
}

function createBridgeRuntime(eventBus: MagiEventBus, options: MagiWebSocketBridgeOptions): MagiWebSocketBridgeRuntime {
    const reconnectDelay = options.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS;
    const maxReconnectDelay = options.maxReconnectDelayMs ?? DEFAULT_MAX_RECONNECT_DELAY_MS;
    const createWebSocket = options.websocketFactory ?? ((url: string, protocols?: string | string[]) =>
        protocols ? new WebSocket(url, protocols) : new WebSocket(url));
    return {
        eventBus,
        options,
        sessionId: options.sessionId.trim(),
        armorToken: options.armorToken?.trim() ?? "",
        reconnectDelay,
        maxReconnectDelay,
        createWebSocket,
        ws: null,
        disposed: false,
        reconnectTimer: null,
        currentDelay: reconnectDelay,
        bridgeOpen: false,
    };
}

function disconnectWebSocket(runtime: MagiWebSocketBridgeRuntime): void {
    runtime.disposed = true;
    clearReconnectTimer(runtime);
    const activeSocket = runtime.ws;
    runtime.ws = null;
    if (activeSocket && activeSocket.readyState <= WebSocket.OPEN) {
        activeSocket.close();
    }
    runtime.bridgeOpen = false;
}

/** 建立 MAGI websocket 事件桥接（后端事件 -> 前端事件总线）。 */
export function bindMagiWebSocketEventBridge(
    eventBus: MagiEventBus,
    options: MagiWebSocketBridgeOptions,
): MagiWebSocketBridge {
    const runtime = createBridgeRuntime(eventBus, options);
    connectWebSocket(runtime);
    return {
        sessionId: runtime.sessionId,
        disconnect: () => disconnectWebSocket(runtime),
    };
}
