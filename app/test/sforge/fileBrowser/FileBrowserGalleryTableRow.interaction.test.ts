import {afterEach, describe, expect, it, vi} from "vitest";
import {createApp, type App as VueApp} from "vue";
import FileBrowserGalleryTableRow from "../../../src/sforge/fileBrowser/FileBrowserGalleryTableRow.vue";
import type {FileBrowserAssetResult} from "../../../src/sforge/fileBrowser/FileBrowser.query.types";

const asset: FileBrowserAssetResult = {
    rootID: "workspace", path: "data/assets/hero.png", name: "hero.png", tags: ["hero", "blue"],
    star: 2, annotation: "", boundBlockId: "", source: "catalog", sourceId: "source-1", importTime: 1,
    width: 640, height: 480, fileSize: 2048,
    palettes: [],
};

let app: VueApp<Element> | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
    app?.unmount();
    host?.remove();
    app = undefined;
    host = undefined;
});

describe("FileBrowserGalleryTableRow", () => {
    it("projects a file row and preserves selection/open events", () => {
        const select = vi.fn();
        const open = vi.fn();
        host = document.createElement("div");
        document.body.append(host);
        app = createApp(FileBrowserGalleryTableRow, {
            asset,
            thumbnailUrl: "/api/s-forge/file-browser/thumbnail?rootID=workspace&path=data%2Fassets%2Fhero.png&size=360",
            selected: true,
            onSelect: select,
            onOpen: open,
        });
        app.mount(host);

        const row = host.querySelector<HTMLElement>(".sforge-file-gallery-table-row");
        expect(row?.getAttribute("role")).toBe("row");
        expect(row?.classList.contains("sforge-file-gallery-table-row--selected")).toBe(true);
        expect(row?.textContent).toContain("hero.png");
        expect(row?.textContent).toContain("640 x 480");
        expect(row?.textContent).toContain("2 KB");
        expect(row?.querySelector<HTMLImageElement>("img")?.src)
            .toBe(`${window.location.origin}/api/s-forge/file-browser/thumbnail?rootID=workspace&path=data%2Fassets%2Fhero.png&size=360`);

        row?.dispatchEvent(new MouseEvent("click", {bubbles: true}));
        row?.dispatchEvent(new MouseEvent("dblclick", {bubbles: true}));
        expect(select).toHaveBeenCalledWith(asset);
        expect(open).toHaveBeenCalledWith(asset);
    });

    it("reports a failed thumbnail without replacing it with an icon", async () => {
        host = document.createElement("div");
        document.body.append(host);
        app = createApp(FileBrowserGalleryTableRow, {
            asset,
            thumbnailUrl: "/api/s-forge/file-browser/thumbnail?rootID=workspace&path=missing.png&size=360",
        });
        app.mount(host);

        const image = host.querySelector<HTMLImageElement>(".sforge-file-gallery-table-row__preview img");
        const thumbnailSource = image?.src;
        image?.dispatchEvent(new Event("error"));
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(image?.src).toBe(thumbnailSource);
        expect(host.querySelector(".sforge-file-gallery-table-row__preview img")).toBeNull();
        expect(host.querySelector(".sforge-file-gallery-table-row__preview svg")).toBeNull();
        expect(host.querySelector(".sforge-file-gallery-table-row__image-error")?.textContent)
            .toContain("缩略图加载失败");
    });

    it("keeps keyboard and multi-item drag data on the row boundary", () => {
        const keydown = vi.fn();
        const setData = vi.fn();
        const dataTransfer = {effectAllowed: "", setData};
        host = document.createElement("div");
        document.body.append(host);
        app = createApp(FileBrowserGalleryTableRow, {
            asset,
            index: 2,
            thumbnailUrl: "/api/s-forge/file-browser/thumbnail?rootID=workspace&path=data%2Fassets%2Fhero.png&size=360",
            dragItems: [
                {rootID: "workspace", path: "data/assets/hero.png", kind: "file", name: "hero.png"},
                {rootID: "workspace", path: "data/assets/second.png", kind: "file", name: "second.png"},
            ],
            onKeydown: keydown,
        });
        app.mount(host);

        const row = host.querySelector<HTMLElement>(".sforge-file-gallery-table-row");
        row?.dispatchEvent(new KeyboardEvent("keydown", {key: "ArrowRight", bubbles: true}));
        expect(keydown).toHaveBeenCalledWith(asset, expect.any(KeyboardEvent));

        const dragStart = new Event("dragstart", {bubbles: true});
        Object.defineProperty(dragStart, "dataTransfer", {value: dataTransfer});
        row?.dispatchEvent(dragStart);
        expect(dataTransfer.effectAllowed).toBe("move");
        expect(setData).toHaveBeenCalledWith("application/x-sforge-file", expect.stringContaining("second.png"));
    });
});
