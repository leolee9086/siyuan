import { describe, it, expect } from "vitest";
import type { WrappedSeel } from "../../../src/magi/composables/useMagi.types";
import type { MagiMessage } from "../../../src/magi/utils/messageFactory.types";
import { createMagiEventBus } from "../../../src/magi/events/magiEventBus";
import { bindMagiProjector } from "../../../src/magi/events/magiProjector";

function createWrappedSeel(name: string, displayName: string): WrappedSeel {
    return {
        _originalAI: {
            config: {
                name,
                displayName,
                color: "#fff",
                icon: "icon",
                responseType: "text",
                persona: "",
                memorySize: 7,
                openAIConfig: {},
            },
            messages: [],
            loading: false,
            connected: true,
            reply: async () => "",
            voteFor: async () => null,
            appendContextMessages: () => {},
            replaceLatestAssistantContextMessage: () => {},
        } as any,
        config: {
            name,
            displayName,
            color: "#fff",
            icon: "icon",
            responseType: "text",
            persona: "",
            memorySize: 7,
        },
        messages: [],
        loading: false,
        connected: true,
        reply: async () => "",
        voteFor: async () => null,
        appendContextMessages: async () => {},
        replaceLatestAssistantContextMessage: async () => {},
    };
}

describe("MAGI Event Bridge - 事件投影", () => {
    it("应将贤者流式事件投影到贤者卡片消息与状态", async () => {
        const bus = await createMagiEventBus();
        const seel = createWrappedSeel("MELCHIOR-01", "MELCHIOR");
        const consensusMessages: MagiMessage[] = [];
        const stop = await bindMagiProjector(bus, { seels: [seel], consensusMessages });

        const streamMessage: MagiMessage = {
            id: "stream-1",
            type: "sse_stream",
            content: "",
            status: "loading",
            timestamp: Date.now(),
        };

        bus.emit("SEEL_REPLY_STARTED", {
            roundId: "round-1",
            timestamp: Date.now(),
            seelName: "MELCHIOR-01",
            displayName: "MELCHIOR",
            userInput: "hello",
            streamMessage,
        });

        expect(seel.loading).toBe(true);
        expect(seel.messages.some((message) => message.type === "user")).toBe(true);
        expect(seel.messages.some((message) => message.id === "stream-1")).toBe(true);

        bus.emit("SEEL_REPLY_CHUNK", {
            roundId: "round-1",
            timestamp: Date.now(),
            seelName: "MELCHIOR-01",
            displayName: "MELCHIOR",
            message: {
                ...streamMessage,
                content: "chunk",
                status: "loading",
            },
        });
        expect(seel.messages.find((message) => message.id === "stream-1")?.content).toBe("chunk");

        bus.emit("SEEL_REPLY_COMPLETED", {
            roundId: "round-1",
            timestamp: Date.now(),
            seelName: "MELCHIOR-01",
            displayName: "MELCHIOR",
            message: {
                ...streamMessage,
                type: "ai",
                content: "final",
                status: "success",
            },
        });

        expect(seel.loading).toBe(false);
        const finalMessage = seel.messages.find((message) => message.id === "stream-1");
        expect(finalMessage?.type).toBe("ai");
        expect(finalMessage?.status).toBe("success");
        expect(finalMessage?.content).toBe("final");

        stop();
    });

    it("应将共识事件和投票进度事件投影到主消息流", async () => {
        const bus = await createMagiEventBus();
        const seel = createWrappedSeel("BALTHASAR-02", "BALTHASAR");
        const consensusMessages: MagiMessage[] = [];
        const stop = await bindMagiProjector(bus, { seels: [seel], consensusMessages });

        bus.emit("CONSENSUS_EMITTED", {
            roundId: "round-2",
            timestamp: Date.now(),
            message: {
                id: "consensus-1",
                type: "consensus",
                content: "final consensus",
                status: "success",
                timestamp: Date.now(),
                meta: { source: "trinity-synthesis" },
            },
        });

        bus.emit("SEEL_VOTE_UPDATED", {
            roundId: "round-2",
            timestamp: Date.now(),
            progress: 45,
            details: [
                { name: "BALTHASAR", decision: "批准" },
                { name: "CASPER", decision: "否决" },
            ],
            proposedAction: "执行A",
        });

        expect(consensusMessages.length).toBe(2);
        expect(consensusMessages[0].id).toBe("consensus-1");
        expect(consensusMessages[1].meta?.type).toBe("vote-status");
        expect(consensusMessages[1].meta?.progress).toBe(45);

        stop();
    });

    it("应兼容后端小写贤者名称并映射到前端编号卡片", async () => {
        const bus = await createMagiEventBus();
        const melchior = createWrappedSeel("MELCHIOR-01", "MELCHIOR");
        const balthasar = createWrappedSeel("BALTHASAR-02", "BALTHASAR");
        const consensusMessages: MagiMessage[] = [];
        const stop = await bindMagiProjector(bus, {
            seels: [melchior, balthasar],
            consensusMessages,
        });

        bus.emitWithMeta("SEEL_REPLY_CHUNK", {
            eventId: "event-lowercase-1",
            seq: 101,
            roundId: "round-lowercase-1",
            timestamp: Date.now(),
            seelName: "melchior",
            displayName: "Melchior",
            message: {
                id: "melchior-stream-1",
                type: "melchior",
                content: "melchior chunk",
                status: "streaming",
                timestamp: Date.now(),
            },
        });

        bus.emitWithMeta("SEEL_REPLY_COMPLETED", {
            eventId: "event-lowercase-2",
            seq: 102,
            roundId: "round-lowercase-1",
            timestamp: Date.now(),
            seelName: "balthazar",
            displayName: "Balthazar",
            message: {
                id: "balthazar-completed-1",
                type: "balthazar",
                content: "balthazar completed",
                status: "success",
                timestamp: Date.now(),
            },
        });

        expect(melchior.messages.find((message) => message.id === "melchior-stream-1")?.content).toBe("melchior chunk");
        expect(balthasar.messages.find((message) => message.id === "balthazar-completed-1")?.content).toBe("balthazar completed");

        stop();
    });

    it("应将侧面投票结果与错误投影到对应贤者卡片", async () => {
        const bus = await createMagiEventBus();
        const seel = createWrappedSeel("CASPER-03", "CASPER");
        const consensusMessages: MagiMessage[] = [];
        const stop = await bindMagiProjector(bus, { seels: [seel], consensusMessages });

        bus.emit("SEEL_VOTE_UPDATED", {
            roundId: "round-3",
            timestamp: Date.now(),
            seelName: "CASPER-03",
            displayName: "CASPER",
            decision: "批准",
            round: 1,
        });

        bus.emit("SEEL_VOTE_UPDATED", {
            roundId: "round-3",
            timestamp: Date.now(),
            seelName: "CASPER-03",
            displayName: "CASPER",
            error: "评估失败",
        });

        const voteMessage = seel.messages.find((message) => message.type === "vote");
        const errorMessage = seel.messages.find((message) => message.type === "error");
        expect(voteMessage?.meta?.decision).toBe("批准");
        expect(errorMessage?.content).toBe("评估失败");

        stop();
    });
});
