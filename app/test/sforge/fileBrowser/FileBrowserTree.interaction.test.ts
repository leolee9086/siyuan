import {afterEach, describe, expect, it, vi} from "vitest";
import {createApp, type App as VueApp} from "vue";
import FileBrowserTree from "../../../src/sforge/fileBrowser/FileBrowserTree.vue";
import {createFileBrowserEntryNode, createFileBrowserRootNode} from "../../../src/sforge/fileBrowser/FileBrowser.tree";
import type {FileBrowserEntry, FileBrowserRoot, FileBrowserTreeNode} from "../../../src/sforge/fileBrowser/FileBrowser.types";

const rootDefinition: FileBrowserRoot = {
    id: "workspace", kind: "workspace", label: "workspace", path: "D:\\workspace",
    permission: "read-write", capabilities: {browse: true, write: true, command: false}, exists: true,
};

function makeTree() {
    const root = createFileBrowserRootNode(rootDefinition);
    const directory: FileBrowserEntry = {
        name: "docs", path: "docs", isDir: true, isSymlink: false, restricted: false,
        hidden: false, size: 0, updated: 1, childFileCount: 1, childDirectoryCount: 0,
        childCountKnown: true,
    };
    const file: FileBrowserEntry = {
        name: "guide.md", path: "docs/guide.md", isDir: false, isSymlink: false,
        restricted: false, hidden: false, size: 1, updated: 1, extension: ".md",
    };
    const docs = createFileBrowserEntryNode(root, directory);
    const guide = createFileBrowserEntryNode(docs, file);
    root.expanded = true;
    root.loadState = "loaded";
    root.children = [docs];
    docs.expanded = true;
    docs.loadState = "loaded";
    docs.children = [guide];
    return {root, docs, guide};
}

let app: VueApp<Element> | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
    app?.unmount();
    host?.remove();
    app = undefined;
    host = undefined;
    window.localStorage.removeItem("sforge:test-tree");
    vi.useRealTimers();
});

describe("FileBrowserTree", () => {
    it("renders real nested treeitems with level and sibling semantics", () => {
        const {root} = makeTree();
        host = document.createElement("div");
        document.body.append(host);
        app = createApp(FileBrowserTree, {
            rootNodes: [root], selectedKeys: new Set<string>(), focusedKey: root.key, openingKey: "",
            persistKey: "sforge:test-tree",
        });
        app.mount(host);

        expect(host.querySelector("[role='tree']")).toBeTruthy();
        const items = Array.from(host.querySelectorAll<HTMLElement>("[role='treeitem']"));
        expect(items.map(item => item.getAttribute("aria-level"))).toEqual(["1", "2", "3"]);
        expect(items.map(item => item.getAttribute("aria-posinset"))).toEqual(["1", "1", "1"]);
        expect(items.map(item => item.getAttribute("aria-setsize"))).toEqual(["1", "1", "1"]);
        expect(host.querySelectorAll("[role='group']")).toHaveLength(2);
        expect(host.querySelector("[role='treeitem'][aria-level='3']")?.textContent).toContain("guide.md");
    });

    it("restores persisted expansion keys and delays directory expansion while dragging", () => {
        vi.useFakeTimers();
        const {root, docs} = makeTree();
        root.expanded = true;
        docs.expanded = false;
        window.localStorage.setItem("sforge:test-tree", JSON.stringify([root.key, docs.key]));
        const restoreExpanded = vi.fn();
        const toggle = vi.fn();
        host = document.createElement("div");
        document.body.append(host);
        app = createApp(FileBrowserTree, {
            rootNodes: [root], selectedKeys: new Set<string>(), focusedKey: "", openingKey: "",
            persistKey: "sforge:test-tree", onRestoreExpanded: restoreExpanded, onToggle: toggle,
        });
        app.mount(host);

        expect(restoreExpanded).toHaveBeenCalledWith([root.key, docs.key]);
        const docsRow = document.getElementById(docs.domID);
        docsRow?.dispatchEvent(new Event("dragenter", {bubbles: true}));
        vi.advanceTimersByTime(499);
        expect(toggle).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(toggle).toHaveBeenCalledWith(docs);
    });
});
