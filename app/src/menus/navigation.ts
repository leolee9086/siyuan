import {exportMd} from "./commonMenuItem/export/exportMenu.factory";
import {copySubMenu} from "./commonMenuItem/copy/copySubMenu.factory";
import {openFileAttr} from "./commonMenuItem/fileAttr/openFileAttr";
import {movePathToMenu} from "./commonMenuItem/movePath/movePathToMenu.factory";
import {renameMenu} from "./commonMenuItem/rename/renameMenu.factory";
import { isElectron, isMobile } from "../platform";
import { MenuItem } from "./Menu.Item";
import { getDisplayName, getNotebookName, getTopPaths, useShell, pathPosix, originalPath } from "../util/file/pathName";
import {isEncryptedBox} from "../util/file/notebook/store";
import { showMessage } from "../dialog/message";
import { confirmDialog } from "../dialog/confirmDialog";
import { fetchPost, fetchSyncPost } from "../util/network/fetch";
import { onGetnotebookconf } from "./onGetnotebookconf";
import { openSearch } from "../search/spread";
import { closePanel } from "../mobile/util/closePanel";
import { popSearch } from "../mobile/menu/search";
import { Constants } from "../constants";
import { hasClosestByTag } from "../protyle/util/hasClosest";
import { deleteFiles } from "../editor/deleteFile";
import { openCardByData } from "../card/openCard";
import { viewCards } from "../card/viewCards";
import type { AppFacade } from "../app/AppFacade.types";
import { openDocHistory } from "../history/doc";
import { openEditorTab } from "./util";
import { makeCard } from "../card/makeCard";
import {transaction} from "../protyle/wysiwyg/transaction/submit";
import { emitOpenMenu } from "../plugin/menu/emitOpenMenu.factory";
import { saveExportFile } from "../protyle/util/compatibility";
import { exportMarkdownZip } from "../protyle/export/exportMd";
import { addFilesToDatabase } from "../protyle/render/av/addToDatabase";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import { initMultiMenu } from "./navigation.initMultiMenu";
import { openEmojiPanel } from "../emoji";
import {sortMenu} from "./navigation/sortMenu";
import {
    FILE_TREE_CHILDREN_SORT_MODE,
    getConfiguredChildrenSortMode,
    isCustomFileTreeList,
} from "../util/fileTreeSort";
import {openMobileFileByIdInNewTabViaPort} from "../plugin/api/openMobileFile.port";
import {appendFileTreeImportMenu} from "./fileTree/importMenu/importMenu.factory";
import {getDockByType} from "../layout/query/dockByType";
import {isFilesDomain} from "../layout/dock/Files/eventHandlers.types";
import {isMobileFilesDomain} from "../mobile/dock/files/mobileFiles.types";

const confirmEncryptedExport = (notebookId: string, callback: () => void) => {
    if (!isEncryptedBox(notebookId)) {
        callback();
        return;
    }
    confirmDialog(siyuanI18n.export, siyuanI18n.encryptedExportRiskTip, callback);
};

export const initNavigationMenu = (app: AppFacade, liElement: HTMLElement) => {
    window.siyuan.menus.menu.remove();
    window.siyuan.menus.menu.element.setAttribute("data-name", Constants.MENU_DOC_TREE_MORE);
    const fileElement = hasClosestByTag(liElement, "DIV");
    if (!fileElement) {
        return window.siyuan.menus.menu;
    }
    if (!liElement.classList.contains("b3-list-item--focus")) {
        fileElement.querySelectorAll(".b3-list-item--focus").forEach(item => {
            item.classList.remove("b3-list-item--focus");
            item.removeAttribute("select-end");
            item.removeAttribute("select-start");
        });
        liElement.classList.add("b3-list-item--focus");
    }
    const selectItemElements = fileElement.querySelectorAll<HTMLElement>(".b3-list-item--focus");
    if (selectItemElements.length > 1) {
        return initMultiMenu(selectItemElements, app, confirmEncryptedExport, isEncryptedBox);
    }
    window.siyuan.menus.menu.element.setAttribute("data-from", Constants.MENU_FROM_DOC_TREE_MORE_NOTEBOOK);
    const notebookId = liElement.parentElement.getAttribute("data-url");
    const name = getNotebookName(notebookId);
    const boxDocID = liElement.getAttribute("data-node-id");
    if (!isMobile && boxDocID && window.siyuan.config.fileTree.parentDocClickExpand &&
        Number(liElement.getAttribute("data-count")) > 0) {
        window.siyuan.menus.menu.append(new MenuItem({
            id: "openDocument",
            label: window.siyuan.languages.openDocument,
            icon: "iconOpen",
            click: () => {
                app.openBlock({
                    id: boxDocID,
                    action: [Constants.CB_GET_FOCUS, Constants.CB_GET_SCROLL],
                });
            }
        }).element);
    }
    if (!window.siyuan.config.readonly) {
        window.siyuan.menus.menu.append(new MenuItem({
            id: "changeIcon",
            label: window.siyuan.languages.changeIcon,
            icon: "iconEmoji",
            click: () => {
                const iconElement = liElement.querySelector<HTMLElement>(".b3-list-item__icon");
                if (!iconElement) {
                    return;
                }
                const rect = iconElement.getBoundingClientRect();
                openEmojiPanel(notebookId, "notebook", {
                    x: rect.left,
                    y: rect.bottom,
                    h: rect.height,
                    w: rect.width,
                }, undefined, iconElement.querySelector<HTMLElement>("img"));
            }
        }).element);
        window.siyuan.menus.menu.append(renameMenu({
            path: "/",
            notebookId,
            name,
            type: "notebook"
        }));
        window.siyuan.menus.menu.append(new MenuItem({
            id: "config",
            label: siyuanI18n.config,
            icon: "iconSettings",
            click: () => {
                fetchPost("/api/notebook/getNotebookConf", {
                    notebook: notebookId
                }, (data) => {
                    onGetnotebookconf(data.data);
                });
            }
        }).element);
        const subMenu = sortMenu("notebook", parseInt(liElement.parentElement.getAttribute("data-sortmode")), (sort) => {
            if (sort === null) {
                return;
            }
            fetchPost("/api/notebook/setNotebookConf", {
                notebook: notebookId,
                conf: {
                    sortMode: sort
                }
            }, (response) => {
                if (response.code !== 0) {
                    return;
                }
                liElement.parentElement.setAttribute("data-sortmode", sort.toString());
                const files = isMobile
                    ? window.siyuan.mobile?.docks?.file
                    : getDockByType("file")?.data.file;
                if (!files || typeof files !== "object" ||
                    !(isFilesDomain(files) || isMobileFilesDomain(files))) {
                    throw new Error("Notebook sorting requires an initialized file tree domain");
                }
                const notebook = window.siyuan.notebooks.find((item) => item.id === notebookId);
                if (notebook) {
                    notebook.sortMode = sort;
                }
                const toggleElement = liElement.querySelector(".b3-list-item__arrow--open");
                if (toggleElement) {
                    toggleElement.classList.remove("b3-list-item__arrow--open");
                    liElement.nextElementSibling?.remove();
                    files.getLeaf(liElement, notebookId);
                }
                files?.onDocSortModeChanged({
                    scope: "notebook",
                    box: notebookId,
                    id: "",
                    path: "/",
                    sortMode: sort,
                });
            });
            return true;
        });
        window.siyuan.menus.menu.append(new MenuItem({
            id: "sort",
            icon: "iconSort",
            label: siyuanI18n.sort,
            type: "submenu",
            submenu: subMenu,
        }).element);
    }
    if (!window.siyuan.config.readonly && !isEncryptedBox(notebookId)) {
        window.siyuan.menus.menu.append(new MenuItem({
            id: "riffCard",
            label: siyuanI18n.riffCard,
            type: "submenu",
            icon: "iconRiffCard",
            submenu: [{
                id: "spaceRepetition",
                iconHTML: "",
                label: siyuanI18n.spaceRepetition,
                accelerator: window.siyuan.config.keymap.editor.general.spaceRepetition.custom,
                click: () => {
                    fetchPost("/api/riff/getNotebookRiffDueCards", { notebook: notebookId }, (response) => {
                        openCardByData(app, response.data, "notebook", notebookId, name);
                    });
                    if (isMobile) {
                        closePanel();
                    }
                }
            }, {
                id: "manage",
                iconHTML: "",
                label: siyuanI18n.manage,
                click: () => {
                    viewCards(app, notebookId, name, "Notebook");
                    if (isMobile) {
                        closePanel();
                    }
                }
            }],
        }).element);
    }
    window.siyuan.menus.menu.append(new MenuItem({
        id: "search",
        label: siyuanI18n.search,
        accelerator: window.siyuan.config.keymap.general.search.custom,
        icon: "iconSearch",
        click() {
            if (isMobile) {
                popSearch(app, {
                    hasReplace: false,
                    hPath: getNotebookName(notebookId),
                    idPath: [notebookId],
                    page: 1,
                });
            }
            if (!isMobile) {
                openSearch({
                    app,
                    hotkey: Constants.DIALOG_SEARCH,
                    notebookId,
                });
            }
        }
    }).element);
    if (!window.siyuan.config.readonly) {
        window.siyuan.menus.menu.append(new MenuItem({
            id: "replace",
            label: siyuanI18n.replace,
            accelerator: window.siyuan.config.keymap.general.replace.custom,
            icon: "iconReplace",
            click() {
                if (isMobile) {
                    popSearch(app, {
                        hasReplace: true,
                        hPath: getNotebookName(notebookId),
                        idPath: [notebookId],
                        page: 1,
                    });
                }
                if (!isMobile) {
                    openSearch({
                        app,
                        hotkey: Constants.DIALOG_REPLACE,
                        notebookId,
                    });
                }
            }
        }).element);
    }
    if (!window.siyuan.config.readonly) {
        window.siyuan.menus.menu.append(new MenuItem({ id: "separator_1", type: "separator" }).element);
        if (!Object.values(Constants.HELP_PATH).includes(notebookId)) {
            window.siyuan.menus.menu.append(new MenuItem({
                id: "close",
                label: siyuanI18n.close,
                icon: "iconClose",
                click: () => {
                    fetchPost("/api/notebook/closeNotebook", {
                        notebook: notebookId
                    });
                }
            }).element);
        }
        window.siyuan.menus.menu.append(new MenuItem({
            id: "delete",
            icon: "iconTrashcan",
            label: siyuanI18n.delete,
            accelerator: "⌦",
            click: () => {
                deleteFiles(Array.from(fileElement.querySelectorAll(".b3-list-item--focus")));
            }
        }).element);
    }
    window.siyuan.menus.menu.append(new MenuItem({ id: "separator_2", type: "separator" }).element);
    if (isElectron) {
        window.siyuan.menus.menu.append(new MenuItem({
            id: "showInFolder",
            icon: "iconFolder",
            label: siyuanI18n.showInFolder,
            click: () => {
                useShell("openPath", originalPath().join(window.siyuan.config.system.dataDir, notebookId));
            }
        }).element);
    }
    appendFileTreeImportMenu(notebookId, "/");

    window.siyuan.menus.menu.append(new MenuItem({
        id: "export",
        label: siyuanI18n.export,
        type: "submenu",
        icon: "iconUpload",
        submenu: [{
            id: "exportSiYuanZip",
            label: "SiYuan .sy.zip",
            icon: "iconSiYuan",
            click: () => {
                confirmEncryptedExport(notebookId, () => {
                    const msgId = showMessage(siyuanI18n.exporting, -1);
                    fetchPost("/api/export/exportNotebookSY", {
                        id: notebookId,
                    }, response => {
                        saveExportFile(response.data.zip, msgId);
                    });
                });
            }
        }, {
            id: "exportMarkdown",
            label: "Markdown .zip",
            icon: "iconMarkdown",
            click: () => {
                confirmEncryptedExport(notebookId, () => exportMarkdownZip({notebook: notebookId}));
            }
        }]
    }).element);
    if (app.plugins) {
        emitOpenMenu({
            plugins: app.plugins,
            type: "open-menu-doctree",
            detail: {
                elements: selectItemElements,
                type: "notebook",
                items: [{id: notebookId, path: "/", notebookId}],
            },
            separatorPosition: "top",
        });
    }
    return window.siyuan.menus.menu;
};

export const initFileMenu = (app: AppFacade, notebookId: string, pathString: string, liElement: Element) => {
    window.siyuan.menus.menu.remove();
    window.siyuan.menus.menu.element.setAttribute("data-name", Constants.MENU_DOC_TREE_MORE);
    const fileElement = hasClosestByTag(liElement, "DIV");
    if (!fileElement) {
        return window.siyuan.menus.menu;
    }
    if (!liElement.classList.contains("b3-list-item--focus")) {
        fileElement.querySelectorAll(".b3-list-item--focus").forEach(item => {
            item.classList.remove("b3-list-item--focus");
            item.removeAttribute("select-end");
            item.removeAttribute("select-start");
        });
        liElement.classList.add("b3-list-item--focus");
    }
    const selectItemElements = fileElement.querySelectorAll<HTMLElement>(".b3-list-item--focus");
    if (selectItemElements.length > 1) {
        return initMultiMenu(selectItemElements, app, confirmEncryptedExport, isEncryptedBox);
    }
    const id = liElement.getAttribute("data-node-id");
    let name = liElement.getAttribute("data-name");
    name = getDisplayName(name, false, true);
    if (isMobile) {
        window.siyuan.menus.menu.append(new MenuItem({
            id: "openInNewTab",
            label: siyuanI18n.openInNewTab,
            icon: "iconAdd",
            click: () => {
                openMobileFileByIdInNewTabViaPort(app, id, [Constants.CB_GET_SCROLL], undefined, notebookId);
            }
        }).element);
        window.siyuan.menus.menu.append(new MenuItem({id: "separator_open", type: "separator"}).element);
    }
    if (!isMobile && window.siyuan.config.fileTree.parentDocClickExpand && Number(liElement.getAttribute("data-count")) > 0) {
        window.siyuan.menus.menu.append(new MenuItem({
            id: "openDocument",
            label: window.siyuan.languages.openDocument,
            icon: "iconOpen",
            click: () => {
                app.openBlock({
                    id,
                    action: [Constants.CB_GET_FOCUS, Constants.CB_GET_SCROLL],
                });
            }
        }).element);
    }
    if (!window.siyuan.config.readonly) {
        if (isCustomFileTreeList(liElement.parentElement)) {
            window.siyuan.menus.menu.append(new MenuItem({
                id: "newDocAbove",
                icon: "iconBefore",
                label: siyuanI18n.newDocAbove,
                click: () => {
                    const paths: string[] = [];
                    Array.from(liElement.parentElement.children).forEach((item) => {
                        if (item.tagName === "LI") {
                            if (item === liElement) {
                                paths.push(undefined);
                            }
                            paths.push(item.getAttribute("data-path"));
                        }
                    });
                    void app.createDocumentInTree(notebookId, pathPosix().dirname(pathString), paths);
                }
            }).element);
            window.siyuan.menus.menu.append(new MenuItem({
                id: "newDocBelow",
                icon: "iconAfter",
                label: siyuanI18n.newDocBelow,
                click: () => {
                    const paths: string[] = [];
                    Array.from(liElement.parentElement.children).forEach((item) => {
                        if (item.tagName === "LI") {
                            paths.push(item.getAttribute("data-path"));
                            if (item === liElement) {
                                paths.push(undefined);
                            }
                        }
                    });
                    void app.createDocumentInTree(notebookId, pathPosix().dirname(pathString), paths);
                }
            }).element);
            window.siyuan.menus.menu.append(new MenuItem({ id: "separator_1", type: "separator" }).element);
        }
        window.siyuan.menus.menu.append(new MenuItem({
            id: "copy",
            label: siyuanI18n.copy,
            type: "submenu",
            icon: "iconCopy",
            submenu: copySubMenu([id]).concat([{
                id: "duplicate",
                iconHTML: "",
                label: siyuanI18n.duplicate,
                accelerator: window.siyuan.config.keymap.editor.general.duplicate.custom,
                click() {
                    fetchPost("/api/filetree/duplicateDoc", {
                        id
                    });
                }
            }])
        }).element);
        const selectedItems = Array.from(fileElement.querySelectorAll(".b3-list-item--focus"));
        window.siyuan.menus.menu.append(movePathToMenu(getTopPaths(selectedItems), selectedItems.map((item) =>
            item.closest("ul[data-url]")?.getAttribute("data-url") || "")));
        window.siyuan.menus.menu.append(new MenuItem({
            id: "addToDatabase",
            label: siyuanI18n.addToDatabase,
            accelerator: window.siyuan.config.keymap.general.addToDatabase.custom,
            icon: "iconDatabase",
            click: () => {
                addFilesToDatabase([liElement]);
            }
        }).element);
        window.siyuan.menus.menu.append(new MenuItem({
            id: "delete",
            icon: "iconTrashcan",
            label: siyuanI18n.delete,
            accelerator: "⌦",
            click: () => {
                deleteFiles(Array.from(fileElement.querySelectorAll(".b3-list-item--focus")));
            }
        }).element);
        window.siyuan.menus.menu.append(new MenuItem({ id: "separator_2", type: "separator" }).element);
        window.siyuan.menus.menu.append(renameMenu({
            path: pathString,
            notebookId,
            name,
            type: "file",
            docId: id,
        }));
        window.siyuan.menus.menu.append(new MenuItem({
            id: "attr",
            label: siyuanI18n.attr,
            icon: "iconAttr",
            click() {
                const docInfoParam: IObject = {
                    id
                };
                if (isEncryptedBox(notebookId)) {
                    docInfoParam.notebook = notebookId;
                }
                fetchPost("/api/block/getDocInfo", docInfoParam, (response) => {
                    openFileAttr(response.data.ial);
                });
            }
        }).element);
        const configuredSortMode = getConfiguredChildrenSortMode(liElement);
        const sortSubMenu = sortMenu("document", configuredSortMode, (sortMode) => {
            fetchPost("/api/filetree/setDocSortMode", {
                id,
                sortMode,
            }, (response) => {
                if (response.code !== 0) {
                    return;
                }
                liElement.setAttribute(FILE_TREE_CHILDREN_SORT_MODE, sortMode?.toString() || "");
                const files = isMobile
                    ? window.siyuan.mobile?.docks?.file
                    : getDockByType("file")?.data.file;
                files?.onDocSortModeChanged({
                    scope: "document",
                    box: notebookId,
                    id,
                    path: pathString,
                    sortMode,
                });
            });
        });
        window.siyuan.menus.menu.append(new MenuItem({
            id: "sort",
            icon: "iconSort",
            label: window.siyuan.languages.sort,
            type: "submenu",
            submenu: sortSubMenu,
        }).element);
        if (!window.siyuan.config.readonly && !isEncryptedBox(notebookId)) {
            const riffCardMenu = [{
                id: "spaceRepetition",
                iconHTML: "",
                label: siyuanI18n.spaceRepetition,
                accelerator: window.siyuan.config.keymap.editor.general.spaceRepetition.custom,
                click: () => {
                    fetchPost("/api/riff/getTreeRiffDueCards", { rootID: id }, (response) => {
                        openCardByData(app, response.data, "doc", id, name);
                    });
                    if (isMobile) {
                        closePanel();
                    }
                }
            }, {
                id: "manage",
                iconHTML: "",
                label: siyuanI18n.manage,
                click: () => {
                    fetchPost("/api/filetree/getHPathByID", {
                        id
                    }, (response) => {
                        viewCards(app, id, pathPosix().join(getNotebookName(notebookId), response.data), "Tree");
                    });
                    if (isMobile) {
                        closePanel();
                    }
                }
            }, {
                id: "quickMakeCard",
                iconHTML: "",
                accelerator: window.siyuan.config.keymap.editor.general.quickMakeCard.custom,
                label: siyuanI18n.quickMakeCard,
                click: () => {
                    transaction(undefined, [{
                        action: "addFlashcards",
                        deckID: Constants.QUICK_DECK_ID,
                        blockIDs: [id]
                    }], [{
                        action: "removeFlashcards",
                        deckID: Constants.QUICK_DECK_ID,
                        blockIDs: [id]
                    }]);
                }
            }, {
                id: "removeCard",
                iconHTML: "",
                label: siyuanI18n.removeCard,
                click: () => {
                    transaction(undefined, [{
                        action: "removeFlashcards",
                        deckID: Constants.QUICK_DECK_ID,
                        blockIDs: [id]
                    }], [{
                        action: "addFlashcards",
                        deckID: Constants.QUICK_DECK_ID,
                        blockIDs: [id]
                    }]);
                }
            }];
            if (window.siyuan.config.flashcard.deck) {
                riffCardMenu.push({
                    id: "addToDeck",
                    iconHTML: "",
                    label: siyuanI18n.addToDeck,
                    click: () => {
                        makeCard(app, [id]);
                    }
                });
            }
            window.siyuan.menus.menu.append(new MenuItem({
                id: "riffCard",
                label: siyuanI18n.riffCard,
                type: "submenu",
                icon: "iconRiffCard",
                submenu: riffCardMenu,
            }).element);
        }
        window.siyuan.menus.menu.append(new MenuItem({
            id: "search",
            label: siyuanI18n.search,
            icon: "iconSearch",
            accelerator: window.siyuan.config.keymap.general.search.custom,
            async click() {
                const searchPath = getDisplayName(pathString, false, true);
                if (isMobile) {
                    const response = await fetchSyncPost("/api/filetree/getHPathByPath", {
                        notebook: notebookId,
                        path: searchPath + ".sy"
                    });
                    if (response.code !== 0 || typeof response.data !== "string") {
                        return;
                    }
                    popSearch(app, {
                        hasReplace: false,
                        hPath: pathPosix().join(getNotebookName(notebookId), response.data),
                        idPath: [pathPosix().join(notebookId, searchPath)],
                        page: 1,
                    });
                }
                if (!isMobile) {
                    openSearch({
                        app,
                        hotkey: Constants.DIALOG_SEARCH,
                        notebookId,
                        searchPath
                    });
                }
            }
        }).element);
        window.siyuan.menus.menu.append(new MenuItem({
            id: "replace",
            label: siyuanI18n.replace,
            accelerator: window.siyuan.config.keymap.general.replace.custom,
            icon: "iconReplace",
            async click() {
                const searchPath = getDisplayName(pathString, false, true);
                if (isMobile) {
                    const response = await fetchSyncPost("/api/filetree/getHPathByPath", {
                        notebook: notebookId,
                        path: searchPath + ".sy"
                    });
                    if (response.code !== 0 || typeof response.data !== "string") {
                        return;
                    }
                    popSearch(app, {
                        hasReplace: true,
                        hPath: pathPosix().join(getNotebookName(notebookId), response.data),
                        idPath: [pathPosix().join(notebookId, searchPath)],
                        page: 1,
                    });
                }
                if (!isMobile) {
                    openSearch({
                        app,
                        hotkey: Constants.DIALOG_REPLACE,
                        notebookId,
                        searchPath
                    });
                }
            }
        }).element);
        window.siyuan.menus.menu.append(new MenuItem({ id: "separator_3", type: "separator" }).element);
    }
    openEditorTab(app, [id], notebookId, pathString);
    if (!window.siyuan.config.readonly) {
        window.siyuan.menus.menu.append(new MenuItem({
            id: "fileHistory",
            label: siyuanI18n.fileHistory,
            icon: "iconHistory",
            click() {
                openDocHistory({ app, id, notebookId, pathString: name });
            }
        }).element);
    }
    // 笔记内插件菜单项 - 使用应用装配的完整管理器领域根
    (async () => {
        const 已注册 = app.inNotePluginManager.是否已启用(id);
        window.siyuan.menus.menu.append(new MenuItem({
            id: "inNotePlugin",
            label: 已注册 ? "更新插件" : "注册为笔记内插件",
            icon: "iconPlugin",
            click: async () => {
                await app.inNotePluginManager.设置为插件文档(id);
                // 已注册时重载,未注册时启用
                const [动作, 成功消息, 失败消息] = 已注册
                    ? [() => app.inNotePluginManager.重载插件(id), "已重载", "重载失败"]
                    : [() => app.inNotePluginManager.启用插件(id, name), "已启用", "启用失败"];
                const success = await 动作();
                const msg = success ? 成功消息 : 失败消息;
                showMessage(`笔记内插件 [${name}] ${msg}`, success ? undefined : 3000, success ? undefined : "error");
            }
        }).element);
    })();
    // CronJob 菜单项 - 动态导入并检查注册状态
    (async () => {
        const { fetchSyncPost } = await import("../util/network/fetch");
        const taskRes = await fetchSyncPost("/api/cronjob/get", { docId: id });
        const 已注册 = taskRes.code === 0 && taskRes.data != null;
        window.siyuan.menus.menu.append(new MenuItem({
            id: "cronjob",
            label: "定时任务",
            icon: "iconHistory",
            type: "submenu",
            submenu: [{
                id: "registerAsCronjob",
                label: 已注册 ? "更新 Go 定时任务" : "注册为 Go 定时任务",
                click: async () => {
                    const { 注册扩展 } = await import("../util/network/cronjobApi");
                    const success = await 注册扩展(id, "go", "cronjob");
                    if (!success) {
                        return;
                    }
                    showMessage(已注册 ? "任务已更新" : "已注册为定时任务");
                    const dock = getDockByType("cronjob");
                    if (dock) {
                        dock.toggleModel("cronjob", true);
                    }
                }
            }, {
                id: "compileCronjob",
                label: "预览编译结果",
                click: async () => {
                    const { 编译文档 } = await import("../util/network/cronjobApi");
                    const result = await 编译文档(id, "go");
                    if (result) {
                        const { Dialog } = await import("../dialog");
                        new Dialog({
                            title: "编译结果预览",
                            content: `<div class="b3-dialog__content">
                                <pre style="max-height: 60vh; overflow: auto; background: var(--b3-theme-background); padding: 16px; border-radius: 4px;"><code>${result.code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>
                                <div style="margin-top: 8px; color: var(--b3-theme-on-surface-light);">输出路径: ${result.output}</div>
                            </div>`,
                            width: "800px"
                        });
                    }
                }
            }]
        }).element);
    })();
    appendFileTreeImportMenu(notebookId, pathString);
    window.siyuan.menus.menu.append(exportMd(id));
    if (app.plugins) {
        emitOpenMenu({
            plugins: app.plugins,
            type: "open-menu-doctree",
            detail: {
                elements: selectItemElements,
                type: "doc",
                items: [{id, path: pathString, notebookId}],
            },
            separatorPosition: "top",
        });
    }
    window.siyuan.menus.menu.element.setAttribute("data-from", Constants.MENU_FROM_DOC_TREE_MORE_DOC);
    return window.siyuan.menus.menu;
};
