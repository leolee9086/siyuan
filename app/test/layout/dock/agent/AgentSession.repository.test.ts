import {beforeEach, describe, expect, it, vi} from "vitest";
import type {AgentRequestHeaderInput} from "../../../../src/layout/dock/agent/request/AgentRequest.types";

const mockedGetSafeSiyuanConfig = vi.hoisted(() => vi.fn());

vi.mock("../../../../src/util/siyuanEnvironments/getSiyuanConfig.environment", () => ({
    getSafeSiyuanConfig: mockedGetSafeSiyuanConfig,
}));
vi.mock("../../../../src/util/network/fetch", () => ({
    fetchSyncPost: vi.fn(),
}));
vi.mock("../../../../src/constants", () => ({
    Constants: {SIYUAN_APPID: "test-app"},
}));

import {fetchSyncPost} from "../../../../src/util/network/fetch";
import {createAgentRequestHeaders} from "../../../../src/layout/dock/agent/request/AgentRequest.headers";
import {createAgentSessionID} from "../../../../src/layout/dock/agent/session/AgentSession.id";
import {createAgentSessionRevisionState} from "../../../../src/layout/dock/agent/session/AgentSession.revisions";
import {getAgentSessionRevision} from "../../../../src/layout/dock/agent/session/AgentSession.revisions";
import {listAgentSessions} from "../../../../src/layout/dock/agent/session/AgentSession.repository";
import {loadAgentSession} from "../../../../src/layout/dock/agent/session/AgentSession.repository";
import {removeAgentSession} from "../../../../src/layout/dock/agent/session/AgentSession.repository";
import {saveAgentSession} from "../../../../src/layout/dock/agent/session/AgentSession.repository";

function requestHeaders(input: AgentRequestHeaderInput = {}) {
    return createAgentRequestHeaders("magi-armor-token", input);
}

describe("Agent session repository", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockedGetSafeSiyuanConfig.mockReturnValue({api: {token: "workspace-api-token"}});
    });

    it("forwards the requested conversation target", async () => {
        vi.mocked(fetchSyncPost).mockResolvedValue({
            code: 0,
            data: {sessions: [], total: 0, page: 1, pageSize: 30},
            msg: "",
        });

        await listAgentSessions(requestHeaders, {targetKind: "magi"});

        expect(fetchSyncPost).toHaveBeenCalledWith("/api/ai/agent/lsSessions", {
            page: 1,
            pageSize: 30,
            keyword: "",
            targetKind: "magi",
        }, {
            Authorization: "Bearer workspace-api-token",
            "X-SiYuan-Agent-Owner-Token": "magi-armor-token",
        });
    });

    it("saves with checkpoint headers and exposes the committed revision", async () => {
        vi.mocked(fetchSyncPost).mockResolvedValue({code: 0, data: {revision: 4}, msg: ""});
        const revisions = createAgentSessionRevisionState();

        await saveAgentSession(revisions, requestHeaders, {
            id: "20260801000000-session",
            title: "Checkpoint",
            createdAt: 1,
            updatedAt: 1,
        });

        expect(fetchSyncPost).toHaveBeenCalledWith(
            "/api/ai/agent/saveSession",
            expect.objectContaining({id: "20260801000000-session", expectedRevision: 0}),
            {
                "Content-Type": "application/json",
                "X-SiYuan-App-ID": "test-app",
                "X-SiYuan-Agent-Checkpoint": "2",
                Authorization: "Bearer workspace-api-token",
                "X-SiYuan-Agent-Owner-Token": "magi-armor-token",
            },
        );
        expect(getAgentSessionRevision(revisions, "20260801000000-session")).toBe(4);
    });

    it("serializes saves and chains the committed revision", async () => {
        let completeFirstSave: (value: IWebSocketData) => void;
        const firstResponse = new Promise<IWebSocketData>((resolve) => {
            completeFirstSave = resolve;
        });
        vi.mocked(fetchSyncPost)
            .mockImplementationOnce(() => firstResponse)
            .mockResolvedValueOnce({code: 0, data: {revision: 3}, msg: ""});
        const revisions = createAgentSessionRevisionState();
        const first = saveAgentSession(revisions, requestHeaders, {
            id: "20260801000000-serial1", title: "First", createdAt: 1, updatedAt: 1,
        });
        const second = saveAgentSession(revisions, requestHeaders, {
            id: "20260801000000-serial1", title: "Second", createdAt: 1, updatedAt: 1,
        });
        expect(fetchSyncPost).toHaveBeenCalledTimes(1);

        completeFirstSave!({code: 0, data: {revision: 2}, msg: ""});
        await first;
        await second;

        expect(fetchSyncPost).toHaveBeenCalledTimes(2);
        expect(vi.mocked(fetchSyncPost).mock.calls[1]?.[1]).toEqual(expect.objectContaining({
            title: "Second",
            expectedRevision: 2,
        }));
    });

    it("retries once with the authoritative revision when a save conflicts", async () => {
        vi.mocked(fetchSyncPost)
            .mockResolvedValueOnce({code: -1, msg: "agent session revision conflict", data: {revision: 5}})
            .mockResolvedValueOnce({code: 0, data: {revision: 6}, msg: ""});
        const revisions = createAgentSessionRevisionState();

        await saveAgentSession(revisions, requestHeaders, {
            id: "20260801000000-conflict1", title: "Conflict", createdAt: 1, updatedAt: 1,
        });

        // 冲突响应携带服务端权威修订，第二次保存以其为新基准。
        expect(fetchSyncPost).toHaveBeenCalledTimes(2);
        expect(vi.mocked(fetchSyncPost).mock.calls[1]?.[1]).toEqual(expect.objectContaining({
            expectedRevision: 5,
        }));
        expect(getAgentSessionRevision(revisions, "20260801000000-conflict1")).toBe(6);
    });

    it("propagates a pending save failure to load and remove", async () => {
        let completeSave: (value: IWebSocketData) => void;
        const saveResponse = new Promise<IWebSocketData>((resolve) => {
            completeSave = resolve;
        });
        vi.mocked(fetchSyncPost).mockImplementationOnce(() => saveResponse);
        const revisions = createAgentSessionRevisionState();
        const save = saveAgentSession(revisions, requestHeaders, {
            id: "20260801000000-failed1", title: "Failed", createdAt: 1, updatedAt: 1,
        });
        const load = loadAgentSession(revisions, requestHeaders, "20260801000000-failed1");
        const remove = removeAgentSession(revisions, requestHeaders, "20260801000000-failed1");
        completeSave!({code: 1, msg: "revision conflict"});

        await expect(save).rejects.toThrow("revision conflict");
        await expect(load).rejects.toThrow("revision conflict");
        await expect(remove).rejects.toThrow("revision conflict");
        expect(fetchSyncPost).toHaveBeenCalledTimes(1);
    });

    it("rejects three stale reads after observing a newer revision", async () => {
        const revisions = createAgentSessionRevisionState();
        const session = {id: "20260801000000-revisio", title: "Revisioned", createdAt: 1, updatedAt: 1};
        vi.mocked(fetchSyncPost)
            .mockResolvedValueOnce({code: 0, data: {...session, revision: 5}, msg: ""})
            .mockResolvedValue({code: 0, data: {...session, revision: 4}, msg: ""});

        await expect(loadAgentSession(revisions, requestHeaders, session.id))
            .resolves.toEqual(expect.objectContaining({revision: 5}));
        await expect(loadAgentSession(revisions, requestHeaders, session.id)).resolves.toBeNull();
        expect(fetchSyncPost).toHaveBeenCalledTimes(4);
    });

    it("rejects invalid generator output instead of creating a fallback session ID", () => {
        expect(createAgentSessionID(() => "20260801000000-abc1234")).toBe("20260801000000-abc1234");
        expect(() => createAgentSessionID(() => "test-session")).toThrow("Invalid Agent session ID");
    });
});
