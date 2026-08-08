import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {createApp, type App as VueApp} from "vue";
import FileBrowserPanel from "../../../src/sforge/fileBrowser/FileBrowserPanel.vue";
import {fileBrowserRepository} from "../../../src/sforge/fileBrowser/FileBrowser.repository";
import {fileBrowserSelection} from "../../../src/sforge/fileBrowser/FileBrowser.selection";
import type {FileBrowserDirectoryPage, FileBrowserRoot} from "../../../src/sforge/fileBrowser/FileBrowser.types";

const operationState = vi.hoisted(() => ({
    items: [] as Array<Record<string, unknown>>,
    createDirectory: vi.fn(),
    rename: vi.fn(),
    copy: vi.fn(),
    requestText: vi.fn(),
    requestDestination: vi.fn(),
    showMessage: vi.fn(),
}));

vi.mock("../../../src/sforge/fileBrowser/FileBrowser.operations.repository", () => ({
    fileBrowserOperationsRepository: {
        createDirectory: operationState.createDirectory,
        rename: operationState.rename,
        copy: operationState.copy,
    },
}));
vi.mock("../../../src/sforge/fileBrowser/FileBrowser.operations.dialog", () => ({
    requestFileBrowserText: operationState.requestText,
    requestFileBrowserCopyDestination: operationState.requestDestination,
}));
vi.mock("../../../src/sforge/fileBrowser/menu/imports", () => ({
    getSiyuanGlobalMenus: () => ({
        menu: {
            remove: () => { operationState.items.length = 0; },
            addItem: (item: Record<string, unknown>) => operationState.items.push(item),
            popup: vi.fn(),
        },
    }),
    siyuanI18n: {openBy: "打开", refresh: "刷新", copyPath: "复制路径", rename: "重命名"},
    writeText: vi.fn(),
}));
vi.mock("../../../src/dialog/message", () => ({showMessage: operationState.showMessage}));

const root: FileBrowserRoot = {
    id: "workspace", kind: "workspace", label: "workspace", path: "D:\\workspace",
    permission: "read-write", capabilities: {browse: true, write: true, command: false}, exists: true,
};

function page(path: string): FileBrowserDirectoryPage {
    const entries = path === ""
        ? [{name: "notes", path: "notes", isDir: true, isSymlink: false, restricted: false, hidden: false,
            size: 0, updated: 1, childFileCount: 1, childDirectoryCount: 0, childCountKnown: true}]
        : [{name: "old.txt", path: "notes/old.txt", isDir: false, isSymlink: false, restricted: false,
            hidden: false, size: 1, updated: 1, extension: ".txt"}];
    return {
        root, path, entries, total: entries.length, fileCount: path ? 1 : 0,
        directoryCount: path ? 0 : 1, offset: 0, limit: 200, hasMore: false,
    };
}

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

describe("file browser tree write operations", () => {
    beforeEach(() => {
        operationState.items = [];
        operationState.createDirectory.mockReset().mockResolvedValue({operation: "create-directory"});
        operationState.rename.mockReset().mockResolvedValue({operation: "rename"});
        operationState.copy.mockReset().mockResolvedValue({operation: "copy", copiedFileCount: 1});
        operationState.requestText.mockReset();
        operationState.requestDestination.mockReset();
        operationState.showMessage.mockReset();
        vi.spyOn(fileBrowserRepository, "listRoots").mockResolvedValue([root]);
        vi.spyOn(fileBrowserRepository, "listDirectory").mockImplementation(async request => page(request.path));
    });

    it("runs create, rename and copy from the real node menu and refreshes the affected parent", async () => {
        operationState.requestText
            .mockResolvedValueOnce("new folder")
            .mockResolvedValueOnce("renamed.txt");
        operationState.requestDestination.mockResolvedValue({rootID: "workspace", path: "notes/copied.txt"});
        host = document.createElement("div");
        document.body.append(host);
        app = createApp(FileBrowserPanel, {app: {openAsset: vi.fn(), openTab: vi.fn(async () => undefined)}});
        app.mount(host);

        await vi.waitFor(() => expect(host?.querySelector(".sforge-file-tree__row--root")).toBeTruthy());
        const notesRow = () => Array.from(host?.querySelectorAll<HTMLElement>(".sforge-file-tree__row") ?? [])
            .find(row => row.querySelector(".sforge-file-tree__name")?.textContent?.trim() === "notes");
        await vi.waitFor(() => expect(notesRow()).toBeTruthy());
        const notesMenu = notesRow()?.querySelector<HTMLButtonElement>("button[aria-label='更多']");
        expect(notesMenu).toBeTruthy();
        notesMenu?.click();
        expect(operationState.items.map(item => item.label)).toContain("新建目录");
        await (operationState.items.find(item => item.label === "新建目录")?.click as () => Promise<void>)();
        await vi.waitFor(() => expect(operationState.createDirectory).toHaveBeenCalledWith({
            rootID: "workspace", path: "notes/new folder",
        }));

        notesRow()?.querySelector<HTMLButtonElement>("button[aria-label='展开']")?.click();
        const fileRow = () => Array.from(host?.querySelectorAll<HTMLElement>(".sforge-file-tree__row") ?? [])
            .find(row => row.querySelector(".sforge-file-tree__name")?.textContent?.trim() === "old.txt");
        await vi.waitFor(() => expect(fileRow()).toBeTruthy());
        fileRow()?.querySelector<HTMLButtonElement>("button[aria-label='更多']")?.click();
        await (operationState.items.find(item => item.label === "重命名")?.click as () => Promise<void>)();
        await vi.waitFor(() => expect(operationState.rename).toHaveBeenCalledWith({
            rootID: "workspace", path: "notes/old.txt", newName: "renamed.txt",
        }));

        fileRow()?.querySelector<HTMLButtonElement>("button[aria-label='更多']")?.click();
        await (operationState.items.find(item => item.label === "复制到...")?.click as () => Promise<void>)();
        await vi.waitFor(() => expect(operationState.copy).toHaveBeenCalledWith({
            sourceRootID: "workspace", sourcePath: "notes/old.txt",
            destinationRootID: "workspace", destinationPath: "notes/copied.txt",
        }));
        expect(fileBrowserRepository.listDirectory).toHaveBeenCalledWith(expect.objectContaining({path: "notes"}));
    });
});
