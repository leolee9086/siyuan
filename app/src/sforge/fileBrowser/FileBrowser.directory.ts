/** 用途：节点树协调与查找；使用范围：节点分页、刷新和竞态校验。 */
import {
    applyFileBrowserDirectoryPage,
    collectLoadedFileBrowserContainers,
    findFileBrowserTreeNode,
    isFileBrowserContainer,
} from "./FileBrowser.tree";
/** 用途：树动作上下文与节点类型；使用范围：本模块全部异步动作。 */
import type {FileBrowserTreeContext, FileBrowserTreeNode} from "./FileBrowser.types";

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
