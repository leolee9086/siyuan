import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    fetchPost: vi.fn(),
    hideMessage: vi.fn(),
    markdown: vi.fn(),
    menu: undefined as IMenu | undefined,
    onExport: vi.fn(() => Promise.resolve("<html>PDF</html>")),
    openPreview: vi.fn(),
    printAndroid: vi.fn(),
    saveExport: vi.fn(),
    saveExportFile: vi.fn(),
    showMessage: vi.fn(() => "message-id"),
}));

vi.mock("../../src/menus/commonMenuItem/export/imports", () => ({
    Constants: {LOCAL_EXPORTPDF: "local-export-pdf", ZWSP: "\u200b"},
    Dialog: class {},
    MenuItem: class {
        public element = document.createElement("button");
        constructor(options: IMenu) {
            mocks.menu = options;
        }
    },
    confirmDialog: vi.fn(),
    exportMarkdownZip: mocks.markdown,
    fetchPost: mocks.fetchPost,
    fetchSyncPost: vi.fn(),
    getLocationHost: () => "localhost:6806",
    getLocationProtocol: () => "http:",
    getSiyuanConfig: () => window.siyuan.config,
    getSiyuanLanguages: () => ({
        export: "Export", exporting: "Exporting", image: "Image", more: "More",
        print: "Print", template: "Template",
    }),
    getSiyuanStorage: () => ({
        "local-export-pdf": {keepFold: true, mergeSubdocs: false},
    }),
    getWindowJSAndroid: () => ({print: mocks.printAndroid}),
    getWindowJSHarmony: () => ({print: vi.fn()}),
    getWindowWebkit: () => ({messageHandlers: {print: {postMessage: vi.fn()}}}),
    hideMessage: mocks.hideMessage,
    isElectron: true,
    isInAndroid: () => true,
    isInHarmony: () => false,
    isInIOS: () => false,
    isInMobileApp: () => true,
    isMobile: () => false,
    onExport: mocks.onExport,
    openExportPreviewTab: mocks.openPreview,
    replaceFileName: (value: string) => value,
    saveExport: mocks.saveExport,
    saveExportFile: mocks.saveExportFile,
    showMessage: mocks.showMessage,
}));

import {exportMd} from "../../src/menus/commonMenuItem/export/exportMenu.factory";
import {createBaseExportMenuItems} from "../../src/menus/commonMenuItem/export/menuItems";
import {createMobileExportMenuItems} from "../../src/menus/commonMenuItem/export/mobile";
import {createMoreFormatsMenuItem} from "../../src/menus/commonMenuItem/export/moreFormats";

const click = (item: IMenu | undefined) => {
    if (!item?.click) {
        throw new Error("Expected export menu click action");
    }
    item.click(document.createElement("button"), new MouseEvent("click"));
};

beforeEach(() => {
    vi.clearAllMocks();
    mocks.menu = undefined;
    Object.defineProperty(window, "siyuan", {
        configurable: true,
        value: {config: {}, isPublish: false},
    });
});

describe("common export menu", () => {
    it("preserves the complete desktop order", () => {
        exportMd("doc-id");
        expect(mocks.menu?.submenu?.map(item => item.id)).toEqual([
            "exportTemplate", "exportSiYuanZip", "exportMarkdown", "exportImage",
            "exportPDF", "exportHTML_SiYuan", "exportHTML_Markdown", "exportWord", "exportMore",
        ]);
        expect(mocks.menu?.submenu?.at(-1)?.submenu?.map(item => item.id)).toEqual([
            "exportReStructuredText", "exportAsciiDoc", "exportTextile", "exportOPML",
            "exportOrgMode", "exportMediaWiki", "exportODT", "exportRTF", "exportEPUB",
        ]);
    });

    it("uses the latest Markdown and image export entry points", () => {
        const items = createBaseExportMenuItems("doc-id");
        click(items[1]);
        click(items[2]);
        expect(mocks.markdown).toHaveBeenCalledWith({id: "doc-id"});
        expect(mocks.openPreview).toHaveBeenCalledWith({blockId: "doc-id", previewType: "image"});
    });

    it("passes the synchronous progress identity into archive saving", () => {
        const item = createMoreFormatsMenuItem("doc-id").submenu?.[0];
        click(item);
        expect(mocks.fetchPost).toHaveBeenCalledWith(
            "/api/export/exportReStructuredText", {id: "doc-id"}, expect.any(Function),
        );
        const callback = mocks.fetchPost.mock.calls[0]?.[2];
        callback({data: {zip: "/export.zip"}});
        expect(mocks.saveExportFile).toHaveBeenCalledWith("/export.zip", "message-id");
    });

    it("prints mobile PDF and hides the same progress identity after the existing delay", async () => {
        vi.useFakeTimers();
        const item = createMobileExportMenuItems("doc-id")[0];
        click(item);
        expect(mocks.fetchPost).toHaveBeenCalledWith("/api/export/exportPreviewHTML", {
            id: "doc-id", keepFold: true, merge: false,
        }, expect.any(Function));
        const callback = mocks.fetchPost.mock.calls[0]?.[2];
        callback({data: {name: "Document"}});
        await vi.runAllTimersAsync();
        expect(mocks.onExport).toHaveBeenCalledWith(
            {data: {name: "Document"}}, undefined, "http://localhost:6806/", {type: "pdf", id: "doc-id"},
        );
        expect(mocks.printAndroid).toHaveBeenCalledWith("Document", "<html>PDF</html>");
        expect(mocks.hideMessage).toHaveBeenCalledWith("message-id");
        vi.useRealTimers();
    });
});
