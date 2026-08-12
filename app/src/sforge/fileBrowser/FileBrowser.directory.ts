/** 用途：节点树协调与查找；使用范围：节点分页、刷新和竞态校验。 */
import {
    applyFileBrowserDirectoryPage,
    collectLoadedFileBrowserContainers,
    findFileBrowserTreeNode,
    isFileBrowserContainer,
    isLocalFileBrowserTreeNode,
} from "./FileBrowser.tree";
import {
    applyFileBrowserProviderDirectoryPage,
    applyFileBrowserProviderResourcePage,
    createFileBrowserProviderSessionNode,
} from "./FileBrowser.provider.tree";
/** 用途：树动作上下文与节点类型；使用范围：本模块全部异步动作。 */
import type {
    FileBrowserProviderTreeNode,
    FileBrowserTreeContext,
    FileBrowserTreeNode,
} from "./FileBrowser.types";

const TREE_PAGE_SIZE = 200;

/** 判断目录响应是否仍属于树中同一个节点和请求修订。 */
function isCurrentNodeRequest(context: FileBrowserTreeContext, node: FileBrowserTreeNode, revision: number) {
    return !context.tracker.disposed && node.requestRevision === revision &&
        findFileBrowserTreeNode(context.state.rootNodes.value, node.key) === node;
}

/** 读取一个容器节点的第一页或下一页。 */
export async function loadFileBrowserTreeNode(
    context: FileBrowserTreeContext,
    node: FileBrowserTreeNode,
    append = false,
) {
    if (!isFileBrowserContainer(node) || (append && (!node.hasMore || node.loadingMore))) {
        return;
    }
    if (isLocalFileBrowserTreeNode(node)) {
        await loadLocalFileBrowserTreeNode(context, node, append);
        return;
    }
    await loadProviderFileBrowserTreeNode(context, node, append);
}

async function loadLocalFileBrowserTreeNode(
    context: FileBrowserTreeContext,
    node: Extract<FileBrowserTreeNode, {domain: "local"}>,
    append: boolean,
) {
    const root = context.state.roots.value.find(candidate => candidate.id === node.rootID);
    if (!root?.exists) {
        node.loadState = "error";
        node.error = root ? "绑定目录当前不存在" : "文件根已经失效";
        return;
    }
    const revision = ++node.requestRevision;
    node.error = "";
    append ? node.loadingMore = true : node.loadState = "loading";
    try {
        const page = await context.repository.listDirectory({
            rootID: node.rootID,
            path: node.path,
            offset: append ? node.children.length : 0,
            limit: TREE_PAGE_SIZE,
            sortBy: context.state.sortBy.value,
            sortDirection: context.state.sortDirection.value,
            directoriesFirst: true,
            includeChildCounts: true,
        });
        if (isCurrentNodeRequest(context, node, revision)) {
            applyFileBrowserDirectoryPage(node, page, append);
            node.loadState = "loaded";
        }
    } catch (error) {
        if (isCurrentNodeRequest(context, node, revision)) {
            node.loadState = "error";
            node.error = error instanceof Error ? error.message : String(error);
        }
    } finally {
        if (isCurrentNodeRequest(context, node, revision)) {
            node.loadingMore = false;
        }
    }
}

async function loadProviderFileBrowserTreeNode(
    context: FileBrowserTreeContext,
    node: FileBrowserProviderTreeNode,
    append: boolean,
) {
    const repository = context.providerRepository;
    if (!repository) {
        node.loadState = "error";
        node.error = "文件 provider 仓储未注册";
        return;
    }
    const revision = ++node.requestRevision;
    node.error = "";
    append ? node.loadingMore = true : node.loadState = "loading";
    try {
        if (node.kind === "provider") {
            const currentSession = node.children.find(child => child.domain === "provider" &&
                child.kind === "provider-session");
            if (currentSession) {
                node.loadState = "loaded";
                return;
            }
            if (node.descriptor.sessionMode !== "automatic") {
                throw new Error("文件 provider 需要先配置连接会话");
            }
            const session = await repository.openSession({provider: node.descriptor.id});
            if (isCurrentNodeRequest(context, node, revision)) {
                node.children = [createFileBrowserProviderSessionNode(node, session)];
                node.total = 1;
                node.totalKnown = true;
                node.directoryCount = 1;
                node.loadState = "loaded";
            } else {
                await repository.closeSession(session.address);
            }
            return;
        }
        if (node.kind === "provider-session") {
            const page = await repository.listResources(node.session.address, {
                ...(append && node.nextCursor ? {cursor: node.nextCursor} : {}),
                limit: TREE_PAGE_SIZE,
            });
            if (isCurrentNodeRequest(context, node, revision)) {
                applyFileBrowserProviderResourcePage(node, page, append);
                node.loadState = "loaded";
            }
            return;
        }
        const parent = node.kind === "provider-resource" ? node.resource.address : node.providerEntry.address;
        const page = await repository.listDirectory({
            parent,
            page: {
                ...(append && node.nextCursor ? {cursor: node.nextCursor} : {}),
                limit: TREE_PAGE_SIZE,
            },
            sortBy: context.state.sortBy.value,
            sortDirection: context.state.sortDirection.value,
            directoriesFirst: true,
        });
        if (isCurrentNodeRequest(context, node, revision)) {
            applyFileBrowserProviderDirectoryPage(node, page, append);
            node.loadState = "loaded";
        }
    } catch (error) {
        if (isCurrentNodeRequest(context, node, revision)) {
            node.loadState = "error";
            node.error = error instanceof Error ? error.message : String(error);
        }
    } finally {
        if (isCurrentNodeRequest(context, node, revision)) {
            node.loadingMore = false;
        }
    }
}

/** 刷新当前节点；递归模式只更新此前已经加载的后代。 */
export async function refreshFileBrowserTreeNode(
    context: FileBrowserTreeContext,
    node: FileBrowserTreeNode,
    recursive = false,
) {
    const loaded = recursive ? collectLoadedFileBrowserContainers(node) : [node];
    const keys = loaded.length > 0 ? loaded.map(item => item.key) : [node.key];
    for (const key of keys) {
        const current = findFileBrowserTreeNode(context.state.rootNodes.value, key);
        if (current && isFileBrowserContainer(current)) {
            await loadFileBrowserTreeNode(context, current);
        }
    }
}

/** 刷新所有已经加载过的根和目录，不主动展开未访问的 Agent 根。 */
export async function refreshLoadedFileBrowserTree(context: FileBrowserTreeContext) {
    const keys = context.state.rootNodes.value.flatMap(root =>
        collectLoadedFileBrowserContainers(root).map(node => node.key));
    for (const key of keys) {
        const node = findFileBrowserTreeNode(context.state.rootNodes.value, key);
        if (node) {
            await loadFileBrowserTreeNode(context, node);
        }
    }
}
