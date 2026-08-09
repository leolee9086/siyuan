import {createApp, type App as VueApp} from "vue";
import {afterEach, describe, expect, it, vi} from "vitest";
import {fileBrowserOperationsRepository} from "../../../src/sforge/fileBrowser/FileBrowser.operations.repository";
import {fileBrowserRepository} from "../../../src/sforge/fileBrowser/FileBrowser.repository";
import {fileBrowserSelection} from "../../../src/sforge/fileBrowser/FileBrowser.selection";
import {makeFileBrowserNodeKey} from "../../../src/sforge/fileBrowser/FileBrowser.tree";
import type {
    FileBrowserDirectoryPage,
    FileBrowserEntry,
    FileBrowserRoot,
    FileBrowserTreeNode,
} from "../../../src/sforge/fileBrowser/FileBrowser.types";

const deleteState = vi.hoisted(() => ({
    confirm: vi.fn(async () => true),
    deleteAction: undefined as ((node: FileBrowserTreeNode) => Promise<void>) | undefined,
    node: undefined as FileBrowserTreeNode | undefined,
}));

vi.mock("../../../src/sforge/fileBrowser/FileBrowser.operations.dialog", () => ({
    requestFileBrowserConfirmation: deleteState.confirm,
    requestFileBrowserText: vi.fn(),
    requestFileBrowserCopyDestination: vi.fn(),
}));

vi.mock("../../../src/sforge/fileBrowser/FileBrowser.menu", () => ({
    showFileBrowserTreeNodeMenu: (_event: MouseEvent, node: FileBrowserTreeNode, actions: {
        delete?: (target: FileBrowserTreeNode) => Promise<void>;
    }) => {
        deleteState.node = node;
        deleteState.deleteAction = actions.delete;
    },
}));

vi.mock("../../../src/dialog/message", () => ({showMessage: vi.fn()}));

const workspace: FileBrowserRoot = {
    id: "workspace", kind: "workspace", label: "workspace", path: "D:\\workspace",
    permission: "read-write", capabilities: {browse: true, write: true, command: false}, exists: true,
};

let mountedApp: VueApp<Element> | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
    mountedApp?.unmount();
    host?.remove();
    mountedApp = undefined;
    host = undefined;
    vi.restoreAllMocks();
    deleteState.confirm.mockClear();
    deleteState.deleteAction = undefined;
    deleteState.node = undefined;
    fileBrowserSelection.clear();
});

function page(root: FileBrowserRoot, path: string, entries: FileBrowserEntry[]): FileBrowserDirectoryPage {
    return {
        root, path, entries, total: entries.length,
        fileCount: entries.filter(entry => !entry.isDir).length,
        directoryCount: entries.filter(entry => entry.isDir).length,
        offset: 0, limit: 200, hasMore: false,
    };
}

describe("FileBrowserPanel delete interaction", () => {
    it("confirms deletion, refreshes the parent, and removes the selected subtree", async () => {
        let deleted = false;
        const listDirectory = vi.spyOn(fileBrowserRepository, "listDirectory").mockImplementation(async request => {
            if (request.path !== "") {
                return page(workspace, request.path, []);
            }
            const entries: FileBrowserEntry[] = deleted
                ? [{name: "keep.txt", path: "keep.txt", isDir: false, isSymlink: false, restricted: false,
                    hidden: false, size: 1, updated: 1, extension: ".txt"}]
                : [
                    {name: "tree", path: "tree", isDir: true, isSymlink: false, restricted: false,
                        hidden: false, size: 0, updated: 1, childFileCount: 1, childDirectoryCount: 0,
                        childCountKnown: true},
                    {name: "keep.txt", path: "keep.txt", isDir: false, isSymlink: false, restricted: false,
                        hidden: false, size: 1, updated: 1, extension: ".txt"},
                ];
            return page(workspace, "", entries);
        });
        vi.spyOn(fileBrowserRepository, "listRoots").mockResolvedValue([workspace]);
        const deleteOperation = vi.spyOn(fileBrowserOperationsRepository, "delete").mockImplementation(async request => {
            deleted = true;
            return {operation: "delete", ...request, removedFileCount: 1, removedDirectoryCount: 1};
        });
        const {default: FileBrowserPanel} = await import("../../../src/sforge/fileBrowser/FileBrowserPanel.vue");

        host = document.createElement("div");
        document.body.append(host);
        mountedApp = createApp(FileBrowserPanel, {app: {openAsset: vi.fn(), openTab: vi.fn()}});
        mountedApp.mount(host);

        await vi.waitFor(() => expect(host?.textContent).toContain("tree"));
        const treeRow = Array.from(host.querySelectorAll<HTMLElement>("[role='treeitem']"))
            .find(row => row.textContent?.includes("tree"));
        expect(treeRow).toBeDefined();
        treeRow?.dispatchEvent(new MouseEvent("contextmenu", {bubbles: true, cancelable: true}));
        await vi.waitFor(() => expect(deleteState.deleteAction).toBeDefined());
        await deleteState.deleteAction?.(deleteState.node!);

        expect(deleteState.confirm).toHaveBeenCalledWith("删除文件", expect.stringContaining("tree"));
        expect(deleteOperation).toHaveBeenCalledWith({rootID: "workspace", path: "tree"});
        await vi.waitFor(() => expect(listDirectory.mock.calls.filter(([request]) => request.path === "")).toHaveLength(2));
        expect(host.textContent).not.toContain("tree");
    });

    it("deletes multiple selected entries through the batch contract and keeps the tree in sync", async () => {
        let deleted = false;
        vi.spyOn(fileBrowserRepository, "listRoots").mockResolvedValue([workspace]);
        const listDirectory = vi.spyOn(fileBrowserRepository, "listDirectory").mockImplementation(async request => {
            if (request.path !== "") {
                return page(workspace, request.path, []);
            }
            const entries: FileBrowserEntry[] = deleted ? [] : [
                {name: "one.txt", path: "one.txt", isDir: false, isSymlink: false, restricted: false,
                    hidden: false, size: 1, updated: 1, extension: ".txt"},
                {name: "two.txt", path: "two.txt", isDir: false, isSymlink: false, restricted: false,
                    hidden: false, size: 1, updated: 1, extension: ".txt"},
            ];
            return page(workspace, "", entries);
        });
        vi.spyOn(fileBrowserOperationsRepository, "deleteBatch").mockImplementation(async request => {
            deleted = true;
            return {
                items: request.items.map(item => ({request: item, result: {operation: "delete", ...item}})),
                successCount: request.items.length, failureCount: 0,
            };
        });
        const {default: FileBrowserPanel} = await import("../../../src/sforge/fileBrowser/FileBrowserPanel.vue");

        host = document.createElement("div");
        document.body.append(host);
        mountedApp = createApp(FileBrowserPanel, {app: {openAsset: vi.fn(), openTab: vi.fn()}});
        mountedApp.mount(host);

        await vi.waitFor(() => expect(host?.textContent).toContain("one.txt"));
        fileBrowserSelection.replaceAddress({
            key: makeFileBrowserNodeKey("workspace", "one.txt"), rootID: "workspace", path: "one.txt", kind: "file", name: "one.txt",
        });
        fileBrowserSelection.select({
            key: makeFileBrowserNodeKey("workspace", "two.txt"), rootID: "workspace", path: "two.txt", kind: "file", name: "two.txt",
        } as FileBrowserTreeNode, [], {toggle: true, range: false});
        const button = () => host?.querySelector<HTMLButtonElement>("button[aria-label='删除已选择项目']");
        await vi.waitFor(() => expect(button()).toBeTruthy());
        await button()?.click();
        await vi.waitFor(() => expect(fileBrowserOperationsRepository.deleteBatch).toHaveBeenCalledWith({
            items: [{rootID: "workspace", path: "one.txt"}, {rootID: "workspace", path: "two.txt"}],
        }));
        await vi.waitFor(() => expect(listDirectory.mock.calls.filter(([request]) => request.path === "")).toHaveLength(2));
        expect(fileBrowserSelection.items.value).toHaveLength(0);
    });
});
