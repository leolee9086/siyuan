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

    it("creates an empty file through its own operation endpoint", async () => {
        network.fetchSyncPost.mockResolvedValue({
            code: 0, msg: "", data: {operation: "create-file", rootID: "workspace", path: "notes/new.md"},
        });
        const {fileBrowserOperationsRepository} = await import(
            "../../../src/sforge/fileBrowser/FileBrowser.operations.repository"
        );

        await expect(fileBrowserOperationsRepository.createFile({rootID: "workspace", path: "notes/new.md"}))
            .resolves.toMatchObject({operation: "create-file", path: "notes/new.md"});
        expect(network.fetchSyncPost).toHaveBeenCalledWith(
            "/api/s-forge/file-browser/operations/create-file", {rootID: "workspace", path: "notes/new.md"},
        );
    });

    it("keeps operation endpoints and root-relative payloads separate", async () => {
        network.fetchSyncPost
            .mockResolvedValueOnce({code: 0, msg: "", data: {operation: "create-directory", rootID: "workspace", path: "new"}})
            .mockResolvedValueOnce({code: 0, msg: "", data: {operation: "rename", rootID: "workspace", path: "renamed.txt"}})
            .mockResolvedValueOnce({code: 0, msg: "", data: {
                operation: "copy", sourceRootID: "workspace", sourcePath: "a.txt",
                destinationRootID: "agent", destinationPath: "b.txt", copiedFileCount: 1,
            }})
            .mockResolvedValueOnce({code: 0, msg: "", data: {
                operation: "move", sourceRootID: "workspace", sourcePath: "b.txt",
                destinationRootID: "agent", destinationPath: "moved/b.txt",
            }})
            .mockResolvedValueOnce({code: 0, msg: "", data: {
                operation: "delete", rootID: "workspace", path: "moved/b.txt", removedFileCount: 1,
            }})
            .mockResolvedValueOnce({code: 0, msg: "", data: {
                items: [{request: {rootID: "workspace", path: "a.txt"}, result: {
                    operation: "delete", rootID: "workspace", path: "a.txt", removedFileCount: 1,
                }}], successCount: 1, failureCount: 0,
            }})
            .mockResolvedValueOnce({code: 0, msg: "", data: {
                items: [{request: {rootID: "workspace", path: "a.txt"}, result: {
                    operation: "copy", sourceRootID: "workspace", sourcePath: "a.txt",
                    destinationRootID: "agent", destinationPath: "out/a.txt",
                }}], successCount: 1, failureCount: 0,
            }})
            .mockResolvedValueOnce({code: 0, msg: "", data: {
                items: [{request: {rootID: "workspace", path: "a.txt"}, result: {
                    operation: "move", sourceRootID: "workspace", sourcePath: "a.txt",
                    destinationRootID: "agent", destinationPath: "out/a.txt",
                }}], successCount: 1, failureCount: 0,
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

        await expect(fileBrowserOperationsRepository.move({
            sourceRootID: "workspace", sourcePath: "b.txt", destinationRootID: "agent", destinationPath: "moved/b.txt",
        })).resolves.toMatchObject({operation: "move", destinationPath: "moved/b.txt"});

        await expect(fileBrowserOperationsRepository.delete({rootID: "workspace", path: "moved/b.txt"}))
            .resolves.toMatchObject({operation: "delete", removedFileCount: 1});
        await expect(fileBrowserOperationsRepository.deleteBatch({items: [{rootID: "workspace", path: "a.txt"}]}))
            .resolves.toMatchObject({successCount: 1, failureCount: 0});
        await expect(fileBrowserOperationsRepository.copyBatch({
            items: [{rootID: "workspace", path: "a.txt"}], destinationRootID: "agent", destinationPath: "out",
        })).resolves.toMatchObject({successCount: 1, failureCount: 0});
        await expect(fileBrowserOperationsRepository.moveBatch({
            items: [{rootID: "workspace", path: "a.txt"}], destinationRootID: "agent", destinationPath: "out",
        })).resolves.toMatchObject({successCount: 1, failureCount: 0});

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
        expect(network.fetchSyncPost).toHaveBeenNthCalledWith(
            4, "/api/s-forge/file-browser/operations/move", {
                sourceRootID: "workspace", sourcePath: "b.txt", destinationRootID: "agent", destinationPath: "moved/b.txt",
            },
        );
        expect(network.fetchSyncPost).toHaveBeenNthCalledWith(
            5, "/api/s-forge/file-browser/operations/delete", {rootID: "workspace", path: "moved/b.txt"},
        );
        expect(network.fetchSyncPost).toHaveBeenNthCalledWith(
            6, "/api/s-forge/file-browser/operations/delete-batch", {
                items: [{rootID: "workspace", path: "a.txt"}],
            },
        );
        expect(network.fetchSyncPost).toHaveBeenNthCalledWith(
            7, "/api/s-forge/file-browser/operations/copy-batch", {
                items: [{rootID: "workspace", path: "a.txt"}], destinationRootID: "agent", destinationPath: "out",
            },
        );
        expect(network.fetchSyncPost).toHaveBeenNthCalledWith(
            8, "/api/s-forge/file-browser/operations/move-batch", {
                items: [{rootID: "workspace", path: "a.txt"}], destinationRootID: "agent", destinationPath: "out",
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
