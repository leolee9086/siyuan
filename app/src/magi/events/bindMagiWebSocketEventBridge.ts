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

    const connect = () => {
        if (disposed) {
            return;
        }
        const nextSocket = createWebSocket(buildMagiWebSocketURL(sessionId));
        ws = nextSocket;

        nextSocket.onopen = () => {
            currentDelay = reconnectDelay;
        };
        nextSocket.onmessage = (event) => {
            try {
                const payload: unknown = JSON.parse(event.data);
                dispatchMagiWebSocketMessage(eventBus, payload);
            } catch (error) {
                console.warn("[magi-ws-bridge] invalid ws payload", error);
            }
        };
        nextSocket.onclose = () => {
            if (!disposed) {
                scheduleReconnect();
            }
        };
        nextSocket.onerror = () => {
            // onclose 负责重连调度，这里仅保留占位避免浏览器默认报错中断。
        };
    };

    connect();

    return {
        sessionId,
        disconnect: () => {
            disposed = true;
            clearReconnectTimer();
            if (ws && ws.readyState <= WebSocket.OPEN) {
                ws.close();
            }
            ws = null;
        },
    };
}
