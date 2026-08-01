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
import {createAgentSessionRevisionState} from "../../../../src/layout/dock/agent/session/AgentSession.revisions";
import {getAgentSessionRevision} from "../../../../src/layout/dock/agent/session/AgentSession.revisions";
import {getAgentPromptSource} from "../../../../src/layout/dock/agent/prompt/AgentPromptSource.repository";
import {keepAgentPromptSourceDocument} from "../../../../src/layout/dock/agent/prompt/AgentPromptSource.repository";
import {refreshAgentPromptSourceDocument} from "../../../../src/layout/dock/agent/prompt/AgentPromptSource.repository";
import {resolveAgentPromptSourceDocument} from "../../../../src/layout/dock/agent/prompt/AgentPromptSource.repository";
import {searchAgentPromptSourceDocuments} from "../../../../src/layout/dock/agent/prompt/AgentPromptSource.repository";

function requestHeaders(input: AgentRequestHeaderInput = {}) {
    return createAgentRequestHeaders("magi-armor-token", input);
}

describe("Agent prompt-source repository", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockedGetSafeSiyuanConfig.mockReturnValue({api: {token: "workspace-api-token"}});
    });

    it("reads source state and exposes the server revision", async () => {
        vi.mocked(fetchSyncPost).mockResolvedValue({
            code: 0,
            data: {
                state: "source-changed",
                revision: 7,
                source: {kind: "document", titleSnapshot: "Agent Charter"},
            },
            msg: "",
        });
        const revisions = createAgentSessionRevisionState();

        await expect(getAgentPromptSource(revisions, requestHeaders, "session-1")).resolves.toMatchObject({
            state: "source-changed",
            revision: 7,
        });
        expect(getAgentSessionRevision(revisions, "session-1")).toBe(7);
    });

    it("reuses filetree search and path resolution", async () => {
        vi.mocked(fetchSyncPost)
            .mockResolvedValueOnce({
                code: 0,
                data: [
                    {box: "notebook-1", path: "/20260730-article.sy", hPath: "Notebook/Agent Charter"},
                    {box: "notebook-1", path: "/", hPath: "Notebook/"},
                ],
                msg: "",
            })
            .mockResolvedValueOnce({code: 0, data: "/Agent Charter", msg: ""})
            .mockResolvedValueOnce({code: 0, data: ["20260730000000-agent"], msg: ""});

        const candidates = await searchAgentPromptSourceDocuments(requestHeaders, "charter");
        await expect(resolveAgentPromptSourceDocument(requestHeaders, candidates[0]!)).resolves.toEqual({
            id: "20260730000000-agent",
            notebookId: "notebook-1",
            title: "Agent Charter",
            hPath: "Notebook/Agent Charter",
        });
    });

    it("uses explicit source revisions and preserves API errors", async () => {
        mockedGetSafeSiyuanConfig.mockReturnValue({});
        vi.mocked(fetchSyncPost)
            .mockResolvedValueOnce({
                code: 0,
                data: {state: "bound", revision: 5, source: {kind: "document", titleSnapshot: "Updated"}},
                msg: "",
            })
            .mockResolvedValueOnce({code: 1, msg: "source document was deleted"});
        const revisions = createAgentSessionRevisionState();

        await expect(refreshAgentPromptSourceDocument(revisions, requestHeaders, {id: "session-2", expectedRevision: 4}))
            .resolves.toMatchObject({revision: 5});
        await expect(keepAgentPromptSourceDocument(revisions, requestHeaders, {id: "session-2", expectedRevision: 5}))
            .rejects.toThrow("source document was deleted");
        expect(vi.mocked(fetchSyncPost).mock.calls[0]?.[1]).toEqual({sessionID: "session-2", expectedRevision: 4});
        expect(vi.mocked(fetchSyncPost).mock.calls[1]?.[1]).toEqual({sessionID: "session-2", expectedRevision: 5});
    });
});
