/** 用途：本地授权根的写操作契约；使用范围：菜单、拖放和操作仓储。 */
import type {FileBrowserFileRequest} from "./FileBrowser.core.types";

/** 新建目录请求，path 始终是目标相对路径。 */
export interface FileBrowserCreateDirectoryRequest {
    rootID: string;
    path: string;
}

/** 新建空文件请求，path 始终是目标相对路径。 */
export interface FileBrowserCreateFileRequest {
    rootID: string;
    path: string;
}

/** 同父目录重命名请求。 */
export interface FileBrowserRenameRequest {
    rootID: string;
    path: string;
    newName: string;
}

/** 复制请求显式区分源和目标授权根。 */
export interface FileBrowserCopyRequest {
    sourceRootID: string;
    sourcePath: string;
    destinationRootID: string;
    destinationPath: string;
}

/** 移动请求显式区分来源和目标授权根；目标路径包含被移动项名称。 */
export interface FileBrowserMoveRequest {
    sourceRootID: string;
    sourcePath: string;
    destinationRootID: string;
    destinationPath: string;
}

/** 删除一个文件或目录树；根本身不是有效目标。 */
export interface FileBrowserDeleteRequest extends FileBrowserFileRequest {}

/** 一次有界的多选删除；每一项仍独立携带根内授权地址。 */
export interface FileBrowserBatchDeleteRequest {
    items: FileBrowserFileRequest[];
}

/** 批量复制/移动共用的目标目录契约；目标路径必须指向已存在目录。 */
export interface FileBrowserBatchTransferRequest {
    items: FileBrowserFileRequest[];
    destinationRootID: string;
    destinationPath: string;
}

export type FileBrowserBatchCopyRequest = FileBrowserBatchTransferRequest;
export type FileBrowserBatchMoveRequest = FileBrowserBatchTransferRequest;

/** 批量操作中单项失败的稳定错误。 */
export interface FileBrowserOperationFailure {
    code: string;
    message: string;
}

/** 批量删除保留输入项和逐项成功/失败结果。 */
export interface FileBrowserBatchDeleteItemResult {
    request: FileBrowserFileRequest;
    result?: FileBrowserOperationResult;
    error?: FileBrowserOperationFailure;
}

export interface FileBrowserBatchDeleteResult {
    items: FileBrowserBatchDeleteItemResult[];
    successCount: number;
    failureCount: number;
}

/** 批量复制/移动的逐项结果，保留部分成功和明确失败。 */
export interface FileBrowserBatchOperationItemResult {
    request: FileBrowserFileRequest;
    result?: FileBrowserOperationResult;
    error?: FileBrowserOperationFailure;
}

export interface FileBrowserBatchOperationResult {
    items: FileBrowserBatchOperationItemResult[];
    successCount: number;
    failureCount: number;
}

/** 文件操作成功包络；不承载绝对物理路径。 */
export interface FileBrowserOperationResult {
    operation: "create-directory" | "create-file" | "rename" | "copy" | "move" | "delete";
    rootID?: string;
    path?: string;
    sourceRootID?: string;
    sourcePath?: string;
    destinationRootID?: string;
    destinationPath?: string;
    copiedFileCount?: number;
    copiedDirectoryCount?: number;
    createdDirectoryCount?: number;
    copiedBytes?: number;
    removedFileCount?: number;
    removedDirectoryCount?: number;
}

/** 文件树菜单使用的独立写操作仓储，不把写入混入只读浏览仓储。 */
export interface FileBrowserOperationRepository {
    createDirectory(request: FileBrowserCreateDirectoryRequest): Promise<FileBrowserOperationResult>;
    createFile(request: FileBrowserCreateFileRequest): Promise<FileBrowserOperationResult>;
    rename(request: FileBrowserRenameRequest): Promise<FileBrowserOperationResult>;
    copy(request: FileBrowserCopyRequest): Promise<FileBrowserOperationResult>;
    move(request: FileBrowserMoveRequest): Promise<FileBrowserOperationResult>;
    delete(request: FileBrowserDeleteRequest): Promise<FileBrowserOperationResult>;
    deleteBatch(request: FileBrowserBatchDeleteRequest): Promise<FileBrowserBatchDeleteResult>;
    copyBatch(request: FileBrowserBatchCopyRequest): Promise<FileBrowserBatchOperationResult>;
    moveBatch(request: FileBrowserBatchMoveRequest): Promise<FileBrowserBatchOperationResult>;
}
