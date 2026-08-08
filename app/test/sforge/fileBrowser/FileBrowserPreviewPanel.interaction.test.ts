import {afterEach, describe, expect, it, vi} from "vitest";
import {createApp, nextTick, type App as VueApp} from "vue";
import FileBrowserPreviewPanel from "../../../src/sforge/fileBrowser/FileBrowserPreviewPanel.vue";
import {fileBrowserRepository} from "../../../src/sforge/fileBrowser/FileBrowser.repository";
import type {FileBrowserFileStat, FileBrowserRoot} from "../../../src/sforge/fileBrowser/FileBrowser.types";

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

    it("replaces a failed image with the controlled placeholder state", async () => {
        vi.spyOn(fileBrowserRepository, "statFile").mockResolvedValue(stat);
        host = document.createElement("div");
        document.body.append(host);
        app = createApp(FileBrowserPreviewPanel, {
            file: {rootID: "workspace", path: "nested/page-2.png", name: "page-2.png"},
        });
        app.mount(host);

        await vi.waitFor(() => expect(host?.querySelector("img")).not.toBeNull());
        host?.querySelector<HTMLImageElement>("img")?.dispatchEvent(new Event("error"));
        await nextTick();

        expect(host?.querySelector("img")).toBeNull();
        expect(host?.querySelector(".sforge-file-preview__state")?.textContent).toContain("图片预览不可用");
    });
});
