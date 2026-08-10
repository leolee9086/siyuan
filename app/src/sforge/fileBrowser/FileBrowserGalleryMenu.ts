/** 用途：画廊项上下文菜单的稳定动作映射；使用范围：卡片和表格行共用。 */
import {getDockByType} from "../../layout/query/dockByType";
import {openBy} from "../../platform/localPath/openBy";
import {FILE_PROPERTIES_DOCK_TYPE} from "./FileBrowser.docks";
import {getSiyuanGlobalMenus, writeText} from "./menu/imports";
import type {FileBrowserAssetResult} from "./FileBrowser.query.types";
import type {FileBrowserRoot} from "./FileBrowser.types";

export interface FileBrowserGalleryMenuActions {
    open(asset: FileBrowserAssetResult): Promise<void> | void;
    openSourceNote?(asset: FileBrowserAssetResult): Promise<void> | void;
    openContainingFolder?(asset: FileBrowserAssetResult, root: FileBrowserRoot): Promise<void> | void;
    openDefault?(asset: FileBrowserAssetResult, root: FileBrowserRoot): Promise<void> | void;
    openDirectory?(asset: FileBrowserAssetResult, root: FileBrowserRoot): Promise<void> | void;
    openProperties?(asset: FileBrowserAssetResult): Promise<void> | void;
    delete?(asset: FileBrowserAssetResult): Promise<void> | void;
}

function normalizeRelativePath(path: string) {
    return path.trim().replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
}

/** 根路径只在桌面动作边界拼接，菜单和 API 仍只传 rootID/path。 */
export function getFileBrowserGalleryAbsolutePath(root: FileBrowserRoot, path: string) {
    const rootPath = root.path.trim().replace(/[\\/]+$/g, "");
    const relativePath = normalizeRelativePath(path).replaceAll("/", "\\");
    return relativePath ? `${rootPath}\\${relativePath}` : rootPath;
}

function getFileBrowserGalleryFileURL(root: FileBrowserRoot, path: string) {
    const absolutePath = getFileBrowserGalleryAbsolutePath(root, path).replaceAll("\\", "/");
    return `file:///${encodeURI(absolutePath).replace(/^\/+/, "")}`;
}

function parentPath(path: string) {
    const normalized = normalizeRelativePath(path);
    const index = normalized.lastIndexOf("/");
    return index >= 0 ? normalized.slice(0, index) : "";
}

/**
 * 显示与 SACAssetsManager galleryItem 对齐的文件项菜单。
 * 领域动作由调用方提供，菜单只持有 root-relative 地址和既有平台端口。
 */
export function showFileBrowserGalleryItemMenu(
    event: MouseEvent,
    asset: FileBrowserAssetResult,
    root: FileBrowserRoot,
    thumbnailURL: string,
    actions: FileBrowserGalleryMenuActions,
) {
    const menu = getSiyuanGlobalMenus().menu;
    menu.remove();

    menu.addItem({
        id: "open",
        label: "打开",
        icon: "iconOpen",
        click: () => void actions.open(asset),
    });

    if (asset.boundBlockId?.trim() && actions.openSourceNote) {
        menu.addItem({
            id: "openSourceNote",
            label: "所在笔记",
            icon: "iconDocument",
            click: () => void actions.openSourceNote?.(asset),
        });
    }
    if (actions.openDefault || actions.openContainingFolder || actions.openDirectory) {
        menu.addItem({type: "separator"});
    }
    if (actions.openDefault) {
        menu.addItem({
            id: "openDefault",
            label: "使用默认应用打开",
            icon: "iconOpen",
            click: () => void actions.openDefault?.(asset, root),
        });
    }
    if (actions.openContainingFolder) {
        menu.addItem({
            id: "openContainingFolder",
            label: "在文件管理器打开所在路径",
            icon: "iconFolder",
            click: () => void actions.openContainingFolder?.(asset, root),
        });
    }
    if (actions.openDirectory) {
        menu.addItem({
            id: "openDirectory",
            label: "在新页签打开文件所在路径",
            icon: "iconAssets",
            click: () => void actions.openDirectory?.(asset, root),
        });
    }

    menu.addItem({type: "separator"});
    menu.addItem({
        id: "copyPath",
        label: "复制文件地址",
        icon: "iconCopy",
        click: () => writeText(getFileBrowserGalleryAbsolutePath(root, asset.path)),
    });
    menu.addItem({
        id: "copyLink",
        label: "复制文件链接(markdown)",
        icon: "iconLink",
        click: () => writeText(`[${asset.name}](${getFileBrowserGalleryFileURL(root, asset.path)})`),
    });
    menu.addItem({
        id: "copyThumbnail",
        label: "复制文件缩略图",
        icon: "iconImage",
        click: () => writeText(`![${asset.name}](${thumbnailURL})`),
    });

    if (actions.openProperties) {
        menu.addItem({type: "separator"});
        menu.addItem({
            id: "properties",
            label: "打开文件属性",
            icon: "iconInfo",
            click: () => void actions.openProperties?.(asset),
        });
    }
    if (actions.delete) {
        menu.addItem({type: "separator"});
        menu.addItem({
            id: "delete",
            label: "删除",
            icon: "iconTrashcan",
            warning: true,
            click: () => void actions.delete?.(asset),
        });
    }

    menu.addItem({type: "separator"});
    menu.addItem({
        id: "copyDirectoryPath",
        label: "复制所在目录地址",
        icon: "iconCopy",
        click: () => writeText(getFileBrowserGalleryAbsolutePath(root, parentPath(asset.path))),
    });
    menu.popup({x: event.clientX, y: event.clientY});
}

/** 默认系统动作，供页签组合根装配；保留在此模块避免平台路径逻辑散落。 */
export function openFileBrowserGalleryAssetDefault(asset: FileBrowserAssetResult, root: FileBrowserRoot) {
    return openBy(getFileBrowserGalleryAbsolutePath(root, asset.path), "app");
}

export function openFileBrowserGalleryAssetContainingFolder(asset: FileBrowserAssetResult, root: FileBrowserRoot) {
    return openBy(getFileBrowserGalleryAbsolutePath(root, asset.path), "folder");
}

/** 使属性 Dock 成为画廊右键动作的真实宿主，而不是仅更新隐藏状态。 */
export function showFileBrowserGalleryProperties(asset: FileBrowserAssetResult, select: () => void): void {
    select();
    getDockByType(FILE_PROPERTIES_DOCK_TYPE)?.toggleModel(FILE_PROPERTIES_DOCK_TYPE, true);
}
