import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const runtime = vi.hoisted(() => ({
    config: {readonly: false},
    getSiyuanConfig: vi.fn(),
    reloadLocation: vi.fn(),
    state: new Map<symbol, unknown>(),
    storage: {} as Record<string, unknown>,
}));

vi.mock("../../../src/util/network/imports", () => ({
    Constants: {LOCAL_FILEPOSITION: "local-file-position", SIYUAN_APPID: "test-app"},
    PROCESS_MESSAGE_UI_DEPENDENCIES: Symbol.for("test.processMessage.uiDependencies"),
    getSForgeState: (key: symbol) => runtime.state.get(key),
    getSiyuanConfig: runtime.getSiyuanConfig,
    getSiyuanStorage: () => runtime.storage,
    getSiyuanWebSocket: () => undefined,
    isBrowser: false,
    isMobile: false,
    reloadLocation: runtime.reloadLocation,
    setSForgeState: (key: symbol, value: unknown) => runtime.state.set(key, value),
}));

vi.mock("../../../src/util/network/cronjobAuth", () => ({
    handleCronjobAuthRequest: vi.fn(),
}));

import {
    processMessage,
    setProcessMessageUIDependencies,
} from "../../../src/util/network/processMessage";
import type {FetchPostPort} from "../../../src/util/network/types";

function createDeferred<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return {promise, reject, resolve};
}

function registerUIDependencies(options: {
    exportLayout?: (input: {cb: () => void; errorExit: boolean}) => Promise<void>;
    hideMessage?: (id?: string) => Promise<void>;
    showMessage?: () => Promise<string | undefined>;
} = {}) {
    setProcessMessageUIDependencies({
        confirmDialog: vi.fn(),
        exportLayout: options.exportLayout ?? vi.fn(async () => undefined),
        hideMessage: options.hideMessage ?? vi.fn(async () => undefined),
        showMessage: options.showMessage ?? vi.fn(async () => "message-id"),
    });
}

describe("processMessage asynchronous contracts", () => {
    beforeEach(() => {
        runtime.getSiyuanConfig.mockReset();
        runtime.getSiyuanConfig.mockReturnValue(runtime.config);
        runtime.reloadLocation.mockReset();
        runtime.state.clear();
        runtime.storage = {};
        vi.stubGlobal("siyuan", {isPublish: false});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it("waits for registered message UI work before resolving", async () => {
        const shown = createDeferred<string | undefined>();
        const showMessage = vi.fn(async () => await shown.promise);
        registerUIDependencies({showMessage});
        let settled = false;

        const handling = processMessage({
            cmd: "msg",
            code: 0,
            msg: "notice",
            data: {closeTimeout: 1000, id: "notice-id"},
        }, {fetchPost: vi.fn()}).then((result) => {
            settled = true;
            return result;
        });
        await vi.waitFor(() => expect(showMessage).toHaveBeenCalledOnce());
        expect(settled).toBe(false);

        shown.resolve("rendered-id");
        await expect(handling).resolves.toBe(false);
        expect(settled).toBe(true);
    });

    it("orders reset-scroll persistence, layout export, and reload", async () => {
        const order: string[] = [];
        const storageCompleted = createDeferred<void>();
        const fetchPost = vi.fn<FetchPostPort>(async (_url, _data, callback) => {
            order.push("storage");
            await storageCompleted.promise;
            await callback?.({code: 0, data: {}, msg: ""});
        });
        registerUIDependencies({
            exportLayout: vi.fn(async ({cb}) => {
                order.push("layout");
                cb();
            }),
        });
        runtime.reloadLocation.mockImplementation(() => order.push("reload"));

        const handling = processMessage({
            cmd: "reloadui",
            code: 0,
            msg: "",
            data: {resetScroll: true},
        }, {fetchPost});
        await vi.waitFor(() => expect(fetchPost).toHaveBeenCalledOnce());
        expect(order).toEqual(["storage"]);

        storageCompleted.resolve();
        await expect(handling).resolves.toBe(false);
        expect(order).toEqual(["storage", "layout", "reload"]);
        expect(runtime.storage["local-file-position"]).toEqual({});
    });

    it("propagates a missing configuration precondition", async () => {
        const error = new Error("Siyuan config is not initialized");
        runtime.getSiyuanConfig.mockImplementationOnce(() => {
            throw error;
        });
        registerUIDependencies();

        await expect(processMessage({
            cmd: "reloadui",
            code: 0,
            msg: "",
            data: {resetScroll: true},
        }, {fetchPost: vi.fn()})).rejects.toBe(error);
    });

    it("reloads only an active publish page for reloadpublishpage", async () => {
        window.siyuan.isPublish = true;

        await expect(processMessage({
            cmd: "reloadpublishpage",
            code: 0,
            msg: "",
            data: {},
        }, {fetchPost: vi.fn()})).resolves.toBe(false);
        expect(runtime.reloadLocation).toHaveBeenCalledOnce();

        runtime.reloadLocation.mockReset();
        window.siyuan.isPublish = false;
        await expect(processMessage({
            cmd: "reloadpublishpage",
            code: 0,
            msg: "",
            data: {},
        }, {fetchPost: vi.fn()})).resolves.toBe(false);
        expect(runtime.reloadLocation).not.toHaveBeenCalled();
    });

    it("rejects explicitly when a CronJob authorization response has no WebSocket", async () => {
        const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

        await expect(processMessage({
            cmd: "cronjob_auth_request",
            code: 0,
            msg: "",
            data: {reqId: "auth-request"},
        }, {fetchPost: vi.fn()})).rejects.toThrow(
            "[CronJob Auth] response WebSocket is not available for request auth-request",
        );
        expect(warning).toHaveBeenCalledWith("[CronJob Auth] confirmDialog dependency is not registered");
    });
});
