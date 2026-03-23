import type { MagiEventBus } from "./magiEventBus.types";
import { MagiWebSocketBridgeOptions, MagiWebSocketBridge, DEFAULT_RECONNECT_DELAY_MS, DEFAULT_MAX_RECONNECT_DELAY_MS, buildMagiWebSocketURL } from "./magiWebSocketBridge";
import { dispatchMagiWebSocketMessage } from "./dispatchMagiWebSocketMessage";

/** 建立 MAGI websocket 事件桥接（后端事件 -> 前端事件总线）。 */

export function bindMagiWebSocketEventBridge(
    eventBus: MagiEventBus,
    options: MagiWebSocketBridgeOptions
): MagiWebSocketBridge {
    const reconnectDelay = options.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS;
    const maxReconnectDelay = options.maxReconnectDelayMs ?? DEFAULT_MAX_RECONNECT_DELAY_MS;
    const createWebSocket = options.websocketFactory ?? ((url: string) => new WebSocket(url));
    const sessionId = options.sessionId.trim();

    let ws: WebSocket | null = null;
    let disposed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let currentDelay = reconnectDelay;
    let bridgeOpen = false;

    const clearReconnectTimer = () => {
        if (!reconnectTimer) {
            return;
        }
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    };

    const scheduleReconnect = () => {
        if (disposed) {
            return;
        }
        clearReconnectTimer();
        reconnectTimer = setTimeout(() => {
            connect();
        }, currentDelay);
        currentDelay = Math.min(currentDelay * 2, maxReconnectDelay);
    };

    const markBridgeOpen = (socket: WebSocket): boolean => {
        if (disposed || ws !== socket || bridgeOpen || socket.readyState !== WebSocket.OPEN) {
            return false;
        }
        bridgeOpen = true;
        clearReconnectTimer();
        currentDelay = reconnectDelay;
        options.onOpen?.();
        return true;
    };

    const markBridgeClosed = (socket: WebSocket): boolean => {
        if (ws !== socket) {
            return false;
        }
        bridgeOpen = false;
        ws = null;
        return true;
    };

    const connect = () => {
        if (disposed) {
            return;
        }
        bridgeOpen = false;
        options.onConnecting?.();
        const nextSocket = createWebSocket(buildMagiWebSocketURL(sessionId));
        ws = nextSocket;

        nextSocket.onopen = () => {
            markBridgeOpen(nextSocket);
        };
        nextSocket.onmessage = (event) => {
            markBridgeOpen(nextSocket);
            try {
                const payload: unknown = JSON.parse(event.data);
                dispatchMagiWebSocketMessage(eventBus, payload);
            } catch (error) {
                console.warn("[magi-ws-bridge] invalid ws payload", error);
            }
        };
        nextSocket.onclose = () => {
            const closedCurrentSocket = markBridgeClosed(nextSocket);
            if (!closedCurrentSocket || disposed) {
                return;
            }
            options.onClose?.();
            scheduleReconnect();
        };
        nextSocket.onerror = () => {
            // onclose 负责重连调度，这里仅保留占位避免浏览器默认报错中断。
        };

        markBridgeOpen(nextSocket);
    };

    connect();

    return {
        sessionId,
        disconnect: () => {
            disposed = true;
            clearReconnectTimer();
            const activeSocket = ws;
            ws = null;
            if (activeSocket && activeSocket.readyState <= WebSocket.OPEN) {
                activeSocket.close();
            }
            bridgeOpen = false;
        },
    };
}
