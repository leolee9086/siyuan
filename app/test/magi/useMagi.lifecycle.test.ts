import {beforeEach, describe, expect, it, vi} from "vitest";

const runtimeSpies = vi.hoisted(() => ({
    bridgeDisconnect: vi.fn(),
    createEventBus: vi.fn(),
    emitWithMeta: vi.fn(),
    fetchPersonaStatus: vi.fn(),
    fetchRuntimeMonitorHistory: vi.fn(),
    initMagi: vi.fn(),
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
    bindMagiWebSocketEventBridge: vi.fn(() => ({disconnect: runtimeSpies.bridgeDisconnect})),
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
}));

vi.mock("../../src/magi/adapters/magiStandardLLMAdapter.backend", () => ({
    MAGI_RUNTIME_MONITOR_SESSION_ID: "runtime-monitor",
}));

describe("useMagi lifecycle", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        runtimeSpies.fetchPersonaStatus.mockResolvedValue(null);
        runtimeSpies.fetchRuntimeMonitorHistory.mockResolvedValue({ events: [] });
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

    it("releases websocket and event bindings exactly once", async () => {
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
        runtimeSpies.fetchPersonaStatus.mockRejectedValueOnce(new Error("persona unavailable"));
        const {useMagi} = await import("../../src/magi/composables/useMagi");

        await expect(useMagi()).rejects.toThrow("persona unavailable");
        expect(runtimeSpies.bridgeDisconnect).toHaveBeenCalledOnce();
        expect(runtimeSpies.runtimeStatusDispose).toHaveBeenCalledOnce();
        expect(runtimeSpies.replyStartedDispose).toHaveBeenCalledOnce();
        expect(runtimeSpies.projectorDispose).toHaveBeenCalledOnce();
    });

    it("replays backend runtime monitor history after seels are initialized", async () => {
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
        });
        const {useMagi} = await import("../../src/magi/composables/useMagi");

        const runtime = await useMagi();

        expect(runtimeSpies.fetchRuntimeMonitorHistory).toHaveBeenCalledWith(0);
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
        runtimeSpies.fetchRuntimeMonitorHistory
            .mockResolvedValueOnce({ events: [] })
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
            expect(runtimeSpies.fetchRuntimeMonitorHistory).toHaveBeenCalledTimes(2);
            expect(runtimeSpies.emitWithMeta).toHaveBeenCalledWith(
                "RUNTIME_STATUS_UPDATED",
                expect.objectContaining({eventId: "history-runtime-after-login", seq: 9}),
            );
        });
        runtime.destroy();
    });
});
