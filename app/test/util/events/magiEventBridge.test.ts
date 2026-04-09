import { describe, it, expect } from "vitest";
import type { WrappedSeel } from "../../../src/magi/composables/useMagi.types";
import type { MagiMessage } from "../../../src/magi/utils/messageFactory.types";
import { createMagiEventBus } from "../../../src/magi/events/magiEventBus";
import { bindMagiProjector } from "../../../src/magi/events/magiProjector";
import type { MagiEventBus, MagiEventName, MagiEventPayloadMap } from "../../../src/magi/events/magiEventBus.types";

let testEventSeq = 0;

function emitTestEvent<K extends MagiEventName>(
    bus: MagiEventBus,
    event: K,
    payload: Omit<MagiEventPayloadMap[K], "eventId" | "seq">,
): boolean {
    testEventSeq += 1;
    return bus.emitWithMeta(event, {
        eventId: `test-event-${testEventSeq}`,
        seq: testEventSeq,
        ...payload,
    } as MagiEventPayloadMap[K]);
}

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

        emitTestEvent(bus, "SEEL_REPLY_STARTED", {
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

        emitTestEvent(bus, "SEEL_REPLY_CHUNK", {
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

        emitTestEvent(bus, "SEEL_REPLY_COMPLETED", {
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

        emitTestEvent(bus, "CONSENSUS_EMITTED", {
            roundId: "round-2",
            timestamp: Date.now(),
            message: {
                id: "consensus-1",
                type: "consensus",
                content: "final consensus",
                status: "success",
                timestamp: Date.now(),
                meta: { source: "dominant-synthesis" },
            },
        });

        emitTestEvent(bus, "SEEL_VOTE_UPDATED", {
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
        const consensusMessage = consensusMessages.find((message) => message.id === "consensus-1");
        const voteStatusMessage = consensusMessages.find((message) => message.meta?.type === "vote-status");
        expect(consensusMessage?.id).toBe("consensus-1");
        expect(voteStatusMessage?.meta?.type).toBe("vote-status");
        expect(voteStatusMessage?.meta?.progress).toBe(45);

        stop();
    });

    it("应把投票事件广播到全部贤者卡片并保留通过状态与理由", async () => {
        const bus = await createMagiEventBus();
        const melchior = createWrappedSeel("MELCHIOR-01", "MELCHIOR");
        const balthazar = createWrappedSeel("BALTHASAR-02", "BALTHASAR");
        const casper = createWrappedSeel("CASPER-03", "CASPER");
        const consensusMessages: MagiMessage[] = [];
        const stop = await bindMagiProjector(bus, {
            seels: [melchior, balthazar, casper],
            consensusMessages,
        });

        emitTestEvent(bus, "SEEL_VOTE_UPDATED", {
            roundId: "round-vote-1",
            timestamp: Date.now(),
            progress: 0,
            round: 1,
            proposedAction: "记录当前推进到工作日志",
            deliberationInitiator: "MELCHIOR-01",
            deliberationReason: "需要留下可追踪记录",
        });

        emitTestEvent(bus, "SEEL_VOTE_UPDATED", {
            roundId: "round-vote-1",
            timestamp: Date.now(),
            seelName: "BALTHASAR-02",
            displayName: "BALTHASAR",
            decision: "批准",
            decisionReason: "风险可控",
            progress: 50,
            round: 1,
        });

        emitTestEvent(bus, "SEEL_VOTE_UPDATED", {
            roundId: "round-vote-1",
            timestamp: Date.now(),
            progress: 100,
            passed: true,
            round: 1,
            proposedAction: "记录当前推进到工作日志",
            deliberationInitiator: "MELCHIOR-01",
            deliberationReason: "需要留下可追踪记录",
            details: [
                { name: "Melchior", decision: "批准", reason: "发起当前行动" },
                { name: "Balthazar", decision: "批准", reason: "风险可控" },
                { name: "Casper", decision: "否决", reason: "收益不够稳定" },
            ],
        });

        for (const seel of [melchior, balthazar, casper]) {
            const voteEvents = seel.messages.filter((message) => message.meta?.eventType === "SEEL_VOTE_UPDATED");
            expect(voteEvents.length).toBe(3);
        }

        const voteStatusMessage = [...consensusMessages]
            .reverse()
            .find((message) => message.meta?.type === "vote-status" && message.meta?.passed === true);
        expect(voteStatusMessage?.meta?.passed).toBe(true);
        expect(voteStatusMessage?.meta?.proposedAction).toBe("记录当前推进到工作日志");
        expect(voteStatusMessage?.meta?.details).toMatchObject([
            { name: "Melchior", decision: "批准", reason: "发起当前行动" },
            { name: "Balthazar", decision: "批准", reason: "风险可控" },
            { name: "Casper", decision: "否决", reason: "收益不够稳定" },
        ]);

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

        emitTestEvent(bus, "SEEL_VOTE_UPDATED", {
            roundId: "round-3",
            timestamp: Date.now(),
            seelName: "CASPER-03",
            displayName: "CASPER",
            decision: "批准",
            round: 1,
            reason: "证据充分，可执行",
        });

        emitTestEvent(bus, "SEEL_VOTE_UPDATED", {
            roundId: "round-3",
            timestamp: Date.now(),
            seelName: "CASPER-03",
            displayName: "CASPER",
            error: "评估失败",
        });

        const voteMessage = seel.messages.find((message) => message.type === "vote");
        const errorMessage = seel.messages.find((message) => message.type === "error");
        expect(voteMessage?.meta?.decision).toBe("批准");
        expect(voteMessage?.meta?.reason).toBe("证据充分，可执行");
        expect(errorMessage?.content).toBe("评估失败");

        stop();
    });

    it("应在工具调用消息中投影 deliberation_signal 理由", async () => {
        const bus = await createMagiEventBus();
        const seel = createWrappedSeel("MELCHIOR-01", "MELCHIOR");
        const consensusMessages: MagiMessage[] = [];
        const stop = await bindMagiProjector(bus, { seels: [seel], consensusMessages });

        emitTestEvent(bus, "TOOL_CALL_DETECTED", {
            roundId: "round-4",
            timestamp: Date.now(),
            seelName: "MELCHIOR-01",
            displayName: "MELCHIOR",
            toolName: "deliberation_signal",
            toolCallIndex: 0,
            toolCallId: "tool-call-bridge-1",
            rawArguments: "{\"requires_deliberation\":true,\"reason\":\"需要复核外部风险\"}",
            argumentsComplete: true,
            arguments: {
                requires_deliberation: true,
                reason: "需要复核外部风险",
            },
        });

        const toolCallMessage = seel.messages.find((message) => message.meta?.type === "tool-call");
        expect(toolCallMessage?.content).toContain("需要复核外部风险");
        expect(toolCallMessage?.meta?.reason).toBe("需要复核外部风险");
        expect(toolCallMessage?.meta?.requiresDeliberation).toBe(true);

        stop();
    });

    it("应将审慎信号投影为独立状态消息", async () => {
        const bus = await createMagiEventBus();
        const seel = createWrappedSeel("MELCHIOR-01", "MELCHIOR");
        const consensusMessages: MagiMessage[] = [];
        const stop = await bindMagiProjector(bus, { seels: [seel], consensusMessages });

        emitTestEvent(bus, "DELIBERATION_SIGNAL_RAISED", {
            roundId: "round-5",
            timestamp: Date.now(),
            initiator: "MELCHIOR-01",
            displayName: "MELCHIOR",
            reason: "该决策影响范围较大，需要审慎评估",
            requiresDeliberation: true,
        });

        const consensusSignal = consensusMessages.find((message) => message.meta?.type === "deliberation-signal");
        const seelSignal = seel.messages.find((message) => message.meta?.type === "deliberation-signal");
        expect(consensusSignal?.content).toContain("需要审慎评估");
        expect(seelSignal?.content).toContain("需要审慎评估");

        stop();
    });

    it("应兼容新的 DOMINANT_SYNTHESIS_COMPLETED 事件名", async () => {
        const bus = await createMagiEventBus();
        const melchior = createWrappedSeel("MELCHIOR-01", "MELCHIOR");
        const casper = createWrappedSeel("CASPER-03", "CASPER");
        const consensusMessages: MagiMessage[] = [];
        const stop = await bindMagiProjector(bus, { seels: [melchior, casper], consensusMessages });

        emitTestEvent(bus, "DOMINANT_SYNTHESIS_COMPLETED", {
            roundId: "round-synthesis-1",
            timestamp: Date.now(),
            content: "由主导者完成统合",
        });

        const projected = melchior.messages.find((message) => message.meta?.eventType === "DOMINANT_SYNTHESIS_COMPLETED");
        expect(projected?.content).toBe("DOMINANT_SYNTHESIS_COMPLETED");

        stop();
    });

    it("应将后端运行时事件投影到 MAGI monitor 流", async () => {
        const bus = await createMagiEventBus();
        const trinity = createWrappedSeel("TRINITY-00", "TRINITY");
        const melchior = createWrappedSeel("MELCHIOR-01", "MELCHIOR");
        const consensusMessages: MagiMessage[] = [];
        const stop = await bindMagiProjector(bus, { seels: [trinity, melchior], consensusMessages });

        bus.emitWithMeta("RUNTIME_STATUS_UPDATED", {
            eventId: "runtime-monitor-event-1",
            seq: 1,
            roundId: "round-monitor-1",
            timestamp: Date.now(),
            state: "heartbeat",
            awake: true,
            currentTask: "Waiting for synthesis",
        });

        bus.emitWithMeta("TOOL_CALL_DETECTED", {
            eventId: "runtime-monitor-event-2",
            seq: 2,
            roundId: "round-monitor-1",
            timestamp: Date.now(),
            seelName: "MELCHIOR-01",
            displayName: "MELCHIOR",
            toolName: "deliberation_signal",
            toolCallIndex: 0,
            toolCallId: "tool-call-1",
            rawArguments: "{\"reason\":\"需要审慎\"}",
            argumentsComplete: true,
            arguments: {
                reason: "需要审慎",
            },
        });

        const runtimeEvent = trinity.messages.find((message) => message.meta?.eventType === "RUNTIME_STATUS_UPDATED");
        const toolEvent = trinity.messages.find((message) => message.meta?.eventType === "TOOL_CALL_DETECTED");

        expect(runtimeEvent?.meta?.monitorScope).toBe("magi-monitor");
        expect(toolEvent?.meta?.monitorScope).toBe("magi-monitor");
        expect(toolEvent?.meta?.eventPayload).toMatchObject({
            toolName: "deliberation_signal",
            displayName: "MELCHIOR",
        });

        stop();
    });
});
