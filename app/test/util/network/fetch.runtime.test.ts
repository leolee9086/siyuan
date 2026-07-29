import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {fetchGet, fetchGetAsync, fetchPost, fetchSyncPost} from "../../../src/util/network/fetch";

const runtime = vi.hoisted(() => ({
    ipcSend: vi.fn(),
    processMessage: vi.fn<() => boolean | Promise<boolean>>(() => true),
    reloadLocation: vi.fn(),
    requestIds: new Map<string, number>(),
    state: new Map<symbol, unknown>(),
}));

vi.mock("../../../src/util/network/imports", () => ({
    Constants: {SIYUAN_QUIT: "siyuan-quit"},
    MODEL_HANDLERS: Symbol.for("sforge.model.handlers"),
    REQUEST_SEMAPHORE: Symbol.for("sforge.fetch.requestSemaphore"),
    getSForgeState: (key: symbol) => runtime.state.get(key),
    getSiyuanReqId: (url: string) => runtime.requestIds.get(url),
    ipcSend: runtime.ipcSend,
    isElectron: false,
    reloadLocation: runtime.reloadLocation,
    setSForgeState: (key: symbol, value: unknown) => runtime.state.set(key, value),
    setSiyuanReqId: (url: string, value: number) => runtime.requestIds.set(url, value),
}));

vi.mock("../../../src/util/network/processMessage", () => ({
    processMessage: runtime.processMessage,
}));

const createDeferred = <T>() => {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return {promise, reject, resolve};
};

const createJsonResponse = (value: unknown) => new Response(JSON.stringify(value), {
    headers: {"content-type": "application/json"},
    status: 200,
});

describe("network fetch async contracts", () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        runtime.ipcSend.mockReset();
        runtime.processMessage.mockReset();
        runtime.processMessage.mockReturnValue(true);
        runtime.reloadLocation.mockReset();
        runtime.requestIds.clear();
        runtime.state.clear();
        fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
        vi.spyOn(console, "error").mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it("waits for an asynchronous success callback before resolving", async () => {
        fetchMock.mockResolvedValue(createJsonResponse({code: 0, data: {id: "doc"}, msg: ""}));
        const callbackStarted = createDeferred<void>();
        const releaseCallback = createDeferred<void>();
        const callback = vi.fn(async () => {
            callbackStarted.resolve();
            await releaseCallback.promise;
        });
        let completed = false;

        const request = fetchPost("/api/filetree/getDoc", {id: "doc"}, callback).then(() => {
            completed = true;
        });
        await callbackStarted.promise;

        expect(completed).toBe(false);
        releaseCallback.resolve();
        await request;
        expect(completed).toBe(true);
    });

    it("processes standard system messages even when no business callback is registered", async () => {
        const response = {cmd: "reloadui", code: 0, data: {}, msg: ""};
        const messageStarted = createDeferred<void>();
        const releaseMessage = createDeferred<void>();
        runtime.processMessage.mockImplementationOnce(async () => {
            messageStarted.resolve();
            await releaseMessage.promise;
            return false;
        });
        fetchMock.mockResolvedValue(createJsonResponse(response));
        let completed = false;

        const request = fetchPost("/api/system/setUILayout", {}).then(() => {
            completed = true;
        });
        await messageStarted.promise;

        expect(completed).toBe(false);
        releaseMessage.resolve();
        await request;
        expect(runtime.processMessage).toHaveBeenCalledWith(response, {fetchPost});
        expect(completed).toBe(true);
    });

    it("propagates callback failures without reporting them as network failures", async () => {
        fetchMock.mockResolvedValue(createJsonResponse({code: 0, data: {}, msg: ""}));
        const callbackError = new Error("callback failed");

        await expect(fetchPost("/api/test", {}, async () => {
            throw callbackError;
        })).rejects.toBe(callbackError);

        expect(console.warn).not.toHaveBeenCalledWith(expect.stringContaining("fetch post failed"));
    });

    it("preserves raw text response delivery for the legacy POST callback protocol", async () => {
        fetchMock.mockResolvedValue(new Response("plain response", {
            headers: {"content-type": "text/plain"},
            status: 200,
        }));
        const callback = vi.fn();

        await fetchPost("/api/raw", {}, callback);

        expect(callback).toHaveBeenCalledOnce();
        expect(callback).toHaveBeenCalledWith("plain response");
        expect(runtime.processMessage).not.toHaveBeenCalled();
    });

    it("recognizes structurally equivalent AbortError values", async () => {
        const abortError = new Error("request cancelled");
        abortError.name = "AbortError";
        fetchMock.mockRejectedValue(abortError);

        await expect(fetchPost("/api/test")).resolves.toBeUndefined();

        expect(runtime.processMessage).not.toHaveBeenCalled();
        expect(console.warn).toHaveBeenCalledWith("fetchPost aborted: /api/test", "request cancelled");
    });

    it("forwards normalized headers through fetchSyncPost", async () => {
        const response = {code: 0, data: {}, msg: ""};
        fetchMock.mockResolvedValue(createJsonResponse(response));

        await expect(fetchSyncPost("/api/ai/agent/lsSessions", {}, {
            Authorization: "Bearer token",
            "X-Request-Attempt": 2,
        })).resolves.toEqual(response);

        const request = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
        expect(request?.headers).toEqual({
            Authorization: "Bearer token",
            "X-Request-Attempt": "2",
        });
        expect(runtime.processMessage).toHaveBeenCalledWith(response, {fetchPost});
    });

    it("reports an empty synchronous response as an explicit protocol error", async () => {
        fetchMock.mockResolvedValue(new Response("", {status: 200}));

        await expect(fetchSyncPost("/api/ai/agent/taskDirectoryCapabilities", {}))
            .rejects.toThrow("fetchSyncPost: 响应格式不符合预期 (url: /api/ai/agent/taskDirectoryCapabilities)");
        expect(runtime.processMessage).not.toHaveBeenCalled();
    });

    it("keeps the official callback GET entry and the internal Promise entry on one implementation", async () => {
        const response = {code: 0, data: {language: "zh_CN"}, msg: ""};
        fetchMock.mockResolvedValueOnce(createJsonResponse(response));
        const callbackCompleted = createDeferred<void>();
        const callback = vi.fn((value: IWebSocketData) => {
            expect(value).toEqual(response);
            callbackCompleted.resolve();
        });
        type OfficialFetchGet = typeof import("siyuan").fetchGet;
        const officialFetchGet: OfficialFetchGet = fetchGet;

        expect(officialFetchGet("/appearance/langs/zh_CN.json", callback)).toBeUndefined();
        await callbackCompleted.promise;

        fetchMock.mockResolvedValueOnce(createJsonResponse(response));
        await expect(fetchGetAsync("/appearance/langs/zh_CN.json")).resolves.toEqual(response);
    });

    it("reports callback GET failures at its synchronous compatibility boundary", async () => {
        const error = new Error("language request failed");
        fetchMock.mockRejectedValue(error);

        expect(fetchGet("/appearance/langs/zh_CN.json", vi.fn())).toBeUndefined();

        await vi.waitFor(() => {
            expect(console.error).toHaveBeenCalledWith(
                "fetchGet failed: /appearance/langs/zh_CN.json",
                error,
            );
        });
    });

    it("retains the official plugin network function surface", () => {
        type OfficialFetchGet = typeof import("siyuan").fetchGet;
        type OfficialFetchPost = typeof import("siyuan").fetchPost;
        const officialFetchGet: OfficialFetchGet = fetchGet;
        const officialFetchPost: OfficialFetchPost = fetchPost;

        expect(officialFetchGet).toBe(fetchGet);
        expect(officialFetchPost).toBe(fetchPost);
    });
});
