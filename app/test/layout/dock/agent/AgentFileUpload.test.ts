import {beforeEach, describe, expect, it, vi} from "vitest";
import type {AgentRequestHeaderInput} from "../../../../src/layout/dock/agent/request/AgentRequest.types";

const mockedGetSafeSiyuanConfig = vi.hoisted(() => vi.fn());

vi.mock("../../../../src/util/siyuanEnvironments/getSiyuanConfig.environment", () => ({
    getSafeSiyuanConfig: mockedGetSafeSiyuanConfig,
}));
vi.mock("../../../../src/util/network/fetch", () => ({fetchSyncPost: vi.fn()}));
vi.mock("../../../../src/constants", () => ({Constants: {SIYUAN_APPID: "test-app"}}));

import {fetchSyncPost} from "../../../../src/util/network/fetch";
import {uploadAgentFiles} from "../../../../src/layout/dock/agent/attachments/AgentFileUpload";
import {createAgentRequestHeaders} from "../../../../src/layout/dock/agent/request/AgentRequest.headers";

function requestHeaders(input: AgentRequestHeaderInput = {}) {
    return createAgentRequestHeaders("magi-armor-token", input);
}

describe("Agent file upload", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockedGetSafeSiyuanConfig.mockReturnValue({api: {token: "workspace-api-token"}});
    });

    it("uploads multipart files and preserves partial results", async () => {
        vi.mocked(fetchSyncPost).mockResolvedValue({
            code: 0,
            data: {succMap: {"ok.txt": "assets/ok.txt?box=box-1"}, errFiles: ["failed.txt"]},
            msg: "disk write failed",
        });

        await expect(uploadAgentFiles(requestHeaders, [
            new File(["ok"], "ok.txt"),
            new File(["failed"], "failed.txt"),
        ])).resolves.toEqual({
            uploaded: [{name: "ok.txt", path: "assets/ok.txt?box=box-1"}],
            failed: ["failed.txt"],
            message: "disk write failed",
        });
        const call = vi.mocked(fetchSyncPost).mock.calls[0];
        expect(call?.[0]).toBe("/api/ai/agent/uploadFiles");
        expect(call?.[1]).toBeInstanceOf(FormData);
        expect((call?.[1] as FormData).getAll("file[]")).toHaveLength(2);
        expect(call?.[2]).toEqual({
            "X-SiYuan-App-ID": "test-app",
            Authorization: "Bearer workspace-api-token",
            "X-SiYuan-Agent-Owner-Token": "magi-armor-token",
        });
    });

    it("rejects an empty upload response", async () => {
        vi.mocked(fetchSyncPost).mockResolvedValue({code: 0, data: {succMap: {}, errFiles: []}, msg: ""});

        await expect(uploadAgentFiles(requestHeaders, [new File(["data"], "empty.txt")]))
            .rejects.toThrow("returned no file result");
    });
});
