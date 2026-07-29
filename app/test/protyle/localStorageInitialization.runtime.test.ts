import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {Constants} from "../../src/constants";
import {getLocalStorage} from "../../src/protyle/util/localStorage/initialize";

const runtime = vi.hoisted(() => ({
    fetchSyncPost: vi.fn(),
    getDefaultSubType: vi.fn(() => ({h1: false})),
    getDefaultType: vi.fn(() => ({paragraph: true})),
}));

vi.mock("../../src/protyle/util/localStorage/imports", async () => {
    const constantsModule = await import("../../src/constants");
    return {
        Constants: constantsModule.Constants,
        fetchSyncPost: runtime.fetchSyncPost,
        getDefaultSubType: runtime.getDefaultSubType,
        getDefaultType: runtime.getDefaultType,
    };
});

const installEmptySiyuanRuntime = () => {
    Object.defineProperty(window, "siyuan", {
        configurable: true,
        value: {},
        writable: true,
    });
};

describe("local storage initialization", () => {
    beforeEach(() => {
        runtime.fetchSyncPost.mockReset();
        runtime.getDefaultSubType.mockClear();
        runtime.getDefaultType.mockClear();
        installEmptySiyuanRuntime();
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        Reflect.deleteProperty(window, "siyuan");
    });

    it("waits for the response, migrates values, and publishes storage only after completion", async () => {
        let resolveResponse!: (value: IWebSocketData) => void;
        runtime.fetchSyncPost.mockReturnValue(new Promise<IWebSocketData>((resolve) => {
            resolveResponse = resolve;
        }));
        const payload: Record<string, unknown> = {
            [Constants.LOCAL_SEARCHDATA]: JSON.stringify({replaceTypes: {}, subTypes: {}}),
            [Constants.LOCAL_ZOOM]: "1.25",
        };

        const initialization = getLocalStorage();
        expect(window.siyuan.storage).toBeUndefined();

        resolveResponse({code: 0, data: payload, msg: ""});
        await initialization;

        const storage = window.siyuan.storage;
        expect(storage).toBeDefined();
        if (!storage) {
            throw new Error("storage was not installed");
        }
        expect(storage).toBe(payload);
        expect(storage[Constants.LOCAL_ZOOM]).toBe(1.25);
        expect(storage[Constants.LOCAL_SEARCHDATA].replaceTypes).toEqual(Constants.SIYUAN_DEFAULT_REPLACETYPES);
        expect(storage[Constants.LOCAL_SEARCHDATA].subTypes).toEqual({h1: false});
    });

    it("rejects malformed kernel payloads without publishing partial state", async () => {
        runtime.fetchSyncPost.mockResolvedValue({code: 0, data: [], msg: ""});

        await expect(getLocalStorage()).rejects.toThrow("returned a non-object payload");

        expect(window.siyuan.storage).toBeUndefined();
    });

    it("reports invalid persisted JSON and installs the corresponding default", async () => {
        const payload: Record<string, unknown> = {
            [Constants.LOCAL_ZOOM]: "not-json",
        };
        runtime.fetchSyncPost.mockResolvedValue({code: 0, data: payload, msg: ""});

        await getLocalStorage();

        expect(console.warn).toHaveBeenCalledWith(
            `[local-storage] failed to migrate ${Constants.LOCAL_ZOOM}; using defaults`,
            expect.any(SyntaxError),
        );
        expect(window.siyuan.storage?.[Constants.LOCAL_ZOOM]).toBe(1);
    });
});
