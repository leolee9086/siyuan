/** 用途：Vue 响应式原语；使用范围：文件树状态工厂。 */
import {computed, ref} from "./state/imports";
/** 用途：稳定节点查找与可见顺序；使用范围：树派生状态。 */
import {findFileBrowserTreeNode, flattenVisibleFileBrowserNodes} from "./FileBrowser.tree";
/** 用途：树控制器状态契约；使用范围：工厂返回类型。 */
import type {
    FileBrowserRoot,
    FileBrowserSelectionStore,
    FileBrowserSortDirection,
    FileBrowserSortField,
    FileBrowserTreeDerivedState,
    FileBrowserTreeNode,
    FileBrowserTreeState,
} from "./FileBrowser.types";

/** 创建一个不与其它 Dock 共享的文件树状态。 */
export function createFileBrowserTreeState(selection: FileBrowserSelectionStore): FileBrowserTreeState {
    return {
        roots: ref<FileBrowserRoot[]>([]),
        rootNodes: ref<FileBrowserTreeNode[]>([]),
        selectedKey: selection.primaryKey,
        selectedKeys: selection.keys,
        focusedKey: ref(""),
        loadingRoots: ref(false),
        rootsError: ref(""),
        openingKey: ref(""),
        openError: ref(""),
        sortBy: ref<FileBrowserSortField>("name"),
        sortDirection: ref<FileBrowserSortDirection>("asc"),
    };
}

/** 创建选择、根和键盘可见顺序的派生状态。 */
export function createFileBrowserTreeDerivedState(state: FileBrowserTreeState): FileBrowserTreeDerivedState {
    const selectedNode = computed(() => findFileBrowserTreeNode(state.rootNodes.value, state.selectedKey.value));
    return {
        selectedNode,
        selectedRoot: computed(() => {
            const rootID = selectedNode.value?.rootID;
            return state.roots.value.find(root => root.id === rootID) ??
                state.roots.value.find(root => root.kind === "workspace");
        }),
        visibleNodes: computed(() => flattenVisibleFileBrowserNodes(state.rootNodes.value)),
    };
}

/** 创建可被根和节点异步动作共享的请求追踪器。 */
export function createFileBrowserTreeTracker() {
    return {rootsRevision: 0, disposed: false};
}
