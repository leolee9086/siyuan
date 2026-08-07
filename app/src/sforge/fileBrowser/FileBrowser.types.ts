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
    permission: FileBrowserPermission;
    external: boolean;
    boundAt: number;
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
}

/** 布局宿主绑定后的统一文件打开动作。 */
export type FileBrowserEntryOpener = (rootID: string, entry: FileBrowserEntry) => Promise<void>;

/** 目录导航打开动作；目录本身不伪装成文件预览。 */
export type FileBrowserDirectoryOpener = (rootID: string, path: string, name: string) => Promise<void>;

/** 递归树节点分类。 */
export type FileBrowserTreeNodeKind = "root" | "directory" | "file";

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
