import {afterEach, describe, expect, it, vi} from "vitest";
import {createApp, type App as VueApp} from "vue";
import FileBrowserGalleryTab from "../../../src/sforge/fileBrowser/FileBrowserGalleryTab.vue";
import {fileBrowserQueryRepository} from "../../../src/sforge/fileBrowser/FileBrowser.query.repository";
import {fileBrowserRepository} from "../../../src/sforge/fileBrowser/FileBrowser.repository";
import {fileBrowserSelection} from "../../../src/sforge/fileBrowser/FileBrowser.selection";
import type {FileBrowserRoot} from "../../../src/sforge/fileBrowser/FileBrowser.types";
import type {FileBrowserSearchResult} from "../../../src/sforge/fileBrowser/FileBrowser.query.types";

const root: FileBrowserRoot = {
    id: "workspace", kind: "workspace", label: "workspace", path: "D:\\workspace",
    permission: "read-write", capabilities: {browse: true, write: true, command: false}, exists: true,
};

const result: FileBrowserSearchResult = {
    assets: [{
        rootID: "workspace", path: "data/assets/icons/hero.png", name: "hero.png", tags: ["hero", "blue"],
        star: 3, annotation: "", boundBlockId: "", source: "catalog", sourceId: "source-1", importTime: 1,
        width: 640, height: 480, fileSize: 1024,
        palettes: [{color: [31, 96, 180], ratio: 0.8, h: 212, s: 71, l: 41}],
    }],
    totalCount: 1,
    pageCount: 1,
};

let app: VueApp<Element> | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
    app?.unmount();
    host?.remove();
    app = undefined;
    host = undefined;
    vi.restoreAllMocks();
    fileBrowserSelection.clear();
});

describe("FileBrowserGalleryTab", () => {
    it("loads a scoped result into the real masonry tab and shares selection/opening", async () => {
        vi.spyOn(fileBrowserRepository, "listRoots").mockResolvedValue([root]);
        vi.spyOn(fileBrowserRepository, "listDirectory").mockResolvedValue({
            root,
            path: "data/assets/icons",
            entries: [
                {
                    name: "sub", path: "data/assets/icons/sub", isDir: true, isSymlink: false,
                    restricted: false, hidden: false, size: 0, updated: 2,
                    childFileCount: 2, childDirectoryCount: 1, childCountKnown: true,
                },
                {
                    name: "other", path: "data/assets/icons/other", isDir: true, isSymlink: false,
                    restricted: false, hidden: false, size: 0, updated: 1,
                    childFileCount: 1, childDirectoryCount: 0, childCountKnown: true,
                },
            ],
            total: 2, fileCount: 0, directoryCount: 2, offset: 0, limit: 2000, hasMore: false,
        });
        vi.spyOn(fileBrowserRepository, "statFile").mockResolvedValue({
            root,
            entry: {
                name: "hero.png", path: "data/assets/icons/hero.png", isDir: false, isSymlink: false,
                restricted: false, hidden: false, size: 1024, updated: 1, extension: ".png",
            },
            mediaType: "image/png", previewKind: "image",
            contentURL: "/api/s-forge/file-browser/content/workspace/data/assets/icons/hero.png",
            revision: "1",
        });
        const search = vi.spyOn(fileBrowserQueryRepository, "search").mockResolvedValue(result);
        const openAsset = vi.fn();
        const openTab = vi.fn(async () => undefined);
        host = document.createElement("div");
        host.style.width = "900px";
        host.style.height = "700px";
        document.body.append(host);
        app = createApp(FileBrowserGalleryTab, {
            app: {openAsset, openTab},
            // 目录页签不应继承另一个目录留下的关键词和扩展名筛选。
            file: {
                rootID: root.id, path: "data/assets/icons", name: "icons",
                query: {keyword: "dev", exts: [".bmp"], orderBy: "updated"},
            },
        });
        app.mount(host);

        await vi.waitFor(() => expect(search).toHaveBeenCalledWith(expect.objectContaining({
            rootIDs: ["workspace"], pathPrefix: "data/assets/icons", orderBy: "updated",
        })));
        const initialRequest = search.mock.calls[0]?.[0];
        expect(initialRequest).not.toHaveProperty("keyword");
        expect(initialRequest).not.toHaveProperty("exts");
        expect(host?.querySelector<HTMLInputElement>("input[aria-label='关键词']")?.value).toBe("");
        expect(host?.querySelector(".sforge-multi-select__value--placeholder")?.textContent).toContain("扩展名");
        await vi.waitFor(() => expect(host?.textContent).toContain("hero.png"));
        expect(host?.querySelector(".virtual-masonry-grid-wrapper")).toBeTruthy();
        expect(host?.textContent).toContain("sub");
        expect(host?.textContent).toContain("2 文件 / 1 目录");
        expect(host?.textContent).toContain("hero");
        expect(host?.textContent).toContain("★★★");
        expect(host?.textContent).toContain("640 x 480");
        expect(host?.textContent).toContain("1 KB");

        const widthSlider = host?.querySelector<HTMLInputElement>("input[aria-label='卡片宽度']");
        widthSlider!.value = "300";
        widthSlider?.dispatchEvent(new Event("input", {bubbles: true}));
        await vi.waitFor(() => expect(host?.querySelector("output")?.textContent).toBe("300px"));

        const attributes = host?.querySelector<HTMLSelectElement>("select[aria-label='显示属性']");
        const sourceOption = Array.from(attributes?.options ?? []).find(option => option.value === "source");
        if (!attributes || !sourceOption) {
            throw new Error("missing gallery attribute option");
        }
        Array.from(attributes.options).forEach(option => { option.selected = option === sourceOption; });
        attributes.dispatchEvent(new Event("change", {bubbles: true}));
        await vi.waitFor(() => expect(host?.textContent).toContain("catalog"));

        const recursiveToggle = host?.querySelector<HTMLInputElement>("input[aria-label='显示子路径']");
        if (!recursiveToggle) {
            throw new Error("missing recursive scope toggle");
        }
        recursiveToggle.checked = false;
        recursiveToggle.dispatchEvent(new Event("change", {bubbles: true}));
        await vi.waitFor(() => expect(search).toHaveBeenLastCalledWith(expect.objectContaining({
            pathPrefix: "data/assets/icons", recursive: false,
        })));

        recursiveToggle.checked = true;
        recursiveToggle.dispatchEvent(new Event("change", {bubbles: true}));
        await vi.waitFor(() => expect(search).toHaveBeenLastCalledWith(expect.objectContaining({
            pathPrefix: "data/assets/icons", recursive: true,
        })));
        const otherToggle = host?.querySelector<HTMLInputElement>("input[aria-label='包含 other']");
        if (!otherToggle) {
            throw new Error("missing child scope toggle");
        }
        otherToggle.checked = false;
        otherToggle.dispatchEvent(new Event("change", {bubbles: true}));
        await vi.waitFor(() => expect(search).toHaveBeenLastCalledWith(expect.objectContaining({
            pathPrefix: "data/assets/icons", recursive: false,
            pathPrefixes: ["data/assets/icons/sub"],
        })));

        const keywordInput = host?.querySelector<HTMLInputElement>("input[aria-label='关键词']");
        keywordInput!.value = "dev";
        keywordInput?.dispatchEvent(new Event("input", {bubbles: true}));
        const extensionTrigger = host?.querySelector<HTMLButtonElement>("button[aria-label='扩展名筛选']");
        extensionTrigger?.click();
        await vi.waitFor(() => expect(host?.querySelector(".sforge-multi-select__option input")).toBeTruthy());
        host?.querySelector<HTMLInputElement>(".sforge-multi-select__option input")?.click();
        await vi.waitFor(() => expect(host?.querySelector(".sforge-multi-select__value")?.textContent).toContain(".bmp"));
        await vi.waitFor(() => expect(search).toHaveBeenLastCalledWith(expect.objectContaining({
            rootIDs: ["workspace"], pathPrefix: "data/assets/icons", exts: [".bmp"], orderBy: "updated",
        })), {timeout: 1200});
        host?.querySelector<HTMLButtonElement>(".sforge-file-gallery-scope__crumb")?.click();
        await vi.waitFor(() => expect(search).toHaveBeenLastCalledWith(expect.objectContaining({
            rootIDs: ["workspace"], pathPrefix: "", orderBy: "updated",
        })));
        expect(host?.querySelector<HTMLInputElement>("input[aria-label='关键词']")?.value).toBe("");
        expect(host?.querySelector(".sforge-multi-select__value--placeholder")?.textContent).toContain("扩展名");

        const card = host?.querySelector<HTMLElement>(".sforge-file-gallery-card");
        const assetCard = card?.querySelector<HTMLElement>(".asset-card");
        expect(card).toBeTruthy();
        expect(assetCard).toBeTruthy();
        const setData = vi.fn();
        const dragStart = new Event("dragstart", {bubbles: true});
        Object.defineProperty(dragStart, "dataTransfer", {
            value: {effectAllowed: "", setData},
        });
        card?.dispatchEvent(dragStart);
        expect(setData).toHaveBeenCalledWith("application/x-sforge-file", expect.stringContaining("hero.png"));
        assetCard?.dispatchEvent(new MouseEvent("click", {bubbles: true}));
        await vi.waitFor(() => expect(fileBrowserSelection.primaryKey.value).toBe(
            JSON.stringify(["workspace", "data/assets/icons/hero.png"]),
        ));
        card?.dispatchEvent(new MouseEvent("dblclick", {bubbles: true}));
        await vi.waitFor(() => expect(openAsset).toHaveBeenCalledWith({
            assetPath: "/api/s-forge/file-browser/content/workspace/data/assets/icons/hero.png",
        }));
    });

    it("opens a tag result without replacing it with the directory scope", async () => {
        vi.spyOn(fileBrowserRepository, "listRoots").mockResolvedValue([root]);
        const search = vi.spyOn(fileBrowserQueryRepository, "search").mockResolvedValue(result);
        host = document.createElement("div");
        document.body.append(host);
        app = createApp(FileBrowserGalleryTab, {
            app: {openAsset: vi.fn(), openTab: vi.fn(async () => undefined)},
            file: {
                rootID: root.id, path: "", name: "标签: blue",
                query: {allRoots: true, tags: ["blue"], matchAllTags: true, orderBy: "updated"},
            },
        });
        app.mount(host);

        await vi.waitFor(() => expect(search).toHaveBeenCalledWith(expect.objectContaining({
            allRoots: true, tags: ["blue"], matchAllTags: true, orderBy: "updated",
        })));
    });

    it("shows an unfiltered global tab as all-root even without an initial query", async () => {
        vi.spyOn(fileBrowserRepository, "listRoots").mockResolvedValue([root]);
        const search = vi.spyOn(fileBrowserQueryRepository, "search").mockResolvedValue(result);
        const file = {rootID: root.id, path: "", name: "全部资源", scope: "global" as const};
        host = document.createElement("div");
        document.body.append(host);
        app = createApp(FileBrowserGalleryTab, {
            app: {openAsset: vi.fn(), openTab: vi.fn(async () => undefined)}, file,
        });
        app.mount(host);

        await vi.waitFor(() => expect(search).toHaveBeenCalledWith({
            allRoots: true, orderBy: "updated", limit: 200, offset: 0,
        }));
        expect(host.querySelector<HTMLInputElement>("input[type='checkbox']")?.checked).toBe(true);
        expect(file.query).toEqual({allRoots: true, orderBy: "updated"});
    });

    it("reports loaded versus total and appends the next page at the scroll boundary", async () => {
        vi.spyOn(fileBrowserRepository, "listRoots").mockResolvedValue([root]);
        const secondAsset = {
            ...result.assets[0], path: "data/assets/icons/second.png", name: "second.png",
        };
        const search = vi.spyOn(fileBrowserQueryRepository, "search")
            .mockResolvedValueOnce({...result, totalCount: 2, assets: [result.assets[0]!]})
            .mockResolvedValueOnce({...result, totalCount: 2, assets: [secondAsset]});
        host = document.createElement("div");
        document.body.append(host);
        app = createApp(FileBrowserGalleryTab, {
            app: {openAsset: vi.fn(), openTab: vi.fn(async () => undefined)},
            file: {rootID: root.id, path: "", name: "全部资源", scope: "global"},
        });
        app.mount(host);

        await vi.waitFor(() => expect(search).toHaveBeenCalledWith(expect.objectContaining({
            allRoots: true, limit: 200, offset: 0,
        })));
        await vi.waitFor(() => expect(host?.textContent).toContain("已加载 1 / 2 个文件"));

        const container = host.querySelector<HTMLElement>(".virtual-masonry-grid-container");
        // 初次布局恢复会暂时屏蔽 80ms 的程序化 scroll；等待该窗口结束后再模拟用户滚动。
        await new Promise(resolve => setTimeout(resolve, 120));
        container?.dispatchEvent(new Event("scroll", {bubbles: true}));
        await vi.waitFor(() => expect(search).toHaveBeenCalledWith(expect.objectContaining({
            allRoots: true, limit: 200, offset: 200,
        })));
        await vi.waitFor(() => expect(host?.textContent).toContain("已加载 2 / 2 个文件"));
    });

    it("keeps a tag result source while leaving runtime extension filtering empty", async () => {
        vi.spyOn(fileBrowserRepository, "listRoots").mockResolvedValue([root]);
        const search = vi.spyOn(fileBrowserQueryRepository, "search").mockResolvedValue(result);
        const file = {
            rootID: root.id, path: "", name: "标签: blue",
            query: {allRoots: true, tags: ["blue"], exts: [".tmp"], orderBy: "updated" as const},
        };
        host = document.createElement("div");
        document.body.append(host);
        app = createApp(FileBrowserGalleryTab, {
            app: {openAsset: vi.fn(), openTab: vi.fn(async () => undefined)},
            file,
        });
        app.mount(host);

        await vi.waitFor(() => expect(search).toHaveBeenCalledWith(expect.objectContaining({
            allRoots: true, tags: ["blue"], orderBy: "updated",
        })));
        host.querySelector<HTMLButtonElement>("button[aria-label='清空文件查询']")?.click();
        await vi.waitFor(() => expect(search).toHaveBeenLastCalledWith({
            allRoots: true, orderBy: "updated", limit: 200, offset: 0,
        }));
        expect(host.querySelector(".sforge-multi-select__value--placeholder")?.textContent).toContain("扩展名");
        expect(host.querySelector<HTMLInputElement>("input[type='checkbox']")?.checked).toBe(true);
        expect(file.query).toEqual({allRoots: true, tags: ["blue"], orderBy: "updated"});

        host.querySelector<HTMLButtonElement>("button[aria-label='重新查询']")?.click();
        await vi.waitFor(() => expect(search).toHaveBeenLastCalledWith({
            allRoots: true, orderBy: "updated", limit: 200, offset: 0,
        }));

        app.unmount();
        host.innerHTML = "";
        search.mockClear();
        app = createApp(FileBrowserGalleryTab, {
            app: {openAsset: vi.fn(), openTab: vi.fn(async () => undefined)}, file,
        });
        app.mount(host);
        await vi.waitFor(() => expect(search).toHaveBeenCalledWith({
            allRoots: true, tags: ["blue"], limit: 200, offset: 0, orderBy: "updated",
        }));
        expect(host.querySelector(".sforge-multi-select__value--placeholder")?.textContent).toContain("扩展名");
    });

    it("does not persist an explicitly submitted empty global form", async () => {
        vi.spyOn(fileBrowserRepository, "listRoots").mockResolvedValue([root]);
        const search = vi.spyOn(fileBrowserQueryRepository, "search").mockResolvedValue(result);
        const file = {
            rootID: root.id, path: "", name: "全部资源",
            query: {allRoots: true, exts: [".bmp"], orderBy: "updated" as const},
        };
        host = document.createElement("div");
        document.body.append(host);
        app = createApp(FileBrowserGalleryTab, {
            app: {openAsset: vi.fn(), openTab: vi.fn(async () => undefined)}, file,
        });
        app.mount(host);

        await vi.waitFor(() => expect(search).toHaveBeenCalledWith(expect.objectContaining({
            allRoots: true, orderBy: "updated",
        })));
        expect(host.querySelector(".sforge-multi-select__value--placeholder")?.textContent).toContain("扩展名");
        host.querySelector("form")?.dispatchEvent(new Event("submit", {bubbles: true, cancelable: true}));

        await vi.waitFor(() => expect(search).toHaveBeenLastCalledWith({
            allRoots: true, orderBy: "updated", limit: 200, offset: 0,
        }));
        expect(file.query).toEqual({allRoots: true, orderBy: "updated"});

        app.unmount();
        host.innerHTML = "";
        search.mockClear();
        app = createApp(FileBrowserGalleryTab, {
            app: {openAsset: vi.fn(), openTab: vi.fn(async () => undefined)}, file,
        });
        app.mount(host);
        await vi.waitFor(() => expect(search).toHaveBeenCalledWith({
            allRoots: true, orderBy: "updated", limit: 200, offset: 0,
        }));
        expect(host.querySelector(".sforge-multi-select__value--placeholder")?.textContent).toContain("扩展名");
    });

    it("does not restore a stale .tmp filter after a runtime extension change", async () => {
        vi.spyOn(fileBrowserRepository, "listRoots").mockResolvedValue([root]);
        const search = vi.spyOn(fileBrowserQueryRepository, "search").mockResolvedValue(result);
        const file = {
            rootID: root.id, path: "", name: "全部资源",
            query: {allRoots: true, exts: [".tmp"], orderBy: "updated" as const},
        };
        host = document.createElement("div");
        document.body.append(host);
        app = createApp(FileBrowserGalleryTab, {
            app: {openAsset: vi.fn(), openTab: vi.fn(async () => undefined)}, file,
        });
        app.mount(host);

        await vi.waitFor(() => expect(search).toHaveBeenCalledWith(expect.objectContaining({
            allRoots: true, orderBy: "updated",
        })));
        const extensionTrigger = host.querySelector<HTMLButtonElement>("button[aria-label='扩展名筛选']");
        extensionTrigger?.click();
        await vi.waitFor(() => expect(host!.querySelector(".sforge-multi-select__option")).toBeTruthy());
        const option = (extension: string) => Array.from(host!.querySelectorAll<HTMLElement>(
            ".sforge-multi-select__option",
        )).find(item => item.textContent?.includes(extension))?.querySelector<HTMLInputElement>("input");
        const freshExtension = option(".png");
        if (!freshExtension) {
            throw new Error("missing replacement extension option");
        }
        freshExtension.checked = true;
        freshExtension.dispatchEvent(new Event("change", {bubbles: true}));
        host.querySelector("form")?.dispatchEvent(new Event("submit", {bubbles: true, cancelable: true}));

        await vi.waitFor(() => expect(search).toHaveBeenLastCalledWith({
            allRoots: true, exts: [".png"], orderBy: "updated", limit: 200, offset: 0,
        }));
        expect(file.query).toEqual({allRoots: true, orderBy: "updated"});

        app.unmount();
        host.innerHTML = "";
        search.mockClear();
        app = createApp(FileBrowserGalleryTab, {
            app: {openAsset: vi.fn(), openTab: vi.fn(async () => undefined)}, file,
        });
        app.mount(host);
        await vi.waitFor(() => expect(search).toHaveBeenCalledWith({
            allRoots: true, orderBy: "updated", limit: 200, offset: 0,
        }));
        expect(host.querySelector(".sforge-multi-select__value--placeholder")?.textContent).toContain("扩展名");
    });

    it("ignores stale all-root query data on a directory tab", async () => {
        vi.spyOn(fileBrowserRepository, "listRoots").mockResolvedValue([root]);
        const search = vi.spyOn(fileBrowserQueryRepository, "search").mockResolvedValue(result);
        const file = {
            rootID: root.id, path: "data/assets", name: "assets",
            query: {allRoots: true, keyword: "old", exts: [".tmp"], orderBy: "updated" as const},
        };
        host = document.createElement("div");
        document.body.append(host);
        app = createApp(FileBrowserGalleryTab, {
            app: {openAsset: vi.fn(), openTab: vi.fn(async () => undefined)},
            file,
        });
        app.mount(host);

        await vi.waitFor(() => expect(search).toHaveBeenCalledWith(expect.objectContaining({
            rootIDs: ["workspace"], pathPrefix: "data/assets", orderBy: "updated",
        })));
        const initialRequest = search.mock.calls[0]?.[0];
        expect(initialRequest).not.toHaveProperty("allRoots");
        expect(initialRequest).not.toHaveProperty("keyword");
        expect(initialRequest).not.toHaveProperty("exts");
        expect(host.querySelector<HTMLInputElement>("input[aria-label='关键词']")?.value).toBe("");
        expect(host.querySelector(".sforge-multi-select__value--placeholder")?.textContent).toContain("扩展名");
        expect(file.query).toBeUndefined();
    });
});
