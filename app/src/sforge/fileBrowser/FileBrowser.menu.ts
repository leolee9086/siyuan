/** 用途：全局菜单、已有文案和剪贴板兼容；使用范围：树节点右键动作。 */
import {getSiyuanGlobalMenus, siyuanI18n, writeText} from "./menu/imports";
/** 用途：容器节点守卫；使用范围：按节点类型过滤菜单。 */
import {
    getFileBrowserCapabilitiesForPath,
    isFileBrowserContainer,
    isLocalFileBrowserTreeNode,
} from "./FileBrowser.tree";
/** 用途：树节点类型；使用范围：菜单参数与动作回调。 */
import type {FileBrowserLocalTreeNode, FileBrowserTreeNode} from "./FileBrowser.types";

export interface FileBrowserTreeMenuActions {
    open(node: FileBrowserTreeNode): Promise<void>;
    createAgentTask?(node: FileBrowserTreeNode): Promise<void>;
    canCreateAgentTask?(node: FileBrowserTreeNode): boolean;
    refresh(node: FileBrowserTreeNode, recursive?: boolean): Promise<void>;
    createFile?(node: FileBrowserLocalTreeNode): Promise<void>;
    createDirectory?(node: FileBrowserLocalTreeNode): Promise<void>;
    rename?(node: FileBrowserLocalTreeNode): Promise<void>;
    copy?(node: FileBrowserLocalTreeNode): Promise<void>;
    delete?(node: FileBrowserLocalTreeNode): Promise<void>;
}

/** 使用应用唯一菜单展示当前树切片已经具有真实业务链的动作。 */
export function showFileBrowserTreeNodeMenu(
    event: MouseEvent,
    node: FileBrowserTreeNode,
    actions: FileBrowserTreeMenuActions,
) {
    const menu = getSiyuanGlobalMenus().menu;
    const localNode = isLocalFileBrowserTreeNode(node) ? node : undefined;
    menu.remove();
    menu.addItem({
        id: "openBy",
        label: siyuanI18n.openBy,
        icon: isFileBrowserContainer(node) ? "iconFolder" : "iconOpen",
        click: () => void actions.open(node),
    });
    if (actions.createAgentTask && node.kind !== "root" &&
        (node.kind === "file" || actions.canCreateAgentTask?.(node) === true)) {
        menu.addItem({
            id: "createAgentTask",
            label: "在 Agent 面板新建任务",
            icon: "iconSparkles",
            click: () => void actions.createAgentTask?.(node),
        });
    }
    const capabilities = localNode ? getFileBrowserCapabilitiesForPath(localNode.root, localNode.path) : undefined;
    const writable = Boolean(localNode?.root.exists && !localNode.entry?.restricted && capabilities?.write);
    if (localNode && writable && isFileBrowserContainer(localNode) && (actions.createDirectory || actions.createFile)) {
        menu.addItem({type: "separator"});
        menu.addItem({
            id: "create",
            label: "新建",
            icon: "iconAdd",
            type: "submenu",
            submenu: [
                ...(actions.createFile ? [{
                    id: "createFile",
                    label: "新建文件",
                    icon: "iconFile",
                    click: () => void actions.createFile?.(localNode),
                }] : []),
                ...(actions.createDirectory ? [{
                    id: "createDirectory",
                    label: "新建目录",
                    icon: "iconFolder",
                    click: () => void actions.createDirectory?.(localNode),
                }] : []),
            ],
        });
    }
    if (localNode && writable && localNode.kind !== "root" && actions.rename) {
        if (!isFileBrowserContainer(localNode) || !(actions.createDirectory || actions.createFile)) {
            menu.addItem({type: "separator"});
        }
        menu.addItem({
            id: "rename",
            label: siyuanI18n.rename,
            icon: "iconEdit",
            click: () => void actions.rename?.(localNode),
        });
    }
    if (localNode && localNode.kind !== "root" && localNode.root.exists && !localNode.entry?.restricted &&
        capabilities?.browse && actions.copy) {
        menu.addItem({type: "separator"});
        menu.addItem({
            id: "copy",
            label: "复制到...",
            icon: "iconCopy",
            click: () => void actions.copy?.(localNode),
        });
    }
    if (localNode && writable && localNode.kind !== "root" && actions.delete) {
        menu.addItem({type: "separator"});
        menu.addItem({
            id: "delete",
            label: "删除",
            icon: "iconTrashcan",
            click: () => void actions.delete?.(localNode),
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
    const localPathItems = localNode ? [
        {type: "separator" as const},
        {
            id: "copyRelativePath",
            label: "复制根内路径",
            icon: "iconCopy",
            click: () => writeText(localNode.path || "."),
        },
        {
            id: "copyFullPath",
            label: siyuanI18n.copyPath,
            icon: "iconCopy",
            click: () => {
                const absolutePath = localNode.kind === "root" ? localNode.root.path :
                    `${localNode.root.path}/${localNode.path}`.replaceAll("/", "\\");
                writeText(absolutePath);
            },
        },
    ] : [];
    menu.addItem({
        id: "copyPaths",
        label: "复制",
        icon: "iconCopy",
        type: "submenu",
        submenu: [
            {
                id: "copyName",
                label: "复制名称",
                icon: "iconCopy",
                click: () => writeText(node.name),
            },
            ...localPathItems,
        ],
    });
    menu.popup({x: event.clientX, y: event.clientY});
}
