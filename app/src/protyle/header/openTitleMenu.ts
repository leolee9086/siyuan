import { fetchPost, fetchSyncPost } from "../../util/network/fetch";
import { MenuItem } from "../../menus/Menu.Item";
import { exportMd, } from "../../menus/commonMenuItem";
import { openFileWechatNotify } from "../../menus/commonMenuItem/openFileWechatNotify";
import { openFileAttr } from "../../menus/commonMenuItem/openFileAttr";
import { updateHotkeyTip } from "../util/compatibility";
import { isMobile, isElectron } from "../../platform";
import { openBacklink, openGraph, openOutline } from "../../layout/dock/util";
import * as path from "path";
import { openMobileFileById } from "../../mobile/editor";
import { Constants } from "../../constants";
import { openCardByData } from "../../card/openCard";
import { viewCards } from "../../card/viewCards";
import { getDisplayName, getNotebookName, pathPosix, useShell } from "../../util/file/pathName";
import { makeCard, quickMakeCard } from "../../card/makeCard";
import { emitOpenMenu } from "../../plugin/EventBus";
import * as dayjs from "dayjs";
import { hideTooltip } from "../runtime/dialog.port";
import { popSearch } from "../../mobile/menu/search";
import { openSearch } from "../../search/spread";
import { openNewWindowById } from "../../window/openNewWindow";
import { openFileById } from "../../editor/utils.openFileById";
import { createProtyleCopyMenu, createFileHistoryMenuItem, createCronjobMenuItem, createInNotePluginMenuItem } from "./openTitleMenu.items";
import { closeTitleMenuIfOpened } from "./openTitleMenu.util";
import { transferBlockRef } from "../../menus/block";
import { appendFileOperationsMenuItemGroup } from "./openTitleMenu.FileOperations";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import {isEncryptedBox, withEncryptedNotebook} from "../../util/pathName";
const appendDesktopOnlyMenuItemGroup = (protyle: IProtyle) => {
    if (isMobile) {
        return;
    }
    window.siyuan.menus.menu.append(new MenuItem({ id: "separator_1", type: "separator" }).element);
    window.siyuan.menus.menu.append(new MenuItem({
        id: "outline",
        icon: "iconAlignCenter",
        label: siyuanI18n.outline,
        accelerator: getSiyuanConfig().keymap.editor.general.outline.custom,
        click: () => {
            openOutline(
                {
                    app: protyle.app,
                    rootId: protyle.block.rootID,
                    title: protyle.options.render.title ? (protyle.title.editElement.textContent || siyuanI18n.untitled) : "",
                    isPreview: false
                }
            );
        }
    }).element);
    window.siyuan.menus.menu.append(new MenuItem({
        id: "backlinks",
        icon: "iconLink",
        label: siyuanI18n.backlinks,
        accelerator: window.siyuan.config.keymap.editor.general.backlinks.custom,
        click: () => {
            openBacklink({
                app: protyle.app,
                blockId: protyle.block.id,
                rootId: protyle.block.rootID,
                useBlockId: protyle.block.showAll,
                title: protyle.title ? (protyle.title.editElement.textContent || siyuanI18n.untitled) : null
            });
        }
    }).element);
    window.siyuan.menus.menu.append(new MenuItem({
        id: "graphView",
        icon: "iconGraph",
        label: siyuanI18n.graphView,
        accelerator: window.siyuan.config.keymap.editor.general.graphView.custom,
        click: () => {
            openGraph({
                app: protyle.app,
                blockId: protyle.block.id,
                rootId: protyle.block.rootID,
                useBlockId: protyle.block.showAll,
                title: protyle.title ? (protyle.title.editElement.textContent || siyuanI18n.untitled) : null
            });
        }
    }).element);
};


export const openTitleMenu = (protyle: IProtyle, position: IPosition) => {
    hideTooltip();
    if (closeTitleMenuIfOpened()) {
        return;
    }
    fetchPost("/api/block/getDocInfo", withEncryptedNotebook(protyle.notebookId, {
        id: protyle.block.rootID
    }), async (response) => {
        window.siyuan.menus.menu.remove();
        window.siyuan.menus.menu.element.setAttribute("data-name", "titleMenu");
        const isBoxDoc = protyle.notebookId === protyle.block.rootID;
        window.siyuan.menus.menu.append(createProtyleCopyMenu(protyle).element);
        if (!protyle.disabled) {
            appendFileOperationsMenuItemGroup(protyle, isBoxDoc);
        }
        appendDesktopOnlyMenuItemGroup(protyle);
        // 定时任务菜单（仅非只读模式）
        // 通过后端 API 检查是否已注册为 cronjob
        if (!window.siyuan.config.readonly) {
            const taskRes = await fetchSyncPost("/api/cronjob/get", { docId: protyle.block.rootID });
            const isRegistered = taskRes.code === 0 && taskRes.data != null;
            window.siyuan.menus.menu.append(createCronjobMenuItem(protyle, isRegistered).element);
        }
        // 笔记内插件菜单（仅非只读模式）
        if (!window.siyuan.config.readonly) {
            const { inNotePluginManager } = await import("../../inNotePlugin");
            const isPluginRegistered = inNotePluginManager.是否已启用(protyle.block.rootID);
            window.siyuan.menus.menu.append(createInNotePluginMenuItem(protyle, isPluginRegistered).element);
        }
        window.siyuan.menus.menu.append(new MenuItem({ id: "separator_2", type: "separator" }).element);
        window.siyuan.menus.menu.append(new MenuItem({
            id: "attr",
            label: siyuanI18n.attr,
            icon: "iconAttr",
            accelerator: window.siyuan.config.keymap.editor.general.attr.custom + "/" + updateHotkeyTip("⇧" + siyuanI18n.click),
            click() {
                openFileAttr(response.data.ial, "bookmark", protyle);
            }
        }).element);
        if (!window.siyuan.config.readonly) {
            if (window.siyuan.config.cloudRegion === 0) {
                window.siyuan.menus.menu.append(new MenuItem({
                    id: "wechatReminder",
                    label: siyuanI18n.wechatReminder,
                    icon: "iconMp",
                    click() {
                        openFileWechatNotify(protyle);
                    }
                }).element);
            }
            const isCardMade = !!response.data.ial[Constants.CUSTOM_RIFF_DECKS];
            if (!isEncryptedBox(protyle.notebookId)) {
            const riffCardMenu: IMenu[] = [{
                id: "spaceRepetition",
                iconHTML: "",
                label: siyuanI18n.spaceRepetition,
                accelerator: window.siyuan.config.keymap.editor.general.spaceRepetition.custom,
                click: () => {
                    fetchPost("/api/riff/getTreeRiffDueCards", { rootID: protyle.block.rootID }, (response) => {
                        openCardByData(protyle.app, response.data, "doc", protyle.block.rootID, response.data.name);
                    });
                }
            }, {
                id: "manage",
                iconHTML: "",
                label: siyuanI18n.manage,
                click: () => {
                    fetchPost("/api/filetree/getHPathByID", {
                        id: protyle.block.rootID
                    }, (response) => {
                        viewCards(protyle.app, protyle.block.rootID, pathPosix().join(getNotebookName(protyle.notebookId), (response.data)), "Tree");
                    });
                }
            }, {
                id: isCardMade ? "removeCard" : "quickMakeCard",
                iconHTML: "",
                label: isCardMade ? siyuanI18n.removeCard : siyuanI18n.quickMakeCard,
                accelerator: window.siyuan.config.keymap.editor.general.quickMakeCard.custom,
                click: () => {
                    let titleElement = protyle.title?.element;
                    if (!titleElement) {
                        titleElement = document.createElement("div");
                        titleElement.setAttribute("data-node-id", protyle.block.rootID);
                        titleElement.setAttribute(Constants.CUSTOM_RIFF_DECKS, response.data.ial[Constants.CUSTOM_RIFF_DECKS]);
                    }
                    quickMakeCard(protyle, [titleElement]);
                }
            }];
            if (window.siyuan.config.flashcard.deck) {
                riffCardMenu.push({
                    id: "addToDeck",
                    iconHTML: "",
                    label: siyuanI18n.addToDeck,
                    click: () => {
                        makeCard(protyle.app, [protyle.block.rootID]);
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
        }
        window.siyuan.menus.menu.append(new MenuItem({
            id: "search",
            label: siyuanI18n.search,
            icon: "iconSearch",
            accelerator: window.siyuan.config.keymap.general.search.custom,
            async click() {
                const searchPath = isBoxDoc ? "" : getDisplayName(protyle.path, false, true);
                if (isMobile) {
                    const pathResponse = isBoxDoc ? undefined : await fetchSyncPost("/api/filetree/getHPathByPath", {
                        notebook: protyle.notebookId,
                        path: searchPath + ".sy"
                    });
                    popSearch(protyle.app, {
                        hasReplace: false,
                        hPath: isBoxDoc ? getNotebookName(protyle.notebookId) : pathPosix().join(getNotebookName(protyle.notebookId), pathResponse.data),
                        idPath: [isBoxDoc ? protyle.notebookId : pathPosix().join(protyle.notebookId, searchPath)],
                        page: 1,
                    });
                }
                if (!isMobile) {
                    openSearch({
                        app: protyle.app,
                        hotkey: Constants.DIALOG_SEARCH,
                        notebookId: protyle.notebookId,
                        searchPath
                    });
                }
            }
        }).element);
        if (!protyle.disabled) {
            transferBlockRef(protyle.block.rootID);;
        }
        window.siyuan.menus.menu.append(new MenuItem({ id: "separator_3", type: "separator" }).element);
        if (!protyle.model) {
            window.siyuan.menus.menu.append(new MenuItem({
                id: "openBy",
                label: siyuanI18n.openBy,
                icon: "iconOpen",
                click() {
                    if (!isMobile) {
                        openFileById({
                            app: protyle.app,
                            id: protyle.block.id,
                            action: protyle.block.rootID !== protyle.block.id ? [Constants.CB_GET_ALL, Constants.CB_GET_FOCUS] : [Constants.CB_GET_CONTEXT],
                        });
                    }
                    if (isMobile) {
                        openMobileFileById(protyle.app, protyle.block.id, protyle.block.rootID !== protyle.block.id ? [Constants.CB_GET_ALL] : [Constants.CB_GET_CONTEXT]);
                    }
                }
            }).element);
        }
        if (isElectron) {
            window.siyuan.menus.menu.append(new MenuItem({
                id: "openByNewWindow",
                label: siyuanI18n.openByNewWindow,
                icon: "iconOpenWindow",
                click() {
                    openNewWindowById(protyle.block.rootID);
                }
            }).element);
            window.siyuan.menus.menu.append(new MenuItem({
                id: "showInFolder",
                icon: "iconFolder",
                label: siyuanI18n.showInFolder,
                click: () => {
                    useShell("showItemInFolder", path.join(window.siyuan.config.system.dataDir, protyle.notebookId, protyle.path));
                }
            }).element);
        }
        if (!protyle.disabled) {
            window.siyuan.menus.menu.append(createFileHistoryMenuItem(protyle, response).element);
        }
        window.siyuan.menus.menu.append(exportMd(protyle.block.showAll ? protyle.block.id : protyle.block.rootID));

        window.siyuan.menus.menu.append(new MenuItem({ id: "separator_4", type: "separator" }).element);
        if (protyle?.app?.plugins) {
            emitOpenMenu({
                plugins: protyle.app.plugins,
                type: "click-editortitleicon",
                detail: {
                    protyle,
                    data: response.data,
                },
                separatorPosition: "bottom",
            });
        }
        window.siyuan.menus.menu.append(new MenuItem({
            id: "updateAndCreatedAt",
            iconHTML: "",
            type: "readonly",
            // 不能换行，否则移动端间距过大
            label: `${siyuanI18n.modifiedAt} ${dayjs(response.data.ial.updated).format("YYYY-MM-DD HH:mm:ss")}<br>${siyuanI18n.createdAt} ${dayjs(response.data.ial.id.substr(0, 14)).format("YYYY-MM-DD HH:mm:ss")}`
        }).element);
        if (isMobile) {
            window.siyuan.menus.menu.fullscreen();
        }
        if (!isMobile) {
            window.siyuan.menus.menu.popup(position);
        }
    });
};
