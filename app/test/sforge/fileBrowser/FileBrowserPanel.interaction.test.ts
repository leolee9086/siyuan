import {afterEach, describe, expect, it, vi} from "vitest";
import {createApp, nextTick, type App as VueApp} from "vue";
import FileBrowserPanel from "../../../src/sforge/fileBrowser/FileBrowserPanel.vue";
import {fileBrowserRepository} from "../../../src/sforge/fileBrowser/FileBrowser.repository";
import {fileBrowserOperationsRepository} from "../../../src/sforge/fileBrowser/FileBrowser.operations.repository";
import {fileBrowserSelection} from "../../../src/sforge/fileBrowser/FileBrowser.selection";
import {makeFileBrowserNodeKey} from "../../../src/sforge/fileBrowser/FileBrowser.tree";
import type {
    FileBrowserDirectoryPage,
    FileBrowserEntry,
    FileBrowserRoot,
    FileBrowserTreeNode,
} from "../../../src/sforge/fileBrowser/FileBrowser.types";

const workspace: FileBrowserRoot = {
    id: "workspace", kind: "workspace", label: "workspace", path: "D:\\workspace",
    permission: "read-write", capabilities: {browse: true, write: true, command: false}, exists: true,
};

const agent: FileBrowserRoot = {
    id: "agent-root", kind: "agent-task-directory", label: "task-alpha", path: "D:\\tasks\\alpha",
    permission: "read-only", capabilities: {browse: true, write: false, command: false}, exists: true,
    sources: [{
        sessionID: "session-alpha", directoryID: "main", name: "task-alpha",
        path: "D:\\tasks\\alpha",
        permission: "read-only", external: true, boundAt: 1,
    }],
};

function directoryPage(root: FileBrowserRoot, path: string): FileBrowserDirectoryPage {
    let entries: FileBrowserEntry[];
    if (path === "logs") {
        entries = [{
            name: "run.log", path: "logs/run.log", isDir: false, isSymlink: false,
            restricted: false, hidden: false, size: 8, updated: 1, extension: ".log",
        }];
    } else if (path) {
        entries = [{
            name: "nested.txt", path: `${path}/nested.txt`, isDir: false, isSymlink: false,
            restricted: false, hidden: false, size: 0, updated: 1, extension: ".txt",
        }];
    } else {
        entries = [{
            name: "logs", path: "logs", isDir: true, isSymlink: false,
            restricted: false, hidden: false, size: 0, updated: 1,
            childFileCount: 1, childDirectoryCount: 0, childCountKnown: true,
        }];
    }
    return {
        root, path, entries, total: entries.length,
        fileCount: path ? 1 : 0, directoryCount: path ? 0 : 1,
        offset: 0, limit: 200, hasMore: false,
    };
}

let mountedApp: VueApp<Element> | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
    mountedApp?.unmount();
    host?.remove();
    mountedApp = undefined;
    host = undefined;
    vi.restoreAllMocks();
    fileBrowserSelection.clear();
    window.localStorage.removeItem("sforge:file-browser:tree");
});

describe("file browser panel interaction", () => {
    it("renders persistent roots and lazily expands an Agent directory tree", async () => {
        vi.spyOn(fileBrowserRepository, "listRoots").mockResolvedValue([workspace, agent]);
        const listDirectory = vi.spyOn(fileBrowserRepository, "listDirectory").mockImplementation(async request =>
            directoryPage(request.rootID === agent.id ? agent : workspace, request.path));
        const openTab = vi.fn(async () => undefined);
        host = document.createElement("div");
        document.body.append(host);
        mountedApp = createApp(FileBrowserPanel, {
            app: {openAsset: vi.fn(), openTab},
        });
        mountedApp.mount(host);

        await vi.waitFor(() => expect(host?.querySelectorAll(".sforge-file-tree__row--root")).toHaveLength(2));
        expect(host.textContent).toContain("D:\\workspace");
        expect(host.textContent).toContain("D:\\tasks\\alpha");
        expect(host.querySelector(".sforge-file-tag-tree")).toBeNull();
        expect(listDirectory).toHaveBeenCalledTimes(1);
        expect(listDirectory).toHaveBeenCalledWith(expect.objectContaining({rootID: "workspace", path: ""}));

        const agentRow = Array.from(host.querySelectorAll<HTMLElement>(".sforge-file-tree__row--root"))
            .find(row => row.textContent?.includes("task-alpha"));
        agentRow?.dispatchEvent(new MouseEvent("click", {bubbles: true}));
        await vi.waitFor(() => expect(listDirectory).toHaveBeenCalledWith(
            expect.objectContaining({rootID: "agent-root", path: ""}),
        ));
        expect(host.querySelectorAll(".sforge-file-tree__row--root")).toHaveLength(2);

        const agentTreeNode = agentRow?.closest<HTMLElement>(".sforge-file-tree__node-shell");
        let logsRow: HTMLElement | undefined;
        await vi.waitFor(() => {
            logsRow = Array.from(agentTreeNode?.querySelectorAll<HTMLElement>(".sforge-file-tree__row") ?? [])
                .find(row => row.textContent?.includes("logs") && !row.classList.contains("sforge-file-tree__row--root"));
            expect(logsRow).toBeDefined();
        });
        logsRow?.dispatchEvent(new MouseEvent("click", {bubbles: true}));
        await vi.waitFor(() => expect(listDirectory).toHaveBeenCalledWith(
            expect.objectContaining({rootID: "agent-root", path: "logs"}),
        ));
        await vi.waitFor(() => expect(host?.textContent).toContain("run.log"));
        logsRow?.dispatchEvent(new MouseEvent("dblclick", {bubbles: true}));
        await vi.waitFor(() => expect(openTab).toHaveBeenCalledWith({
            custom: {
                title: "logs", icon: "iconAssets", id: "sforge-file-gallery",
                data: {rootID: "agent-root", path: "logs", name: "logs", scope: "directory"},
            },
        }));

        const tree = host.querySelector<HTMLElement>("[role='tree']");
        expect(tree).toBeTruthy();
        const rootRows = Array.from(tree?.querySelectorAll<HTMLElement>(":scope > .sforge-file-tree__node-shell > [role='treeitem']") ?? []);
        expect(rootRows).toHaveLength(2);
        expect(rootRows.map(row => row.getAttribute("aria-level"))).toEqual(["1", "1"]);
        expect(rootRows.map(row => row.getAttribute("aria-posinset"))).toEqual(["1", "2"]);
        expect(rootRows.map(row => row.getAttribute("aria-setsize"))).toEqual(["2", "2"]);

        const agentShell = agentRow?.closest<HTMLElement>(".sforge-file-tree__node-shell");
        const agentGroup = agentShell?.querySelector<HTMLElement>(":scope > [role='group']");
        expect(agentGroup).toBeTruthy();
        const logsTreeItem = logsRow;
        expect(logsTreeItem?.getAttribute("aria-level")).toBe("2");
        expect(logsTreeItem?.getAttribute("aria-posinset")).toBe("1");
        expect(logsTreeItem?.getAttribute("aria-setsize")).toBe("1");
        expect(logsTreeItem?.getAttribute("aria-expanded")).toBe("true");
        const logsShell = logsTreeItem?.closest<HTMLElement>(".sforge-file-tree__node-shell");
        const logsGroup = logsShell?.querySelector<HTMLElement>(":scope > [role='group']");
        expect(logsGroup?.querySelector("[role='treeitem']")?.getAttribute("aria-level")).toBe("3");

        host.querySelector<HTMLElement>("[aria-label='全部折叠']")
            ?.dispatchEvent(new MouseEvent("click", {bubbles: true}));
        await nextTick();
        expect(host.querySelectorAll("[role='group']")).toHaveLength(0);
    });

    it("moves a dropped file into a directory and refreshes both sides", async () => {
        let moved = false;
        vi.spyOn(fileBrowserRepository, "listRoots").mockResolvedValue([workspace]);
        const listDirectory = vi.spyOn(fileBrowserRepository, "listDirectory").mockImplementation(async request => {
            const entries: FileBrowserEntry[] = request.path === ""
                ? [
                    {name: "target", path: "target", isDir: true, isSymlink: false, restricted: false,
                        hidden: false, size: 0, updated: 1, childFileCount: moved ? 1 : 0,
                        childDirectoryCount: 0, childCountKnown: false},
                    ...(!moved ? [{name: "source.txt", path: "source.txt", isDir: false, isSymlink: false,
                        restricted: false, hidden: false, size: 7, updated: 1, extension: ".txt"}] : []),
                ]
                : moved ? [{name: "source.txt", path: "target/source.txt", isDir: false, isSymlink: false,
                    restricted: false, hidden: false, size: 7, updated: 1, extension: ".txt"}] : [];
            return {
                root: workspace, path: request.path, entries, total: entries.length,
                fileCount: entries.filter(entry => !entry.isDir).length,
                directoryCount: entries.filter(entry => entry.isDir).length,
                offset: 0, limit: 200, hasMore: false,
            };
        });
        const move = vi.spyOn(fileBrowserOperationsRepository, "move").mockImplementation(async request => {
            moved = true;
            return {operation: "move", ...request};
        });
        const openTab = vi.fn(async () => undefined);
        host = document.createElement("div");
        document.body.append(host);
        mountedApp = createApp(FileBrowserPanel, {app: {openAsset: vi.fn(), openTab}});
        mountedApp.mount(host);

        await vi.waitFor(() => expect(host?.textContent).toContain("source.txt"));
        const targetRow = Array.from(host.querySelectorAll<HTMLElement>("[role='treeitem']"))
            .find(row => row.textContent?.includes("target"));
        expect(targetRow).toBeDefined();
        targetRow?.dispatchEvent(new MouseEvent("click", {bubbles: true}));
        await vi.waitFor(() => expect(listDirectory).toHaveBeenCalledWith(expect.objectContaining({path: "target"})));
        const dataTransfer = {
            getData: vi.fn(() => JSON.stringify({rootID: "workspace", path: "source.txt", kind: "file", name: "source.txt"})),
        };
        const drop = new Event("drop", {bubbles: true, cancelable: true});
        Object.defineProperty(drop, "dataTransfer", {value: dataTransfer});
        targetRow?.dispatchEvent(drop);

        await vi.waitFor(() => expect(move).toHaveBeenCalledWith({
            sourceRootID: "workspace", sourcePath: "source.txt",
            destinationRootID: "workspace", destinationPath: "target/source.txt",
        }));
        await vi.waitFor(() => expect(listDirectory.mock.calls.filter(([request]) => request.path === "target")).toHaveLength(1));
        await vi.waitFor(() => expect(Array.from(host.querySelectorAll<HTMLElement>("[role='treeitem']"))
            .some(row => row.getAttribute("title")?.startsWith("target/source.txt"))).toBe(true));
        expect(host.querySelector(".sforge-file-browser__error")?.textContent ?? "").not.toContain("移动");
    });

    it("moves a multi-selection through the batch contract and clears successful sources", async () => {
        let moved = false;
        vi.spyOn(fileBrowserRepository, "listRoots").mockResolvedValue([workspace]);
        const listDirectory = vi.spyOn(fileBrowserRepository, "listDirectory").mockImplementation(async request => {
            const entries: FileBrowserEntry[] = request.path === ""
                ? [
                    {name: "target", path: "target", isDir: true, isSymlink: false, restricted: false,
                        hidden: false, size: 0, updated: 1, childFileCount: moved ? 2 : 0,
                        childDirectoryCount: 0, childCountKnown: false},
                    ...(!moved ? [
                        {name: "one.txt", path: "one.txt", isDir: false, isSymlink: false,
                            restricted: false, hidden: false, size: 1, updated: 1, extension: ".txt"},
                        {name: "two.txt", path: "two.txt", isDir: false, isSymlink: false,
                            restricted: false, hidden: false, size: 1, updated: 1, extension: ".txt"},
                    ] : []),
                ]
                : moved ? [
                    {name: "one.txt", path: "target/one.txt", isDir: false, isSymlink: false,
                        restricted: false, hidden: false, size: 1, updated: 1, extension: ".txt"},
                    {name: "two.txt", path: "target/two.txt", isDir: false, isSymlink: false,
                        restricted: false, hidden: false, size: 1, updated: 1, extension: ".txt"},
                ] : [];
            return {
                root: workspace, path: request.path, entries, total: entries.length,
                fileCount: entries.filter(entry => !entry.isDir).length,
                directoryCount: entries.filter(entry => entry.isDir).length,
                offset: 0, limit: 200, hasMore: false,
            };
        });
        const moveBatch = vi.spyOn(fileBrowserOperationsRepository, "moveBatch")
            .mockImplementation(async request => {
                moved = true;
                return {
                    items: request.items.map(item => ({
                        request: item,
                        result: {
                            operation: "move" as const,
                            sourceRootID: item.rootID,
                            sourcePath: item.path,
                            destinationRootID: request.destinationRootID,
                            destinationPath: `${request.destinationPath}/${item.path.split("/").at(-1)}`,
                        },
                    })),
                    successCount: request.items.length,
                    failureCount: 0,
                };
            });
        host = document.createElement("div");
        document.body.append(host);
        mountedApp = createApp(FileBrowserPanel, {app: {openAsset: vi.fn(), openTab: vi.fn()}});
        mountedApp.mount(host);

        await vi.waitFor(() => expect(host?.textContent).toContain("one.txt"));
        const targetRow = Array.from(host.querySelectorAll<HTMLElement>("[role='treeitem']"))
            .find(row => row.textContent?.includes("target"));
        expect(targetRow).toBeDefined();
        fileBrowserSelection.replaceAddress({
            key: makeFileBrowserNodeKey("workspace", "one.txt"), rootID: "workspace", path: "one.txt",
            kind: "file", name: "one.txt",
        });
        fileBrowserSelection.select({
            key: makeFileBrowserNodeKey("workspace", "two.txt"), rootID: "workspace", path: "two.txt",
            kind: "file", name: "two.txt",
        } as FileBrowserTreeNode, [], {toggle: true, range: false});

        const dataTransfer = {
            getData: vi.fn(() => JSON.stringify({
                rootID: "workspace", path: "one.txt", kind: "file", name: "one.txt",
                items: [
                    {rootID: "workspace", path: "one.txt", kind: "file", name: "one.txt"},
                    {rootID: "workspace", path: "two.txt", kind: "file", name: "two.txt"},
                ],
            })),
        };
        const drop = new Event("drop", {bubbles: true, cancelable: true});
        Object.defineProperty(drop, "dataTransfer", {value: dataTransfer});
        targetRow?.dispatchEvent(drop);

        await vi.waitFor(() => expect(moveBatch).toHaveBeenCalledWith({
            items: [{rootID: "workspace", path: "one.txt"}, {rootID: "workspace", path: "two.txt"}],
            destinationRootID: "workspace", destinationPath: "target",
        }));
        await vi.waitFor(() => expect(fileBrowserSelection.items.value).toHaveLength(0));
        await vi.waitFor(() => expect(listDirectory.mock.calls.filter(([request]) => request.path === "target")).toHaveLength(1));
        expect(host.querySelector(".sforge-file-browser__error")?.textContent ?? "").not.toContain("移动");
    });
});
