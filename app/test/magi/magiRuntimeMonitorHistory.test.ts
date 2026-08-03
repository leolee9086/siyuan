import {beforeEach, describe, expect, it, vi} from "vitest";

const historySpies = vi.hoisted(() => ({
    fetch: vi.fn(),
    getActiveMagiArmorSession: vi.fn(),
}));

vi.mock("../../src/magi/service/magiIdentitySession", () => ({
    getActiveMagiArmorSession: historySpies.getActiveMagiArmorSession,
}));

describe("fetchMagiRuntimeMonitorHistory", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal("fetch", historySpies.fetch);
        historySpies.getActiveMagiArmorSession.mockReturnValue(null);
    });

    it("does not request monitor history without a Guardian main UI armor session", async () => {
        const {fetchMagiRuntimeMonitorHistory} = await import("../../src/magi/service/magiRuntimeMonitorHistory");

        const result = await fetchMagiRuntimeMonitorHistory(0);

        expect(result.events).toEqual([]);
        expect(historySpies.fetch).not.toHaveBeenCalled();
    });

    it("does not request monitor history with an avatar-only armor session", async () => {
        historySpies.getActiveMagiArmorSession.mockReturnValue({
            armorToken: "avatar-token",
            expiresAt: Date.now() + 60_000,
            identityId: "avatar",
            displayName: "Avatar",
            routeClass: "avatar-only",
            channel: "magi-main-ui",
            nickname: "avatar",
        });
        const {fetchMagiRuntimeMonitorHistory} = await import("../../src/magi/service/magiRuntimeMonitorHistory");

        const result = await fetchMagiRuntimeMonitorHistory(0);

        expect(result.events).toEqual([]);
        expect(historySpies.fetch).not.toHaveBeenCalled();
    });

    it("requests monitor history with the active Guardian main UI armor token", async () => {
        historySpies.getActiveMagiArmorSession.mockReturnValue({
            armorToken: "guardian-token",
            expiresAt: Date.now() + 60_000,
            identityId: "guardian",
            displayName: "Guardian",
            routeClass: "guardian",
            channel: "magi-main-ui",
            nickname: "guardian",
        });
        historySpies.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ events: [{ eventId: "history-1" }] }),
        });
        const {fetchMagiRuntimeMonitorHistory} = await import("../../src/magi/service/magiRuntimeMonitorHistory");

        const result = await fetchMagiRuntimeMonitorHistory(12);

        expect(result.events).toEqual([{ eventId: "history-1" }]);
        expect(historySpies.fetch).toHaveBeenCalledWith(
            "/api/s-forge/magi/v1/runtime/monitor/history",
            expect.objectContaining({
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer guardian-token",
                },
                body: JSON.stringify({ afterSeq: 12 }),
            }),
        );
    });
});
