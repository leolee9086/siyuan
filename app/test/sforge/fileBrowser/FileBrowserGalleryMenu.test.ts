import {beforeEach, describe, expect, it, vi} from "vitest";
import type {FileBrowserAssetResult} from "../../../src/sforge/fileBrowser/FileBrowser.query.types";
import type {FileBrowserRoot} from "../../../src/sforge/fileBrowser/FileBrowser.types";

const menuState = vi.hoisted(() => ({
    items: [] as Array<Record<string, unknown>>,
    popup: vi.fn(),
    remove: vi.fn(),
    writeText: vi.fn(),
    toggleModel: vi.fn(),
}));

vi.mock("../../../src/sforge/fileBrowser/menu/imports", () => ({
    getSiyuanGlobalMenus: () => ({
        menu: {
            remove: menuState.remove,
            addItem: (item: Record<string, unknown>) => menuState.items.push(item),
            popup: menuState.popup,
        },
    }),
    writeText: menuState.writeText,
}));
vi.mock("../../../src/platform/localPath/openBy", () => ({
    openBy: vi.fn(async () => undefined),
}));
vi.mock("../../../src/layout/query/dockByType", () => ({
    getDockByType: () => ({toggleModel: menuState.toggleModel}),
}));

const root: FileBrowserRoot = {
    id: "workspace", kind: "workspace", label: "workspace", path: "D:\\workspace",
    permission: "read-write", capabilities: {browse: true, write: true, command: false}, exists: true,
};

const asset: FileBrowserAssetResult = {
    rootID: root.id, path: "assets/hero one.png", name: "hero one.png", tags: ["blue"], star: 1,
    annotation: "", boundBlockId: "block-1", source: "", sourceId: "source-1", importTime: 1,
    width: 100, height: 80, fileSize: 1024,
};

describe("FileBrowser gallery item menu", () => {
    beforeEach(() => {
        menuState.items = [];
        menuState.popup.mockClear();
        menuState.remove.mockClear();
        menuState.writeText.mockClear();
        menuState.toggleModel.mockClear();
    });

    it("matches the reference open/copy/property/delete action surface", async () => {
        const {showFileBrowserGalleryItemMenu} = await import("../../../src/sforge/fileBrowser/FileBrowserGalleryMenu");
        const actions = {
            open: vi.fn(async () => undefined),
            openSourceNote: vi.fn(async () => undefined),
            openDefault: vi.fn(async () => undefined),
            openContainingFolder: vi.fn(async () => undefined),
            openDirectory: vi.fn(async () => undefined),
            openProperties: vi.fn(async () => undefined),
            delete: vi.fn(async () => undefined),
        };

        showFileBrowserGalleryItemMenu(
            new MouseEvent("contextmenu", {clientX: 31, clientY: 47}),
            asset, root, "http://localhost/thumb.png", actions,
        );

        const labels = menuState.items.map(item => item.label);
        expect(labels).toEqual(expect.arrayContaining([
            "打开", "所在笔记", "使用默认应用打开", "在文件管理器打开所在路径",
            "在新页签打开文件所在路径", "复制文件地址", "复制文件链接(markdown)",
            "复制文件缩略图", "打开文件属性", "删除", "复制所在目录地址",
        ]));
        const item = (label: string) => menuState.items.find(candidate => candidate.label === label);
        await (item("打开")?.click as () => Promise<void>)();
        await (item("所在笔记")?.click as () => Promise<void>)();
        await (item("使用默认应用打开")?.click as () => Promise<void>)();
        await (item("在文件管理器打开所在路径")?.click as () => Promise<void>)();
        await (item("在新页签打开文件所在路径")?.click as () => Promise<void>)();
        await (item("打开文件属性")?.click as () => Promise<void>)();
        await (item("删除")?.click as () => Promise<void>)();
        (item("复制文件地址")?.click as () => void)();
        (item("复制文件链接(markdown)")?.click as () => void)();
        (item("复制文件缩略图")?.click as () => void)();
        (item("复制所在目录地址")?.click as () => void)();

        expect(actions.open).toHaveBeenCalledWith(asset);
        expect(actions.openSourceNote).toHaveBeenCalledWith(asset);
        expect(actions.openDefault).toHaveBeenCalledWith(asset, root);
        expect(actions.openContainingFolder).toHaveBeenCalledWith(asset, root);
        expect(actions.openDirectory).toHaveBeenCalledWith(asset, root);
        expect(actions.openProperties).toHaveBeenCalledWith(asset);
        expect(actions.delete).toHaveBeenCalledWith(asset);
        expect(menuState.writeText).toHaveBeenNthCalledWith(1, "D:\\workspace\\assets\\hero one.png");
        expect(menuState.writeText).toHaveBeenNthCalledWith(2,
            "[hero one.png](file:///D:/workspace/assets/hero%20one.png)");
        expect(menuState.writeText).toHaveBeenNthCalledWith(3, "![hero one.png](http://localhost/thumb.png)");
        expect(menuState.writeText).toHaveBeenNthCalledWith(4, "D:\\workspace\\assets");
        expect(menuState.popup).toHaveBeenCalledWith({x: 31, y: 47});
    });

    it("does not expose a source-note action without a bound block", async () => {
        const {showFileBrowserGalleryItemMenu} = await import("../../../src/sforge/fileBrowser/FileBrowserGalleryMenu");
        showFileBrowserGalleryItemMenu(new MouseEvent("contextmenu"), {...asset, boundBlockId: ""}, root, "thumb", {
            open: vi.fn(), openSourceNote: vi.fn(),
        });
        expect(menuState.items.map(item => item.label)).not.toContain("所在笔记");
    });
});
