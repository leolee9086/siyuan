/** 用途：Vue 响应式引用类型；使用范围：文件树控制器公开状态。 */
import type {ComputedRef, Ref} from "vue";
import type {
    FileBrowserEntry,
    FileBrowserFileRequest,
    FileBrowserRoot,
    FileBrowserSortDirection,
    FileBrowserSortField,
} from "./FileBrowser.core.types";
import type {FileBrowserRepository} from "./FileBrowser.preview.types";
import type {
    FileBrowserProviderDescriptor,
    FileBrowserProviderEntry,
    FileBrowserProviderRepository,
    FileBrowserProviderResource,
    FileBrowserProviderSession,
} from "./FileBrowser.provider.types";

/** 布局宿主绑定后的统一文件打开动作。 */
export type FileBrowserEntryOpener = (rootID: string, entry: FileBrowserEntry) => Promise<void>;

/** 目录导航打开动作；目录本身不伪装成文件预览。 */
export type FileBrowserDirectoryOpener = (rootID: string, path: string, name: string) => Promise<void>;

/** 递归树节点分类。 */
export type FileBrowserLocalTreeNodeKind = "root" | "directory" | "file";

/** provider/session/resource 是真实树层级，不映射为本地根或目录。 */
export type FileBrowserProviderTreeNodeKind = "provider" | "provider-session" | "provider-resource" |
    "directory" | "file";

export type FileBrowserTreeNodeKind = FileBrowserLocalTreeNodeKind | FileBrowserProviderTreeNodeKind;

/** 一个可移动的根内地址；不携带绝对物理路径。 */
export interface FileBrowserDragItem {
    rootID: string;
    path: string;
    kind: Exclude<FileBrowserLocalTreeNodeKind, "root">;
    name: string;
}

/** 文件浏览器拖放载荷；items 仅在多选拖放时出现。 */
export interface FileBrowserDragData extends FileBrowserDragItem {
    items?: FileBrowserDragItem[];
}

/** 容器节点的异步子项状态。 */
export type FileBrowserTreeLoadState = "unloaded" | "loading" | "loaded" | "error";

interface FileBrowserTreeNodeBase {
    key: string;
    domID: string;
    parentKey: string;
    depth: number;
    kind: FileBrowserTreeNodeKind;
    name: string;
    expanded: boolean;
    loadState: FileBrowserTreeLoadState;
    children: FileBrowserTreeNode[];
    total: number;
    totalKnown: boolean;
    fileCount: number;
    directoryCount: number;
    hasMore: boolean;
    nextCursor: string;
    loadingMore: boolean;
    error: string;
    requestRevision: number;
}

/** 工作空间根、Agent 根和其后代使用本地授权地址。 */
export interface FileBrowserLocalTreeNode extends FileBrowserTreeNodeBase {
    domain: "local";
    kind: FileBrowserLocalTreeNodeKind;
    children: FileBrowserLocalTreeNode[];
    rootID: string;
    path: string;
    root: FileBrowserRoot;
    entry?: FileBrowserEntry;
}

interface FileBrowserProviderTreeNodeBase extends FileBrowserTreeNodeBase {
    domain: "provider";
    descriptor: FileBrowserProviderDescriptor;
}

/** 一个可建立 session 的 provider。 */
export interface FileBrowserProviderRootTreeNode extends FileBrowserProviderTreeNodeBase {
    kind: "provider";
    children: FileBrowserProviderSessionTreeNode[];
}

/** provider 自己建立的一次连接生命周期。 */
export interface FileBrowserProviderSessionTreeNode extends FileBrowserProviderTreeNodeBase {
    kind: "provider-session";
    children: FileBrowserProviderResourceTreeNode[];
    session: FileBrowserProviderSession;
}

/** session 枚举出的独立资源根。 */
export interface FileBrowserProviderResourceTreeNode extends FileBrowserProviderTreeNodeBase {
    kind: "provider-resource";
    children: FileBrowserProviderEntryTreeNode[];
    session: FileBrowserProviderSession;
    resource: FileBrowserProviderResource;
}

/** provider 资源内的 opaque 条目。 */
export interface FileBrowserProviderEntryTreeNode extends FileBrowserProviderTreeNodeBase {
    kind: "directory" | "file";
    children: FileBrowserProviderEntryTreeNode[];
    session: FileBrowserProviderSession;
    resource: FileBrowserProviderResource;
    providerEntry: FileBrowserProviderEntry;
}

export type FileBrowserProviderTreeNode = FileBrowserProviderRootTreeNode | FileBrowserProviderSessionTreeNode |
    FileBrowserProviderResourceTreeNode | FileBrowserProviderEntryTreeNode;

export type FileBrowserTreeNode = FileBrowserLocalTreeNode | FileBrowserProviderTreeNode;

/** 文件树控制器持有的响应式状态。 */
export interface FileBrowserTreeState {
    roots: Ref<FileBrowserRoot[]>;
    providers: Ref<FileBrowserProviderDescriptor[]>;
    rootNodes: Ref<FileBrowserTreeNode[]>;
    selectedKey: ComputedRef<string>;
    selectedKeys: ComputedRef<string[]>;
    providerSelectedKey: Ref<string>;
    focusedKey: Ref<string>;
    loadingRoots: Ref<boolean>;
    rootsError: Ref<string>;
    providersError: Ref<string>;
    openingKey: Ref<string>;
    openError: Ref<string>;
    sortBy: Ref<FileBrowserSortField>;
    sortDirection: Ref<FileBrowserSortDirection>;
}

/** 跨文件树、画廊和属性 Dock 共享的稳定选择地址。 */
export interface FileBrowserSelectionItem extends FileBrowserFileRequest {
    key: string;
    kind: FileBrowserLocalTreeNodeKind;
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
    select(
        node: FileBrowserLocalTreeNode,
        visible: FileBrowserLocalTreeNode[],
        modifiers?: FileBrowserSelectionModifiers,
    ): void;
    selectAddress(
        item: FileBrowserSelectionItem,
        visible: FileBrowserSelectionItem[],
        modifiers?: FileBrowserSelectionModifiers,
    ): void;
    selectAddresses(
        items: FileBrowserSelectionItem[],
        visible: FileBrowserSelectionItem[],
        modifiers?: FileBrowserSelectionModifiers,
    ): void;
    replace(node: FileBrowserLocalTreeNode): void;
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
    providerRepository?: FileBrowserProviderRepository;
    openEntry: FileBrowserEntryOpener;
    openDirectory: FileBrowserDirectoryOpener;
    tracker: FileBrowserTreeTracker;
    selection: FileBrowserSelectionStore;
}
