import {afterEach, describe, expect, it, vi} from "vitest";
import {createApp, nextTick, type App as VueApp} from "vue";
import FilePropertiesPanel from "../../../src/sforge/fileBrowser/FilePropertiesPanel.vue";
import {createFileBrowserSelectionStore} from "../../../src/sforge/fileBrowser/FileBrowser.selection";
import type {FileBrowserRoot, FileBrowserTreeNode} from "../../../src/sforge/fileBrowser/FileBrowser.types";
import type {
    FilePropertiesInspectResult,
    FilePropertiesItem,
    FilePropertiesRepository,
    FilePropertiesUpdateItem,
    FilePropertiesUpdateResult,
} from "../../../src/sforge/fileBrowser/FileProperties.types";
import type {FileTagDefinitionsRepository} from "../../../src/sforge/fileBrowser/FileTags.types";

const root: FileBrowserRoot = {
    id: "workspace", kind: "workspace", label: "workspace", path: "D:\\workspace",
    permission: "read-write", capabilities: {browse: true, write: true, command: false}, exists: true,
};

function node(path: string): FileBrowserTreeNode {
    return {
        key: JSON.stringify([root.id, path]), domID: `node-${path}`, rootID: root.id, parentKey: root.id,
        depth: 1, kind: "file", name: path, path, root,
        entry: {name: path, path, isDir: false, isSymlink: false, restricted: false, hidden: false, size: 1, updated: 1, extension: ".md"},
        expanded: false, loadState: "loaded", children: [], total: 0, fileCount: 0, directoryCount: 0,
        hasMore: false, loadingMore: false, error: "", requestRevision: 0,
    };
}

function item(path: string, tags: string[]): FilePropertiesItem {
    const request = {rootID: root.id, path};
    return {
        request,
        properties: {
            root, entry: node(path).entry!, previewKind: "text", revision: `revision-${path}`, readOnly: false,
        },
        metadata: {
            rootID: root.id, path, name: path, tags, star: 0, annotation: "", boundBlockId: "",
            source: "", sourceId: "", importTime: 0,
        },
        metadataPersisted: true,
        metadataWritable: true,
    };
}

function imageItem(path: string): FilePropertiesItem {
    const result = item(path, []);
    if (!result.properties) {
        throw new Error("图片夹具缺少物理属性");
    }
    result.properties = {
        ...result.properties,
        entry: {...result.properties.entry, name: path.split("/").at(-1) ?? path, extension: ".png"},
        previewKind: "image",
        contentURL: `/api/s-forge/file-browser/content/workspace/${path}`,
    };
    return result;
}

function inspectResult(items: FilePropertiesItem[]): FilePropertiesInspectResult {
    return {items, successCount: items.length, failureCount: 0, metadataFailureCount: 0};
}

let app: VueApp<Element> | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
    app?.unmount();
    host?.remove();
    document.getElementById("baseURL")?.remove();
    app = undefined;
    host = undefined;
});

describe("file properties panel tag interactions", () => {
    it("resolves a root-relative image content URL against the application origin", async () => {
        const image = imageItem("nested/page-2.png");
        const repository: FilePropertiesRepository = {
            inspect: vi.fn(async () => inspectResult([image])),
            update: vi.fn(async () => ({items: [image], successCount: 1, failureCount: 0}) satisfies FilePropertiesUpdateResult),
        };
        const tagRepository: FileTagDefinitionsRepository = {
            get: vi.fn(async () => ({revision: "tag-revision-1", items: []})),
            update: vi.fn(async request => ({revision: "tag-revision-2", items: request.items})),
        };
        const selection = createFileBrowserSelectionStore();
        selection.replace(node("nested/page-2.png"));
        const base = document.createElement("base");
        base.id = "baseURL";
        base.href = "/stage/build/desktop/";
        document.head.append(base);
        host = document.createElement("div");
        document.body.append(host);
        app = createApp(FilePropertiesPanel, {repository, selection, tagRepository});
        app.mount(host);

        await vi.waitFor(() => expect(host?.querySelector("img")).not.toBeNull());
        expect(host?.querySelector<HTMLImageElement>("img")?.src)
            .toBe(`${window.location.origin}/api/s-forge/file-browser/content/workspace/nested/page-2.png`);
    });

    it("switches to per-file rows and sends root-aware remove/add/color updates", async () => {
        const first = item("one.md", ["Review"]);
        const second = item("two.md", ["Review", "Blue"]);
        const update = vi.fn(async (updates: FilePropertiesUpdateItem[]) => {
            const current = new Map([["one.md", first], ["two.md", second]]);
            const results = updates.map(request => {
                const source = current.get(request.request.path)!;
                if (!source.properties || !source.metadata) {
                    throw new Error("属性交互夹具缺少成功结果");
                }
                const metadata = {...source.metadata, tags: request.patch.tags ?? source.metadata.tags};
                return {request: request.request, properties: source.properties, metadata};
            });
            return {items: results, successCount: results.length, failureCount: 0} satisfies FilePropertiesUpdateResult;
        });
        const repository: FilePropertiesRepository = {
            inspect: vi.fn(async () => inspectResult([first, second])),
            update,
        };
        const tagRepository: FileTagDefinitionsRepository = {
            get: vi.fn(async () => ({revision: "tag-revision-1", items: [{name: "Review", color: "#112233"}]})),
            update: vi.fn(async request => ({revision: "tag-revision-2", items: request.items})),
        };
        const selection = createFileBrowserSelectionStore();
        const firstNode = node("one.md");
        const secondNode = node("two.md");
        selection.replace(firstNode);
        selection.select(secondNode, [firstNode, secondNode], {toggle: true, range: false});
        host = document.createElement("div");
        document.body.append(host);
        app = createApp(FilePropertiesPanel, {repository, selection, tagRepository});
        app.mount(host);

        await vi.waitFor(() => expect(host?.textContent).toContain("Review (2)"));
        const reviewChip = Array.from(host?.querySelectorAll<HTMLElement>(".sforge-file-tags__chips .b3-chip") ?? [])
            .find(element => element.textContent?.includes("Review"));
        expect(reviewChip?.style.backgroundColor).toBe("#112233");
        host?.querySelector<HTMLElement>("[aria-label='逐文件标签']")
            ?.dispatchEvent(new MouseEvent("click", {bubbles: true}));
        await nextTick();
        expect(host?.querySelectorAll(".sforge-file-tags__file")).toHaveLength(2);

        host?.querySelector<HTMLElement>("[aria-label='从 one.md 移除标签 Review']")
            ?.dispatchEvent(new MouseEvent("click", {bubbles: true}));
        await vi.waitFor(() => expect(update).toHaveBeenCalledWith([
            expect.objectContaining({request: {rootID: "workspace", path: "one.md"}, patch: {tags: []}}),
        ]));

        const input = host?.querySelector<HTMLInputElement>("[placeholder='为 two.md 添加标签']");
        if (input) {
            input.value = "Green";
            input.dispatchEvent(new Event("input", {bubbles: true}));
            input.dispatchEvent(new KeyboardEvent("keydown", {key: "Enter", bubbles: true}));
        }
        await vi.waitFor(() => expect(update).toHaveBeenLastCalledWith([
            expect.objectContaining({request: {rootID: "workspace", path: "two.md"}, patch: {tags: ["Blue", "Green", "Review"]}}),
        ]));

        const color = host?.querySelector<HTMLInputElement>("[aria-label='设置标签 Review 的颜色']");
        if (color) {
            color.value = "#abcdef";
            color.dispatchEvent(new Event("change", {bubbles: true}));
        }
        await vi.waitFor(() => expect(tagRepository.update).toHaveBeenCalledWith({
            expectedRevision: "tag-revision-1",
            items: [{name: "Review", color: "#ABCDEF"}],
        }));
    });
});
