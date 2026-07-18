import {beforeEach, describe, expect, it, vi} from "vitest";

const mockedGetSafeSiyuanConfig = vi.hoisted(() => vi.fn());

vi.mock("../../../../src/util/siyuanEnvironments/getSiyuanConfig.environment", () => ({
    getSafeSiyuanConfig: mockedGetSafeSiyuanConfig,
}));

vi.mock("../../../../src/util/fetch", () => ({
    fetchSyncPost: vi.fn(),
}));

vi.mock("../../../../src/constants", () => ({
    Constants: {SIYUAN_APPID: "test-app"},
}));

describe("Agent owner request headers", () => {
    beforeEach(() => {
        mockedGetSafeSiyuanConfig.mockReset();
        vi.resetModules();
    });

    it("combines the workspace API token with the guardian owner armor token", async () => {
        mockedGetSafeSiyuanConfig.mockReturnValue({api: {token: "workspace-api-token"}});
        const {agentOwnerHeaders, setAgentOwnerTokenProvider} = await import("../../../../src/layout/dock/agent/SessionStore");
        setAgentOwnerTokenProvider(() => "magi-armor-token");

        expect(agentOwnerHeaders({"Content-Type": "application/json"})).toEqual({
            "Content-Type": "application/json",
            Authorization: "Bearer workspace-api-token",
            "X-SiYuan-Agent-Owner-Token": "magi-armor-token",
        });
    });

    it("preserves an explicitly supplied authorization header", async () => {
        mockedGetSafeSiyuanConfig.mockReturnValue({api: {token: "workspace-api-token"}});
        const {agentOwnerHeaders} = await import("../../../../src/layout/dock/agent/SessionStore");

        expect(agentOwnerHeaders({Authorization: "Bearer explicit-token"})).toEqual({
            Authorization: "Bearer explicit-token",
        });
    });
});
