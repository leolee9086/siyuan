/** 用途：统一 Kernel 请求；使用范围：文件树写操作仓储。 */
import {fetchSyncPost} from "./repository/imports";
/** 用途：校验文件操作响应；使用范围：写请求的 API 边界。 */
import {parseFileBrowserOperationResult} from "./FileBrowser.guards";
/** 用途：请求/响应契约；使用范围：菜单和树控制器。 */
import type {
    FileBrowserCopyRequest,
    FileBrowserCreateDirectoryRequest,
    FileBrowserOperationRepository,
    FileBrowserRenameRequest,
} from "./FileBrowser.types";
import {requireFileBrowserResponseData} from "./FileBrowser.repository";

const CREATE_DIRECTORY_ENDPOINT = "/api/s-forge/file-browser/operations/create-directory";
const RENAME_ENDPOINT = "/api/s-forge/file-browser/operations/rename";
const COPY_ENDPOINT = "/api/s-forge/file-browser/operations/copy";

async function runOperation(endpoint: string, request: object, operation: string) {
    const response = await fetchSyncPost(endpoint, request);
    return parseFileBrowserOperationResult(requireFileBrowserResponseData(response, operation));
}

export const fileBrowserOperationsRepository: FileBrowserOperationRepository = {
    createDirectory: (request: FileBrowserCreateDirectoryRequest) =>
        runOperation(CREATE_DIRECTORY_ENDPOINT, request, "新建目录"),
    rename: (request: FileBrowserRenameRequest) => runOperation(RENAME_ENDPOINT, request, "重命名"),
    copy: (request: FileBrowserCopyRequest) => runOperation(COPY_ENDPOINT, request, "复制文件"),
};
