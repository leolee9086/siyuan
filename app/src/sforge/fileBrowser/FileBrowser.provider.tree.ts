/** 用途：provider 树节点构造与分页协调；使用范围：共享递归树的外部资源分支。 */
import {makeFileBrowserNodeDOMID} from "./FileBrowser.tree";
import type {
    FileBrowserProviderDescriptor,
    FileBrowserProviderDirectoryPage,
    FileBrowserProviderEntry,
    FileBrowserProviderEntryTreeNode,
    FileBrowserProviderResource,
    FileBrowserProviderResourcePage,
    FileBrowserProviderResourceTreeNode,
    FileBrowserProviderRootTreeNode,
    FileBrowserProviderSession,
    FileBrowserProviderSessionTreeNode,
    FileBrowserProviderTreeNode,
} from "./FileBrowser.types";

/** provider 树键始终携带明确层级，不使用 endpoint、主机名或展示名称。 */
export function makeFileBrowserProviderNodeKey(parts: readonly string[]) {
    return JSON.stringify(["provider", ...parts]);
}

function baseNode(key: string, parentKey: string, depth: number, name: string) {
    return {
        domain: "provider" as const,
        key,
        domID: makeFileBrowserNodeDOMID(key),
        parentKey,
        depth,
        name,
        expanded: false,
        loadState: "unloaded" as const,
        children: [],
        total: 0,
        totalKnown: false,
        fileCount: 0,
        directoryCount: 0,
        hasMore: false,
        nextCursor: "",
        loadingMore: false,
        error: "",
        requestRevision: 0,
    };
}

/** 创建一个 provider 顶层节点；只有 automatic provider 会进入当前生产树。 */
export function createFileBrowserProviderRootNode(
    descriptor: FileBrowserProviderDescriptor,
): FileBrowserProviderRootTreeNode {
    const key = makeFileBrowserProviderNodeKey([descriptor.id]);
    return {...baseNode(key, "", 0, descriptor.displayName), kind: "provider", descriptor};
}

/** 创建 provider 自己建立的 session 层级。 */
export function createFileBrowserProviderSessionNode(
    parent: FileBrowserProviderRootTreeNode,
    session: FileBrowserProviderSession,
): FileBrowserProviderSessionTreeNode {
    const key = makeFileBrowserProviderNodeKey([session.address.provider, session.address.session]);
    return {
        ...baseNode(key, parent.key, parent.depth + 1, session.descriptor.sessionLabel ?? session.descriptor.displayName),
        kind: "provider-session",
        descriptor: parent.descriptor,
        session,
    };
}

/** 创建 session 枚举出的独立 resource；相同展示名称不会影响节点身份。 */
export function createFileBrowserProviderResourceNode(
    parent: FileBrowserProviderSessionTreeNode,
    resource: FileBrowserProviderResource,
): FileBrowserProviderResourceTreeNode {
    const address = resource.address;
    const key = makeFileBrowserProviderNodeKey([address.provider, address.session, address.resource]);
    return {
        ...baseNode(key, parent.key, parent.depth + 1, resource.name),
        kind: "provider-resource",
        descriptor: parent.descriptor,
        session: parent.session,
        resource,
    };
}

/** 创建 provider 目录或文件节点；opaque token 是 entry 层唯一定位信息。 */
export function createFileBrowserProviderEntryNode(
    parent: FileBrowserProviderResourceTreeNode | FileBrowserProviderEntryTreeNode,
    entry: FileBrowserProviderEntry,
): FileBrowserProviderEntryTreeNode {
    const address = entry.address;
    const key = makeFileBrowserProviderNodeKey([
        address.provider, address.session, address.resource, address.token,
    ]);
    return {
        ...baseNode(key, parent.key, parent.depth + 1, entry.name),
        kind: entry.isDir ? "directory" : "file",
        descriptor: parent.descriptor,
        session: parent.session,
        resource: parent.resource,
        providerEntry: entry,
        loadState: entry.isDir ? "unloaded" : "loaded",
    };
}

function updateDescriptor(node: FileBrowserProviderTreeNode, descriptor: FileBrowserProviderDescriptor) {
    node.descriptor = descriptor;
    if (node.kind === "provider") {
        node.name = descriptor.displayName;
    }
    for (const child of node.children) {
        if (child.domain === "provider") {
            updateDescriptor(child, descriptor);
        }
    }
}

/** 协调 provider 顶层列表，不按 endpoint、source 或主机名归并。 */
export function reconcileFileBrowserProviders(
    previous: FileBrowserProviderRootTreeNode[],
    descriptors: FileBrowserProviderDescriptor[],
) {
    const previousByProvider = new Map(previous.map(node => [node.descriptor.id, node]));
    return descriptors.map(descriptor => {
        const node = previousByProvider.get(descriptor.id);
        if (!node) {
            return createFileBrowserProviderRootNode(descriptor);
        }
        updateDescriptor(node, descriptor);
        return node;
    });
}

/** 把 session 的 resource 分页应用到已有节点，并保留已加载子树。 */
export function applyFileBrowserProviderResourcePage(
    node: FileBrowserProviderSessionTreeNode,
    page: FileBrowserProviderResourcePage,
    append: boolean,
) {
    const previous = new Map(node.children
        .filter((child): child is FileBrowserProviderResourceTreeNode =>
            child.domain === "provider" && child.kind === "provider-resource")
        .map(child => [child.key, child]));
    const incoming = page.resources.map(resource => {
        const key = makeFileBrowserProviderNodeKey([
            resource.address.provider, resource.address.session, resource.address.resource,
        ]);
        const current = previous.get(key);
        if (!current) {
            return createFileBrowserProviderResourceNode(node, resource);
        }
        current.name = resource.name;
        current.resource = resource;
        current.session = node.session;
        current.descriptor = node.descriptor;
        return current;
    });
    node.children = append
        ? [...node.children, ...incoming.filter(child => !node.children.some(current => current.key === child.key))]
        : incoming;
    node.total = page.total ?? node.children.length;
    node.totalKnown = page.total !== undefined;
    node.directoryCount = node.children.length;
    node.fileCount = 0;
    node.hasMore = page.hasMore;
    node.nextCursor = page.nextCursor ?? "";
}

/** 把 provider 目录分页应用到 resource 或目录节点。 */
export function applyFileBrowserProviderDirectoryPage(
    node: FileBrowserProviderResourceTreeNode | FileBrowserProviderEntryTreeNode,
    page: FileBrowserProviderDirectoryPage,
    append: boolean,
) {
    const previous = new Map(node.children
        .filter((child): child is FileBrowserProviderEntryTreeNode =>
            child.domain === "provider" && (child.kind === "directory" || child.kind === "file"))
        .map(child => [child.key, child]));
    const incoming = page.entries.map(entry => {
        const address = entry.address;
        const key = makeFileBrowserProviderNodeKey([
            address.provider, address.session, address.resource, address.token,
        ]);
        const current = previous.get(key);
        if (!current || current.kind !== (entry.isDir ? "directory" : "file")) {
            return createFileBrowserProviderEntryNode(node, entry);
        }
        current.name = entry.name;
        current.providerEntry = entry;
        current.session = node.session;
        current.resource = node.resource;
        current.descriptor = node.descriptor;
        return current;
    });
    node.children = append
        ? [...node.children, ...incoming.filter(child => !node.children.some(current => current.key === child.key))]
        : incoming;
    node.total = page.totalKnown ? page.total : node.children.length;
    node.totalKnown = page.totalKnown;
    node.directoryCount = node.children.filter(child => child.kind === "directory").length;
    node.fileCount = node.children.filter(child => child.kind === "file").length;
    node.hasMore = page.hasMore;
    node.nextCursor = page.nextCursor ?? "";
}
