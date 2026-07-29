import {beforeEach, describe, expect, it, vi} from "vitest";

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

describe("Agent owner request headers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
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

    it("forwards the requested conversation target when listing sessions", async () => {
        mockedGetSafeSiyuanConfig.mockReturnValue({api: {token: "workspace-api-token"}});
        const fetchModule = await import("../../../../src/util/network/fetch");
        const fetchSyncPost = vi.mocked(fetchModule.fetchSyncPost);
        fetchSyncPost.mockResolvedValue({
            code: 0,
            data: {sessions: [], total: 0, page: 1, pageSize: 30},
            msg: "",
        });
        const {SessionStore} = await import("../../../../src/layout/dock/agent/SessionStore");

        await SessionStore.list({targetKind: "magi"});

        expect(fetchSyncPost).toHaveBeenCalledWith("/api/ai/agent/lsSessions", {
            page: 1,
            pageSize: 30,
            keyword: "",
            targetKind: "magi",
        }, {
            Authorization: "Bearer workspace-api-token",
        });
    });

    it("combines checkpoint, app, workspace and owner headers when saving", async () => {
        mockedGetSafeSiyuanConfig.mockReturnValue({api: {token: "workspace-api-token"}});
        const fetchModule = await import("../../../../src/util/network/fetch");
        const fetchSyncPost = vi.mocked(fetchModule.fetchSyncPost);
        fetchSyncPost.mockResolvedValue({code: 0, data: {revision: 4}, msg: ""});
        const {SessionStore, setAgentOwnerTokenProvider} = await import("../../../../src/layout/dock/agent/SessionStore");
        setAgentOwnerTokenProvider(() => "magi-armor-token");

        await SessionStore.save({
            id: "session-1",
            title: "Checkpoint",
            createdAt: 1,
            updatedAt: 1,
        });

        expect(fetchSyncPost).toHaveBeenCalledWith(
            "/api/ai/agent/saveSession",
            expect.objectContaining({id: "session-1", expectedRevision: 0}),
            {
                "Content-Type": "application/json",
                "X-SiYuan-App-ID": "test-app",
                "X-SiYuan-Agent-Checkpoint": "2",
                Authorization: "Bearer workspace-api-token",
                "X-SiYuan-Agent-Owner-Token": "magi-armor-token",
            },
        );
        expect(SessionStore.getRevision("session-1")).toBe(4);
    });

    it("serializes saves for the same session and chains the committed revision", async () => {
        mockedGetSafeSiyuanConfig.mockReturnValue({});
        const fetchModule = await import("../../../../src/util/network/fetch");
        const fetchSyncPost = vi.mocked(fetchModule.fetchSyncPost);
        let completeFirstSave: (value: IWebSocketData) => void;
        const firstResponse = new Promise<IWebSocketData>((resolve) => {
            completeFirstSave = resolve;
        });
        fetchSyncPost
            .mockImplementationOnce(() => firstResponse)
            .mockResolvedValueOnce({code: 0, data: {revision: 3}, msg: ""});
        const {SessionStore} = await import("../../../../src/layout/dock/agent/SessionStore");

        const first = SessionStore.save({id: "serial", title: "First", createdAt: 1, updatedAt: 1});
        const second = SessionStore.save({id: "serial", title: "Second", createdAt: 1, updatedAt: 1});
        expect(fetchSyncPost).toHaveBeenCalledTimes(1);

        completeFirstSave!({code: 0, data: {revision: 2}, msg: ""});
        await first;
        await second;

        expect(fetchSyncPost).toHaveBeenCalledTimes(2);
        const secondCall = fetchSyncPost.mock.calls[1];
        expect(secondCall).toBeDefined();
        expect(secondCall?.[1]).toEqual(expect.objectContaining({
            title: "Second",
            expectedRevision: 2,
        }));
    });

    it("propagates a pending save failure instead of loading or deleting stale state", async () => {
        mockedGetSafeSiyuanConfig.mockReturnValue({});
        const fetchModule = await import("../../../../src/util/network/fetch");
        const fetchSyncPost = vi.mocked(fetchModule.fetchSyncPost);
        let completeSave: (value: IWebSocketData) => void;
        const saveResponse = new Promise<IWebSocketData>((resolve) => {
            completeSave = resolve;
        });
        fetchSyncPost.mockImplementationOnce(() => saveResponse);
        const {SessionStore} = await import("../../../../src/layout/dock/agent/SessionStore");

        const save = SessionStore.save({id: "failed", title: "Failed", createdAt: 1, updatedAt: 1});
        const load = SessionStore.load("failed");
        const remove = SessionStore.remove("failed");
        completeSave!({code: 1, msg: "revision conflict"});

        await expect(save).rejects.toThrow("revision conflict");
        await expect(load).rejects.toThrow("revision conflict");
        await expect(remove).rejects.toThrow("revision conflict");
        expect(fetchSyncPost).toHaveBeenCalledTimes(1);
    });

    it("rejects three stale reads after observing a newer revision", async () => {
        mockedGetSafeSiyuanConfig.mockReturnValue({});
        const fetchModule = await import("../../../../src/util/network/fetch");
        const fetchSyncPost = vi.mocked(fetchModule.fetchSyncPost);
        const session = {id: "revisioned", title: "Revisioned", createdAt: 1, updatedAt: 1};
        fetchSyncPost
            .mockResolvedValueOnce({code: 0, data: {...session, revision: 5}, msg: ""})
            .mockResolvedValue({code: 0, data: {...session, revision: 4}, msg: ""});
        const {SessionStore} = await import("../../../../src/layout/dock/agent/SessionStore");

        await expect(SessionStore.load("revisioned")).resolves.toEqual(expect.objectContaining({revision: 5}));
        await expect(SessionStore.load("revisioned")).resolves.toBeNull();
        expect(fetchSyncPost).toHaveBeenCalledTimes(4);
    });
});
