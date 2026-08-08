/** 用途：全局菜单、已有文案和剪贴板兼容；使用范围：树节点右键动作。 */
import {getSiyuanGlobalMenus, siyuanI18n, writeText} from "./menu/imports";
/** 用途：容器节点守卫；使用范围：按节点类型过滤菜单。 */
import {getFileBrowserCapabilitiesForPath, isFileBrowserContainer} from "./FileBrowser.tree";
/** 用途：树节点类型；使用范围：菜单参数与动作回调。 */
import type {FileBrowserTreeNode} from "./FileBrowser.types";

export interface FileBrowserTreeMenuActions {
    open(node: FileBrowserTreeNode): Promise<void>;
    refresh(node: FileBrowserTreeNode, recursive?: boolean): Promise<void>;
    createDirectory?(node: FileBrowserTreeNode): Promise<void>;
    rename?(node: FileBrowserTreeNode): Promise<void>;
    copy?(node: FileBrowserTreeNode): Promise<void>;
}

/** 使用应用唯一菜单展示当前树切片已经具有真实业务链的动作。 */
export function showFileBrowserTreeNodeMenu(
    event: MouseEvent,
    node: FileBrowserTreeNode,
    actions: FileBrowserTreeMenuActions,
) {
    const menu = getSiyuanGlobalMenus().menu;
    menu.remove();
    menu.addItem({
        id: "openBy",
        label: siyuanI18n.openBy,
        icon: isFileBrowserContainer(node) ? "iconFolder" : "iconOpen",
        click: () => void actions.open(node),
    });
    const capabilities = getFileBrowserCapabilitiesForPath(node.root, node.path);
    const writable = node.root.exists && !node.entry?.restricted && capabilities.write;
    if (writable && isFileBrowserContainer(node) && actions.createDirectory) {
        menu.addItem({type: "separator"});
        menu.addItem({
            id: "createDirectory",
            label: "新建目录",
            icon: "iconFolder",
            click: () => void actions.createDirectory?.(node),
        });
    }
    if (writable && node.kind !== "root" && actions.rename) {
        if (!isFileBrowserContainer(node) || !actions.createDirectory) {
            menu.addItem({type: "separator"});
        }
        menu.addItem({
            id: "rename",
            label: siyuanI18n.rename,
            icon: "iconEdit",
            click: () => void actions.rename?.(node),
        });
    }
    if (node.kind !== "root" && node.root.exists && !node.entry?.restricted && capabilities.browse && actions.copy) {
        menu.addItem({type: "separator"});
        menu.addItem({
            id: "copy",
            label: "复制到...",
            icon: "iconCopy",
            click: () => void actions.copy?.(node),
        });
    }
    if (isFileBrowserContainer(node)) {
        menu.addItem({type: "separator"});
        menu.addItem({
            id: "refresh",
            label: siyuanI18n.refresh,
            icon: "iconRefresh",
            click: () => void actions.refresh(node),
        });
        menu.addItem({
            id: "refreshDeep",
            label: "递归刷新已加载目录",
            icon: "iconRefresh",
            click: () => void actions.refresh(node, true),
        });
    }
    menu.addItem({type: "separator"});
    menu.addItem({
        id: "copyPath",
        label: siyuanI18n.copyPath,
        icon: "iconCopy",
        click: () => writeText(node.kind === "root" ? node.root?.path ?? "" :
            `${node.root?.path ?? ""}/${node.path}`.replaceAll("/", "\\")),
    });
    menu.popup({x: event.clientX, y: event.clientY});
}
