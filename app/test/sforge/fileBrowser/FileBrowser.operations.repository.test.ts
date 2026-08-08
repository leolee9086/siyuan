import {beforeEach, describe, expect, it, vi} from "vitest";

const network = vi.hoisted(() => ({
    fetchSyncPost: vi.fn(),
}));

vi.mock("../../../src/sforge/fileBrowser/repository/imports", () => ({
    fetchSyncPost: network.fetchSyncPost,
}));

describe("file browser operation repository", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("keeps operation endpoints and root-relative payloads separate", async () => {
        network.fetchSyncPost
            .mockResolvedValueOnce({code: 0, msg: "", data: {operation: "create-directory", rootID: "workspace", path: "new"}})
            .mockResolvedValueOnce({code: 0, msg: "", data: {operation: "rename", rootID: "workspace", path: "renamed.txt"}})
            .mockResolvedValueOnce({code: 0, msg: "", data: {
                operation: "copy", sourceRootID: "workspace", sourcePath: "a.txt",
                destinationRootID: "agent", destinationPath: "b.txt", copiedFileCount: 1,
            }});
        const {fileBrowserOperationsRepository} = await import(
            "../../../src/sforge/fileBrowser/FileBrowser.operations.repository"
        );

        await expect(fileBrowserOperationsRepository.createDirectory({rootID: "workspace", path: "new"}))
            .resolves.toMatchObject({operation: "create-directory"});
        await expect(fileBrowserOperationsRepository.rename({rootID: "workspace", path: "old.txt", newName: "renamed.txt"}))
            .resolves.toMatchObject({operation: "rename"});
        await expect(fileBrowserOperationsRepository.copy({
            sourceRootID: "workspace", sourcePath: "a.txt", destinationRootID: "agent", destinationPath: "b.txt",
        })).resolves.toMatchObject({operation: "copy", copiedFileCount: 1});

        expect(network.fetchSyncPost).toHaveBeenNthCalledWith(
            1, "/api/s-forge/file-browser/operations/create-directory", {rootID: "workspace", path: "new"},
        );
        expect(network.fetchSyncPost).toHaveBeenNthCalledWith(
            2, "/api/s-forge/file-browser/operations/rename", {rootID: "workspace", path: "old.txt", newName: "renamed.txt"},
        );
        expect(network.fetchSyncPost).toHaveBeenNthCalledWith(
            3, "/api/s-forge/file-browser/operations/copy", {
                sourceRootID: "workspace", sourcePath: "a.txt", destinationRootID: "agent", destinationPath: "b.txt",
            },
        );
    });

    it("rejects malformed operation envelopes", async () => {
        network.fetchSyncPost.mockResolvedValue({code: 0, msg: "", data: {operation: "copy", copiedBytes: "bad"}});
        const {fileBrowserOperationsRepository} = await import(
            "../../../src/sforge/fileBrowser/FileBrowser.operations.repository"
        );
        await expect(fileBrowserOperationsRepository.copy({
            sourceRootID: "workspace", sourcePath: "a", destinationRootID: "workspace", destinationPath: "b",
        })).rejects.toThrow("文件操作响应格式错误");
    });
});
