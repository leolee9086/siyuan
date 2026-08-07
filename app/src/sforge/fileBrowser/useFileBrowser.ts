/** 用途：文件树状态工厂；使用范围：Vue 面板的唯一公开控制器 facade。 */
import {
    createFileBrowserTreeDerivedState,
    createFileBrowserTreeState,
    createFileBrowserTreeTracker,
} from "./FileBrowser.state";
/** 用途：默认 API 仓储；使用范围：生产环境控制器组合。 */
import {fileBrowserRepository} from "./FileBrowser.repository";
/** 用途：应用级多选端口；使用范围：生产面板和测试注入。 */
import {fileBrowserSelection} from "./FileBrowser.selection";
/** 用途：根读取动作；使用范围：首次挂载和工具栏刷新。 */
import {loadFileBrowserRoots} from "./FileBrowser.roots";
/** 用途：树交互动作；使用范围：facade 方法绑定。 */
import {
    activateFileBrowserTreeNode,
    collapseAllFileBrowserNodes,
    loadMoreFileBrowserNode,
    openFileBrowserTreeNode,
    refreshFileBrowserNode,
    restoreFileBrowserTreeExpansion,
    selectFileBrowserTreeNode,
    setFileBrowserTreeSort,
    toggleFileBrowserTreeNode,
    toggleFileBrowserTreeSortDirection,
} from "./FileBrowser.actions";
/** 用途：标准树键盘语义；使用范围：递归节点 keydown。 */
import {handleFileBrowserTreeKey} from "./FileBrowser.keyboard";
/** 用途：控制器依赖和公开方法参数；使用范围：组合边界。 */
import type {
    FileBrowserDirectoryOpener,
    FileBrowserEntryOpener,
    FileBrowserRepository,
    FileBrowserSelectionModifiers,
    FileBrowserSortField,
    FileBrowserTreeNode,
    FileBrowserSelectionStore,
} from "./FileBrowser.types";

const ignoreFileBrowserOpen: FileBrowserEntryOpener = () => Promise.resolve();
const ignoreFileBrowserDirectoryOpen: FileBrowserDirectoryOpener = () => Promise.resolve();

/** 创建一个独立的常驻多根文件树实例。 */
export function useFileBrowser(
    repository: FileBrowserRepository = fileBrowserRepository,
    openEntry: FileBrowserEntryOpener = ignoreFileBrowserOpen,
    selection: FileBrowserSelectionStore = fileBrowserSelection,
    openDirectory: FileBrowserDirectoryOpener = ignoreFileBrowserDirectoryOpen,
) {
    const state = createFileBrowserTreeState(selection);
    const derived = createFileBrowserTreeDerivedState(state);
    const tracker = createFileBrowserTreeTracker();
    const context = {state, derived, repository, openEntry, openDirectory, tracker, selection};
    const dispose = () => {
        tracker.disposed = true;
        ++tracker.rootsRevision;
    };
    return {
        ...state,
        ...derived,
        loadRoots: () => loadFileBrowserRoots(context),
        selectNode: (node: FileBrowserTreeNode) => selectFileBrowserTreeNode(context, node),
        activateNode: (node: FileBrowserTreeNode, modifiers?: FileBrowserSelectionModifiers) =>
            activateFileBrowserTreeNode(context, node, modifiers),
        toggleNode: (node: FileBrowserTreeNode) => toggleFileBrowserTreeNode(context, node),
        openNode: (node: FileBrowserTreeNode) => openFileBrowserTreeNode(context, node),
        refreshNode: (node: FileBrowserTreeNode, recursive = false) => refreshFileBrowserNode(context, node, recursive),
        restoreExpanded: (keys: string[]) => restoreFileBrowserTreeExpansion(context, keys),
        loadMoreNode: (node: FileBrowserTreeNode) => loadMoreFileBrowserNode(context, node),
        collapseAll: () => collapseAllFileBrowserNodes(context),
        setSort: (field: FileBrowserSortField) => setFileBrowserTreeSort(context, field),
        toggleSortDirection: () => toggleFileBrowserTreeSortDirection(context),
        handleKey: (node: FileBrowserTreeNode, key: string) => handleFileBrowserTreeKey(context, node, key),
        dispose,
    };
}
