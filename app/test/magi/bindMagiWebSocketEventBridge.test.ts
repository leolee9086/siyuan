import { describe, expect, it, vi } from "vitest";

class FakeWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;

    readonly url: string;
    readyState: number;
    onopen: ((event: Event) => void) | null = null;
    onmessage: ((event: MessageEvent<string>) => void) | null = null;
    onclose: ((event: CloseEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;

    constructor(url: string, readyState = FakeWebSocket.CONNECTING) {
        this.url = url;
        this.readyState = readyState;
    }

    emitOpen(): void {
        this.readyState = FakeWebSocket.OPEN;
        this.onopen?.({ type: "open" } as Event);
    }

    emitMessage(data: string): void {
        this.onmessage?.({ data } as MessageEvent<string>);
    }

    close(): void {
        this.readyState = FakeWebSocket.CLOSED;
        this.onclose?.({ type: "close" } as CloseEvent);
    }
}

function createRuntimeStatusEventPayload(sessionId: string): string {
    return JSON.stringify({
        cmd: "magiEvent",
        data: {
            sessionId,
            eventType: "RUNTIME_STATUS_UPDATED",
            roundId: "round-1",
            timestamp: 1,
            eventId: "event-1",
            seq: 1,
            state: "heartbeat",
            awake: true,
        },
    });
}

describe("bindMagiWebSocketEventBridge", () => {
    it("should send the armor token as a websocket subprotocol", async () => {
        vi.stubGlobal("location", {
            protocol: "http:",
            host: "example.test",
        });
        const eventBus = {
            emitWithMeta: vi.fn(),
        };
        const socket = new FakeWebSocket("ws://example.test");
        const websocketFactory = vi.fn(() => socket as unknown as WebSocket);
        const { bindMagiWebSocketEventBridge } = await import("../../src/magi/events/bindMagiWebSocketEventBridge");

        bindMagiWebSocketEventBridge(eventBus as never, {
            sessionId: "runtime-session",
            armorToken: "magi_ak_v1_token.signature",
            websocketFactory,
        });

        expect(websocketFactory).toHaveBeenCalledWith(
            "ws://example.test/ws?app=magi&id=runtime-session&type=main",
            ["magi_ak_v1_token.signature"],
        );
    });

    it("should mark the bridge open when the socket is already open after creation", async () => {
        vi.stubGlobal("location", {
            protocol: "http:",
            host: "example.test",
        });
        const openSpy = vi.fn();
        const connectingSpy = vi.fn();
        const eventBus = {
            emitWithMeta: vi.fn(),
        };
        const socket = new FakeWebSocket("ws://example.test", FakeWebSocket.OPEN);
        const { bindMagiWebSocketEventBridge } = await import("../../src/magi/events/bindMagiWebSocketEventBridge");

        bindMagiWebSocketEventBridge(eventBus as never, {
            sessionId: "runtime-session",
            websocketFactory: () => socket as unknown as WebSocket,
            onConnecting: connectingSpy,
            onOpen: openSpy,
        });

        expect(connectingSpy).toHaveBeenCalledTimes(1);
        expect(openSpy).toHaveBeenCalledTimes(1);
    });

    it("should synchronize open state from the socket before dispatching a message", async () => {
        vi.stubGlobal("location", {
            protocol: "http:",
            host: "example.test",
        });
        const openSpy = vi.fn();
        const eventBus = {
            emitWithMeta: vi.fn().mockReturnValue(true),
        };
        const socket = new FakeWebSocket("ws://example.test");
        const { bindMagiWebSocketEventBridge } = await import("../../src/magi/events/bindMagiWebSocketEventBridge");

        bindMagiWebSocketEventBridge(eventBus as never, {
            sessionId: "runtime-session",
            websocketFactory: () => socket as unknown as WebSocket,
            onOpen: openSpy,
        });

        socket.readyState = FakeWebSocket.OPEN;
        socket.emitMessage(createRuntimeStatusEventPayload("runtime-session"));

        expect(openSpy).toHaveBeenCalledTimes(1);
        expect(eventBus.emitWithMeta).toHaveBeenCalledWith(
            "RUNTIME_STATUS_UPDATED",
            expect.objectContaining({
                state: "heartbeat",
                awake: true,
            }),
        );
    });

    it("should ignore stale close events after a newer socket becomes current", async () => {
        vi.useFakeTimers();
        vi.stubGlobal("location", {
            protocol: "http:",
            host: "example.test",
        });

        try {
            const openSpy = vi.fn();
            const closeSpy = vi.fn();
            const eventBus = {
                emitWithMeta: vi.fn().mockReturnValue(true),
            };
            const sockets = [
                new FakeWebSocket("ws://example.test", FakeWebSocket.OPEN),
                new FakeWebSocket("ws://example.test"),
            ];
            let socketIndex = 0;
            const { bindMagiWebSocketEventBridge } = await import("../../src/magi/events/bindMagiWebSocketEventBridge");

            bindMagiWebSocketEventBridge(eventBus as never, {
                sessionId: "runtime-session",
                reconnectDelayMs: 1,
                websocketFactory: () => {
                    const socket = sockets[socketIndex];
                    socketIndex += 1;
                    if (!socket) {
                        throw new Error("unexpected extra websocket creation");
                    }
                    return socket as unknown as WebSocket;
                },
                onOpen: openSpy,
                onClose: closeSpy,
            });

            const firstSocket = sockets[0];
            const secondSocket = sockets[1];

            expect(openSpy).toHaveBeenCalledTimes(1);

            firstSocket.close();
            expect(closeSpy).toHaveBeenCalledTimes(1);

            await vi.advanceTimersByTimeAsync(1);
            secondSocket.emitOpen();

            expect(openSpy).toHaveBeenCalledTimes(2);

            firstSocket.onclose?.({ type: "close" } as CloseEvent);

            expect(closeSpy).toHaveBeenCalledTimes(1);
        } finally {
            vi.useRealTimers();
        }
    });
});
