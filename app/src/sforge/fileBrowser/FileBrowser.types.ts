/** 用途：Vue 响应式引用类型；使用范围：文件树控制器公开状态。 */
import type {ComputedRef, Ref} from "vue";

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

/** 新建目录请求，path 始终是目标相对路径。 */
export interface FileBrowserCreateDirectoryRequest {
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

/** 文件操作成功包络；不承载绝对物理路径。 */
export interface FileBrowserOperationResult {
    operation: "create-directory" | "rename" | "copy" | "move" | "delete";
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

/** 根内路径导航使用的稳定面包屑，不携带操作系统绝对路径。 */
export interface FileBrowserBreadcrumb {
    label: string;
    path: string;
}

/** 已经通过 Kernel 边界校验的文件统计和打开目标。 */
export interface FileBrowserFileStat {
    root: FileBrowserRoot;
    entry: FileBrowserEntry;
    mediaType: string;
    previewKind: FileBrowserPreviewKind;
    contentURL: string;
    revision: string;
}

/** 有界文本预览请求。 */
export interface FileBrowserPreviewRequest extends FileBrowserFileRequest {
    maxBytes?: number;
}

/** 文本预览响应，不承载完整编辑文档。 */
export interface FileBrowserTextPreview {
    stat: FileBrowserFileStat;
    text: string;
    encoding: string;
    truncated: boolean;
}

/** D5A/D5Mesh parser summary used by the file-browser preview surface. */
export interface FileBrowserD5AMeshSummary {
    version: number;
    sourceBytes: number;
    triangleCount: number;
    vertexCount: number;
    descriptorCount: number;
    geometryGroupCount: number;
    metadataTriangleCount?: number;
}

/** One D5Mesh/material bundle discovered inside a D5A container. */
export interface FileBrowserD5ABundleSummary {
    id: string;
    meshEntry: string;
    infoEntry?: string;
    status: string;
    mesh?: FileBrowserD5AMeshSummary;
    material?: {
        title: string;
        infoVersion?: number;
        materialCount: number;
        textureReferenceCount: number;
    };
    warnings: string[];
}

/** Versioned structural report from the migrated D5A domain package. */
export interface FileBrowserD5AInspectionReport {
    schemaVersion: number;
    documentKind: string;
    operation: string;
    status: string;
    format: string;
    elapsedMs: number;
    warnings: string[];
    d5a?: {
        variant: string;
        entryCount: number;
        fileEntryCount: number;
        encryptedEntryCount: number;
        compressedBytes: number;
        uncompressedBytes: number;
        groupInfoEntry?: string;
        bundles: FileBrowserD5ABundleSummary[];
    };
}

/** Root-relative D5A inspection response; absolute paths never cross the API. */
export interface FileBrowserD5AInspectionResult {
    rootID: string;
    path: string;
    report: FileBrowserD5AInspectionReport;
}

/** 编码后的本地编辑文档；文本内容来自已授权根的有界快照。 */
export type FileBrowserEditorEncoding = "utf-8" | "utf-8-bom" | "utf-16le" | "utf-16be";

/** 本地编辑器读取请求；客户端只携带根 ID 和根相对路径。 */
export interface FileBrowserEditorReadRequest extends FileBrowserFileRequest {
    maxBytes?: number;
}

/** 本地编辑器保存请求；revision 是读取快照的精确字节版本。 */
export interface FileBrowserEditorWriteRequest extends FileBrowserFileRequest {
    text: string;
    encoding: FileBrowserEditorEncoding;
    revision: string;
    maxBytes?: number;
}

/** 编辑器页签消费的完整本地文本快照。 */
export interface FileBrowserEditorDocument {
    root: FileBrowserRoot;
    entry: FileBrowserEntry;
    previewKind: "text";
    contentURL: string;
    text: string;
    encoding: FileBrowserEditorEncoding;
    size: number;
    updated: number;
    revision: string;
    readOnly: boolean;
    language: string;
}

/** 原子保存后的新版本元数据。 */
export interface FileBrowserEditorWriteResult {
    root: FileBrowserRoot;
    entry: FileBrowserEntry;
    previewKind: "text";
    contentURL: string;
    encoding: FileBrowserEditorEncoding;
    size: number;
    updated: number;
    revision: string;
    readOnly: boolean;
    language: string;
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

/** 文件浏览器的唯一前端数据入口。 */
export interface FileBrowserRepository {
    listRoots(): Promise<FileBrowserRoot[]>;
    listDirectory(request: FileBrowserListRequest): Promise<FileBrowserDirectoryPage>;
    statFile(request: FileBrowserFileRequest): Promise<FileBrowserFileStat>;
    previewText(request: FileBrowserPreviewRequest): Promise<FileBrowserTextPreview>;
    inspectD5A(request: FileBrowserFileRequest): Promise<FileBrowserD5AInspectionResult>;
    readEditorFile(request: FileBrowserEditorReadRequest): Promise<FileBrowserEditorDocument>;
    writeEditorFile(request: FileBrowserEditorWriteRequest): Promise<FileBrowserEditorWriteResult>;
}

/** 文件树菜单使用的独立写操作仓储，不把写入混入只读浏览仓储。 */
export interface FileBrowserOperationRepository {
    createDirectory(request: FileBrowserCreateDirectoryRequest): Promise<FileBrowserOperationResult>;
    rename(request: FileBrowserRenameRequest): Promise<FileBrowserOperationResult>;
    copy(request: FileBrowserCopyRequest): Promise<FileBrowserOperationResult>;
    move(request: FileBrowserMoveRequest): Promise<FileBrowserOperationResult>;
    delete(request: FileBrowserDeleteRequest): Promise<FileBrowserOperationResult>;
    deleteBatch(request: FileBrowserBatchDeleteRequest): Promise<FileBrowserBatchDeleteResult>;
}

/** 布局宿主绑定后的统一文件打开动作。 */
export type FileBrowserEntryOpener = (rootID: string, entry: FileBrowserEntry) => Promise<void>;

/** 目录导航打开动作；目录本身不伪装成文件预览。 */
export type FileBrowserDirectoryOpener = (rootID: string, path: string, name: string) => Promise<void>;

/** 递归树节点分类。 */
export type FileBrowserTreeNodeKind = "root" | "directory" | "file";

/** 文件浏览器拖放载荷；由树/画廊产生，供移动和标签投递解析根内相对地址。 */
export interface FileBrowserDragData {
    rootID: string;
    path: string;
    kind: Exclude<FileBrowserTreeNodeKind, "root">;
    name: string;
}

/** 容器节点的异步子项状态。 */
export type FileBrowserTreeLoadState = "unloaded" | "loading" | "loaded" | "error";

/** 工作空间根、Agent 根、目录和文件共用的稳定树节点。 */
export interface FileBrowserTreeNode {
    key: string;
    domID: string;
    rootID: string;
    parentKey: string;
    depth: number;
    kind: FileBrowserTreeNodeKind;
    name: string;
    path: string;
    root: FileBrowserRoot;
    entry?: FileBrowserEntry;
    expanded: boolean;
    loadState: FileBrowserTreeLoadState;
    children: FileBrowserTreeNode[];
    total: number;
    fileCount: number;
    directoryCount: number;
    hasMore: boolean;
    loadingMore: boolean;
    error: string;
    requestRevision: number;
}

/** 文件树控制器持有的响应式状态。 */
export interface FileBrowserTreeState {
    roots: Ref<FileBrowserRoot[]>;
    rootNodes: Ref<FileBrowserTreeNode[]>;
    selectedKey: Ref<string>;
    selectedKeys: ComputedRef<string[]>;
    focusedKey: Ref<string>;
    loadingRoots: Ref<boolean>;
    rootsError: Ref<string>;
    openingKey: Ref<string>;
    openError: Ref<string>;
    sortBy: Ref<FileBrowserSortField>;
    sortDirection: Ref<FileBrowserSortDirection>;
}

/** 跨文件树、画廊和属性 Dock 共享的稳定选择地址。 */
export interface FileBrowserSelectionItem extends FileBrowserFileRequest {
    key: string;
    kind: FileBrowserTreeNodeKind;
    name: string;
}

/** 鼠标选择修饰键，不把 DOM Event 泄漏给领域层。 */
export interface FileBrowserSelectionModifiers {
    toggle: boolean;
    range: boolean;
}

/** 应用级文件选择端口。 */
export interface FileBrowserSelectionStore {
    items: Ref<FileBrowserSelectionItem[]>;
    primaryKey: Ref<string>;
    anchorKey: Ref<string>;
    revision: Ref<number>;
    keys: ComputedRef<string[]>;
    select(node: FileBrowserTreeNode, visible: FileBrowserTreeNode[], modifiers?: FileBrowserSelectionModifiers): void;
    replace(node: FileBrowserTreeNode): void;
    replaceAddress(item: FileBrowserSelectionItem): void;
    retainRoots(rootIDs: Set<string>): void;
    removeSubtree(rootID: string, path: string): void;
    clear(): void;
}

/** 从树状态推导出的选择和可见顺序。 */
export interface FileBrowserTreeDerivedState {
    selectedNode: ComputedRef<FileBrowserTreeNode | undefined>;
    selectedRoot: ComputedRef<FileBrowserRoot | undefined>;
    visibleNodes: ComputedRef<FileBrowserTreeNode[]>;
}

/** 根刷新和销毁所需的请求修订状态。 */
export interface FileBrowserTreeTracker {
    rootsRevision: number;
    disposed: boolean;
}

/** 文件树动作共享的显式依赖集合。 */
export interface FileBrowserTreeContext {
    state: FileBrowserTreeState;
    derived: FileBrowserTreeDerivedState;
    repository: FileBrowserRepository;
    openEntry: FileBrowserEntryOpener;
    openDirectory: FileBrowserDirectoryOpener;
    tracker: FileBrowserTreeTracker;
    selection: FileBrowserSelectionStore;
}

/** 自定义预览页签的稳定身份数据。 */
export interface FileBrowserPreviewTabData extends FileBrowserFileRequest {
    name: string;
}

/** 独立文件瀑布流页签的稳定范围；路径仍相对授权根。 */
export interface FileBrowserGalleryTabData extends FileBrowserFileRequest {
    name: string;
    /** 全根结果页签的稳定范围标记；筛选条件变化不应改变页签类型。 */
    scope?: "global" | "directory";
    query?: import("./FileBrowser.query.types").FileBrowserSearchRequest;
}

/** 只读预览组件参数。 */
export interface FileBrowserPreviewPanelProps {
    file: FileBrowserPreviewTabData;
}

/** 自定义文本编辑页签的稳定入口数据。 */
export interface FileBrowserEditorTabData extends FileBrowserFileRequest {
    name: string;
}
