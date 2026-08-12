/** 文件浏览器根的来源类型。 */
export type FileBrowserRootKind = "workspace" | "agent-task-directory";

/** 文件浏览器根的聚合权限。 */
export type FileBrowserPermission = "read-only" | "read-write" | "command";

/** 文件根当前公开的能力。 */
export interface FileBrowserRootCapabilities {
    browse: boolean;
    write: boolean;
    command: boolean;
}

/** 贡献同一真实根的 Agent 会话来源。 */
export interface FileBrowserRootSource {
    sessionID: string;
    directoryID: string;
    name: string;
    path: string;
    permission: FileBrowserPermission;
    external: boolean;
    boundAt: number;
}

/** 被父根吸收但仍保留独立地址和能力边界的绑定根。 */
export interface FileBrowserRootMount {
    id: string;
    kind: FileBrowserRootKind;
    label: string;
    path: string;
    relativePath: string;
    permission: FileBrowserPermission;
    capabilities: FileBrowserRootCapabilities;
    sources?: FileBrowserRootSource[];
    exists: boolean;
}

/** 由 Kernel 解析并授权的可浏览根。 */
export interface FileBrowserRoot {
    id: string;
    kind: FileBrowserRootKind;
    label: string;
    path: string;
    permission: FileBrowserPermission;
    capabilities: FileBrowserRootCapabilities;
    sources?: FileBrowserRootSource[];
    mounts?: FileBrowserRootMount[];
    exists: boolean;
}

/** 根内单个目录项，path 始终相对于 root。 */
export interface FileBrowserEntry {
    name: string;
    path: string;
    isDir: boolean;
    isSymlink: boolean;
    restricted: boolean;
    hidden: boolean;
    size: number;
    updated: number;
    extension?: string;
    childFileCount?: number;
    childDirectoryCount?: number;
    childCountKnown?: boolean;
}

/** Kernel 为文件选择的只读预览表面。 */
export type FileBrowserPreviewKind = "directory" | "image" | "audio" | "video" | "pdf" | "text" | "d5a" | "binary";

/** root ID 与相对路径组成的唯一文件地址。 */
export interface FileBrowserFileRequest {
    rootID: string;
    path: string;
}

/** 根内路径导航使用的稳定面包屑，不携带操作系统绝对路径。 */
export interface FileBrowserBreadcrumb {
    label: string;
    path: string;
}

/** 当前目录的分页响应。 */
export interface FileBrowserDirectoryPage {
    root: FileBrowserRoot;
    path: string;
    entries: FileBrowserEntry[];
    total: number;
    fileCount: number;
    directoryCount: number;
    offset: number;
    limit: number;
    hasMore: boolean;
}

/** Kernel 支持的目录排序字段。 */
export type FileBrowserSortField = "name" | "size" | "updated" | "extension";

/** Kernel 支持的排序方向。 */
export type FileBrowserSortDirection = "asc" | "desc";

/** 一个树节点的分页目录请求。 */
export interface FileBrowserListRequest {
    rootID: string;
    path: string;
    offset: number;
    limit: number;
    sortBy: FileBrowserSortField;
    sortDirection: FileBrowserSortDirection;
    directoriesFirst: boolean;
    includeChildCounts: boolean;
}
