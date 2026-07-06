import { App } from "..";
import { makeCard } from "../card/makeCard";
import { Constants } from "../constants";
import { showMessage } from "../dialog/message";
import { deleteFiles } from "../editor/deleteFile";
import { emitOpenMenu } from "../plugin/EventBus";
import { addFilesToDatabase } from "../protyle/render/av/addToDatabase";
import { exportMarkdownZip } from "../protyle/export/exportMd";
import { saveExportFile } from "../protyle/util/compatibility";
import { transaction } from "../protyle/wysiwyg/transaction";
import { fetchPost } from "../util/network/fetch";
import { getTopPaths } from "../util/file/pathName";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import { movePathToMenu } from "./commonMenuItem";
import { copySubMenu } from "./commonMenuItem/copy";
import { MenuItem } from "./Menu.Item";
import { openEditorTab } from "./util";

export const initMultiMenu = (selectItemElements: NodeListOf<Element>, app: App) => {
    window.siyuan.menus.menu.element.setAttribute("data-from", Constants.MENU_FROM_DOC_TREE_MORE_ITEMS);
    const fileItemElement = Array.from(selectItemElements).find(item => {
        if (item.getAttribute("data-type") === "navigation-file") {
            return true;
        }
    });
    if (!fileItemElement) {
        return window.siyuan.menus.menu;
    }
    const blockIDs: string[] = [];
    selectItemElements.forEach(item => {
        const id = item.getAttribute("data-node-id");
        if (id) {
            blockIDs.push(id);
        }
    });

    if (blockIDs.length > 0) {
        window.siyuan.menus.menu.append(new MenuItem({
            id: "copy",
            label: siyuanI18n.copy,
            type: "submenu",
            icon: "iconCopy",
            submenu: copySubMenu(blockIDs).concat([{
                id: "duplicate",
                iconHTML: "",
                label: siyuanI18n.duplicate,
                accelerator: window.siyuan.config.keymap.editor.general.duplicate.custom,
                click() {
                    blockIDs.forEach((id) => {
                        fetchPost("/api/filetree/duplicateDoc", {
                            id
                        });
                    });
                }
            }])
        }).element);
    }

    window.siyuan.menus.menu.append(movePathToMenu(getTopPaths(
        Array.from(selectItemElements)
    )));

    if (blockIDs.length > 0) {
        window.siyuan.menus.menu.append(new MenuItem({
            id: "addToDatabase",
            label: siyuanI18n.addToDatabase,
            accelerator: window.siyuan.config.keymap.general.addToDatabase.custom,
            icon: "iconDatabase",
            click: () => {
                addFilesToDatabase(Array.from(selectItemElements));
            }
        }).element);
    }
    window.siyuan.menus.menu.append(new MenuItem({
        id: "delete",
        icon: "iconTrashcan",
        label: siyuanI18n.delete,
        accelerator: "⌦",
        click: () => {
            deleteFiles(Array.from(selectItemElements));
        }
    }).element);

    if (blockIDs.length === 0) {
        return window.siyuan.menus.menu;
    }
    window.siyuan.menus.menu.append(new MenuItem({ id: "separator_1", type: "separator" }).element);
    if (!window.siyuan.config.readonly) {
        const riffCardMenu = [{
            id: "quickMakeCard",
            iconHTML: "",
            accelerator: window.siyuan.config.keymap.editor.general.quickMakeCard.custom,
            label: siyuanI18n.quickMakeCard,
            click: () => {
                transaction(undefined, [{
                    action: "addFlashcards",
                    deckID: Constants.QUICK_DECK_ID,
                    blockIDs,
                }], [{
                    action: "removeFlashcards",
                    deckID: Constants.QUICK_DECK_ID,
                    blockIDs,
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
                    blockIDs,
                }], [{
                    action: "addFlashcards",
                    deckID: Constants.QUICK_DECK_ID,
                    blockIDs,
                }]);
            }
        }];
        if (window.siyuan.config.flashcard.deck) {
            riffCardMenu.push({
                id: "addToDeck",
                iconHTML: "",
                label: siyuanI18n.addToDeck,
                click: () => {
                    makeCard(app, blockIDs);
                }
            });
        }
        window.siyuan.menus.menu.append(new MenuItem({
            id: "riffCard",
            label: siyuanI18n.riffCard,
            icon: "iconRiffCard",
            submenu: riffCardMenu,
        }).element);
        window.siyuan.menus.menu.append(new MenuItem({ id: "separator_2", type: "separator" }).element);
    }
    openEditorTab(app, blockIDs);
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
                const msgId = showMessage(window.siyuan.languages.exporting, -1);
                fetchPost("/api/export/exportSYs", {
                    ids: blockIDs,
                }, response => {
                    saveExportFile(response.data.zip, msgId);
                });
            }
        }, {
            id: "exportMarkdown",
            label: "Markdown .zip",
            icon: "iconMarkdown",
            click: () => {
                exportMarkdownZip({ids: blockIDs});
            }
        }]
    }).element);
    if (app.plugins) {
        emitOpenMenu({
            plugins: app.plugins,
            type: "open-menu-doctree",
            detail: {
                elements: selectItemElements,
                type: "docs"
            },
            separatorPosition: "top",
        });
    }
    return window.siyuan.menus.menu;
};
