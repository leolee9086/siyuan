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
        await expect(searchFileBrowserAssets({})).rejects.toThrow("文件查询响应格式错误");
    });
});
