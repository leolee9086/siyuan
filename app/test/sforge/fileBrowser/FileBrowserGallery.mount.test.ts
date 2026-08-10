import {afterEach, describe, expect, it, vi} from "vitest";
import {mountFileBrowserGallery} from "../../../src/sforge/fileBrowser/FileBrowser.gallery";
import {fileBrowserQueryRepository} from "../../../src/sforge/fileBrowser/FileBrowser.query.repository";
import {fileBrowserRepository} from "../../../src/sforge/fileBrowser/FileBrowser.repository";
import type {CustomDomain} from "../../../src/layout/dock/custom/custom.types";
import type {FileBrowserGalleryTabData, FileBrowserRoot} from "../../../src/sforge/fileBrowser/FileBrowser.types";
import type {FileBrowserSearchResult} from "../../../src/sforge/fileBrowser/FileBrowser.query.types";

const root: FileBrowserRoot = {
    id: "workspace", kind: "workspace", label: "workspace", path: "D:\\workspace",
    permission: "read-write", capabilities: {browse: true, write: true, command: false}, exists: true,
};

const result: FileBrowserSearchResult = {
    assets: [{
        rootID: "workspace", path: "assets/hero.png", name: "hero.png", tags: [], star: 0,
        annotation: "", boundBlockId: "", source: "", sourceId: "", importTime: 0,
        width: 640, height: 480, fileSize: 1024,
    }],
    totalCount: 1,
    pageCount: 1,
};

let host: HTMLDivElement | undefined;
let destroyMounts: Array<() => void> = [];

function customFor(element: HTMLElement): CustomDomain {
    const data: FileBrowserGalleryTabData = {rootID: root.id, path: "", name: "全部资源", scope: "global"};
    return {
        element,
        data,
        app: {openAsset: vi.fn(), openTab: vi.fn(async () => undefined)},
    } as unknown as CustomDomain;
}

afterEach(() => {
    destroyMounts.forEach(destroy => destroy());
    destroyMounts = [];
    host?.remove();
    host = undefined;
    vi.restoreAllMocks();
});

describe("FileBrowser gallery host lifecycle", () => {
    it("keeps one Vue state tree when the same panel is initialized twice", async () => {
        vi.spyOn(fileBrowserRepository, "listRoots").mockResolvedValue([root]);
        vi.spyOn(fileBrowserQueryRepository, "search").mockResolvedValue(result);
        host = document.createElement("div");
        document.body.append(host);

        const first = customFor(host);
        mountFileBrowserGallery(first);
        const firstDestroy = first.destroy;
        if (firstDestroy) {
            destroyMounts.push(firstDestroy);
        }
        await vi.waitFor(() => expect(host?.querySelector(".sforge-file-gallery")).toBeTruthy());

        const second = customFor(host);
        mountFileBrowserGallery(second);
        const secondDestroy = second.destroy;
        if (secondDestroy) {
            destroyMounts.push(secondDestroy);
        }

        expect(host.querySelectorAll(".sforge-file-gallery")).toHaveLength(1);
        await vi.waitFor(() => expect(host?.textContent).toContain("hero.png"));
        expect(host?.textContent).not.toContain("此目录没有可展示的资源");

        firstDestroy?.();
        expect(host.querySelectorAll(".sforge-file-gallery")).toHaveLength(1);
        secondDestroy?.();
        expect(host.querySelectorAll(".sforge-file-gallery")).toHaveLength(0);
    });
});
