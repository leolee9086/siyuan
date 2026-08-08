import {beforeEach, describe, expect, it, vi} from "vitest";

const network = vi.hoisted(() => ({fetchSyncPost: vi.fn()}));

vi.mock("../../../src/sforge/fileBrowser/repository/imports", () => ({
    fetchSyncPost: network.fetchSyncPost,
}));

const asset = {
    rootID: "workspace", path: "data/assets/hero.png", name: "hero.png", tags: ["hero"], star: 4,
    annotation: "", boundBlockId: "", source: "local", sourceId: "", importTime: 1,
    width: 100, height: 80, fileSize: 42,
    palettes: [{color: [255, 0, 0], ratio: 1, h: 0, s: 100, l: 50}],
};

describe("file browser query repository", () => {
    beforeEach(() => vi.clearAllMocks());

    it("sends the root-scoped query and validates the complete result projection", async () => {
        network.fetchSyncPost.mockResolvedValue({
            code: 0, msg: "", data: {assets: [asset], totalCount: 1, pageCount: 1},
        });
        const {searchFileBrowserAssets} = await import(
            "../../../src/sforge/fileBrowser/FileBrowser.query.repository"
        );
        const request = {
            rootIDs: ["workspace", "agent-a"], allRoots: true, tags: ["hero"], matchAllTags: true,
            palette: {color: [255, 0, 0] as [number, number, number], tolerance: 12, minRatio: 0.5},
            limit: 20, offset: 0,
        };

        await expect(searchFileBrowserAssets(request)).resolves.toEqual({assets: [asset], totalCount: 1, pageCount: 1});
        expect(network.fetchSyncPost).toHaveBeenCalledWith("/api/s-forge/file-browser/search", request);
    });

    it("accepts unindexed files whose optional media metadata is omitted", async () => {
        network.fetchSyncPost.mockResolvedValue({
            code: 0,
            msg: "",
            data: {
                assets: [{
                    rootID: "workspace", path: "data/project/readme.md", name: "readme.md", tags: [],
                    star: 0, annotation: "", boundBlockId: "", source: "scan", sourceId: "", importTime: 1,
                }],
                totalCount: 1,
                pageCount: 1,
            },
        });
        const {searchFileBrowserAssets} = await import(
            "../../../src/sforge/fileBrowser/FileBrowser.query.repository"
        );

        await expect(searchFileBrowserAssets({allRoots: true})).resolves.toEqual({
            assets: [{
                rootID: "workspace", path: "data/project/readme.md", name: "readme.md", tags: [],
                star: 0, annotation: "", boundBlockId: "", source: "scan", sourceId: "", importTime: 1,
                width: 0, height: 0, fileSize: 0,
            }],
            totalCount: 1,
            pageCount: 1,
        });
    });

    it("rejects failed envelopes, missing data and malformed assets", async () => {
        const {searchFileBrowserAssets} = await import(
            "../../../src/sforge/fileBrowser/FileBrowser.query.repository"
        );
        network.fetchSyncPost.mockResolvedValueOnce({code: 403, msg: "denied"});
        await expect(searchFileBrowserAssets({})).rejects.toThrow("denied");

        network.fetchSyncPost.mockResolvedValueOnce({code: 0, msg: ""});
        await expect(searchFileBrowserAssets({})).rejects.toThrow("文件查询未返回数据");

        network.fetchSyncPost.mockResolvedValueOnce({
            code: 0, msg: "", data: {assets: [{rootID: "workspace"}], totalCount: 1, pageCount: 1},
        });
        await expect(searchFileBrowserAssets({})).rejects.toThrow(
            "文件查询响应格式错误：data.assets[0] 的 path 应为字符串，实际为 undefined",
        );
    });

    it("reports the response location and field when a result entry is malformed", async () => {
        network.fetchSyncPost.mockResolvedValue({
            code: 0,
            msg: "",
            data: {
                assets: [{rootID: "workspace", path: "旧文件/readme.md", name: "readme.md", tags: null}],
                totalCount: 1,
                pageCount: 1,
            },
        });
        const {searchFileBrowserAssets} = await import(
            "../../../src/sforge/fileBrowser/FileBrowser.query.repository"
        );

        await expect(searchFileBrowserAssets({})).rejects.toThrow(
            "文件查询响应格式错误：data.assets[0] (旧文件/readme.md) 的 tags 应为字符串数组，实际为 null",
        );
    });

    it("reports the failing index inside a tag array", async () => {
        network.fetchSyncPost.mockResolvedValue({
            code: 0,
            msg: "",
            data: {
                assets: [{
                    rootID: "workspace", path: "旧文件/image.png", name: "image.png", tags: ["ok", 7],
                }],
                totalCount: 1,
                pageCount: 1,
            },
        });
        const {searchFileBrowserAssets} = await import(
            "../../../src/sforge/fileBrowser/FileBrowser.query.repository"
        );

        await expect(searchFileBrowserAssets({})).rejects.toThrow(
            "文件查询响应格式错误：data.assets[0] (旧文件/image.png) 的 tags[1] 应为字符串，实际为 number",
        );
    });
});
