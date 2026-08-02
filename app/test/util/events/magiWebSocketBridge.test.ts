import { describe, expect, it } from "vitest";
import { createMagiEventBus } from "../../../src/magi/events/magiEventBus";
import { dispatchMagiWebSocketMessage } from "../../../src/magi/events/dispatchMagiWebSocketMessage";

describe("MAGI WebSocket Bridge", () => {
    it("应把 magiEvent 转发到事件总线", async () => {
        const bus = await createMagiEventBus();
        let capturedEventId = "";
        bus.subscribe("SEEL_REPLY_COMPLETED", (payload) => {
            capturedEventId = payload.eventId;
        });

        const handled = dispatchMagiWebSocketMessage(bus, {
            cmd: "magiEvent",
            data: {
                eventType: "SEEL_REPLY_COMPLETED",
                sessionId: "session-1",
                eventId: "event-1",
                seq: 1,
                roundId: "round-1",
                timestamp: Date.now(),
                seelName: "MELCHIOR-01",
                displayName: "MELCHIOR",
                message: {
                    id: "msg-1",
                    type: "ai",
                    content: "done",
                    status: "success",
                    timestamp: Date.now(),
                },
            },
        });

        expect(handled).toBe(true);
        expect(capturedEventId).toBe("event-1");
    });

    it("应转发包含工具结果的语义活动事件", async () => {
        const bus = await createMagiEventBus();
        let capturedResult = "";
        bus.subscribe("SEEL_TOOL_ACTIVITY_UPDATED", (payload) => {
            capturedResult = payload.result ?? "";
        });

        const handled = dispatchMagiWebSocketMessage(bus, {
            cmd: "magiEvent",
            data: {
                eventType: "SEEL_TOOL_ACTIVITY_UPDATED",
                sessionId: "session-tool",
                eventId: "event-tool-1",
                seq: 2,
                roundId: "round-tool-1",
                timestamp: Date.now(),
                seelName: "MELCHIOR-01",
                displayName: "MELCHIOR",
                toolName: "note_keyword_search",
                toolCallIndex: 0,
                toolCallId: "call-tool-1",
                rawArguments: "{\"query\":\"缓存\"}",
                arguments: { query: "缓存" },
                phase: "completed",
                result: "{\"matchedBlockCount\":1}",
            },
        });

        expect(handled).toBe(true);
        expect(capturedResult).toBe("{\"matchedBlockCount\":1}");
    });

    it("应转发会话不匹配的消息", async () => {
        const bus = await createMagiEventBus();
        let count = 0;
        bus.subscribe("CONSENSUS_EMITTED", () => {
            count += 1;
        });

        const handled = dispatchMagiWebSocketMessage(bus, {
            cmd: "magiEvent",
            data: {
                eventType: "CONSENSUS_EMITTED",
                sessionId: "session-b",
                eventId: "event-2",
                seq: 2,
                roundId: "round-2",
                timestamp: Date.now(),
                message: {
                    id: "consensus-1",
                    type: "consensus",
                    content: "final",
                    status: "success",
                    timestamp: Date.now(),
                },
            },
        });

        expect(handled).toBe(true);
        expect(count).toBe(1);
    });

    it("应兼容包含 data 内层节点的协议格式", async () => {
        const bus = await createMagiEventBus();
        let count = 0;
        bus.subscribe("ROUND_STARTED", () => {
            count += 1;
        });

        const handled = dispatchMagiWebSocketMessage(bus, {
            cmd: "magiEvent",
            data: {
                eventType: "ROUND_STARTED",
                sessionId: "session-3",
                data: {
                    eventId: "event-3",
                    seq: 3,
                    roundId: "round-3",
                    timestamp: Date.now(),
                    userInput: "hello",
                },
            },
        });

        expect(handled).toBe(true);
        expect(count).toBe(1);
    });

    it("应转发 DOMINANT_SYNTHESIS_COMPLETED 事件", async () => {
        const bus = await createMagiEventBus();
        let content = "";
        bus.subscribe("DOMINANT_SYNTHESIS_COMPLETED", (payload) => {
            content = payload.content;
        });

        const handled = dispatchMagiWebSocketMessage(bus, {
            cmd: "magiEvent",
            data: {
                eventType: "DOMINANT_SYNTHESIS_COMPLETED",
                sessionId: "session-4",
                eventId: "event-4",
                seq: 4,
                roundId: "round-4",
                timestamp: Date.now(),
                content: "dominant synthesis",
            },
        });

        expect(handled).toBe(true);
        expect(content).toBe("dominant synthesis");
    });
});
