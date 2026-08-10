/** 用途：统一 Kernel 请求；使用范围：文件树写操作仓储。 */
import {fetchSyncPost} from "./repository/imports";
/** 用途：校验文件操作响应；使用范围：写请求的 API 边界。 */
import {parseFileBrowserOperationResult} from "./FileBrowser.guards";
/** 用途：批量操作响应校验；使用范围：复制、移动和删除请求的仓储边界。 */
import {parseFileBrowserBatchCopyResult} from "./FileBrowser.operation.guards";
/** 用途：批量操作响应校验；使用范围：删除请求的仓储边界。 */
import {parseFileBrowserBatchDeleteResult} from "./FileBrowser.operation.guards";
/** 用途：批量操作响应校验；使用范围：移动请求的仓储边界。 */
import {parseFileBrowserBatchMoveResult} from "./FileBrowser.operation.guards";
/** 用途：请求/响应契约；使用范围：菜单和树控制器。 */
import type {
    FileBrowserCopyRequest,
    FileBrowserBatchDeleteRequest,
    FileBrowserCreateDirectoryRequest,
    FileBrowserDeleteRequest,
    FileBrowserMoveRequest,
    FileBrowserOperationRepository,
    FileBrowserBatchDeleteResult,
    FileBrowserBatchCopyRequest,
    FileBrowserBatchMoveRequest,
    FileBrowserBatchOperationResult,
    FileBrowserRenameRequest,
} from "./FileBrowser.types";
import {requireFileBrowserResponseData} from "./FileBrowser.repository";

const CREATE_DIRECTORY_ENDPOINT = "/api/s-forge/file-browser/operations/create-directory";
const RENAME_ENDPOINT = "/api/s-forge/file-browser/operations/rename";
const COPY_ENDPOINT = "/api/s-forge/file-browser/operations/copy";
const MOVE_ENDPOINT = "/api/s-forge/file-browser/operations/move";
const DELETE_ENDPOINT = "/api/s-forge/file-browser/operations/delete";
const DELETE_BATCH_ENDPOINT = "/api/s-forge/file-browser/operations/delete-batch";
const COPY_BATCH_ENDPOINT = "/api/s-forge/file-browser/operations/copy-batch";
const MOVE_BATCH_ENDPOINT = "/api/s-forge/file-browser/operations/move-batch";

async function runOperation(endpoint: string, request: object, operation: string) {
    const response = await fetchSyncPost(endpoint, request);
    return parseFileBrowserOperationResult(requireFileBrowserResponseData(response, operation));
}

async function runBatchDelete(request: FileBrowserBatchDeleteRequest): Promise<FileBrowserBatchDeleteResult> {
    const response = await fetchSyncPost(DELETE_BATCH_ENDPOINT, request);
    return parseFileBrowserBatchDeleteResult(requireFileBrowserResponseData(response, "批量删除"));
}

async function runBatchCopy(request: FileBrowserBatchCopyRequest): Promise<FileBrowserBatchOperationResult> {
    const response = await fetchSyncPost(COPY_BATCH_ENDPOINT, request);
    return parseFileBrowserBatchCopyResult(requireFileBrowserResponseData(response, "批量复制"));
}

async function runBatchMove(request: FileBrowserBatchMoveRequest): Promise<FileBrowserBatchOperationResult> {
    const response = await fetchSyncPost(MOVE_BATCH_ENDPOINT, request);
    return parseFileBrowserBatchMoveResult(requireFileBrowserResponseData(response, "批量移动"));
}

export const fileBrowserOperationsRepository: FileBrowserOperationRepository = {
    createDirectory: (request: FileBrowserCreateDirectoryRequest) =>
        runOperation(CREATE_DIRECTORY_ENDPOINT, request, "新建目录"),
    rename: (request: FileBrowserRenameRequest) => runOperation(RENAME_ENDPOINT, request, "重命名"),
    copy: (request: FileBrowserCopyRequest) => runOperation(COPY_ENDPOINT, request, "复制文件"),
    move: (request: FileBrowserMoveRequest) => runOperation(MOVE_ENDPOINT, request, "移动文件"),
    delete: (request: FileBrowserDeleteRequest) => runOperation(DELETE_ENDPOINT, request, "删除文件"),
    deleteBatch: runBatchDelete,
    copyBatch: runBatchCopy,
    moveBatch: runBatchMove,
};
