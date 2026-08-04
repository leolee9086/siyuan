import {beforeEach, describe, expect, it, vi} from "vitest";

const runtimeSpies = vi.hoisted(() => ({
    bindWebSocket: vi.fn(),
    bridgeDisconnect: vi.fn(),
    createEventBus: vi.fn(),
    emitWithMeta: vi.fn(),
    fetchPersonaStatus: vi.fn(),
    fetchRuntimeMonitorHistory: vi.fn(),
    initMagi: vi.fn(),
    getActiveMagiArmorSession: vi.fn(),
    projectorDispose: vi.fn(),
    resolveActiveSeed: vi.fn(),
    runtimeStatusDispose: vi.fn(),
    replyStartedDispose: vi.fn(),
}));

vi.mock("../../src/magi/core/wise/mockWise.subclass", () => ({
    initMagi: runtimeSpies.initMagi,
}));

vi.mock("../../src/magi/prompts/personaRuntimePromptBuilder", () => ({
    resolveStartupPromptInjectionsByActiveSeed: runtimeSpies.resolveActiveSeed,
}));

vi.mock("../../src/magi/events/magiEventBus", () => ({
    createMagiEventBus: runtimeSpies.createEventBus,
}));

vi.mock("../../src/magi/events/bindMagiWebSocketEventBridge", () => ({
    bindMagiWebSocketEventBridge: runtimeSpies.bindWebSocket,
}));

vi.mock("../../src/magi/events/magiProjector", () => ({
    bindMagiProjector: vi.fn(async () => runtimeSpies.projectorDispose),
}));

vi.mock("../../src/magi/service/magiPersonaStatus", () => ({
    fetchMagiPersonaStatus: runtimeSpies.fetchPersonaStatus,
}));

vi.mock("../../src/magi/service/magiRuntimeMonitorHistory", () => ({
    fetchMagiRuntimeMonitorHistory: runtimeSpies.fetchRuntimeMonitorHistory,
}));

vi.mock("../../src/magi/service/magiIdentitySession", () => ({
    MAGI_IDENTITY_SESSION_CHANGED_EVENT: "magi:identity-session-changed",
    getActiveMagiArmorSession: runtimeSpies.getActiveMagiArmorSession,
}));

vi.mock("../../src/magi/adapters/magiStandardLLMAdapter.backend", () => ({
    MAGI_RUNTIME_MONITOR_SESSION_ID: "runtime-monitor",
}));

describe("useMagi lifecycle", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        runtimeSpies.bindWebSocket.mockReturnValue({disconnect: runtimeSpies.bridgeDisconnect});
        runtimeSpies.fetchPersonaStatus.mockResolvedValue(null);
        runtimeSpies.fetchRuntimeMonitorHistory.mockResolvedValue({ events: [] });
        runtimeSpies.getActiveMagiArmorSession.mockReturnValue(null);
        runtimeSpies.initMagi.mockResolvedValue([]);
        runtimeSpies.resolveActiveSeed.mockResolvedValue(undefined);
        runtimeSpies.emitWithMeta.mockReturnValue(true);
        runtimeSpies.createEventBus.mockResolvedValue({
            emitWithMeta: runtimeSpies.emitWithMeta,
            subscribe: vi.fn((eventName: string) => eventName === "RUNTIME_STATUS_UPDATED"
                ? runtimeSpies.runtimeStatusDispose
                : runtimeSpies.replyStartedDispose),
        });
    });

    function guardianSession() {
        return {
            armorToken: "guardian-token",
            expiresAt: Date.now() + 60_000,
            identityId: "guardian",
            displayName: "Guardian",
            routeClass: "guardian",
            channel: "magi-main-ui",
            nickname: "guardian",
        };
    }

    it("does not subscribe to runtime monitor events without a Guardian armor session", async () => {
        const {useMagi} = await import("../../src/magi/composables/useMagi");
        const runtime = await useMagi();

        expect(runtimeSpies.bindWebSocket).not.toHaveBeenCalled();
        expect(runtimeSpies.fetchRuntimeMonitorHistory).not.toHaveBeenCalled();
        expect(runtime.websocketConnectionStatus.value).toBe("disconnected");
        runtime.destroy();
    });

    it("releases websocket and event bindings exactly once", async () => {
        runtimeSpies.getActiveMagiArmorSession.mockReturnValue(guardianSession());
        const {useMagi} = await import("../../src/magi/composables/useMagi");
        const runtime = await useMagi();

        runtime.destroy();
        runtime.destroy();

        expect(runtimeSpies.bridgeDisconnect).toHaveBeenCalledOnce();
        expect(runtimeSpies.runtimeStatusDispose).toHaveBeenCalledOnce();
        expect(runtimeSpies.replyStartedDispose).toHaveBeenCalledOnce();
        expect(runtimeSpies.projectorDispose).toHaveBeenCalledOnce();
        expect(runtime.websocketConnectionStatus.value).toBe("disconnected");
    });

    it("releases established bindings when initialization fails", async () => {
        runtimeSpies.getActiveMagiArmorSession.mockReturnValue(guardianSession());
        runtimeSpies.fetchPersonaStatus.mockRejectedValueOnce(new Error("persona unavailable"));
        const {useMagi} = await import("../../src/magi/composables/useMagi");

        await expect(useMagi()).rejects.toThrow("persona unavailable");
        expect(runtimeSpies.bridgeDisconnect).not.toHaveBeenCalled();
        expect(runtimeSpies.runtimeStatusDispose).not.toHaveBeenCalled();
        expect(runtimeSpies.replyStartedDispose).not.toHaveBeenCalled();
        expect(runtimeSpies.projectorDispose).not.toHaveBeenCalled();
    });

    it("releases monitor subscriptions when websocket construction fails", async () => {
        runtimeSpies.getActiveMagiArmorSession.mockReturnValue(guardianSession());
        runtimeSpies.bindWebSocket.mockImplementationOnce(() => {
            throw new Error("websocket unavailable");
        });
        const {useMagi} = await import("../../src/magi/composables/useMagi");

        await expect(useMagi()).rejects.toThrow("websocket unavailable");
        expect(runtimeSpies.runtimeStatusDispose).toHaveBeenCalledOnce();
        expect(runtimeSpies.replyStartedDispose).toHaveBeenCalledOnce();
        expect(runtimeSpies.projectorDispose).toHaveBeenCalledOnce();
    });

    it("replays backend runtime monitor history after seels are initialized", async () => {
        runtimeSpies.getActiveMagiArmorSession.mockReturnValue(guardianSession());
        runtimeSpies.fetchRuntimeMonitorHistory.mockResolvedValueOnce({
            events: [{
                eventType: "RUNTIME_STATUS_UPDATED",
                sessionId: "runtime-monitor",
                eventId: "history-runtime-1",
                seq: 7,
                roundId: "runtime-status",
                timestamp: 100,
                state: "heartbeat",
                awake: true,
            }],
            oldestSeq: 7,
            latestSeq: 7,
            truncated: true,
            hasMoreBefore: true,
        });
        const {useMagi} = await import("../../src/magi/composables/useMagi");

        const runtime = await useMagi();

        expect(runtimeSpies.fetchRuntimeMonitorHistory).toHaveBeenCalledWith(
            0,
            {signal: expect.any(AbortSignal)},
        );
        expect(runtimeSpies.fetchRuntimeMonitorHistory).toHaveBeenCalledOnce();
        expect(runtimeSpies.emitWithMeta).toHaveBeenCalledWith(
            "RUNTIME_STATUS_UPDATED",
            expect.objectContaining({
                eventId: "history-runtime-1",
                seq: 7,
                state: "heartbeat",
                awake: true,
            }),
        );
        runtime.destroy();
    });

    it("replays monitor history when the MAGI armor session becomes available", async () => {
        runtimeSpies.getActiveMagiArmorSession
            .mockReturnValueOnce(null)
            .mockReturnValue(guardianSession());
        runtimeSpies.fetchRuntimeMonitorHistory
            .mockResolvedValueOnce({
                events: [{
                    eventType: "RUNTIME_STATUS_UPDATED",
                    sessionId: "runtime-monitor",
                    eventId: "history-runtime-after-login",
                    seq: 9,
                    roundId: "runtime-status",
                    timestamp: 200,
                    state: "heartbeat",
                    awake: true,
                }],
            });
        const {useMagi} = await import("../../src/magi/composables/useMagi");
        const runtime = await useMagi();

        window.dispatchEvent(new CustomEvent("magi:identity-session-changed"));

        await vi.waitFor(() => {
            expect(runtimeSpies.fetchRuntimeMonitorHistory).toHaveBeenCalledOnce();
            expect(runtimeSpies.emitWithMeta).toHaveBeenCalledWith(
                "RUNTIME_STATUS_UPDATED",
                expect.objectContaining({eventId: "history-runtime-after-login", seq: 9}),
            );
        });
        runtime.destroy();
    });

    it("disconnects and clears projected history when the armor session is removed", async () => {
        runtimeSpies.getActiveMagiArmorSession.mockReturnValue(guardianSession());
        const {useMagi} = await import("../../src/magi/composables/useMagi");
        const runtime = await useMagi();
        runtime.consensusMessages.push({
            id: "visible-history",
            type: "assistant",
            content: "sensitive runtime history",
            status: "success",
            timestamp: 1,
        });

        runtimeSpies.getActiveMagiArmorSession.mockReturnValue(null);
        window.dispatchEvent(new CustomEvent("magi:identity-session-changed"));

        await vi.waitFor(() => {
            expect(runtimeSpies.bridgeDisconnect).toHaveBeenCalledOnce();
            expect(runtime.consensusMessages).toEqual([]);
            expect(runtime.websocketConnectionStatus.value).toBe("disconnected");
        });
        runtime.destroy();
    });

    it("preserves consensus messages during an authenticated persona reload", async () => {
        runtimeSpies.getActiveMagiArmorSession.mockReturnValue(guardianSession());
        const {useMagi} = await import("../../src/magi/composables/useMagi");
        const runtime = await useMagi();
        runtime.consensusMessages.push({
            id: "preserved-consensus",
            type: "assistant",
            content: "keep this message",
            status: "success",
            timestamp: 1,
        });

        await runtime.initializeMAGI({preserveConsensusMessages: true});

        expect(runtime.consensusMessages.some((message) => message.id === "preserved-consensus")).toBe(true);
        runtime.destroy();
    });
});
