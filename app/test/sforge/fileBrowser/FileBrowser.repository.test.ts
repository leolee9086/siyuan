import {beforeEach, describe, expect, it, vi} from "vitest";

const network = vi.hoisted(() => ({
    fetchSyncPost: vi.fn(),
}));

vi.mock("../../../src/sforge/fileBrowser/repository/imports", () => ({
    fetchSyncPost: network.fetchSyncPost,
}));

const workspaceRoot = {
    id: "workspace",
    kind: "workspace",
    label: "workspace",
    path: "D:\\workspace",
    permission: "read-write",
    capabilities: {browse: true, write: true, command: false},
    exists: true,
};

describe("file browser repository", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("reads and validates the aggregated roots through the shared Kernel transport", async () => {
        network.fetchSyncPost.mockResolvedValue({code: 0, msg: "", data: [workspaceRoot]});
        const {listFileBrowserRoots} = await import("../../../src/sforge/fileBrowser/FileBrowser.repository");

        await expect(listFileBrowserRoots()).resolves.toEqual([workspaceRoot]);
        expect(network.fetchSyncPost).toHaveBeenCalledWith("/api/s-forge/file-browser/roots", {});
    });

    it("forwards only root-relative list input and validates the response root", async () => {
        network.fetchSyncPost.mockResolvedValue({
            code: 0,
            msg: "",
            data: {
                root: workspaceRoot,
                path: "docs",
                entries: [{
                    name: "guide.md", path: "docs/guide.md", isDir: false, isSymlink: false,
                    restricted: false, hidden: false, size: 42, updated: 100, extension: ".md",
                }],
                total: 1,
                fileCount: 1,
                directoryCount: 0,
                offset: 0,
                limit: 200,
                hasMore: false,
            },
        });
        const {listFileBrowserDirectory} = await import("../../../src/sforge/fileBrowser/FileBrowser.repository");
        const request = {
            rootID: "workspace", path: "docs", offset: 0, limit: 200,
            sortBy: "name" as const, sortDirection: "asc" as const, directoriesFirst: true,
            includeChildCounts: true,
        };

        const result = await listFileBrowserDirectory(request);

        expect(result.entries[0]?.path).toBe("docs/guide.md");
        expect(network.fetchSyncPost).toHaveBeenCalledWith("/api/s-forge/file-browser/list", request);
    });

    it("rejects failed envelopes, malformed data, and a mismatched root", async () => {
        const {listFileBrowserDirectory, listFileBrowserRoots} = await import(
            "../../../src/sforge/fileBrowser/FileBrowser.repository"
        );
        network.fetchSyncPost.mockResolvedValueOnce({code: 403, msg: "denied"});
        await expect(listFileBrowserRoots()).rejects.toThrow("denied");

        network.fetchSyncPost.mockResolvedValueOnce({code: 0, msg: "", data: [{id: "broken"}]});
        await expect(listFileBrowserRoots()).rejects.toThrow("文件根响应格式错误");

        network.fetchSyncPost.mockResolvedValueOnce({
            code: 0,
            msg: "",
            data: {root: {...workspaceRoot, id: "other"}, path: "", entries: [], total: 0,
                fileCount: 0, directoryCount: 0, offset: 0, limit: 200, hasMore: false},
        });
        await expect(listFileBrowserDirectory({
            rootID: "workspace", path: "", offset: 0, limit: 200,
            sortBy: "name", sortDirection: "asc", directoriesFirst: true, includeChildCounts: true,
        })).rejects.toThrow("目录响应与请求节点不一致");
    });

    it("validates stat and bounded text preview responses", async () => {
        const entry = {
            name: "guide.md", path: "docs/guide.md", isDir: false, isSymlink: false,
            restricted: false, hidden: false, size: 42, updated: 100, extension: ".md",
        };
        const stat = {
            root: workspaceRoot, entry, mediaType: "text/markdown", previewKind: "text",
            contentURL: "/api/s-forge/file-browser/content/workspace/docs/guide.md", revision: "64-2a",
        };
        network.fetchSyncPost
            .mockResolvedValueOnce({code: 0, msg: "", data: stat})
            .mockResolvedValueOnce({
                code: 0, msg: "", data: {stat, text: "# Guide", encoding: "utf-8", truncated: false},
            });
        const {previewFileBrowserText, statFileBrowserFile} = await import(
            "../../../src/sforge/fileBrowser/FileBrowser.repository"
        );
        const request = {rootID: "workspace", path: "docs/guide.md"};

        await expect(statFileBrowserFile(request)).resolves.toEqual(stat);
        await expect(previewFileBrowserText({...request, maxBytes: 1024})).resolves.toMatchObject({text: "# Guide"});
        expect(network.fetchSyncPost).toHaveBeenNthCalledWith(1, "/api/s-forge/file-browser/stat", request);
        expect(network.fetchSyncPost).toHaveBeenNthCalledWith(
            2, "/api/s-forge/file-browser/preview", {...request, maxBytes: 1024},
        );
    });

    it("reads a validated D5A inspection report through the root-relative endpoint", async () => {
        network.fetchSyncPost.mockResolvedValue({
            code: 0,
            msg: "",
            data: {
                rootID: "workspace",
                path: "models/sample.d5a",
                report: {
                    schemaVersion: 1,
                    documentKind: "d5a-inspection",
                    operation: "inspect",
                    status: "ok",
                    format: "d5a",
                    elapsedMs: 3,
                    warnings: [],
                    d5a: {
                        variant: "archive",
                        entryCount: 2,
                        fileEntryCount: 2,
                        encryptedEntryCount: 0,
                        compressedBytes: 128,
                        uncompressedBytes: 256,
                        bundles: [{
                            id: "bundle-1",
                            meshEntry: "model.d5mesh",
                            status: "ok",
                            mesh: {
                                version: 11,
                                sourceBytes: 256,
                                triangleCount: 4,
                                vertexCount: 12,
                                descriptorCount: 1,
                                geometryGroupCount: 1,
                            },
                            warnings: [],
                        }],
                    },
                },
            },
        });
        const {inspectFileBrowserD5A} = await import(
            "../../../src/sforge/fileBrowser/FileBrowser.repository"
        );
        const request = {rootID: "workspace", path: "models/sample.d5a"};

        await expect(inspectFileBrowserD5A(request)).resolves.toMatchObject({
            rootID: request.rootID,
            path: request.path,
            report: {format: "d5a", d5a: {bundles: [{mesh: {version: 11}}]}},
        });
        expect(network.fetchSyncPost).toHaveBeenCalledWith(
            "/api/s-forge/file-browser/d5a/inspect", request,
        );
    });

    it("rejects malformed D5A reports and responses for another file", async () => {
        const {inspectFileBrowserD5A} = await import(
            "../../../src/sforge/fileBrowser/FileBrowser.repository"
        );
        const request = {rootID: "workspace", path: "models/sample.d5a"};

        network.fetchSyncPost.mockResolvedValueOnce({
            code: 0,
            msg: "",
            data: {rootID: "workspace", path: request.path, report: {format: "d5a"}},
        });
        await expect(inspectFileBrowserD5A(request)).rejects.toThrow("D5A 结构报告响应格式错误");

        network.fetchSyncPost.mockResolvedValueOnce({
            code: 0,
            msg: "",
            data: {
                rootID: "workspace",
                path: "models/other.d5a",
                report: {
                    schemaVersion: 1,
                    documentKind: "d5a-inspection",
                    operation: "inspect",
                    status: "ok",
                    format: "d5a",
                    elapsedMs: 0,
                    warnings: [],
                },
            },
        });
        await expect(inspectFileBrowserD5A(request)).rejects.toThrow("D5A 结构响应与请求地址不一致");
    });
});
