import {isElectron, isMobile} from "../platform";
import {fetchPost} from "../util/network/fetch";
import {originalPath, useShell} from "../util/file/pathName";
import {Constants} from "../constants";
import {openNewWindowById} from "../window/openNewWindow";
import { MenuItem } from "./Menu.Item";
import type { AppFacade } from "../app/AppFacade.types";
import {updateHotkeyTip} from "../protyle/util/compatibility";
import {checkFold} from "../block/fold/checkFold";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import { openExportPreviewTab } from "../export-preview/open";

export const openEditorTab = (app: AppFacade, ids: string[], notebookId?: string, pathString?: string, onlyGetMenus = false) => {
    if (!isMobile) {
    const openSubmenus: IMenu[] = [{
        id: "insertRight",
        icon: "iconLayoutRight",
        label: siyuanI18n.insertRight,
        accelerator: ids.length === 1 ? `${updateHotkeyTip(window.siyuan.config.keymap.editor.general.insertRight.custom)}${window.siyuan.config.keymap.editor.general.insertRight.custom ? "/" : ""}${updateHotkeyTip("⌥" + siyuanI18n.click)}` : undefined,
        click: () => {
            if (notebookId) {
                app.openBlock({
                    id: ids[0],
                    position: "right",
                    action: [Constants.CB_GET_FOCUS, Constants.CB_GET_SCROLL]
                });
            } else {
                ids.forEach((id) => {
                    checkFold(id, (zoomIn, action) => {
                        app.openBlock({
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
                app.openBlock({
                    id: ids[0],
                    position: "bottom",
                    action: [Constants.CB_GET_FOCUS, Constants.CB_GET_SCROLL]
                });
            } else {
                ids.forEach((id) => {
                    checkFold(id, (zoomIn, action) => {
                        app.openBlock({
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
                    app.openBlock({
                        id: ids[0],
                        action: [Constants.CB_GET_FOCUS, Constants.CB_GET_SCROLL],
                        removeCurrentTab: false
                    });
                } else {
                    ids.forEach((id) => {
                        checkFold(id, (zoomIn, action) => {
                            app.openBlock({
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
