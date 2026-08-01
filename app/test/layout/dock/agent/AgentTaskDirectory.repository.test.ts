import {beforeEach, describe, expect, it, vi} from "vitest";
import type {AgentRequestHeaderInput} from "../../../../src/layout/dock/agent/request/AgentRequest.types";

const mockedGetSafeSiyuanConfig = vi.hoisted(() => vi.fn());

vi.mock("../../../../src/util/siyuanEnvironments/getSiyuanConfig.environment", () => ({
    getSafeSiyuanConfig: mockedGetSafeSiyuanConfig,
}));
vi.mock("../../../../src/util/network/fetch", () => ({fetchSyncPost: vi.fn()}));
vi.mock("../../../../src/constants", () => ({Constants: {SIYUAN_APPID: "test-app"}}));

import {fetchSyncPost} from "../../../../src/util/network/fetch";
import {createAgentRequestHeaders} from "../../../../src/layout/dock/agent/request/AgentRequest.headers";
import {addAgentTaskDirectory} from "../../../../src/layout/dock/agent/task-directory/AgentTaskDirectory.repository";
import {bindAgentTaskDirectory} from "../../../../src/layout/dock/agent/task-directory/AgentTaskDirectory.repository";
import {canBindAgentTaskDirectories} from "../../../../src/layout/dock/agent/task-directory/AgentTaskDirectory.repository";
import {unbindAgentTaskDirectory} from "../../../../src/layout/dock/agent/task-directory/AgentTaskDirectory.repository";

function requestHeaders(input: AgentRequestHeaderInput = {}) {
    return createAgentRequestHeaders("magi-armor-token", input);
}

describe("Agent task-directory repository", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockedGetSafeSiyuanConfig.mockReturnValue({api: {token: "workspace-api-token"}});
    });

    it("returns the Kernel-derived bind capability as a boolean", async () => {
        vi.mocked(fetchSyncPost).mockResolvedValue({
            code: 0,
            data: {canBindTaskDirectories: false},
            msg: "",
        });

        await expect(canBindAgentTaskDirectories(requestHeaders)).resolves.toBe(false);
        expect(fetchSyncPost).toHaveBeenCalledWith(
            "/api/ai/agent/taskDirectoryCapabilities",
            {},
            {
                Authorization: "Bearer workspace-api-token",
                "X-SiYuan-Agent-Owner-Token": "magi-armor-token",
            },
        );
    });

    it("propagates capability and mutation errors", async () => {
        vi.mocked(fetchSyncPost).mockResolvedValue({code: 1, msg: "directory operation failed"});

        await expect(canBindAgentTaskDirectories(requestHeaders)).rejects.toThrow("directory operation failed");
        await expect(bindAgentTaskDirectory(requestHeaders, "session-1", "C:/task"))
            .rejects.toThrow("directory operation failed");
        await expect(addAgentTaskDirectory(requestHeaders, {
            id: "session-1",
            path: "C:/task",
            permission: "read-only",
        }))
            .rejects.toThrow("directory operation failed");
        await expect(unbindAgentTaskDirectory(requestHeaders, "session-1"))
            .rejects.toThrow("directory operation failed");
    });
});
