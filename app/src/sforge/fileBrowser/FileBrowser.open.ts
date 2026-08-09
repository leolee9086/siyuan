/** 用途：现有资源扩展名与应用外观；使用范围：统一文件打开端口。 */
import {Constants} from "./open/imports";
import type {AppFacade} from "./open/imports";
/** 用途：只读预览页签类型；使用范围：非 Asset 文件打开。 */
import {FILE_BROWSER_PREVIEW_TAB_TYPE} from "./FileBrowser.preview";
import {FILE_BROWSER_GALLERY_TAB_TYPE} from "./FileBrowser.gallery.constants";
import {FILE_BROWSER_EDITOR_TAB_TYPE} from "./FileBrowser.editor.constants";
import {supportsAssetMainTab} from "../../asset/assetFormat";
/** 用途：文件统计、目录项和打开动作；使用范围：打开端口契约。 */
import type {
    FileBrowserEntry,
    FileBrowserEntryOpener,
    FileBrowserFileStat,
    FileBrowserRepository,
} from "./FileBrowser.types";

function canUseAssetTab(stat: FileBrowserFileStat) {
    return supportsAssetMainTab(stat.entry.name, stat.mediaType) &&
        Constants.SIYUAN_ASSETS_EXTS.includes(stat.entry.extension ?? "");
}

function openRegisteredPreview(app: Pick<AppFacade, "openTab">, stat: FileBrowserFileStat) {
    return app.openTab({
        custom: {
            title: stat.entry.name,
            icon: stat.previewKind === "text" ? "iconCode" : "iconFile",
            id: FILE_BROWSER_PREVIEW_TAB_TYPE,
            data: {rootID: stat.root.id, path: stat.entry.path, name: stat.entry.name},
        },
    });
}

function openRegisteredEditor(app: Pick<AppFacade, "openTab">, stat: FileBrowserFileStat) {
    return app.openTab({
        custom: {
            title: stat.entry.name,
            icon: "iconCode",
            id: FILE_BROWSER_EDITOR_TAB_TYPE,
            data: {rootID: stat.root.id, path: stat.entry.path, name: stat.entry.name},
        },
    });
}

/** 为一个 App 实例建立唯一打开端口，调用方始终只传 root ID 与相对路径。 */
export function createFileBrowserEntryOpener(
    app: Pick<AppFacade, "openAsset" | "openTab">,
    repository: FileBrowserRepository,
) {
    return async (rootID: string, entry: FileBrowserEntry) => {
        const stat = await repository.statFile({rootID, path: entry.path});
        if (canUseAssetTab(stat)) {
            app.openAsset({assetPath: stat.contentURL});
            return;
        }
        if (stat.previewKind === "text") {
            await openRegisteredEditor(app, stat);
            return;
        }
        await openRegisteredPreview(app, stat);
    };
}

/** 为目录建立独立资源结果页签；树 Dock 只负责导航和选择。 */
export function createFileBrowserDirectoryOpener(app: Pick<AppFacade, "openTab">) {
    return async (rootID: string, path: string, name: string) => {
        await app.openTab({
            custom: {
                title: name,
                icon: "iconAssets",
                id: FILE_BROWSER_GALLERY_TAB_TYPE,
                data: {rootID, path, name, scope: "directory"},
            },
        });
    };
}
