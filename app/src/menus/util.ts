import {ipcInvoke} from "../platform/electron/ipcRenderer";
import {isElectron, isMobile} from "../platform";
import {fetchPost} from "../util/network/fetch";
import {getAssetName, originalPath, pathPosix, useShell} from "../util/file/pathName";
import { openFileById } from "../editor/utils.openFileById";
import {Constants} from "../constants";
import {openNewWindowById} from "../window/openNewWindow";
import { MenuItem } from "./Menu.Item";
import {App} from "../index";
import {isInAndroid, saveExportFile, updateHotkeyTip} from "../protyle/util/compatibility";
import {checkFold} from "../util/platform/noRelyPCFunction";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import {showMessage} from "../dialog/message";
import { openExportPreviewTab } from "../export-preview/open";

export const exportAsset = (src: string) => {
    return {
        id: "export",
        label: siyuanI18n.export,
        icon: "iconUpload",
        async click() {
            if (!isElectron) {
                saveExportFile(src);
            }
            if (isElectron) {
                const result = await ipcInvoke(Constants.SIYUAN_GET, {
                    cmd: "showSaveDialog",
                    defaultPath: getAssetName(src) + pathPosix().extname(src),
                    properties: ["showOverwriteConfirmation"],
                });
                if (!result.canceled) {
                    fetchPost("/api/file/copyFile", {src, dest: result.filePath}, (response) => {
                        if (response.code === 0) {
                            showMessage(window.siyuan.languages.exported);
                        }
                    });
                }
            }
        }
    };
};

// 复制资源文件到系统剪贴板，在文件资源管理器中可粘贴为文件（仅 Windows、macOS 桌面端支持）
export const writeAssetToClipboard = (src: string) => {
    if (["windows", "darwin"].includes(window.siyuan.config.system.os)) {
        return {
            id: "copyFile",
            label: window.siyuan.languages.copyFile,
            icon: "iconFile",
            click: () => {
                fetchPost("/api/clipboard/writeFilePath", {path: src}, (response) => {
                    if (response.code === 0) {
                        showMessage(window.siyuan.languages.copied);
                    } else {
                        showMessage(response.msg || "", response.data?.closeTimeout ?? 5000, "error");
                    }
                });
            }
        };
    } else {
        return {ignore: true};
    }
};

export const copyAsset = writeAssetToClipboard;

export const openEditorTab = (app: App, ids: string[], notebookId?: string, pathString?: string, onlyGetMenus = false) => {
    if (!isMobile) {
    const openSubmenus: IMenu[] = [{
        id: "insertRight",
        icon: "iconLayoutRight",
        label: siyuanI18n.insertRight,
        accelerator: ids.length === 1 ? `${updateHotkeyTip(window.siyuan.config.keymap.editor.general.insertRight.custom)}/${updateHotkeyTip("⌥" + siyuanI18n.click)}` : undefined,
        click: () => {
            if (notebookId) {
                openFileById({
                    app,
                    id: ids[0],
                    position: "right",
                    action: [Constants.CB_GET_FOCUS, Constants.CB_GET_SCROLL]
                });
            } else {
                ids.forEach((id) => {
                    checkFold(id, (zoomIn, action) => {
                        openFileById({
                            app,
                            id,
                            position: "right",
                            action,
                            zoomIn
                        });
                    });
                });
            }
        }
    }, {
        id: "insertBottom",
        icon: "iconLayoutBottom",
        label: siyuanI18n.insertBottom,
        accelerator: ids.length === 1 ? "⇧⌘" + siyuanI18n.click : "",
        click: () => {
            if (notebookId) {
                openFileById({
                    app,
                    id: ids[0],
                    position: "bottom",
                    action: [Constants.CB_GET_FOCUS, Constants.CB_GET_SCROLL]
                });
            } else {
                ids.forEach((id) => {
                    checkFold(id, (zoomIn, action) => {
                        openFileById({
                            app,
                            id,
                            position: "bottom",
                            action,
                            zoomIn
                        });
                    });
                });
            }
        }
    }];
    if (window.siyuan.config.fileTree.openFilesUseCurrentTab) {
        openSubmenus.push({
            id: "openInNewTab",
            label: siyuanI18n.openInNewTab,
            accelerator: ids.length === 1 ? "⌥⌘" + siyuanI18n.click : undefined,
            click: () => {
                if (notebookId) {
                    openFileById({
                        app,
                        id: ids[0],
                        action: [Constants.CB_GET_FOCUS, Constants.CB_GET_SCROLL],
                        removeCurrentTab: false
                    });
                } else {
                    ids.forEach((id) => {
                        checkFold(id, (zoomIn, action) => {
                            openFileById({
                                app,
                                id,
                                action,
                                zoomIn,
                                removeCurrentTab: false
                            });
                        });
                    });
                }
            }
        });
    }
    if (isElectron) {
        openSubmenus.push({
            id: "openByNewWindow",
            label: siyuanI18n.openByNewWindow,
            icon: "iconOpenWindow",
            click() {
                openNewWindowById(ids);
            }
        });
    }
    openSubmenus.push({id: "separator_1", type: "separator"});
    openSubmenus.push({
        id: "preview",
        icon: "iconPreview",
        label: siyuanI18n.preview,
        click: () => {
            for (const id of ids) {
                void openExportPreviewTab({
                    app,
                    blockId: id,
                });
            }
        }
    });
    if (isElectron) {
        openSubmenus.push({id: "separator_2", type: "separator"});
        openSubmenus.push({
            id: "showInFolder",
            icon: "iconFolder",
            label: siyuanI18n.showInFolder,
            click: () => {
                if (notebookId) {
                    useShell("showItemInFolder", originalPath().join(window.siyuan.config.system.dataDir, notebookId, pathString));
                } else {
                    ids.forEach((id) => {
                        fetchPost("/api/block/getBlockInfo", {id}, (response) => {
                            useShell("showItemInFolder", originalPath().join(window.siyuan.config.system.dataDir, response.data.box, response.data.path));
                        });
                    });
                }
            }
        });
    }
    if (onlyGetMenus) {
        return openSubmenus;
    }
    window.siyuan.menus.menu.append(new MenuItem({
        id: "openBy",
        label: siyuanI18n.openBy,
        icon: "iconOpen",
        submenu: openSubmenus,
    }).element);
    }
};

export const copyPNGByLink = (link: string) => {
    if (isInAndroid()) {
        window.JSAndroid.writeImageClipboard(link);
        return;
    }
    // 通过 fetch 拿到 blob 后再写入剪贴板，避免跨域图片直接 drawImage 污染 canvas 导致 toBlob 失败
    // （浏览器访问 Docker 部署时常见，报错：Tainted canvases may not be exported）
    const writePNGBlob = (blob: Blob) => {
        try {
            navigator.clipboard.write([
                new ClipboardItem({
                    // @ts-ignore
                    ["image/png"]: blob
                })
            ]).catch(() => {
                showMessage(window.siyuan.languages.clipboardPermissionDenied);
            });
        } catch (e) {
            // http 等非安全上下文下 navigator.clipboard 可能为 undefined，这里会同步抛错
            showMessage(window.siyuan.languages.clipboardPermissionDenied);
        }
    };
    // 把任意图片 blob 画进 canvas 再导出为 PNG；blob URL 为同源，不会污染 canvas
    const blobToPNGClipboard = (blob: Blob) => {
        if (blob.type === "image/png") {
            writePNGBlob(blob);
            return;
        }
        const objectURL = URL.createObjectURL(blob);
        const canvas = document.createElement("canvas");
        const tempElement = document.createElement("img");
        tempElement.onload = (e: Event & { target: HTMLImageElement }) => {
            canvas.width = e.target.naturalWidth;
            canvas.height = e.target.naturalHeight;
            canvas.getContext("2d").drawImage(e.target, 0, 0);
            URL.revokeObjectURL(objectURL);
            canvas.toBlob((pngBlob) => {
                if (pngBlob) {
                    writePNGBlob(pngBlob);
                }
            }, "image/png", 1);
        };
        tempElement.onerror = () => {
            URL.revokeObjectURL(objectURL);
        };
        tempElement.src = objectURL;
    };
    fetch(link).then(async (response) => {
        if (!response.ok) {
            throw new Error(response.statusText);
        }
        blobToPNGClipboard(await response.blob());
    }).catch(() => {
        // fetch 失败时回退：以 CORS 模式加载后再导出（需目标服务器返回 ACAO）
        const canvas = document.createElement("canvas");
        const tempElement = document.createElement("img");
        tempElement.crossOrigin = "anonymous";
        tempElement.onload = (e: Event & { target: HTMLImageElement }) => {
            canvas.width = e.target.naturalWidth;
            canvas.height = e.target.naturalHeight;
            canvas.getContext("2d").drawImage(e.target, 0, 0);
            canvas.toBlob((blob) => {
                if (blob) {
                    writePNGBlob(blob);
                }
            }, "image/png", 1);
        };
        tempElement.src = link;
    });
};
