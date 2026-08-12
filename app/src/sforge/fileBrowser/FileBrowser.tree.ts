/** 用途：文件树节点与目录响应契约；使用范围：纯节点构造、协调和遍历。 */
import type {
    FileBrowserDirectoryPage,
    FileBrowserEntry,
    FileBrowserLocalTreeNode,
    FileBrowserProviderTreeNode,
    FileBrowserRoot,
    FileBrowserRootCapabilities,
    FileBrowserTreeNode,
} from "./FileBrowser.types";

/** 以 root ID 和根内相对路径建立不会与显示名耦合的节点身份。 */
export function makeFileBrowserNodeKey(rootID: string, path: string) {
    return JSON.stringify([rootID, path]);
}

/** 为原生焦点恢复生成稳定且可由 getElementById 直接查询的 ID。 */
export function makeFileBrowserNodeDOMID(key: string) {
    return `sforge-file-node-${encodeURIComponent(key)}`;
}

/** 本地根和后代是唯一允许进入 rootID/path 操作链的节点。 */
export function isLocalFileBrowserTreeNode(node: FileBrowserTreeNode): node is FileBrowserLocalTreeNode {
    return node.domain === "local";
}

/** provider 节点只使用 provider/session/resource/token 地址。 */
export function isProviderFileBrowserTreeNode(node: FileBrowserTreeNode): node is FileBrowserProviderTreeNode {
    return node.domain === "provider";
}

/** 判断节点能否拥有异步子项。 */
export function isFileBrowserContainer(node: FileBrowserTreeNode) {
    return node.kind === "root" || node.kind === "provider" || node.kind === "provider-session" ||
        node.kind === "provider-resource" || node.kind === "directory";
}

/**
 * 取得一个根内路径最具体的授权范围。
 *
 * 父根归并后，树节点仍使用展示根 ID；这里按挂载点重新计算能力，
 * 使只读 Agent 挂载不会错误显示新建、重命名和复制入口。
 */
export function getFileBrowserCapabilitiesForPath(root: FileBrowserRoot, path: string) {
    const normalize = (value: string) => value.trim().replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
    const normalizedPath = normalize(path);
    let capabilities: FileBrowserRootCapabilities = root.capabilities;
    let bestPrefixLength = 0;
    for (const mount of root.mounts ?? []) {
        const prefix = normalize(mount.relativePath);
        if (!prefix || (normalizedPath !== prefix && !normalizedPath.startsWith(`${prefix}/`)) ||
            prefix.length <= bestPrefixLength) {
            continue;
        }
        capabilities = mount.capabilities;
        bestPrefixLength = prefix.length;
    }
    return capabilities;
}

/** 从服务端根创建一个常驻顶层节点。 */
export function createFileBrowserRootNode(root: FileBrowserRoot): FileBrowserLocalTreeNode {
    const key = makeFileBrowserNodeKey(root.id, "");
    return {
        domain: "local",
        key,
        domID: makeFileBrowserNodeDOMID(key),
        rootID: root.id,
        parentKey: "",
        depth: 0,
        kind: "root",
        name: root.label,
        path: "",
        root,
        expanded: false,
        loadState: root.exists ? "unloaded" : "error",
        children: [],
        total: 0,
        totalKnown: false,
        fileCount: 0,
        directoryCount: 0,
        hasMore: false,
        nextCursor: "",
        loadingMore: false,
        error: root.exists ? "" : "绑定目录当前不存在",
        requestRevision: 0,
    };
}

/** 从目录响应项创建文件或目录节点。 */
export function createFileBrowserEntryNode(parent: FileBrowserTreeNode, entry: FileBrowserEntry): FileBrowserLocalTreeNode {
    if (!isLocalFileBrowserTreeNode(parent)) {
        throw new Error("本地目录项不能挂载到 provider 节点");
    }
    const key = makeFileBrowserNodeKey(parent.rootID, entry.path);
    const knownTotal = (entry.childFileCount ?? 0) + (entry.childDirectoryCount ?? 0);
    const emptyDirectory = entry.isDir && entry.childCountKnown === true && knownTotal === 0;
    return {
        domain: "local",
        key,
        domID: makeFileBrowserNodeDOMID(key),
        rootID: parent.rootID,
        parentKey: parent.key,
        depth: parent.depth + 1,
        kind: entry.isDir ? "directory" : "file",
        name: entry.name,
        path: entry.path,
        root: parent.root,
        entry,
        expanded: false,
        loadState: entry.isDir ? (emptyDirectory ? "loaded" : "unloaded") : "loaded",
        children: [],
        total: entry.childCountKnown ? knownTotal : 0,
        totalKnown: entry.childCountKnown === true,
        fileCount: entry.childFileCount ?? 0,
        directoryCount: entry.childDirectoryCount ?? 0,
        hasMore: false,
        nextCursor: "",
        loadingMore: false,
        error: "",
        requestRevision: 0,
    };
}

/** 根刷新时保留仍指向同一真实位置的节点状态。 */
function updateRootNode(node: FileBrowserLocalTreeNode, root: FileBrowserRoot) {
    const locationChanged = node.root?.path !== root.path;
    const recovered = node.root?.exists === false && root.exists;
    node.name = root.label;
    node.root = root;
    if (locationChanged || recovered) {
        resetFileBrowserContainer(node);
    }
    if (!root.exists) {
        resetFileBrowserContainer(node);
        node.loadState = "error";
        node.error = "绑定目录当前不存在";
    }
}

/** 协调根列表并保持仍存在根的展开、选择和已加载子树。 */
export function reconcileFileBrowserRoots(previous: FileBrowserLocalTreeNode[], roots: FileBrowserRoot[]) {
    const previousByID = new Map(previous.map(node => [node.rootID, node]));
    return roots.map(root => {
        const node = previousByID.get(root.id);
        if (!node) {
            return createFileBrowserRootNode(root);
        }
        updateRootNode(node, root);
        return node;
    });
}

/** 用最新目录项更新旧节点的元数据，同时保留其已加载后代。 */
function reconcileEntryNode(
    parent: FileBrowserLocalTreeNode,
    previous: FileBrowserLocalTreeNode | undefined,
    entry: FileBrowserEntry,
) {
    const expectedKind = entry.isDir ? "directory" : "file";
    if (!previous || previous.kind !== expectedKind) {
        return createFileBrowserEntryNode(parent, entry);
    }
    previous.name = entry.name;
    previous.path = entry.path;
    previous.entry = entry;
    previous.root = parent.root;
    previous.parentKey = parent.key;
    previous.depth = parent.depth + 1;
    if (previous.kind === "directory" && previous.loadState === "unloaded" && entry.childCountKnown) {
        previous.fileCount = entry.childFileCount ?? 0;
        previous.directoryCount = entry.childDirectoryCount ?? 0;
        previous.total = previous.fileCount + previous.directoryCount;
        previous.totalKnown = true;
        if (previous.total === 0) {
            previous.loadState = "loaded";
        }
    }
    return previous;
}

/** 把一个目录分页响应应用到容器节点。 */
export function applyFileBrowserDirectoryPage(
    node: FileBrowserLocalTreeNode,
    page: FileBrowserDirectoryPage,
    append: boolean,
) {
    const previousByKey = new Map(node.children
        .filter((child): child is FileBrowserLocalTreeNode => child.domain === "local")
        .map(child => [child.key, child]));
    const incoming = page.entries.map(entry => {
        const key = makeFileBrowserNodeKey(node.rootID, entry.path);
        return reconcileEntryNode(node, previousByKey.get(key), entry);
    });
    if (append) {
        const existingKeys = new Set(node.children.map(child => child.key));
        node.children.push(...incoming.filter(child => !existingKeys.has(child.key)));
    } else {
        node.children = incoming;
    }
    node.total = page.total;
    node.totalKnown = true;
    node.fileCount = page.fileCount;
    node.directoryCount = page.directoryCount;
    node.hasMore = page.hasMore;
    node.nextCursor = "";
}

/** 清空一个容器的运行时子树并使下一次展开重新读取。 */
export function resetFileBrowserContainer(node: FileBrowserTreeNode) {
    node.expanded = false;
    node.loadState = "unloaded";
    node.children = [];
    node.total = 0;
    node.totalKnown = false;
    node.fileCount = 0;
    node.directoryCount = 0;
    node.hasMore = false;
    node.nextCursor = "";
    node.loadingMore = false;
    node.error = "";
    ++node.requestRevision;
}

/** 在所有根的已创建节点中按稳定身份查找。 */
export function findFileBrowserTreeNode(roots: FileBrowserTreeNode[], key: string) {
    const pending = [...roots];
    while (pending.length > 0) {
        const node = pending.shift();
        if (!node) {
            continue;
        }
        if (node.key === key) {
            return node;
        }
        pending.unshift(...node.children);
    }
    return undefined;
}

/** 生成键盘导航使用的当前可见节点顺序。 */
export function flattenVisibleFileBrowserNodes(roots: FileBrowserTreeNode[]) {
    const visible: FileBrowserTreeNode[] = [];
    const append = (nodes: FileBrowserTreeNode[]) => {
        for (const node of nodes) {
            visible.push(node);
            if (isFileBrowserContainer(node) && node.expanded) {
                append(node.children);
            }
        }
    };
    append(roots);
    return visible;
}

/** 收集一个子树中已经加载过的容器身份，供递归刷新使用。 */
export function collectLoadedFileBrowserContainers(node: FileBrowserTreeNode) {
    const result: FileBrowserTreeNode[] = [];
    const pending = [node];
    while (pending.length > 0) {
        const current = pending.shift();
        if (!current || !isFileBrowserContainer(current)) {
            continue;
        }
        if (current.loadState === "loaded" || current.children.length > 0) {
            result.push(current);
            pending.push(...current.children);
        }
    }
    return result;
}
