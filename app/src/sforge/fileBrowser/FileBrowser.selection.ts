/** 用途：Vue 响应式原语；使用范围：跨 Dock 文件选择端口。 */
import {computed, ref} from "./state/imports";
/** 用途：共享选择契约；使用范围：文件树、画廊和属性 Dock。 */
import type {
    FileBrowserSelectionItem,
    FileBrowserSelectionModifiers,
    FileBrowserSelectionStore,
    FileBrowserTreeNode,
} from "./FileBrowser.types";

type SelectionState = Pick<FileBrowserSelectionStore, "items" | "primaryKey" | "anchorKey" | "revision">;
type SelectionCommit = (
    next: FileBrowserSelectionItem[],
    primary: string,
    anchor?: string,
) => void;

function selectionItem(node: FileBrowserTreeNode): FileBrowserSelectionItem {
    return {key: node.key, rootID: node.rootID, path: node.path, kind: node.kind, name: node.name};
}

function sameSelection(left: FileBrowserSelectionItem[], right: FileBrowserSelectionItem[]) {
    return left.length === right.length && left.every((item, index) => item.key === right[index]?.key);
}

function createSelectionState(): SelectionState {
    const items = ref<FileBrowserSelectionItem[]>([]);
    const primaryKey = ref("");
    const anchorKey = ref("");
    const revision = ref(0);
    return {items, primaryKey, anchorKey, revision};
}

function createSelectionCommit(state: SelectionState): SelectionCommit {
    return (next, primary, anchor = state.anchorKey.value) => {
        if (
            sameSelection(state.items.value, next)
            && state.primaryKey.value === primary
            && state.anchorKey.value === anchor
        ) {
            return;
        }
        state.items.value = next;
        state.primaryKey.value = primary;
        state.anchorKey.value = anchor;
        state.revision.value++;
    };
}

function replaceSelection(commit: SelectionCommit, node: FileBrowserTreeNode) {
    const item = selectionItem(node);
    commit([item], item.key, item.key);
}

function replaceAddressSelection(commit: SelectionCommit, item: FileBrowserSelectionItem) {
    commit([item], item.key, item.key);
}

function selectRange(
    state: SelectionState,
    commit: SelectionCommit,
    node: FileBrowserTreeNode,
    visible: FileBrowserTreeNode[],
    modifiers: FileBrowserSelectionModifiers,
) {
    const anchor = state.anchorKey.value || state.primaryKey.value;
    const from = visible.findIndex(item => item.key === anchor);
    const to = visible.findIndex(item => item.key === node.key);
    if (from < 0 || to < 0) {
        replaceSelection(commit, node);
        return;
    }
    const start = Math.min(from, to);
    const end = Math.max(from, to);
    const range = visible.slice(start, end + 1).map(selectionItem);
    if (!modifiers.toggle) {
        commit(range, node.key, anchor);
        return;
    }
    const selected = new Map(state.items.value.map(item => [item.key, item]));
    for (const item of range) {
        selected.set(item.key, item);
    }
    commit([...selected.values()], node.key, anchor);
}

function selectNode(
    state: SelectionState,
    commit: SelectionCommit,
    node: FileBrowserTreeNode,
    visible: FileBrowserTreeNode[],
    modifiers: FileBrowserSelectionModifiers,
) {
    if (modifiers.range) {
        selectRange(state, commit, node, visible, modifiers);
        return;
    }
    if (!modifiers.toggle) {
        replaceSelection(commit, node);
        return;
    }
    const index = state.items.value.findIndex(item => item.key === node.key);
    if (index < 0) {
        const item = selectionItem(node);
        commit([...state.items.value, item], item.key, item.key);
        return;
    }
    const next = state.items.value.filter(item => item.key !== node.key);
    commit(next, next.at(-1)?.key ?? "", node.key);
}

function retainSelectionRoots(state: SelectionState, commit: SelectionCommit, rootIDs: Set<string>) {
    const next = state.items.value.filter(item => rootIDs.has(item.rootID));
    const primary = next.some(item => item.key === state.primaryKey.value)
        ? state.primaryKey.value
        : (next.at(-1)?.key ?? "");
    const anchor = next.some(item => item.key === state.anchorKey.value) ? state.anchorKey.value : primary;
    commit(next, primary, anchor);
}

function createSelectionActions(state: SelectionState) {
    const commit = createSelectionCommit(state);
    return {
        select: (
            node: FileBrowserTreeNode,
            visible: FileBrowserTreeNode[],
            modifiers: FileBrowserSelectionModifiers = {toggle: false, range: false},
        ) => selectNode(state, commit, node, visible, modifiers),
        replace: (node: FileBrowserTreeNode) => replaceSelection(commit, node),
        replaceAddress: (item: FileBrowserSelectionItem) => replaceAddressSelection(commit, item),
        retainRoots: (rootIDs: Set<string>) => retainSelectionRoots(state, commit, rootIDs),
        clear: () => commit([], "", ""),
    };
}

/** 创建一个可注入测试、也可作为应用单例使用的选择端口。 */
export function createFileBrowserSelectionStore(): FileBrowserSelectionStore {
    const state = createSelectionState();
    const actions = createSelectionActions(state);
    return {
        ...state,
        keys: computed(() => state.items.value.map(item => item.key)),
        ...actions,
    };
}

/** 生产界面的唯一文件选择实例；Dock 销毁不清空。 */
export const fileBrowserSelection = createFileBrowserSelectionStore();
