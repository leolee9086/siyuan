import {afterEach, describe, expect, it, vi} from "vitest";
import {createApp, nextTick, type App as VueApp} from "vue";
import FileBrowserPreviewPanel from "../../../src/sforge/fileBrowser/FileBrowserPreviewPanel.vue";
import {fileBrowserRepository} from "../../../src/sforge/fileBrowser/FileBrowser.repository";
import type {
    FileBrowserD5AInspectionReport,
    FileBrowserFileStat,
    FileBrowserRoot,
} from "../../../src/sforge/fileBrowser/FileBrowser.types";

const root: FileBrowserRoot = {
    id: "workspace", kind: "workspace", label: "workspace", path: "D:\\workspace",
    permission: "read-write", capabilities: {browse: true, write: true, command: false}, exists: true,
};

const stat: FileBrowserFileStat = {
    root,
    entry: {
        name: "page-2.png", path: "nested/page-2.png", isDir: false, isSymlink: false,
        restricted: false, hidden: false, size: 42, updated: 100, extension: ".png",
    },
    mediaType: "image/png",
    previewKind: "image",
    contentURL: "/api/s-forge/file-browser/content/workspace/nested/page-2.png",
    revision: "42-sha256",
};

let app: VueApp<Element> | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
    app?.unmount();
    host?.remove();
    vi.restoreAllMocks();
    document.getElementById("baseURL")?.remove();
    app = undefined;
    host = undefined;
});

describe("FileBrowserPreviewPanel image adaptation", () => {
    it("keeps file-browser content at the application origin under a staged base URL", async () => {
        const base = document.createElement("base");
        base.id = "baseURL";
        base.href = "/stage/build/desktop/";
        document.head.append(base);
        vi.spyOn(fileBrowserRepository, "statFile").mockResolvedValue(stat);
        host = document.createElement("div");
        document.body.append(host);
        app = createApp(FileBrowserPreviewPanel, {
            file: {rootID: "workspace", path: "nested/page-2.png", name: "page-2.png"},
        });
        app.mount(host);

        await vi.waitFor(() => expect(host?.querySelector("img")).not.toBeNull());
        expect(host?.querySelector<HTMLImageElement>("img")?.src)
            .toBe(`${window.location.origin}${stat.contentURL}`);
    });

    it("keeps the original source after failure and reports an explicit error", async () => {
        vi.spyOn(fileBrowserRepository, "statFile").mockResolvedValue(stat);
        host = document.createElement("div");
        document.body.append(host);
        app = createApp(FileBrowserPreviewPanel, {
            file: {rootID: "workspace", path: "nested/page-2.png", name: "page-2.png"},
        });
        app.mount(host);

        await vi.waitFor(() => expect(host?.querySelector("img")).not.toBeNull());
        const image = host?.querySelector<HTMLImageElement>("img");
        const originalSource = image?.src;
        image?.dispatchEvent(new Event("error"));
        await nextTick();

        expect(image?.src).toBe(originalSource);
        expect(host?.querySelector("img")).toBeNull();
        expect(host?.querySelector(".sforge-file-preview__state")?.textContent).toContain("原图加载失败");
        expect(host?.querySelector(".sforge-file-preview__state")?.textContent).not.toContain("缩略图");
    });

    it("renders the migrated D5A structural report instead of a binary placeholder", async () => {
        const d5aStat: FileBrowserFileStat = {
            ...stat,
            entry: {...stat.entry, name: "fixture.d5a", path: "models/fixture.d5a", extension: ".d5a", size: 1024},
            mediaType: "application/octet-stream",
            previewKind: "d5a",
            contentURL: "/api/s-forge/file-browser/content/workspace/models/fixture.d5a",
        };
        const report: FileBrowserD5AInspectionReport = {
                schemaVersion: 1, documentKind: "scene", operation: "inspect", status: "pass", format: "d5a",
                elapsedMs: 2.5, warnings: [], d5a: {
                    variant: "d5mesh", entryCount: 1, fileEntryCount: 1, encryptedEntryCount: 0,
                    compressedBytes: 100, uncompressedBytes: 200, bundles: [{
                        id: "", meshEntry: "1.d5mesh", status: "parsed", warnings: [], mesh: {
                            version: 11, sourceBytes: 200, triangleCount: 1, vertexCount: 3,
                            descriptorCount: 1, geometryGroupCount: 1,
                        },
                    }],
                },
        };
        vi.spyOn(fileBrowserRepository, "statFile").mockResolvedValue(d5aStat);
        vi.spyOn(fileBrowserRepository, "previewFile").mockResolvedValue({
            stat: d5aStat, provider: "d5a", data: report,
        });
        host = document.createElement("div");
        document.body.append(host);
        app = createApp(FileBrowserPreviewPanel, {
            file: {rootID: "workspace", path: "models/fixture.d5a", name: "fixture.d5a"},
        });
        app.mount(host);

        await vi.waitFor(() => expect(host?.querySelector(".sforge-d5a-preview")).not.toBeNull());
        expect(host?.querySelector(".sforge-d5a-preview")?.textContent).toContain("1.d5mesh");
        expect(host?.querySelector(".sforge-d5a-preview")?.textContent).toContain("1");
        expect(host?.querySelector(".sforge-file-preview__state")).toBeNull();
    });
});
