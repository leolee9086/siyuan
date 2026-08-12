import {beforeEach, describe, expect, it, vi} from "vitest";
import type {
    FileBrowserLocalTreeNode,
    FileBrowserProviderEntryTreeNode,
} from "../../../src/sforge/fileBrowser/FileBrowser.types";

const menuState = vi.hoisted(() => ({
    items: [] as Array<Record<string, unknown>>,
    popup: vi.fn(),
    remove: vi.fn(),
}));

vi.mock("../../../src/sforge/fileBrowser/menu/imports", () => ({
    getSiyuanGlobalMenus: () => ({
        menu: {
            remove: menuState.remove,
            addItem: (item: Record<string, unknown>) => menuState.items.push(item),
            popup: menuState.popup,
        },
    }),
    siyuanI18n: {
        openBy: "打开",
        refresh: "刷新",
        copyPath: "复制路径",
        rename: "重命名",
    },
    writeText: vi.fn(),
}));

const root = {
    id: "workspace", kind: "workspace" as const, label: "workspace", path: "D:\\workspace",
    permission: "read-write" as const,
    capabilities: {browse: true, write: true, command: false}, exists: true,
};

function makeNode(overrides: Partial<FileBrowserLocalTreeNode> = {}): FileBrowserLocalTreeNode {
    return {
        domain: "local",
        key: "[\"workspace\",\"notes/a.txt\"]", domID: "node", rootID: root.id, parentKey: "[\"workspace\",\"notes\"]",
        depth: 2, kind: "file", name: "a.txt", path: "notes/a.txt", root,
        entry: {
            name: "a.txt", path: "notes/a.txt", isDir: false, isSymlink: false, restricted: false,
            hidden: false, size: 1, updated: 1,
        }, expanded: false, loadState: "loaded", children: [], total: 0, fileCount: 0, directoryCount: 0,
        hasMore: false, totalKnown: true, nextCursor: "", loadingMore: false, error: "", requestRevision: 0,
        ...overrides,
    };
}

function makeProviderFile(): FileBrowserProviderEntryTreeNode {
    const descriptor = {
        id: "synology-file-station", displayName: "群晖文件", kind: "file-share",
        sessionMode: "automatic" as const, sessionLabel: "当前会话", capabilities: ["list", "stat", "open"],
    };
    const session = {
        address: {kind: "provider-session" as const, provider: descriptor.id, session: "same-session"},
        readOnly: true,
        descriptor,
    };
    const resource = {
        id: "same-resource", name: "工作文件", kind: "file-share", readOnly: true,
        capabilities: ["list", "stat", "open"], source: {name: "192.168.31.195", kind: "endpoint"},
        address: {
            kind: "provider-resource" as const, provider: descriptor.id,
            session: "same-session", resource: "same-resource",
        },
    };
    return {
        domain: "provider",
        key: "provider-file", domID: "provider-file", parentKey: "provider-resource", depth: 3,
        kind: "file", name: "a.txt", descriptor, session, resource,
        providerEntry: {
            id: "same-token", name: "a.txt", kind: "file", isDir: false, size: 1, modified: 1, created: 1,
            revision: {}, previewKind: "text",
            address: {
                kind: "provider-entry", provider: descriptor.id, session: "same-session",
                resource: "same-resource", token: "same-token",
            },
        },
        expanded: false, loadState: "loaded", children: [], total: 0, totalKnown: true,
        fileCount: 0, directoryCount: 0, hasMore: false, nextCursor: "", loadingMore: false,
        error: "", requestRevision: 0,
    };
}

describe("FileBrowser tree menu", () => {
    beforeEach(() => {
        menuState.items = [];
        menuState.popup.mockClear();
        menuState.remove.mockClear();
    });

    it("exposes writable directory operations and invokes their callbacks", async () => {
        const {showFileBrowserTreeNodeMenu} = await import("../../../src/sforge/fileBrowser/FileBrowser.menu");
        const actions = {
            open: vi.fn(async () => undefined),
            refresh: vi.fn(async () => undefined),
            createFile: vi.fn(async () => undefined),
            createDirectory: vi.fn(async () => undefined),
            rename: vi.fn(async () => undefined),
            copy: vi.fn(async () => undefined),
            delete: vi.fn(async () => undefined),
        };
        const node = makeNode({kind: "directory", name: "notes", path: "notes", parentKey: "", entry: {
            name: "notes", path: "notes", isDir: true, isSymlink: false, restricted: false,
            hidden: false, size: 0, updated: 1,
        }});

        showFileBrowserTreeNodeMenu(new MouseEvent("contextmenu", {clientX: 12, clientY: 20}), node, actions);
        const labels = menuState.items.map(item => item.label);
        expect(labels).toEqual(expect.arrayContaining(["新建", "重命名", "复制到...", "删除"]));
        const createMenu = menuState.items.find(item => item.label === "新建") as {
            submenu?: Array<Record<string, unknown>>;
        } | undefined;
        expect(createMenu?.submenu?.map(item => item.label)).toEqual(["新建文件", "新建目录"]);
        const item = (label: string) => menuState.items.find(candidate => candidate.label === label);
        const submenuItem = (label: string) => createMenu?.submenu?.find(candidate => candidate.label === label);
        await (submenuItem("新建文件")?.click as () => Promise<void>)();
        await (submenuItem("新建目录")?.click as () => Promise<void>)();
        await (item("重命名")?.click as () => Promise<void>)();
        await (item("复制到...")?.click as () => Promise<void>)();
        await (item("删除")?.click as () => Promise<void>)();
        expect(actions.createFile).toHaveBeenCalledWith(node);
        expect(actions.createDirectory).toHaveBeenCalledWith(node);
        expect(actions.rename).toHaveBeenCalledWith(node);
        expect(actions.copy).toHaveBeenCalledWith(node);
        expect(actions.delete).toHaveBeenCalledWith(node);
        expect(menuState.popup).toHaveBeenCalledWith({x: 12, y: 20});
    });

    it("hides write operations inside a read-only mounted path", async () => {
        const {showFileBrowserTreeNodeMenu} = await import("../../../src/sforge/fileBrowser/FileBrowser.menu");
        const readOnlyRoot = {
            ...root,
            mounts: [{
                id: "agent", kind: "agent-task-directory" as const, label: "agent", path: "D:\\workspace\\readonly",
                relativePath: "readonly", permission: "read-only" as const,
                capabilities: {browse: true, write: false, command: false}, exists: true,
            }],
        };
        const node = makeNode({root: readOnlyRoot, path: "readonly/a.txt", rootID: root.id});
        showFileBrowserTreeNodeMenu(new MouseEvent("contextmenu"), node, {
            open: vi.fn(async () => undefined), refresh: vi.fn(async () => undefined),
            createFile: vi.fn(async () => undefined), createDirectory: vi.fn(async () => undefined),
            rename: vi.fn(async () => undefined), copy: vi.fn(async () => undefined),
            delete: vi.fn(async () => undefined),
        });
        const labels = menuState.items.map(item => item.label);
        expect(labels).not.toEqual(expect.arrayContaining(["新建", "重命名", "复制到..."]));
    });

    it("does not expose local paths or local mutations for provider entries", async () => {
        const {showFileBrowserTreeNodeMenu} = await import("../../../src/sforge/fileBrowser/FileBrowser.menu");
        showFileBrowserTreeNodeMenu(new MouseEvent("contextmenu"), makeProviderFile(), {
            open: vi.fn(async () => undefined), refresh: vi.fn(async () => undefined),
            createFile: vi.fn(async () => undefined), createDirectory: vi.fn(async () => undefined),
            rename: vi.fn(async () => undefined), copy: vi.fn(async () => undefined),
            delete: vi.fn(async () => undefined),
        });

        const labels = menuState.items.map(item => item.label);
        expect(labels).not.toEqual(expect.arrayContaining(["新建", "重命名", "复制到...", "删除"]));
        const copyMenu = menuState.items.find(item => item.label === "复制") as {
            submenu?: Array<Record<string, unknown>>;
        } | undefined;
        expect(copyMenu?.submenu?.map(item => item.label)).toEqual(["复制名称"]);
    });
});
