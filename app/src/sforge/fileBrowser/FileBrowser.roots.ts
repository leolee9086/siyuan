/** 用途：节点加载与已访问树刷新；使用范围：根首次加载和工具栏刷新。 */
import {loadFileBrowserTreeNode, refreshLoadedFileBrowserTree} from "./FileBrowser.directory";
/** 用途：根节点协调；使用范围：根刷新后状态恢复。 */
import {reconcileFileBrowserRoots} from "./FileBrowser.tree";
/** 用途：文件树动作上下文；使用范围：根加载入口。 */
import type {FileBrowserTreeContext, FileBrowserTreeNode} from "./FileBrowser.types";

/** 使根刷新开始前仍在途的节点响应失效。 */
function invalidateTreeRequests(roots: FileBrowserTreeNode[]) {
    const pending = [...roots];
    for (let index = 0; index < pending.length; index++) {
        const node = pending[index];
        if (!node) {
            continue;
        }
        ++node.requestRevision;
        pending.push(...node.children);
    }
}

/** 选择工作空间根作为首次可见焦点。 */
function selectInitialRoot(context: FileBrowserTreeContext) {
    const workspace = context.state.rootNodes.value.find(node => node.root?.kind === "workspace") ??
        context.state.rootNodes.value[0];
    if (!workspace) {
        return undefined;
    }
    context.selection.replace(workspace);
    context.state.focusedKey.value = workspace.key;
    return workspace;
}

/** 读取根集合；首次默认展开工作空间，后续刷新只更新已加载节点。 */
export async function loadFileBrowserRoots(context: FileBrowserTreeContext) {
    const {state, repository, tracker} = context;
    const revision = ++tracker.rootsRevision;
    const initialLoad = state.rootNodes.value.length === 0;
    invalidateTreeRequests(state.rootNodes.value);
    state.loadingRoots.value = true;
    state.rootsError.value = "";
    try {
        const roots = await repository.listRoots();
        if (tracker.disposed || revision !== tracker.rootsRevision) {
            return;
        }
        state.roots.value = roots;
        state.rootNodes.value = reconcileFileBrowserRoots(state.rootNodes.value, roots);
        context.selection.retainRoots(new Set(roots.map(root => root.id)));
        const initialRoot = state.selectedKey.value ? undefined : selectInitialRoot(context);
        if (initialLoad && initialRoot?.root?.exists) {
            initialRoot.expanded = true;
            await loadFileBrowserTreeNode(context, initialRoot);
        } else if (!initialLoad) {
            await refreshLoadedFileBrowserTree(context);
        }
    } catch (error) {
        if (!tracker.disposed && revision === tracker.rootsRevision) {
            state.rootsError.value = error instanceof Error ? error.message : String(error);
        }
    } finally {
        if (revision === tracker.rootsRevision) {
            state.loadingRoots.value = false;
        }
    }
}
