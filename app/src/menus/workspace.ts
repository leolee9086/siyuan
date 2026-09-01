import { MenuItem } from "./Menu.Item";
import {ipcSend} from "../platform/electron/ipcRenderer";
import {ipcInvoke} from "../platform/electron/ipcRenderer";
import {isElectron} from "../platform";
import {openHistory} from "../history/history.panel";
import {getOpenNotebookCount, originalPath, pathPosix, useShell} from "../util/file/pathName";
import {fetchNewDailyNote, mountHelp, newDailyNote} from "../util/file/mount";
import {fetchPost} from "../util/network/fetch";
import {Constants} from "../constants";
import {
    isInAndroid,
    isInHarmony,
    isInMobileApp,
    setStorageVal,
    writeText
} from "../protyle/util/compatibility";
import {isIPad} from "../util/platform/functions";
import {openCard} from "../card/openCard";
import {getAllDocks} from "../layout/getAll";
import {getDockHotkey} from "../layout/dock/hotkey";
import {exportLayout} from "../layout/export/exportLayout";
import {getAllLayout} from "../layout/persistence/layoutSnapshot";
import {getDockByType} from "../layout/query/dockByType";
import {exitSiYuan} from "../dialog/processSystem";
import { lockScreen } from "../dialog/processSystem/lockScreen";
import {showMessage} from "../dialog/message";
import {unicode2Emoji} from "../emoji";
import {Dock} from "../layout/dock";
import {escapeAttr, escapeHtml} from "../util/DOM/escape";
import {viewCards} from "../card/viewCards";
import {Dialog} from "../dialog";
import {hasClosestByClassName} from "../protyle/util/hasClosest";
import {confirmDialog} from "../dialog/confirmDialog";
import type { AppFacade } from "../app/AppFacade.types";
import {isBrowser} from "../util/platform/functions";
import {openRecentDocs} from "../business/openRecentDocs";
import * as dayjs from "dayjs";
import {upDownHint} from "../util/DOM/upDownHint";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import { openBazaarHubTab, openBazaarPublishTab } from "../bazaar-hub/open";
import {openDesktopDataMigration} from "./dataMigration/desktop";
import {openLink} from "../editor/openLink";

const editLayout = (layoutName?: string) => {
    const dialog = new Dialog({
        positionId: Constants.DIALOG_SAVEWORKSPACE,
        title: layoutName ? siyuanI18n.edit : siyuanI18n.save,
        content: `<div class="b3-dialog__content">
        <input class="b3-text-field fn__block" value="${layoutName || ""}" placeholder="${siyuanI18n.memo}">
</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--remove${layoutName ? "" : " fn__none"}">${siyuanI18n.delete}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--cancel">${siyuanI18n.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text${layoutName ? "" : " fn__none"}">${siyuanI18n.rename}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${siyuanI18n[layoutName ? "updateLayout" : "confirm"]}</button>
</div>`,
        width: "520px",
    });
    dialog.element.setAttribute("data-key", Constants.DIALOG_SAVEWORKSPACE);
    const btnsElement = dialog.element.querySelectorAll(".b3-button");
    const inputElement = dialog.element.querySelector("input");
    inputElement.select();
    inputElement.focus();
    dialog.bindInput(inputElement, () => {
        btnsElement[3].dispatchEvent(new CustomEvent("click"));
    });
    btnsElement[0].addEventListener("click", () => {
        window.siyuan.storage[Constants.LOCAL_LAYOUTS].find((layoutItem: ISaveLayout, index: number) => {
            if (layoutItem.name === layoutName) {
                window.siyuan.storage[Constants.LOCAL_LAYOUTS].splice(index, 1);
                setStorageVal(Constants.LOCAL_LAYOUTS, window.siyuan.storage[Constants.LOCAL_LAYOUTS]);
                return true;
            }
        });
        dialog.destroy();
    });
    btnsElement[1].addEventListener("click", () => {
        dialog.destroy();
    });
    btnsElement[2].addEventListener("click", () => {
        const value = inputElement.value;
        if (!value) {
            showMessage(siyuanI18n["_kernel"]["142"]);
            return;
        }
        dialog.destroy();
        window.siyuan.storage[Constants.LOCAL_LAYOUTS].find((layoutItem: ISaveLayout) => {
            if (layoutItem.name === layoutName) {
                layoutItem.name = value;
                layoutItem.time = new Date().getTime();
                setStorageVal(Constants.LOCAL_LAYOUTS, window.siyuan.storage[Constants.LOCAL_LAYOUTS]);
                return true;
            }
        });
    });
    btnsElement[3].addEventListener("click", () => {
        const value = inputElement.value;
        if (!value) {
            showMessage(siyuanI18n["_kernel"]["142"]);
            return;
        }
        dialog.destroy();
        if (layoutName) {
            window.siyuan.storage[Constants.LOCAL_LAYOUTS].find((layoutItem: ISaveLayout) => {
                if (layoutItem.name === layoutName) {
                    layoutItem.name = value;
                    layoutItem.time = new Date().getTime();
                    layoutItem.layout = getAllLayout();
                    layoutItem.filesPaths = window.siyuan.storage[Constants.LOCAL_FILESPATHS];
                    setStorageVal(Constants.LOCAL_LAYOUTS, window.siyuan.storage[Constants.LOCAL_LAYOUTS]);
                    return true;
                }
            });
            return;
        }
        const hadName = window.siyuan.storage[Constants.LOCAL_LAYOUTS].find((item: ISaveLayout) => {
            if (item.name === value) {
                confirmDialog(siyuanI18n.save, siyuanI18n.exportTplTip, () => {
                    item.layout = getAllLayout();
                    item.time = new Date().getTime();
                    item.filesPaths = window.siyuan.storage[Constants.LOCAL_FILESPATHS];
                    setStorageVal(Constants.LOCAL_LAYOUTS, window.siyuan.storage[Constants.LOCAL_LAYOUTS]);
                });
                return true;
            }
        });
        if (hadName) {
            return;
        }
        window.siyuan.storage[Constants.LOCAL_LAYOUTS].push({
            name: value,
            time: new Date().getTime(),
            layout: getAllLayout(),
            filesPaths: window.siyuan.storage[Constants.LOCAL_FILESPATHS]
        });
        setStorageVal(Constants.LOCAL_LAYOUTS, window.siyuan.storage[Constants.LOCAL_LAYOUTS]);
    });
};

const togglePinDock = (id: "switchLeftDock" | "switchRightDock" | "switchBottomDock", dock: Dock, pinIcon: string, unpinIcon: string) => {
    return {
        id,
        label: `${dock.pin ? window.siyuan.languages.switchToFloatingLayout : window.siyuan.languages.switchToFixedLayout}`,
        icon: `${dock.pin ? unpinIcon : pinIcon}`,
        accelerator: window.siyuan.config.keymap.general[id].custom,
        current: !dock.pin,
        click() {
            dock.togglePin();
        }
    };
};

export const workspaceMenu = (app: AppFacade, rect: DOMRect) => {
    if (!window.siyuan.menus.menu.element.classList.contains("fn__none") &&
        window.siyuan.menus.menu.element.getAttribute("data-name") === Constants.MENU_BAR_WORKSPACE) {
        window.siyuan.menus.menu.remove();
        return;
    }
    fetchPost("/api/system/getWorkspaces", {}, (response) => {
        window.siyuan.menus.menu.remove();
        window.siyuan.menus.menu.element.setAttribute("data-name", Constants.MENU_BAR_WORKSPACE);
        if (!window.siyuan.config.readonly) {
            window.siyuan.menus.menu.append(new MenuItem({
                id: "config",
                label: siyuanI18n.config,
                icon: "iconSettings",
                accelerator: window.siyuan.config.keymap.general.config.custom,
                click: () => {
                    app.openSettings();
                }
            }).element);
        }
        window.siyuan.menus.menu.append(new MenuItem({
            id: "bazaarHub",
            label: `${siyuanI18n.bazaar} Hub`,
            icon: "iconBazaar",
            click: () => {
                void openBazaarHubTab({ app });
            }
        }).element);
        if (!window.siyuan.config.readonly) {
            window.siyuan.menus.menu.append(new MenuItem({
                id: "bazaarPublish",
                label: `${siyuanI18n.publish} · ${siyuanI18n.bazaar}`,
                icon: "iconUpload",
                click: () => {
                    void openBazaarPublishTab({ app });
                }
            }).element);
        }
        const dockMenu: IMenu[] = [];
        getAllDocks().forEach(item => {
            dockMenu.push({
                id: item.type,
                icon: item.icon,
                accelerator: getDockHotkey(item),
                label: item.title,
                click() {
                    getDockByType(item.type).toggleModel(item.type);
                }
            });
        });
        if (!window.siyuan.config.readonly) {
            dockMenu.push({id: "separator_1", type: "separator"});
            dockMenu.push(togglePinDock("switchLeftDock", window.siyuan.layout.leftDock, "iconPanelLeft", "iconPanelLeftDashed"));
            dockMenu.push(togglePinDock("switchRightDock", window.siyuan.layout.rightDock, "iconPanelRight", "iconPanelRightDashed"));
            dockMenu.push(togglePinDock("switchBottomDock", window.siyuan.layout.bottomDock, "iconPanelBottom", "iconPanelBottomDashed"));
        }
        window.siyuan.menus.menu.append(new MenuItem({
            id: "panels",
            label: siyuanI18n.panels,
            icon: "iconDock",
            type: "submenu",
            submenu: dockMenu
        }).element);
        if (!window.siyuan.config.readonly) {
            let workspaceSubMenu: IMenu[];
            if (isElectron) {
            workspaceSubMenu = [{
                id: "newOrOpenBy",
                label: `${siyuanI18n.new} / ${siyuanI18n.openBy}`,
                iconHTML: "",
                click: async () => {
                    const localPath = await ipcInvoke(Constants.SIYUAN_GET, {
                        cmd: "showOpenDialog",
                        defaultPath: window.siyuan.config.system.homeDir,
                        properties: ["openDirectory", "createDirectory"],
                    });
                    if (localPath.filePaths.length === 0) {
                        return;
                    }
                    fetchPost("/api/system/checkWorkspaceDir", {path: localPath.filePaths[0]}, (response) => {
                        if (response.data.isWorkspace) {
                            openWorkspace(localPath.filePaths[0]);
                        } else {
                            confirmDialog("🏗️ " + siyuanI18n.createWorkspace, siyuanI18n.createWorkspaceTip + `<br><br><code class="fn__code">${localPath.filePaths[0]}</code>`, () => {
                                openWorkspace(localPath.filePaths[0]);
                            });
                        }
                    });
                }
            }];
            workspaceSubMenu.push({id: "separator_1", type: "separator"});
            response.data.forEach((item: IWorkspace) => {
                workspaceSubMenu.push(workspaceItem(item) as IMenu);
            });
            }
            if (!isElectron) {
            workspaceSubMenu = [{
                id: "new",
                label: siyuanI18n.new,
                iconHTML: "",
                click() {
                    const createWorkspaceDialog = new Dialog({
                        title: siyuanI18n.new,
                        content: `<div class="b3-dialog__content">
    <input class="b3-text-field fn__block">
</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${siyuanI18n.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${siyuanI18n.confirm}</button>
</div>`,
                        width: "520px",
                    });
                    createWorkspaceDialog.element.setAttribute("data-key", Constants.DIALOG_CREATEWORKSPACE);
                    const inputElement = createWorkspaceDialog.element.querySelector("input");
                    inputElement.focus();
                    const btnsElement = createWorkspaceDialog.element.querySelectorAll(".b3-button");
                    btnsElement[0].addEventListener("click", () => {
                        createWorkspaceDialog.destroy();
                    });
                    btnsElement[1].addEventListener("click", () => {
                        fetchPost("/api/system/createWorkspaceDir", {
                            path: pathPosix().join(pathPosix().dirname(window.siyuan.config.system.workspaceDir), inputElement.value)
                        }, () => {
                            createWorkspaceDialog.destroy();
                        });
                    });
                }
            }, {
                id: "openBy",
                label: `${siyuanI18n.openBy}...`,
                iconHTML: "",
                click() {
                    fetchPost("/api/system/getMobileWorkspaces", {}, (response) => {
                        let selectHTML = "";
                        response.data.forEach((item: string, index: number) => {
                            selectHTML += `<option value="${item}"${index === 0 ? ' selected="selected"' : ""}>${pathPosix().basename(item)}</option>`;
                        });
                        const openWorkspaceDialog = new Dialog({
                            title: siyuanI18n.openBy,
                            content: `<div class="b3-dialog__content">
    <select class="b3-text-field fn__block">${selectHTML}</select>
</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${siyuanI18n.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${siyuanI18n.confirm}</button>
</div>`,
                            width: "520px",
                        });
                        openWorkspaceDialog.element.setAttribute("data-key", Constants.DIALOG_OPENWORKSPACE);
                        const btnsElement = openWorkspaceDialog.element.querySelectorAll(".b3-button");
                        btnsElement[0].addEventListener("click", () => {
                            openWorkspaceDialog.destroy();
                        });
                        btnsElement[1].addEventListener("click", () => {
                            const openPath = openWorkspaceDialog.element.querySelector("select").value;
                            if (openPath === window.siyuan.config.system.workspaceDir) {
                                openWorkspaceDialog.destroy();
                                return;
                            }
                            confirmDialog(siyuanI18n.confirm, `${pathPosix().basename(window.siyuan.config.system.workspaceDir)} -> ${pathPosix().basename(openPath)}?`, () => {
                                fetchPost("/api/system/setWorkspaceDir", {
                                    path: openPath
                                }, () => {
                                    exitSiYuan(false);
                                });
                            });
                        });
                    });
                }
            }];
            workspaceSubMenu.push({id: "separator_1", type: "separator"});
            response.data.forEach((item: IWorkspace) => {
                workspaceSubMenu.push({
                    iconHTML: "",
                    action: "iconCloseRound",
                    current: window.siyuan.config.system.workspaceDir === item.path,
                    label: pathPosix().basename(item.path),
                    bind(menuElement) {
                        menuElement.addEventListener("click", (event) => {
                            if (hasClosestByClassName(event.target as Element, "b3-menu__action")) {
                                event.preventDefault();
                                event.stopPropagation();
                                if (item.path === window.siyuan.config.system.workspaceDir) {
                                    fetchPost("/api/system/removeWorkspaceDir", {path: item.path});
                                    return;
                                }
                                confirmDialog(siyuanI18n.deleteOpConfirm, siyuanI18n.removeWorkspacePhysically.replace("${x}", item.path), () => {
                                    fetchPost("/api/system/removeWorkspaceDirPhysically", {path: item.path});
                                }, () => {
                                    fetchPost("/api/system/removeWorkspaceDir", {path: item.path});
                                }, true);
                                return;
                            }
                            confirmDialog(siyuanI18n.confirm, `${pathPosix().basename(window.siyuan.config.system.workspaceDir)} -> ${pathPosix().basename(item.path)}?`, () => {
                                fetchPost("/api/system/setWorkspaceDir", {
                                    path: item.path
                                }, () => {
                                    exitSiYuan(false);
                                });
                            });
                        });
                    }
                });
            });
            }
            if (!isBrowser() || isInMobileApp()) {
                window.siyuan.menus.menu.append(new MenuItem({
                    id: "workspaceList",
                    label: siyuanI18n.workspaceList,
                    icon: "iconWorkspace",
                    type: "submenu",
                    submenu: workspaceSubMenu,
                }).element);
            }
        }
        const layoutSubMenu: IMenu[] = [{
            id: "save",
            iconHTML: "",
            label: siyuanI18n.save,
            click() {
                editLayout();
            }
        }];
        if (window.siyuan.storage[Constants.LOCAL_LAYOUTS].length > 0) {
            layoutSubMenu.push({id: "separator_1", type: "separator"});
            layoutSubMenu.push({
                iconHTML: "",
                type: "empty",
                label: `<input class="b3-text-field fn__block" style="margin: 4px 0" placeholder="${siyuanI18n.search}">
<div class="b3-list b3-list--background" style="max-width: 50vw"></div>`,
                bind(menuElement) {
                    const genListHTML = () => {
                        let html = "";
                        window.siyuan.storage[Constants.LOCAL_LAYOUTS].sort((a: ISaveLayout, b: ISaveLayout) => {
                            return a.name.localeCompare(b.name, undefined, {numeric: true});
                        }).forEach((item: ISaveLayout) => {
                            if (inputElement.value === "" || item.name.toLowerCase().indexOf(inputElement.value.toLowerCase()) > -1) {
                                html += `<div data-name="${item.name}" class="b3-list-item b3-list-item--narrow b3-list-item--hide-action${html ? "" : " b3-list-item--focus"} ariaLabel" data-position="8east" aria-label="${escapeAttr(item.name)}" >
    <div class="b3-list-item__text">${item.name}</div>
    <span class="b3-list-item__meta">${item.time ? dayjs(item.time).format("YYYY-MM-DD HH:mm") : ""}</span>
    <span class="b3-list-item__action">
        <svg><use xlink:href="#iconEdit"></use></svg>
    </span>
</div>`;
                            }
                        });
                        return html;
                    };
                    const inputElement = menuElement.querySelector(".b3-text-field") as HTMLInputElement;
                    const listElement = menuElement.querySelector(".b3-list");
                    inputElement.addEventListener("keydown", (event) => {
                        event.stopPropagation();
                        if (event.isComposing) {
                            return;
                        }
                        upDownHint(listElement, event);
                        if (event.key === "Escape") {
                            window.siyuan.menus.menu.remove();
                        } else if (event.key === "Enter") {
                            const currentElement = listElement.querySelector(".b3-list-item--focus");
                            if (currentElement) {
                                listElement.dispatchEvent(new CustomEvent("click", {detail: currentElement.getAttribute("data-name")}));
                            }
                        }
                    });
                    inputElement.addEventListener("compositionend", () => {
                        listElement.innerHTML = genListHTML();
                    });
                    inputElement.addEventListener("input", (event: InputEvent) => {
                        if (event.isComposing) {
                            return;
                        }
                        event.stopPropagation();
                        listElement.innerHTML = genListHTML();
                    });
                    listElement.addEventListener("click", (event: MouseEvent) => {
                        if (window.siyuan.config.readonly) {
                            return;
                        }
                        const actionElement = hasClosestByClassName(event.target as Element, "b3-list-item__action");
                        if (actionElement) {
                            event.preventDefault();
                            event.stopPropagation();
                            editLayout(actionElement.parentElement.dataset.name);
                            window.siyuan.menus.menu.remove();
                            return;
                        }
                        const liElement = hasClosestByClassName(event.target as Element, "b3-list-item");
                        if (liElement || event.detail) {
                            const itemData: ISaveLayout = window.siyuan.storage[Constants.LOCAL_LAYOUTS].find((item: ISaveLayout) => {
                                if (typeof event.detail === "string") {
                                    return item.name === event.detail;
                                } else if (liElement) {
                                    return item.name === liElement.dataset.name;
                                }
                            });
                            if (itemData) {
                                fetchPost("/api/system/setUILayout", {layout: itemData.layout}, () => {
                                    if (itemData.filesPaths) {
                                        window.siyuan.storage[Constants.LOCAL_FILESPATHS] = itemData.filesPaths;
                                        setStorageVal(Constants.LOCAL_FILESPATHS, itemData.filesPaths, () => {
                                            window.location.reload();
                                        });
                                    } else {
                                        window.location.reload();
                                    }
                                });
                            }
                            event.preventDefault();
                            event.stopPropagation();
                        }
                    });
                    listElement.innerHTML = genListHTML();
                }
            });
        }
        if (!window.siyuan.config.readonly) {
            window.siyuan.menus.menu.append(new MenuItem({
                id: "layout",
                label: siyuanI18n.layout,
                icon: "iconLayout",
                type: "submenu",
                submenu: layoutSubMenu
            }).element);
        }
        window.siyuan.menus.menu.append(new MenuItem({id: "separator_1", type: "separator"}).element);
        if (!window.siyuan.config.readonly) {
            if (getOpenNotebookCount() < 2) {
                window.siyuan.menus.menu.append(new MenuItem({
                    id: "dailyNote",
                    label: siyuanI18n.dailyNote,
                    icon: "iconCalendar",
                    accelerator: window.siyuan.config.keymap.general.dailyNote.custom,
                    click: () => {
                        newDailyNote(app);
                    }
                }).element);
            } else {
                const submenu: IMenu[] = [];
                window.siyuan.notebooks.forEach(item => {
                    if (!item.closed) {
                        submenu.push({
                            label: escapeHtml(item.name),
                            iconHTML: unicode2Emoji(item.icon || window.siyuan.storage[Constants.LOCAL_IMAGES].note, "b3-menu__icon", true),
                            accelerator: window.siyuan.storage[Constants.LOCAL_DAILYNOTEID] === item.id ? window.siyuan.config.keymap.general.dailyNote.custom : "",
                            click: () => {
                                fetchNewDailyNote(app, item.id);
                                window.siyuan.storage[Constants.LOCAL_DAILYNOTEID] = item.id;
                                setStorageVal(Constants.LOCAL_DAILYNOTEID, window.siyuan.storage[Constants.LOCAL_DAILYNOTEID]);
                            }
                        });
                    }
                });
                window.siyuan.menus.menu.append(new MenuItem({
                    id: "dailyNote",
                    label: siyuanI18n.dailyNote,
                    icon: "iconCalendar",
                    type: "submenu",
                    submenu
                }).element);
            }
            if (!window.siyuan.config.readonly) {
                window.siyuan.menus.menu.append(new MenuItem({
                    id: "riffCard",
                    label: siyuanI18n.riffCard,
                    type: "submenu",
                    icon: "iconRiffCard",
                    submenu: [{
                        id: "spaceRepetition",
                        iconHTML: "",
                        label: siyuanI18n.spaceRepetition,
                        accelerator: window.siyuan.config.keymap.general.riffCard.custom,
                        click: () => {
                            openCard(app);
                        }
                    }, {
                        id: "manage",
                        iconHTML: "",
                        label: siyuanI18n.manage,
                        click: () => {
                            viewCards(app, "", siyuanI18n.all, "");
                        }
                    }],
                }).element);
            }
            window.siyuan.menus.menu.append(new MenuItem({
                id: "recentDocs",
                label: siyuanI18n.recentDocs,
                icon: "iconFile",
                accelerator: window.siyuan.config.keymap.general.recentDocs.custom,
                click: () => {
                    openRecentDocs();
                }
            }).element);
            window.siyuan.menus.menu.append(new MenuItem({
                id: "lockScreen",
                label: siyuanI18n.lockScreen,
                icon: "iconLock",
                accelerator: window.siyuan.config.keymap.general.lockScreen.custom,
                click: () => {
                    lockScreen(app);
                }
            }).element);
            window.siyuan.menus.menu.append(new MenuItem({
                id: "dataHistory",
                label: siyuanI18n.dataHistory,
                icon: "iconHistory",
                accelerator: window.siyuan.config.keymap.general.dataHistory.custom,
                click: () => {
                    openHistory(app);
                }
            }).element);
            if (!window.siyuan.config.readonly) {
                window.siyuan.menus.menu.append(new MenuItem({
                    id: "dataMigration",
                    label: window.siyuan.languages.dataMigration,
                    icon: "iconDatabaseBackup",
                    click: () => {
                        openDesktopDataMigration();
                    }
                }).element);
            }
            window.siyuan.menus.menu.append(new MenuItem({id: "separator_2", type: "separator"}).element);
        }
        window.siyuan.menus.menu.append(new MenuItem({
            id: "userGuide",
            label: siyuanI18n.userGuide,
            icon: "iconHelp",
            ignore: window.siyuan.config.readonly,
            click: () => {
                mountHelp();
            }
        }).element);
        window.siyuan.menus.menu.append(new MenuItem({
            id: "feedback",
            label: siyuanI18n.feedback,
            icon: "iconFeedback",
            click: () => {
                if ("zh-CN" === window.siyuan.config.lang) {
                    openLink(app, "https://ld246.com/article/1649901726096");
                } else {
                    openLink(app, "https://liuyun.io/article/1686530886208");
                }
            }
        }).element);
        if (isElectron) {
            window.siyuan.menus.menu.append(new MenuItem({
                id: "debug",
                label: siyuanI18n.debug,
                icon: "iconBug",
                click: () => {
                    ipcSend(Constants.SIYUAN_CMD, "openDevTools");
                }
            }).element);
        }
        if (isIPad() || isInAndroid() || isInHarmony() || !isBrowser()) {
            window.siyuan.menus.menu.append(new MenuItem({id: "separator_3", type: "separator"}).element);
            window.siyuan.menus.menu.append(new MenuItem({
                id: "safeQuit",
                label: siyuanI18n.safeQuit,
                icon: "iconQuit",
                warning: true,
                click: () => {
                    exportLayout({
                        errorExit: true,
                        cb: exitSiYuan,
                    });
                }
            }).element);
        }
        window.siyuan.menus.menu.popup({x: rect.left, y: rect.bottom});
    });
};

const openWorkspace = (workspace: string) => {
    if (!isElectron) {
        return;
    }
    if (workspace === window.siyuan.config.system.workspaceDir) {
        return;
    }
    fetchPost("/api/system/setWorkspaceDir", {
        path: workspace
    }, () => {
        ipcSend(Constants.SIYUAN_OPEN_WORKSPACE, {
            workspace,
            lang: window.siyuan.config.appearance.lang
        });
    });
};

const workspaceItem = (item: IWorkspace) => {
    if (!isElectron) {
        return;
    }
    const submenu = [{
        id: "showInFolder",
        icon: "iconFolder",
        label: siyuanI18n.showInFolder,
        click() {
            useShell("showItemInFolder", item.path);
        }
    }, {
        id: "copyPath",
        icon: "iconCopy",
        label: siyuanI18n.copyPath,
        click() {
            writeText(item.path);
            showMessage(siyuanI18n.copied);
        }
    }];
    if (item.path !== window.siyuan.config.system.workspaceDir) {
        submenu.splice(0, 0, {
            id: "openBy",
            icon: "iconOpenWindow",
            label: siyuanI18n.openBy,
            click() {
                openWorkspace(item.path);
            }
        });
        if (item.closed) {
            submenu.push({
                id: "removeWorkspaceTip",
                icon: "iconTrashcan",
                label: siyuanI18n.removeWorkspaceTip,
                click() {
                    fetchPost("/api/system/removeWorkspaceDir", {path: item.path});
                }
            });
        }
    }
    return {
        label: `<div aria-label="${item.path}" class="fn__ellipsis ariaLabel" style="max-width: 256px">
    ${originalPath().basename(item.path)}
</div>`,
        current: !item.closed,
        iconHTML: "",
        type: "submenu",
        submenu,
        click() {
            openWorkspace(item.path);
        },
    };
};
