import {beforeEach, describe, expect, it, vi} from "vitest";
import {useFileBrowser} from "../../../src/sforge/fileBrowser/useFileBrowser";
import {fileBrowserSelection} from "../../../src/sforge/fileBrowser/FileBrowser.selection";
import {makeFileBrowserNodeKey, resetFileBrowserContainer} from "../../../src/sforge/fileBrowser/FileBrowser.tree";
import type {
    FileBrowserDirectoryPage,
    FileBrowserEntry,
    FileBrowserFileRequest,
    FileBrowserRepository,
    FileBrowserRoot,
} from "../../../src/sforge/fileBrowser/FileBrowser.types";

const workspaceRoot: FileBrowserRoot = {
    id: "workspace", kind: "workspace", label: "workspace", path: "D:\\workspace",
    permission: "read-write", capabilities: {browse: true, write: true, command: false}, exists: true,
};

const agentRoot: FileBrowserRoot = {
    id: "root-agent", kind: "agent-task-directory", label: "agent-task", path: "D:\\agent-task",
    permission: "read-only", capabilities: {browse: true, write: false, command: false},
    sources: [{
        sessionID: "session-a", directoryID: "main", name: "agent-task",
        path: "D:\\agent-task",
        permission: "read-only", external: true, boundAt: 100,
    }],
    exists: true,
};

const directory: FileBrowserEntry = {
    name: "docs", path: "docs", isDir: true, isSymlink: false,
    restricted: false, hidden: false, size: 0, updated: 100,
    childFileCount: 1, childDirectoryCount: 0, childCountKnown: true,
};

const file: FileBrowserEntry = {
    name: "guide.md", path: "docs/guide.md", isDir: false, isSymlink: false,
    restricted: false, hidden: false, size: 10, updated: 1, extension: ".md",
};

function page(root: FileBrowserRoot, input: Partial<FileBrowserDirectoryPage> = {}): FileBrowserDirectoryPage {
    return {
        root, path: "", entries: [], total: 0, fileCount: 0, directoryCount: 0,
        offset: 0, limit: 200, hasMore: false, ...input,
    };
}

function repository(overrides: Partial<FileBrowserRepository> = {}): FileBrowserRepository {
    return {
        listRoots: vi.fn(async () => [workspaceRoot, agentRoot]),
        listDirectory: vi.fn(async request => page(
            request.rootID === agentRoot.id ? agentRoot : workspaceRoot,
            {path: request.path},
        )),
        statFile: vi.fn(async (request: FileBrowserFileRequest) => ({
            root: request.rootID === agentRoot.id ? agentRoot : workspaceRoot,
            entry: {...file, path: request.path}, mediaType: "text/plain", previewKind: "text" as const,
            contentURL: "/content", revision: "1-1",
        })),
        previewFile: vi.fn(async request => ({
            stat: await repository().statFile(request), text: "text", encoding: "utf-8", truncated: false,
        })),
        ...overrides,
    };
}

beforeEach(() => fileBrowserSelection.clear());

describe("file browser tree state", () => {
    it("keeps all roots visible and expands only the workspace on first load", async () => {
        const listDirectory = vi.fn(async request => page(workspaceRoot, {
            path: request.path, entries: [directory], total: 1, directoryCount: 1,
        }));
        const browser = useFileBrowser(repository({listDirectory}));

        await browser.loadRoots();

        expect(browser.rootNodes.value.map(node => node.rootID)).toEqual(["workspace", "root-agent"]);
        expect(browser.rootNodes.value[0]?.expanded).toBe(true);
        expect(browser.rootNodes.value[0]?.children[0]?.path).toBe("docs");
        expect(browser.rootNodes.value[1]?.loadState).toBe("unloaded");
        expect(listDirectory).toHaveBeenCalledTimes(1);
    });

    it("loads each directory node lazily and keeps its parent visible", async () => {
        const listDirectory = vi.fn(async request => request.path === "docs"
            ? page(workspaceRoot, {path: "docs", entries: [file], total: 1, fileCount: 1})
            : page(workspaceRoot, {entries: [directory], total: 1, directoryCount: 1}));
        const browser = useFileBrowser(repository({listDirectory}));
        await browser.loadRoots();
        const docs = browser.rootNodes.value[0]?.children[0];
        if (!docs) {
            throw new Error("expected docs node");
        }

        await browser.activateNode(docs);

        expect(docs.expanded).toBe(true);
        expect(docs.children[0]?.path).toBe("docs/guide.md");
        expect(browser.visibleNodes.value.map(node => node.path)).toEqual(["", "docs", "docs/guide.md", ""]);
        expect(listDirectory).toHaveBeenLastCalledWith(expect.objectContaining({
            rootID: "workspace", path: "docs", includeChildCounts: true,
        }));
    });

    it("keeps unavailable historical roots visible without listing them", async () => {
        const missing = {...agentRoot, id: "missing", exists: false};
        const listDirectory = vi.fn(async () => page(workspaceRoot));
        const browser = useFileBrowser(repository({
            listRoots: vi.fn(async () => [workspaceRoot, missing]), listDirectory,
        }));
        await browser.loadRoots();
        const missingNode = browser.rootNodes.value[1];
        if (!missingNode) {
            throw new Error("expected missing root node");
        }

        await browser.activateNode(missingNode);

        expect(missingNode.loadState).toBe("error");
        expect(missingNode.error).toContain("不存在");
        expect(listDirectory).toHaveBeenCalledTimes(1);
    });

    it("appends later pages to the container that requested them", async () => {
        const second = {...file, name: "second.md", path: "second.md"};
        const first = {...file, name: "first.md", path: "first.md"};
        const listDirectory = vi.fn(async request => request.offset === 0
            ? page(workspaceRoot, {entries: [first], total: 2, fileCount: 2, hasMore: true})
            : page(workspaceRoot, {entries: [second], total: 2, fileCount: 2, offset: 1}));
        const browser = useFileBrowser(repository({listDirectory}));
        await browser.loadRoots();
        const root = browser.rootNodes.value[0];
        if (!root) {
            throw new Error("expected workspace root");
        }

        await browser.loadMoreNode(root);

        expect(root.children.map(item => item.name)).toEqual(["first.md", "second.md"]);
        expect(listDirectory).toHaveBeenLastCalledWith(expect.objectContaining({offset: 1}));
    });

    it("ignores an older node response after a newer refresh", async () => {
        let resolveFirst: (value: FileBrowserDirectoryPage) => void = () => undefined;
        const firstPage = new Promise<FileBrowserDirectoryPage>(resolve => {
            resolveFirst = resolve;
        });
        let call = 0;
        const listDirectory = vi.fn(async () => {
            call++;
            return call === 1 ? firstPage : page(workspaceRoot, {entries: [file], total: 1, fileCount: 1});
        });
        const browser = useFileBrowser(repository({listDirectory}));
        const initialLoad = browser.loadRoots();
        await vi.waitFor(() => expect(browser.rootNodes.value).toHaveLength(2));
        const root = browser.rootNodes.value[0];
        if (!root) {
            throw new Error("expected workspace root");
        }
        await browser.refreshNode(root);
        resolveFirst(page(workspaceRoot, {entries: [directory], total: 1, directoryCount: 1}));
        await initialLoad;

        expect(root.children.map(item => item.name)).toEqual(["guide.md"]);
    });

    it("opens the selected file through the injected real application port and exposes failure", async () => {
        const opener = vi.fn(async () => {
            throw new Error("preview failed");
        });
        const browser = useFileBrowser(repository({
            listDirectory: vi.fn(async () => page(workspaceRoot, {entries: [file], total: 1, fileCount: 1})),
        }), opener);
        await browser.loadRoots();
        const node = browser.rootNodes.value[0]?.children[0];
        if (!node) {
            throw new Error("expected file node");
        }

        await browser.openNode(node);

        expect(opener).toHaveBeenCalledWith("workspace", file);
        expect(browser.selectedKey.value).toBe(node.key);
        expect(browser.openingKey.value).toBe("");
        expect(browser.openError.value).toBe("preview failed");
    });

    it("uses standard left and right tree keyboard semantics", async () => {
        const browser = useFileBrowser(repository({
            listDirectory: vi.fn(async request => request.path === "docs"
                ? page(workspaceRoot, {path: "docs", entries: [file], total: 1, fileCount: 1})
                : page(workspaceRoot, {entries: [directory], total: 1, directoryCount: 1})),
        }));
        await browser.loadRoots();
        const docs = browser.rootNodes.value[0]?.children[0];
        if (!docs) {
            throw new Error("expected docs node");
        }

        await browser.handleKey(docs, "ArrowRight");
        const child = await browser.handleKey(docs, "ArrowRight");
        const parent = child ? await browser.handleKey(child, "ArrowLeft") : undefined;

        expect(docs.expanded).toBe(true);
        expect(child?.path).toBe("docs/guide.md");
        expect(parent?.key).toBe(docs.key);
    });

    it("restores a persisted nested expansion by loading each missing ancestor", async () => {
        const listDirectory = vi.fn(async request => request.path === "docs"
            ? page(workspaceRoot, {path: "docs", entries: [file], total: 1, fileCount: 1})
            : page(workspaceRoot, {entries: [directory], total: 1, directoryCount: 1}));
        const browser = useFileBrowser(repository({listDirectory}));
        await browser.loadRoots();
        const root = browser.rootNodes.value[0];
        if (!root) {
            throw new Error("expected workspace root");
        }
        resetFileBrowserContainer(root);

        await browser.restoreExpanded([
            root.key,
            makeFileBrowserNodeKey(workspaceRoot.id, "docs"),
        ]);

        const docs = root.children[0];
        expect(root.expanded).toBe(true);
        expect(docs?.expanded).toBe(true);
        expect(docs?.children[0]?.path).toBe("docs/guide.md");
        expect(listDirectory).toHaveBeenLastCalledWith(expect.objectContaining({path: "docs"}));
    });
});
