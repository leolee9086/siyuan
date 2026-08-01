import {beforeEach, describe, expect, it, vi} from "vitest";

const mockedGetSafeSiyuanConfig = vi.hoisted(() => vi.fn());

vi.mock("../../../../src/util/siyuanEnvironments/getSiyuanConfig.environment", () => ({
    getSafeSiyuanConfig: mockedGetSafeSiyuanConfig,
}));
vi.mock("../../../../src/constants", () => ({
    Constants: {SIYUAN_APPID: "test-app"},
}));

import {createAgentRequestHeaders} from "../../../../src/layout/dock/agent/request/AgentRequest.headers";

describe("Agent request headers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockedGetSafeSiyuanConfig.mockReturnValue({api: {token: "workspace-api-token"}});
    });

    it("combines explicit owner identity with the current workspace token", () => {
        expect(createAgentRequestHeaders("magi-armor-token", {
            headers: {"Content-Type": "application/json"},
        })).toEqual({
            "Content-Type": "application/json",
            Authorization: "Bearer workspace-api-token",
            "X-SiYuan-Agent-Owner-Token": "magi-armor-token",
        });
    });

    it("preserves explicit authorization and adds checkpoint protocol headers", () => {
        expect(createAgentRequestHeaders("", {
            scope: "checkpoint",
            headers: {Authorization: "Bearer explicit-token"},
        })).toEqual({
            Authorization: "Bearer explicit-token",
            "Content-Type": "application/json",
            "X-SiYuan-App-ID": "test-app",
            "X-SiYuan-Agent-Checkpoint": "2",
        });
    });
});
