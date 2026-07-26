import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    electron: false,
    android: false,
    fetchPost: vi.fn(),
    ipcInvoke: vi.fn(),
    saveExportFile: vi.fn(),
    showMessage: vi.fn(),
}));

vi.mock("../../src/asset/actions/imports", () => ({
    Constants: {SIYUAN_GET: "siyuan-get"},
    fetchPost: mocks.fetchPost,
    getAssetName: (src: string) => src.replace(/^.*\//, "").replace(/\.[^.]+$/, ""),
    getSiyuanConfig: () => window.siyuan.config,
    ipcInvoke: mocks.ipcInvoke,
    get isElectron() {
        return mocks.electron;
    },
    isInAndroid: () => mocks.android,
    pathPosix: () => ({extname: (src: string) => src.slice(src.lastIndexOf("."))}),
    saveExportFile: mocks.saveExportFile,
    showMessage: mocks.showMessage,
    siyuanI18n: {
        clipboardPermissionDenied: "Clipboard denied",
        copied: "Copied",
        copyFile: "Copy file",
        export: "Export",
        exported: "Exported",
    },
}));

import {
    copyPNGByLink,
    exportAsset,
    writeAssetToClipboard,
} from "../../src/asset/actions";

beforeEach(() => {
    mocks.electron = false;
    mocks.android = false;
    vi.clearAllMocks();
    Object.assign(window, {
        JSAndroid: {writeImageClipboard: vi.fn()},
        siyuan: {
            config: {system: {os: "windows"}},
            languages: {
                clipboardPermissionDenied: "Clipboard denied",
                copied: "Copied",
                copyFile: "Copy file",
                exported: "Exported",
            },
        },
    });
});

describe("asset actions", () => {
    it("uses the Web download adapter outside Electron", async () => {
        const item = exportAsset("assets/report.pdf");

        expect(item).toMatchObject({id: "export", label: "Export", icon: "iconUpload"});
        await item.click();

        expect(mocks.saveExportFile).toHaveBeenCalledWith("assets/report.pdf");
        expect(mocks.ipcInvoke).not.toHaveBeenCalled();
    });

    it("uses the desktop save dialog and copies the selected file", async () => {
        mocks.electron = true;
        mocks.ipcInvoke.mockResolvedValue({canceled: false, filePath: "D:/exports/report.pdf"});
        mocks.fetchPost.mockImplementation((_url, _data, callback) => callback({code: 0}));

        await exportAsset("assets/report.pdf").click();

        expect(mocks.ipcInvoke).toHaveBeenCalledWith("siyuan-get", {
            cmd: "showSaveDialog",
            defaultPath: "report.pdf",
            properties: ["showOverwriteConfirmation"],
        });
        expect(mocks.fetchPost).toHaveBeenCalledWith("/api/file/copyFile", {
            src: "assets/report.pdf",
            dest: "D:/exports/report.pdf",
        }, expect.any(Function));
        expect(mocks.showMessage).toHaveBeenCalledWith("Exported");
    });

    it("keeps file clipboard support limited to Windows and macOS", () => {
        mocks.fetchPost.mockImplementation((_url, _data, callback) => callback({code: 0}));

        const item = writeAssetToClipboard("assets/report.pdf");
        expect(item).toMatchObject({id: "copyFile", label: "Copy file", icon: "iconFile"});
        if ("click" in item) {
            item.click();
        }
        expect(mocks.fetchPost).toHaveBeenCalledWith("/api/clipboard/writeFilePath", {
            path: "assets/report.pdf",
        }, expect.any(Function));
        expect(mocks.showMessage).toHaveBeenCalledWith("Copied");

        window.siyuan.config.system.os = "linux";
        expect(writeAssetToClipboard("assets/report.pdf")).toEqual({ignore: true});
    });

    it("delegates image clipboard writes to the Android bridge", () => {
        mocks.android = true;

        copyPNGByLink("assets/image.png");

        expect(window.JSAndroid.writeImageClipboard).toHaveBeenCalledWith("assets/image.png");
    });
});
