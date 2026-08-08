import {afterEach, describe, expect, it, vi} from "vitest";
import {createApp, type App as VueApp} from "vue";
import FileBrowserSearchPanel from "../../../src/sforge/fileBrowser/FileBrowserSearchPanel.vue";
import type {FileBrowserRoot} from "../../../src/sforge/fileBrowser/FileBrowser.types";

const root: FileBrowserRoot = {
    id: "workspace", kind: "workspace", label: "workspace", path: "D:\\workspace",
    permission: "read-write", capabilities: {browse: true, write: true, command: false}, exists: true,
};

let app: VueApp<Element> | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
    app?.unmount();
    host?.remove();
    app = undefined;
    host = undefined;
});

describe("FileBrowserSearchPanel", () => {
    it("emits tag, RGB tolerance, palette ratio and circular Hue filters", async () => {
        const search = vi.fn();
        host = document.createElement("div");
        document.body.append(host);
        app = createApp(FileBrowserSearchPanel, {
            roots: [root], result: {assets: [], totalCount: 0, pageCount: 0}, loading: false, error: "",
            onSearch: search,
        });
        app.mount(host);

        const input = (selector: string) => host?.querySelector<HTMLInputElement>(selector);
        const setInput = (selector: string, value: string) => {
            const element = input(selector);
            if (!element) {
                throw new Error(`missing ${selector}`);
            }
            element.value = value;
            element.dispatchEvent(new Event("input", {bubbles: true}));
        };
        setInput("input[type='search']", "hero");
        setInput("input[aria-label='标签筛选']", "red, blue");
        input("input[aria-label='启用颜色检索']")?.click();
        setInput("input[aria-label='RGB 目标颜色']", "#ff0080");
        setInput("input[aria-label='颜色容差']", "12");
        setInput("input[aria-label='最小调色板比例']", "0.5");
        setInput("input[aria-label='最小色相']", "330");
        setInput("input[aria-label='最大色相']", "20");
        setInput("input[aria-label='最小饱和度']", "40");
        setInput("input[aria-label='最大饱和度']", "80");
        setInput("input[aria-label='最小亮度']", "20");
        setInput("input[aria-label='最大亮度']", "70");
        const extensionTrigger = host.querySelector<HTMLButtonElement>("button[aria-label='扩展名筛选']");
        extensionTrigger?.click();
        await vi.waitFor(() => expect(host?.querySelector(".sforge-multi-select__option input")).toBeTruthy());
        const extensionOption = host.querySelector<HTMLInputElement>(".sforge-multi-select__option input");
        if (!extensionOption) {
            throw new Error("missing extension options");
        }
        extensionOption.click();
        input("input[type='checkbox']")?.click();
        host.querySelector("form")?.dispatchEvent(new Event("submit", {bubbles: true, cancelable: true}));

        expect(search).toHaveBeenCalledWith(expect.objectContaining({
            keyword: "hero", allRoots: true, tags: ["red", "blue"], matchAllTags: false,
            exts: [".bmp"],
            palette: {color: [255, 0, 128], tolerance: 12, minRatio: 0.5, minH: 330, maxH: 20,
                minS: 40, maxS: 80, minL: 20, maxL: 70},
        }));
    });

    it("refreshes the query after changing only the extension filter", async () => {
        const search = vi.fn();
        host = document.createElement("div");
        document.body.append(host);
        app = createApp(FileBrowserSearchPanel, {
            roots: [root], loading: false, error: "", initialRequest: {allRoots: true, orderBy: "updated"},
            onSearch: search,
        });
        app.mount(host);

        host.querySelector<HTMLButtonElement>("button[aria-label='扩展名筛选']")?.click();
        await vi.waitFor(() => expect(host?.querySelector(".sforge-multi-select__option input")).toBeTruthy());
        const pngOption = Array.from(host.querySelectorAll<HTMLElement>(".sforge-multi-select__option"))
            .find(option => option.textContent?.includes(".png"))?.querySelector<HTMLInputElement>("input");
        if (!pngOption) {
            throw new Error("missing png extension option");
        }
        pngOption.click();

        await vi.waitFor(() => expect(search).toHaveBeenLastCalledWith({
            allRoots: true, exts: [".png"], orderBy: "updated",
        }), {timeout: 1200});
    });

    it("keeps result rendering out of the tree search form", () => {
        host = document.createElement("div");
        document.body.append(host);
        app = createApp(FileBrowserSearchPanel, {
            roots: [root], loading: false, error: "", onSearch: vi.fn(),
        });
        app.mount(host);

        expect(host.querySelector(".sforge-file-search__result")).toBeNull();
        expect(host.querySelector("form")).toBeTruthy();
    });

    it("allows an initially filtered global form to become an empty filter", async () => {
        const search = vi.fn();
        host = document.createElement("div");
        document.body.append(host);
        app = createApp(FileBrowserSearchPanel, {
            roots: [root], loading: false, error: "", scope: undefined,
            initialRequest: {allRoots: true, tags: ["blue"], exts: [".tmp"], orderBy: "updated"},
            onSearch: search,
            onClear: vi.fn(),
        });
        app.mount(host);

        await vi.waitFor(() => expect(host?.querySelector("button[aria-label='清空文件查询']")).toBeTruthy());
        host?.querySelector<HTMLButtonElement>("button[aria-label='清空文件查询']")?.click();
        host?.querySelector("form")?.dispatchEvent(new Event("submit", {bubbles: true, cancelable: true}));

        expect(search).toHaveBeenLastCalledWith({allRoots: true, orderBy: "updated"});
        await vi.waitFor(() => expect(host?.querySelector(".sforge-multi-select__value--placeholder")).toBeTruthy());
        expect(host?.querySelector(".sforge-multi-select__value--placeholder")?.textContent).toContain("扩展名");
        expect(host?.querySelector<HTMLInputElement>("input[aria-label='标签筛选']")?.value).toBe("");
    });

    it("treats blank query list entries as an empty filter", async () => {
        const search = vi.fn();
        host = document.createElement("div");
        document.body.append(host);
        app = createApp(FileBrowserSearchPanel, {
            roots: [root], loading: false, error: "", scope: undefined,
            initialRequest: {allRoots: true, tags: ["  "], exts: [""], orderBy: "updated"},
            onSearch: search,
        });
        app.mount(host);

        await vi.waitFor(() => expect(host?.querySelector(".sforge-multi-select__value--placeholder")).toBeTruthy());
        expect(host?.querySelector<HTMLInputElement>("input[aria-label='标签筛选']")?.value).toBe("");
        host?.querySelector("form")?.dispatchEvent(new Event("submit", {bubbles: true, cancelable: true}));

        expect(search).toHaveBeenCalledWith({allRoots: true, orderBy: "updated"});
    });
});
