import {beforeEach, describe, expect, it, vi} from "vitest";
import type * as Siyuan from "siyuan";
import {createAppFacade} from "../../src/app/AppFacade.types";
import {EventBus} from "../../src/plugin/EventBus";
import {createInNotePluginManagerFixture} from "../inNotePlugin/InNotePluginManager.fixture";

const services = vi.hoisted(() => ({
    fetchPost: vi.fn(),
    ipcSend: vi.fn(),
    openFile: vi.fn(),
}));

vi.mock("../../src/constants", () => ({
    Constants: {
        CB_GET_FOCUS: "focus",
        CB_GET_HL: "highlight",
        CB_GET_ALL: "all",
        CB_GET_CONTEXT: "context",
        CB_GET_ROOTSCROLL: "root-scroll",
        SIYUAN_CMD: "siyuan-cmd",
    },
}));

vi.mock("../../src/util/network/fetch", () => ({fetchPost: services.fetchPost}));
vi.mock("../../src/platform", () => ({isElectron: true, isMobile: false}));
vi.mock("../../src/platform/electron/ipcRenderer", () => ({ipcSend: services.ipcSend}));
vi.mock("../../src/editor/open/openFile", () => ({openFile: services.openFile}));
import {processSiYuanUri} from "../../src/editor/uri/processSiYuanUri";

const createApp = () => createAppFacade<Siyuan.Plugin, EventBus>({
    plugins: [],
    appId: "uri-test",
    eventBus: new EventBus("uri-test"),
    inNotePluginManager: createInNotePluginManagerFixture(),
    pluginHost: {reloadData: vi.fn(), addDock: vi.fn()},
    createProtyle: vi.fn(),
    getOpenEditors: vi.fn(() => []),
    getOpenModels: vi.fn(),
    openSettings: vi.fn(),
    globalCommand: vi.fn(() => false),
    openSearch: vi.fn(),
    createDocument: vi.fn(),
    createDocumentInTree: vi.fn(),
    handleUnavailableDocument: vi.fn(),
    toggleFullscreen: vi.fn(),
    openGlobalSearch: vi.fn(),
    openTab: vi.fn(),
    openAsset: vi.fn(),
    openBlock: vi.fn(),
    openDatabaseRow: vi.fn(),
    processSiYuanUri: vi.fn(() => false),
});

describe("Editor SiYuan URI dispatch", () => {
    beforeEach(() => {
        services.fetchPost.mockReset();
        services.ipcSend.mockReset();
        services.openFile.mockReset();
        Object.defineProperty(window, "siyuan", {
            configurable: true,
            value: {editorIsFullscreen: false},
        });
    });

    it("rejects unsupported protocols without starting navigation", () => {
        const app = createApp();

        expect(processSiYuanUri(app, "https://example.com")).toBe(false);
        expect(services.fetchPost).not.toHaveBeenCalled();
        expect(app.openBlock).not.toHaveBeenCalled();
    });

    it("keeps block existence, fold and foreground ordering while delegating host navigation", () => {
        const app = createApp();
        services.fetchPost.mockImplementation((url: string, _data: object, callback: (response: {data: unknown}) => void) => {
            if (url === "/api/block/checkBlockExist") {
                callback({data: true});
                return;
            }
            callback({data: {isFolded: true}});
        });

        expect(processSiYuanUri(app, "siyuan://blocks/20260726000000-uri0001?fullscreen=1")).toBe(true);
        expect(services.fetchPost.mock.calls.map(([url]) => url)).toEqual([
            "/api/block/checkBlockExist",
            "/api/block/checkBlockFold",
        ]);
        expect(app.openBlock).toHaveBeenCalledWith({
            id: "20260726000000-uri0001",
            action: ["focus", "highlight", "all"],
            zoomIn: true,
        });
        expect(services.ipcSend).toHaveBeenCalledWith("siyuan-cmd", "show");
        expect(window.siyuan.editorIsFullscreen).toBe(true);
    });
});
