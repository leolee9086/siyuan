/** 用途：树节点加载与刷新；使用范围：展开、分页和排序动作。 */
import {
    loadFileBrowserTreeNode,
    refreshFileBrowserTreeNode,
    refreshLoadedFileBrowserTree,
} from "./FileBrowser.directory";
/** 用途：节点查找和容器守卫；使用范围：选择、键盘和全部折叠。 */
import {findFileBrowserTreeNode, isFileBrowserContainer, makeFileBrowserNodeKey} from "./FileBrowser.tree";
/** 用途：树上下文、节点和排序字段；使用范围：本模块公开动作。 */
import type {
    FileBrowserSelectionModifiers,
    FileBrowserSortField,
    FileBrowserTreeContext,
    FileBrowserTreeNode,
} from "./FileBrowser.types";

/** 通过共享选择端口更新普通、切换或范围选择，并保持树键盘焦点。 */
export function selectFileBrowserTreeNode(
    context: FileBrowserTreeContext,
    node: FileBrowserTreeNode,
    modifiers?: FileBrowserSelectionModifiers,
) {
    context.selection.select(node, context.derived.visibleNodes.value, modifiers);
    context.state.focusedKey.value = node.key;
}

/** 展开容器，并在第一次展开或失败重试时读取子项。 */
export async function expandFileBrowserTreeNode(context: FileBrowserTreeContext, node: FileBrowserTreeNode) {
    if (!isFileBrowserContainer(node) || node.root?.exists === false) {
        return;
    }
    node.expanded = true;
    if (node.loadState === "unloaded" || node.loadState === "error") {
        await loadFileBrowserTreeNode(context, node);
    }
}

/** 折叠容器但保留已加载子树，以便再次展开时即时恢复。 */
export function collapseFileBrowserTreeNode(node: FileBrowserTreeNode) {
    if (isFileBrowserContainer(node)) {
        node.expanded = false;
    }
}

/** 切换一个容器的展开状态。 */
export async function toggleFileBrowserTreeNode(context: FileBrowserTreeContext, node: FileBrowserTreeNode) {
    if (node.expanded) {
        collapseFileBrowserTreeNode(node);
        return;
    }
    await expandFileBrowserTreeNode(context, node);
}

/** 单击目录遵循参考树折叠语义；单击文件只选择。 */
export async function activateFileBrowserTreeNode(
    context: FileBrowserTreeContext,
    node: FileBrowserTreeNode,
    modifiers?: FileBrowserSelectionModifiers,
) {
    selectFileBrowserTreeNode(context, node, modifiers);
    if (isFileBrowserContainer(node) && !modifiers?.toggle && !modifiers?.range) {
        await toggleFileBrowserTreeNode(context, node);
    }
}

/** 双击或 Enter 打开文件；目录进入独立资源瀑布流页签。 */
export async function openFileBrowserTreeNode(context: FileBrowserTreeContext, node: FileBrowserTreeNode) {
    context.selection.replace(node);
    context.state.focusedKey.value = node.key;
    if (isFileBrowserContainer(node)) {
        await expandFileBrowserTreeNode(context, node);
        await context.openDirectory(node.rootID, node.path, node.name);
        return;
    }
    if (!node.entry || node.entry.restricted) {
        return;
    }
    context.state.openingKey.value = node.key;
    context.state.openError.value = "";
    try {
        await context.openEntry(node.rootID, node.entry);
    } catch (error) {
        context.state.openError.value = error instanceof Error ? error.message : String(error);
    } finally {
        if (context.state.openingKey.value === node.key) {
            context.state.openingKey.value = "";
        }
    }
}

/** 收起全部根和目录，但不丢弃懒加载缓存。 */
export function collapseAllFileBrowserNodes(context: FileBrowserTreeContext) {
    const pending = [...context.state.rootNodes.value];
    for (let index = 0; index < pending.length; index++) {
        const node = pending[index];
        if (!node) {
            continue;
        }
        collapseFileBrowserTreeNode(node);
        pending.push(...node.children);
    }
}

/** 修改排序并刷新所有已经访问的节点。 */
export async function setFileBrowserTreeSort(context: FileBrowserTreeContext, field: FileBrowserSortField) {
    context.state.sortBy.value = field;
    await refreshLoadedFileBrowserTree(context);
}

/** 切换升降序并刷新所有已经访问的节点。 */
export async function toggleFileBrowserTreeSortDirection(context: FileBrowserTreeContext) {
    context.state.sortDirection.value = context.state.sortDirection.value === "asc" ? "desc" : "asc";
    await refreshLoadedFileBrowserTree(context);
}

/** 当前节点菜单使用的刷新入口。 */
export async function refreshFileBrowserNode(context: FileBrowserTreeContext, node: FileBrowserTreeNode, recursive = false) {
    if (isFileBrowserContainer(node)) {
        await refreshFileBrowserTreeNode(context, node, recursive);
    }
}

/** 当前容器的下一页加载入口。 */
export async function loadMoreFileBrowserNode(context: FileBrowserTreeContext, node: FileBrowserTreeNode) {
    await loadFileBrowserTreeNode(context, node, true);
}

/** 由键盘导航选择目标节点。 */
export function focusFileBrowserTreeNode(context: FileBrowserTreeContext, node: FileBrowserTreeNode | undefined) {
    if (node) {
        selectFileBrowserTreeNode(context, node);
    }
    return node;
}

/** 按稳定 parentKey 查找当前节点的父容器。 */
export function findFileBrowserParent(context: FileBrowserTreeContext, node: FileBrowserTreeNode) {
    return node.parentKey ? findFileBrowserTreeNode(context.state.rootNodes.value, node.parentKey) : undefined;
}

/**
 * 按稳定节点身份恢复已保存的展开路径；先加载祖先目录，避免只恢复可见根而丢失深层树。
 */
export async function restoreFileBrowserTreeExpansion(context: FileBrowserTreeContext, keys: string[]) {
    const targets = keys.flatMap(key => {
        try {
            const parsed: unknown = JSON.parse(key);
            if (!Array.isArray(parsed) || typeof parsed[0] !== "string" || typeof parsed[1] !== "string") {
                return [];
            }
            return [{rootID: parsed[0], path: parsed[1]}];
        } catch {
            return [];
        }
    }).sort((left, right) => left.path.split("/").length - right.path.split("/").length);

    for (const target of targets) {
        let current = findFileBrowserTreeNode(
            context.state.rootNodes.value,
            makeFileBrowserNodeKey(target.rootID, ""),
        );
        if (!current) {
            continue;
        }
        const segments = target.path ? target.path.split("/") : [];
        const prefixes = segments.map((_segment, index) => segments.slice(0, index + 1).join("/"));
        for (const prefix of prefixes) {
            if (!isFileBrowserContainer(current)) {
                break;
            }
            await expandFileBrowserTreeNode(context, current);
            const child = findFileBrowserTreeNode(
                context.state.rootNodes.value,
                makeFileBrowserNodeKey(target.rootID, prefix),
            );
            if (!child) {
                current = undefined;
                break;
            }
            current = child;
        }
        if (current && isFileBrowserContainer(current)) {
            await expandFileBrowserTreeNode(context, current);
        }
    }
}
