import {describe, expect, it, vi} from "vitest";
import {createFileBrowserSelectionStore} from "../../../src/sforge/fileBrowser/FileBrowser.selection";
import {useFileProperties} from "../../../src/sforge/fileBrowser/useFileProperties";
import type {
    FileBrowserFileRequest,
    FileBrowserRoot,
    FileBrowserTreeNode,
} from "../../../src/sforge/fileBrowser/FileBrowser.types";
import type {
    FilePropertiesInspectResult,
    FilePropertiesItem,
    FilePropertiesRepository,
    FilePropertiesUpdateResult,
} from "../../../src/sforge/fileBrowser/FileProperties.types";
import type {
    FileTagDefinitionsRepository,
    FileTagDefinitionsSnapshot,
} from "../../../src/sforge/fileBrowser/FileTags.types";

const root: FileBrowserRoot = {
    id: "workspace",
    kind: "workspace",
    label: "workspace",
    path: "D:\\workspace",
    permission: "read-write",
    capabilities: {browse: true, write: true, command: false},
    exists: true,
};

function treeNode(path: string): FileBrowserTreeNode {
    const name = path.split("/").at(-1) ?? path;
    return {
        key: JSON.stringify([root.id, path]),
        domID: `node-${name}`,
        rootID: root.id,
        parentKey: root.id,
        depth: 1,
        kind: "file",
        name,
        path,
        root,
        entry: {
            name,
            path,
            isDir: false,
            isSymlink: false,
            restricted: false,
            hidden: false,
            size: 10,
            updated: 100,
            extension: ".md",
        },
        expanded: false,
        loadState: "loaded",
        children: [],
        total: 0,
        fileCount: 0,
        directoryCount: 0,
        hasMore: false,
        loadingMore: false,
        error: "",
        requestRevision: 0,
    };
}

function propertyItem(request: FileBrowserFileRequest, tags: string[] = []): FilePropertiesItem {
    const name = request.path.split("/").at(-1) ?? request.path;
    return {
        request,
        properties: {
            root,
            entry: {
                name,
                path: request.path,
                isDir: false,
                isSymlink: false,
                restricted: false,
                hidden: false,
                size: 10,
                updated: 100,
                extension: ".md",
            },
            mediaType: "text/markdown",
            previewKind: "text",
            contentURL: `/api/file/${name}`,
            revision: `revision-${name}`,
            readOnly: false,
        },
        metadata: {
            rootID: request.rootID,
            path: request.path,
            name,
            tags,
            star: 0,
            annotation: "",
            boundBlockId: "",
            source: "",
            sourceId: "",
            importTime: 0,
        },
        metadataPersisted: true,
        metadataWritable: true,
    };
}

function inspectResult(...items: FilePropertiesItem[]): FilePropertiesInspectResult {
    return {items, successCount: items.length, failureCount: 0, metadataFailureCount: 0};
}

function deferred<T>() {
    let resolve: (value: T) => void = () => undefined;
    const promise = new Promise<T>(done => {
        resolve = done;
    });
    return {promise, resolve};
}

describe("file properties controller", () => {
    it("keeps the newest selection when an older inspect response arrives last", async () => {
        const first = deferred<FilePropertiesInspectResult>();
        const second = deferred<FilePropertiesInspectResult>();
        const inspect = vi.fn()
            .mockReturnValueOnce(first.promise)
            .mockReturnValueOnce(second.promise);
        const repository: FilePropertiesRepository = {
            inspect,
            update: vi.fn(async (): Promise<FilePropertiesUpdateResult> => ({items: [], successCount: 0, failureCount: 0})),
        };
        const selection = createFileBrowserSelectionStore();
        const firstNode = treeNode("first.md");
        const secondNode = treeNode("second.md");
        selection.replace(firstNode);
        const controller = useFileProperties(repository, selection);
        await vi.waitFor(() => expect(inspect).toHaveBeenCalledTimes(1));

        selection.replace(secondNode);
        await vi.waitFor(() => expect(inspect).toHaveBeenCalledTimes(2));
        second.resolve(inspectResult(propertyItem({rootID: root.id, path: secondNode.path})));
        await vi.waitFor(() => expect(controller.items.value[0]?.request.path).toBe("second.md"));
        first.resolve(inspectResult(propertyItem({rootID: root.id, path: firstNode.path})));
        await Promise.resolve();

        expect(controller.items.value[0]?.request.path).toBe("second.md");
        controller.dispose();
    });

    it("updates successful items, preserves failed items and reports partial failure", async () => {
        const firstNode = treeNode("first.md");
        const secondNode = treeNode("second.md");
        const firstRequest = {rootID: root.id, path: firstNode.path};
        const secondRequest = {rootID: root.id, path: secondNode.path};
        const initialFirst = propertyItem(firstRequest, ["existing"]);
        const initialSecond = propertyItem(secondRequest, []);
        const updatedFirst = propertyItem(firstRequest, ["existing", "reviewed"]);
        if (!updatedFirst.properties || !updatedFirst.metadata) {
            throw new Error("成功更新夹具必须包含物理属性和元数据");
        }
        const updatedProperties = updatedFirst.properties;
        const updatedMetadata = updatedFirst.metadata;
        const update = vi.fn(async (): Promise<FilePropertiesUpdateResult> => ({
            items: [
                {request: firstRequest, properties: updatedProperties, metadata: updatedMetadata},
                {request: secondRequest, error: {code: "revision_conflict", message: "文件已变化"}},
            ],
            successCount: 1,
            failureCount: 1,
        }));
        const repository: FilePropertiesRepository = {
            inspect: vi.fn(async () => inspectResult(initialFirst, initialSecond)),
            update,
        };
        const selection = createFileBrowserSelectionStore();
        selection.replace(firstNode);
        selection.select(secondNode, [firstNode, secondNode], {toggle: true, range: false});
        const controller = useFileProperties(repository, selection);
        await vi.waitFor(() => expect(controller.items.value).toHaveLength(2));

        await controller.addTag("reviewed");

        expect(update).toHaveBeenCalledWith([
            expect.objectContaining({request: firstRequest, revision: "revision-first.md", patch: {tags: ["existing", "reviewed"]}}),
            expect.objectContaining({request: secondRequest, revision: "revision-second.md", patch: {tags: ["reviewed"]}}),
        ]);
        expect(controller.items.value[0]?.metadata?.tags).toEqual(["existing", "reviewed"]);
        expect(controller.items.value[1]?.metadata?.tags).toEqual([]);
        expect(controller.items.value[1]?.metadataError?.code).toBe("revision_conflict");
        expect(controller.saveError.value).toBe("文件已变化");
        controller.dispose();
    });

    it("keeps the newest tag definition snapshot and writes a color with its revision", async () => {
        const first = deferred<FileTagDefinitionsSnapshot>();
        const second = deferred<FileTagDefinitionsSnapshot>();
        const tagRepository: FileTagDefinitionsRepository = {
            get: vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise),
            update: vi.fn(async update => ({revision: "revision-3", items: update.items})),
        };
        const repository: FilePropertiesRepository = {
            inspect: vi.fn(async () => inspectResult(propertyItem({rootID: root.id, path: "first.md"}, ["Review"]))),
            update: vi.fn(async (): Promise<FilePropertiesUpdateResult> => ({items: [], successCount: 0, failureCount: 0})),
        };
        const selection = createFileBrowserSelectionStore();
        selection.replace(treeNode("first.md"));
        const controller = useFileProperties(repository, selection, tagRepository);

        const firstLoad = controller.refreshTagDefinitions();
        const secondLoad = controller.refreshTagDefinitions();
        second.resolve({revision: "revision-2", items: [{name: "Review", color: "#112233"}]});
        await secondLoad;
        first.resolve({revision: "revision-1", items: [{name: "Review", color: "#AABBCC"}]});
        await firstLoad;
        expect(controller.tagDefinitions.value.revision).toBe("revision-2");
        expect(controller.aggregateTags.value[0]).toMatchObject({color: "#112233", configured: true});

        await controller.setTagColor("Review", "#abcdef");
        expect(tagRepository.update).toHaveBeenCalledWith({
            expectedRevision: "revision-2",
            items: [{name: "Review", color: "#ABCDEF"}],
        });
        expect(controller.tagDefinitions.value.revision).toBe("revision-3");
        controller.dispose();
    });

    it("serializes consecutive tag color writes onto the newest definition revision", async () => {
        const first = deferred<FileTagDefinitionsSnapshot>();
        const second = deferred<FileTagDefinitionsSnapshot>();
        const update = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
        const tagRepository: FileTagDefinitionsRepository = {
            get: vi.fn(async () => ({revision: "revision-1", items: [{name: "Review", color: ""}]})),
            update,
        };
        const repository: FilePropertiesRepository = {
            inspect: vi.fn(async () => inspectResult()),
            update: vi.fn(async (): Promise<FilePropertiesUpdateResult> => ({items: [], successCount: 0, failureCount: 0})),
        };
        const controller = useFileProperties(repository, createFileBrowserSelectionStore(), tagRepository);
        await controller.refreshTagDefinitions();

        const firstWrite = controller.setTagColor("Review", "#111111");
        const secondWrite = controller.setTagColor("Review", "#222222");
        await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(1));
        first.resolve({revision: "revision-2", items: [{name: "Review", color: "#111111"}]});
        await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(2));
        expect(update).toHaveBeenLastCalledWith({
            expectedRevision: "revision-2",
            items: [{name: "Review", color: "#222222"}],
        });
        second.resolve({revision: "revision-3", items: [{name: "Review", color: "#222222"}]});
        await Promise.all([firstWrite, secondWrite]);
        expect(controller.tagDefinitions.value.revision).toBe("revision-3");
        controller.dispose();
    });
});
