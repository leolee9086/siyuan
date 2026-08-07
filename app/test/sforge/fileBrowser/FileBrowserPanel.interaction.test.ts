import {afterEach, describe, expect, it, vi} from "vitest";
import {createApp, nextTick, type App as VueApp} from "vue";
import FileBrowserPanel from "../../../src/sforge/fileBrowser/FileBrowserPanel.vue";
import {fileBrowserRepository} from "../../../src/sforge/fileBrowser/FileBrowser.repository";
import {fileBrowserSelection} from "../../../src/sforge/fileBrowser/FileBrowser.selection";
import type {
    FileBrowserDirectoryPage,
    FileBrowserEntry,
    FileBrowserRoot,
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
            tagCountRepository: {list: vi.fn().mockResolvedValue([])},
            tagDefinitionsRepository: {get: vi.fn().mockResolvedValue({revision: "", items: []})},
        });
        mountedApp.mount(host);

        await vi.waitFor(() => expect(host?.querySelectorAll(".sforge-file-tree__row--root")).toHaveLength(2));
        expect(host.textContent).toContain("D:\\workspace");
        expect(host.textContent).toContain("D:\\tasks\\alpha");
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
                data: {rootID: "agent-root", path: "logs", name: "logs"},
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
});
