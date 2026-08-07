/** 用途：树展开、折叠、选择和打开动作；使用范围：键盘语义映射。 */
import {
    collapseFileBrowserTreeNode,
    expandFileBrowserTreeNode,
    findFileBrowserParent,
    focusFileBrowserTreeNode,
    openFileBrowserTreeNode,
    toggleFileBrowserTreeNode,
} from "./FileBrowser.actions";
/** 用途：容器节点守卫；使用范围：左右键行为。 */
import {isFileBrowserContainer} from "./FileBrowser.tree";
/** 用途：树上下文和节点契约；使用范围：键盘入口。 */
import type {FileBrowserTreeContext, FileBrowserTreeNode} from "./FileBrowser.types";

/** 在当前可见顺序中选择相邻节点。 */
function focusSibling(context: FileBrowserTreeContext, node: FileBrowserTreeNode, offset: number) {
    const visible = context.derived.visibleNodes.value;
    const index = visible.findIndex(candidate => candidate.key === node.key);
    if (index < 0) {
        return undefined;
    }
    const targetIndex = Math.max(0, Math.min(visible.length - 1, index + offset));
    return focusFileBrowserTreeNode(context, visible[targetIndex]);
}

/** 执行标准树形控件键盘语义并返回需要接收 DOM 焦点的节点。 */
export async function handleFileBrowserTreeKey(
    context: FileBrowserTreeContext,
    node: FileBrowserTreeNode,
    key: string,
) {
    switch (key) {
        case "ArrowUp":
            return focusSibling(context, node, -1);
        case "ArrowDown":
            return focusSibling(context, node, 1);
        case "Home":
            return focusFileBrowserTreeNode(context, context.derived.visibleNodes.value[0]);
        case "End":
            return focusFileBrowserTreeNode(context, context.derived.visibleNodes.value.at(-1));
        case "ArrowLeft":
            if (isFileBrowserContainer(node) && node.expanded) {
                collapseFileBrowserTreeNode(node);
                return node;
            }
            return focusFileBrowserTreeNode(context, findFileBrowserParent(context, node));
        case "ArrowRight":
            if (!isFileBrowserContainer(node)) {
                return node;
            }
            if (!node.expanded) {
                await expandFileBrowserTreeNode(context, node);
                return node;
            }
            return focusFileBrowserTreeNode(context, node.children[0] ?? node);
        case "Enter":
            await openFileBrowserTreeNode(context, node);
            return node;
        case " ":
            focusFileBrowserTreeNode(context, node);
            if (isFileBrowserContainer(node)) {
                await toggleFileBrowserTreeNode(context, node);
            }
            return node;
        default:
            return undefined;
    }
}
