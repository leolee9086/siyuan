import {Dialog} from "../../../dialog";
import type { AppFacade } from "../../../app/AppFacade.types";
import {upDownHint} from "../../../util/DOM/upDownHint";
import {updateHotkeyTip} from "../../../protyle/util/compatibility";
import {isMobile} from "../../../util/platform/functions";
import {Constants} from "../../../constants";
import {Editor} from "../../../editor";
import {getCurrentEditor} from "../../../mobile/util/getCurrentEditor";
import {popSearch} from "../../../mobile/menu/search";
import {getActiveTab, getDockByType} from "../../../layout/tabUtil";
import {isCustomDomain} from "../../../layout/dock/custom/custom.types";
import {getAllModels} from "../../../layout/getAll";
import {Files} from "../../../layout/dock/Files";
import {Search} from "../../../search";
import {openSearch} from "../../../search/spread";
import {isElectron} from "../../../platform";
import {addEditorToDatabase, addFilesToDatabase} from "../../../protyle/render/av/addToDatabase";
import {hasClosestBlock, hasClosestByClassName, hasTopClosestByTag} from "../../../protyle/util/hasClosest";
import {onlyProtyleCommand} from "./protyle";
import {globalCommand} from "./global";
import {getDisplayName, getNotebookName, getTopPaths, moveToPath, pathPosix} from "../../../util/file/pathName";
import {movePathTo} from "../../../util/file/movePath/movePathTo";
import {hintMoveBlock} from "../../../protyle/hint/extend";
import {fetchSyncPost} from "../../../util/network/fetch";
import {focusByRange} from "../../../protyle/util/selection";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import {matchHotKey} from "../../../protyle/util/hotKey";

export const commandPanel = (app: AppFacade) => {
    const range = getSelection().rangeCount > 0 ? getSelection().getRangeAt(0) : undefined;
    const dialog = new Dialog({
        width: isMobile() ? "92vw" : "80vw",
        height: isMobile() ? "80vh" : "70vh",
        title: siyuanI18n.commandPanel,
        content: `<div class="fn__flex-column">
    <div class="b3-form__icon search__header" style="border-top: 0;border-bottom: 1px solid var(--b3-theme-surface-lighter);">
        <svg class="b3-form__icon-icon"><use xlink:href="#iconSearch"></use></svg>
        <input class="b3-text-field b3-text-field--text" style="padding-left: 32px !important;">
    </div>
    <ul class="b3-list b3-list--background search__list" id="commands"></ul>
    <div class="search__tip">
        <kbd>↑/↓</kbd> ${siyuanI18n.searchTip1}
        <kbd>${siyuanI18n.enterKey}/${siyuanI18n.click}</kbd> ${siyuanI18n.confirm}
        <kbd>Esc</kbd> ${siyuanI18n.close}
    </div>
</div>`,
        destroyCallback() {
            if (range) {
                focusByRange(range);
            }
        },
    });
    dialog.element.setAttribute("data-key", Constants.DIALOG_COMMANDPANEL);
    const listElement = dialog.element.querySelector("#commands");
    let html = "";
    Object.keys(window.siyuan.config.keymap.general).forEach((key) => {
        let keys;
        keys = ["addToDatabase", "fileTree", "outline", "bookmark", "tag", "dailyNote", "inbox", "backlinks",
            "graphView", "globalGraph", "closeAll", "closeLeft", "closeOthers", "closeRight", "closeTab",
            "closeUnmodified", "config", "dataHistory", "editReadonly", "enter", "enterBack", "globalSearch", "goBack",
            "goForward", "goToEditTabNext", "goToEditTabPrev", "goToTab1", "goToTab2", "goToTab3", "goToTab4",
            "goToTab5", "goToTab6", "goToTab7", "goToTab8", "goToTab9", "goToTabNext", "goToTabPrev", "lockScreen",
            "mainMenu", "move", "newFile", "recentDocs", "replace", "riffCard", "search", "selectOpen1", "syncNow",
            "splitLR", "splitMoveB", "splitMoveR", "splitTB", "switchLeftDock", "switchRightDock", "switchBottomDock",
            "tabToWindow", "stickSearch", "toggleDock", "unsplitAll", "unsplit", "recentClosed"];
        if (isElectron) {
            keys.push("toggleWin");
        }
        if (isMobile()) {
            keys = ["addToDatabase", "fileTree", "outline", "bookmark", "tag", "dailyNote", "inbox", "backlinks",
                "dataHistory", "editReadonly", "enter", "enterBack", "globalSearch", "lockScreen", "mainMenu", "move",
                "newFile", "recentDocs", "replace", "riffCard", "search", "selectOpen1", "syncNow"];
        }
        if (keys.includes(key)) {
            html += `<li class="b3-list-item" data-command="${key}">
    <span class="b3-list-item__text">${siyuanI18n[key]}</span>
    <span class="b3-list-item__meta${isMobile() ? " fn__none" : ""}">${updateHotkeyTip(window.siyuan.config.keymap.general[key].custom)}</span>
</li>`;
        }
    });
    Object.keys(window.siyuan.config.keymap.editor.general).forEach((key) => {
        if (["switchReadonly", "switchAdjust"].includes(key)) {
            html += `<li class="b3-list-item" data-command="${key}">
    <span class="b3-list-item__text">${siyuanI18n[key]}</span>
    <span class="b3-list-item__meta${isMobile() ? " fn__none" : ""}">${updateHotkeyTip(window.siyuan.config.keymap.editor.general[key].custom)}</span>
</li>`;
        }
    });
    listElement.insertAdjacentHTML("beforeend", html);
    app.plugins.forEach(plugin => {
        plugin.commands.forEach(command => {
            const liElement = document.createElement("li");
            liElement.classList.add("b3-list-item");
            liElement.innerHTML = `<span class="b3-list-item__text">${plugin.displayName}: ${command.langText || plugin.i18n[command.langKey]}</span>
<span class="b3-list-item__meta${isMobile() ? " fn__none" : ""}">${updateHotkeyTip(command.customHotkey)}</span>`;
            liElement.addEventListener("click", (event) => {
                if (command.callback) {
                    command.callback();
                } else if (command.globalCallback) {
                    command.globalCallback();
                }
                dialog.destroy();
                event.preventDefault();
                event.stopPropagation();
            });
            listElement.insertAdjacentElement("beforeend", liElement);
        });
    });

    if (listElement.childElementCount === 0) {
        const liElement = document.createElement("li");
        liElement.classList.add("b3-list-item", "b3-list-item--focus");
        liElement.innerHTML = `<span class="b3-list-item__text" style="-webkit-line-clamp: inherit;">${siyuanI18n._kernel[122]}</span>`;
        liElement.addEventListener("click", () => {
            dialog.destroy();
        });
        listElement.insertAdjacentElement("beforeend", liElement);
    } else {
        listElement.firstElementChild.classList.add("b3-list-item--focus");
    }

    const inputElement = dialog.element.querySelector(".b3-text-field") as HTMLInputElement;
    inputElement.focus();
    listElement.addEventListener("click", (event: KeyboardEvent) => {
        const liElement = hasClosestByClassName(event.target as HTMLElement, "b3-list-item");
        if (liElement) {
            const command = liElement.getAttribute("data-command");
            if (command) {
                execByCommand({command, app, previousRange: range});
                dialog.destroy();
                event.preventDefault();
                event.stopPropagation();
            }
        }
    });
    inputElement.addEventListener("keydown", (event: KeyboardEvent) => {
        event.stopPropagation();
        if (event.isComposing) {
            return;
        }
        if (!event.repeat && matchHotKey(window.siyuan.config.keymap.general.commandPanel.custom, event)) {
            dialog.destroy();
            event.preventDefault();
            return;
        }
        upDownHint(listElement, event);
        if (event.key === "Enter") {
            const currentElement = listElement.querySelector(".b3-list-item--focus");
            if (currentElement) {
                const command = currentElement.getAttribute("data-command");
                if (command) {
                    execByCommand({command, app, previousRange: range});
                } else {
                    currentElement.dispatchEvent(new CustomEvent("click"));
                }
            }
            dialog.destroy();
        } else if (event.key === "Escape") {
            dialog.destroy();
        }
    });
    inputElement.addEventListener("compositionend", () => {
        filterList(inputElement, listElement);
    });
    inputElement.addEventListener("input", (event: InputEvent) => {
        if (event.isComposing) {
            return;
        }
        event.stopPropagation();
        filterList(inputElement, listElement);
    });
};

const filterList = (inputElement: HTMLInputElement, listElement: Element) => {
    const inputValue = inputElement.value.toLowerCase();
    listElement.querySelector(".b3-list-item--focus")?.classList.remove("b3-list-item--focus");
    let hasFocus = false;
    Array.from(listElement.children).forEach((element: HTMLElement) => {
        const elementValue = element.querySelector(".b3-list-item__text").textContent.toLowerCase();
        const command = element.dataset.command;
        if (inputValue.indexOf(elementValue) > -1 || elementValue.indexOf(inputValue) > -1 ||
            inputValue.indexOf(command) > -1 || command?.indexOf(inputValue) > -1) {
            if (!hasFocus) {
                element.classList.add("b3-list-item--focus");
            }
            hasFocus = true;
            element.classList.remove("fn__none");
        } else {
            element.classList.add("fn__none");
        }
    });
};

export const execByCommand = async (options: {
    command: string,
    app?: AppFacade,
    previousRange?: Range,
    protyle?: IProtyle,
    fileLiElements?: Element[]
}) => {
    if (globalCommand(options.command, options.app)) {
        return;
    }

    const isFileFocus = document.querySelector(".layout__tab--active")?.classList.contains("sy__file");

    let protyle = options.protyle;
    // 移动端：未传入 protyle 时从全局当前编辑器获取
    if (isMobile() && !protyle) {
        protyle = getCurrentEditor()?.protyle;
        options.previousRange = protyle?.toolbar.range;
    }
    const range: Range = options.previousRange || (getSelection().rangeCount > 0 ? getSelection().getRangeAt(0) : document.createRange());
    let fileLiElements = options.fileLiElements;
    if (!isFileFocus && !protyle) {
        if (range) {
            window.siyuan.dialogs.find(item => {
                if (item.editors) {
                    Object.keys(item.editors).find(key => {
                        if (item.editors[key].protyle.element.contains(range.startContainer)) {
                            protyle = item.editors[key].protyle;
                            return true;
                        }
                    });
                    if (protyle) {
                        return true;
                    }
                }
            });
        }
        const activeTab = getActiveTab();
        if (!protyle && activeTab) {
            if (activeTab.model instanceof Editor) {
                protyle = activeTab.model.editor.protyle;
            } else if (activeTab.model instanceof Search) {
                if (activeTab.model.element.querySelector("#searchUnRefPanel").classList.contains("fn__none")) {
                    protyle = activeTab.model.editors.edit.protyle;
                } else {
                    protyle = activeTab.model.editors.unRefEdit.protyle;
                }
            } else if (isCustomDomain(activeTab.model) && activeTab.model.editors.length > 0) {
                if (range) {
                    activeTab.model.editors.find(item => {
                        if (item.protyle.element.contains(range.startContainer)) {
                            protyle = item.protyle;
                            return true;
                        }
                    });
                }
            }
        }
        if (!protyle) {
            if (!protyle && range) {
                window.siyuan.blockPanels.find(item => {
                    item.editors.find(editorItem => {
                        if (editorItem.protyle.element.contains(range.startContainer)) {
                            protyle = editorItem.protyle;
                            return true;
                        }
                    });
                    if (protyle) {
                        return true;
                    }
                });
            }
            const models = getAllModels();
            if (!protyle) {
                models.backlink.find(item => {
                    if (item.element.classList.contains("layout__tab--active")) {
                        if (range) {
                            item.editors.find(editor => {
                                if (editor.protyle.element.contains(range.startContainer)) {
                                    protyle = editor.protyle;
                                    return true;
                                }
                            });
                        }
                        if (!protyle && item.editors.length > 0) {
                            protyle = item.editors[0].protyle;
                        }
                        return true;
                    }
                });
            }
            if (!protyle) {
                models.editor.find(item => {
                    if (item.parent.headElement.classList.contains("item--focus")) {
                        protyle = item.editor.protyle;
                        return true;
                    }
                });
            }
        }
    }

    // only protyle
    if (!isFileFocus && protyle && onlyProtyleCommand({
        command: options.command,
        previousRange: range,
        protyle
    })) {
        return;
    }

    if (isFileFocus && !fileLiElements) {
        const dockFile = getDockByType("file");
        if (!dockFile) {
            return false;
        }
        const files = dockFile.data.file as Files;
        fileLiElements = Array.from(files.element.querySelectorAll(".b3-list-item--focus"));
    }

    // 全局命令，在没有 protyle 和文件树没聚焦的情况下执行
    if ((!protyle && !isFileFocus) ||
        (isFileFocus && (!fileLiElements || fileLiElements.length === 0)) ||
        (isMobile() && !document.getElementById("empty").classList.contains("fn__none"))) {
        if (options.command === "replace") {
            // 移动端使用弹出式搜索，桌面端使用搜索面板
            if (isMobile()) {
                popSearch(options.app, {hasReplace: true, page: 1});
            }
            if (!isMobile()) {
                openSearch({
                    app: options.app,
                    hotkey: Constants.DIALOG_REPLACE,
                    key: range.toString()
                });
            }
        } else if (options.command === "search") {
            // 移动端使用弹出式搜索，桌面端使用搜索面板
            if (isMobile()) {
                popSearch(options.app, {hasReplace: false, page: 1});
            }
            if (!isMobile()) {
                openSearch({
                    app: options.app,
                    hotkey: Constants.DIALOG_SEARCH,
                    key: range.toString()
                });
            }
        }
        return;
    }

    // protyle and file tree
    switch (options.command) {
        case "replace":
            if (!isFileFocus) {
                // 移动端：通过路径获取可读路径后弹出搜索；桌面端：直接打开搜索面板
                if (isMobile()) {
                    const response = await fetchSyncPost("/api/filetree/getHPathByPath", {
                        notebook: protyle.notebookId,
                        path: protyle.path.endsWith(".sy") ? protyle.path : protyle.path + ".sy"
                    });
                    if (response.code !== 0 || typeof response.data !== "string") {
                        return;
                    }
                    popSearch(options.app, {
                        page: 1,
                        hasReplace: true,
                        hPath: pathPosix().join(getNotebookName(protyle.notebookId), response.data),
                        idPath: [pathPosix().join(protyle.notebookId, protyle.path)]
                    });
                }
                if (!isMobile()) {
                    openSearch({
                        app: options.app,
                        hotkey: Constants.DIALOG_REPLACE,
                        key: range.toString(),
                        notebookId: protyle.notebookId,
                        searchPath: protyle.path
                    });
                }
            } else {
                // 桌面端：从文件树选中项获取笔记本和路径，打开替换面板
                if (!isMobile()) {
                    const topULElement = hasTopClosestByTag(fileLiElements[0], "UL");
                    if (!topULElement) {
                        return false;
                    }
                    const notebookId = topULElement.getAttribute("data-url");
                    const pathString = fileLiElements[0].getAttribute("data-path");
                    const isFile = fileLiElements[0].getAttribute("data-type") === "navigation-file";
                    if (isFile) {
                        openSearch({
                            app: options.app,
                            hotkey: Constants.DIALOG_REPLACE,
                            notebookId: notebookId,
                            searchPath: getDisplayName(pathString, false, true)
                        });
                    } else {
                        openSearch({
                            app: options.app,
                            hotkey: Constants.DIALOG_REPLACE,
                            notebookId: notebookId,
                        });
                    }
                }
            }
            break;
        case "search":
            if (!isFileFocus) {
                // 移动端：通过路径获取可读路径后弹出搜索；桌面端：直接打开搜索面板
                if (isMobile()) {
                    const response = await fetchSyncPost("/api/filetree/getHPathByPath", {
                        notebook: protyle.notebookId,
                        path: protyle.path.endsWith(".sy") ? protyle.path : protyle.path + ".sy"
                    });
                    if (response.code !== 0 || typeof response.data !== "string") {
                        return;
                    }
                    popSearch(options.app, {
                        page: 1,
                        hasReplace: false,
                        hPath: pathPosix().join(getNotebookName(protyle.notebookId), response.data),
                        idPath: [pathPosix().join(protyle.notebookId, protyle.path)]
                    });
                }
                if (!isMobile()) {
                    openSearch({
                        app: options.app,
                        hotkey: Constants.DIALOG_SEARCH,
                        key: range.toString(),
                        notebookId: protyle.notebookId,
                        searchPath: protyle.path
                    });
                }
            } else {
                // 桌面端：从文件树选中项获取笔记本和路径，打开搜索面板
                if (!isMobile()) {
                    const topULElement = hasTopClosestByTag(fileLiElements[0], "UL");
                    if (!topULElement) {
                        return false;
                    }
                    const notebookId = topULElement.getAttribute("data-url");
                    const pathString = fileLiElements[0].getAttribute("data-path");
                    const isFile = fileLiElements[0].getAttribute("data-type") === "navigation-file";
                    if (isFile) {
                        openSearch({
                            app: options.app,
                            hotkey: Constants.DIALOG_SEARCH,
                            notebookId: notebookId,
                            searchPath: getDisplayName(pathString, false, true)
                        });
                    } else {
                        openSearch({
                            app: options.app,
                            hotkey: Constants.DIALOG_SEARCH,
                            notebookId: notebookId,
                        });
                    }
                }
            }
            break;
        case "addToDatabase":
            if (!isFileFocus) {
                addEditorToDatabase(protyle, range);
            } else {
                addFilesToDatabase(fileLiElements);
            }
            break;
        case "move":
            if (!isFileFocus) {
                const nodeElement = hasClosestBlock(range.startContainer);
                if (protyle.title?.editElement.contains(range.startContainer) || !nodeElement || window.siyuan.menus.menu.element.getAttribute("data-name") === Constants.MENU_TITLE) {
                    movePathTo({
                        cb: (toPath, toNotebook) => {
                            moveToPath([protyle.path], toNotebook[0], toPath[0]);
                        },
                        paths: [protyle.path],
                        range,
                        flashcard: false,
                        rootIDs: [protyle.block.rootID],
                        sourceNotebookIds: [protyle.notebookId]
                    });
                } else if (nodeElement && range && protyle.element.contains(range.startContainer)) {
                    let selectElements = Array.from(protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select"));
                    if (selectElements.length === 0) {
                        selectElements = [nodeElement];
                    }
                    movePathTo({
                        cb: (toPath) => {
                            hintMoveBlock(toPath[0], selectElements, protyle);
                        },
                        flashcard: false,
                        rootIDs: [protyle.block.rootID],
                        sourceNotebookIds: [protyle.notebookId]
                    });
                }
            } else {
                const paths = getTopPaths(fileLiElements);
                const sourceNotebookIds = fileLiElements.map((item) =>
                    item.getAttribute("data-notebook-id") || item.closest("ul[data-url]")?.getAttribute("data-url") || "");
                const rootIDs: string[] = [];
                fileLiElements.forEach(item => {
                    rootIDs.push(item.getAttribute("data-node-id"));
                });
                movePathTo({
                    cb: (toPath, toNotebook) => {
                        moveToPath(paths, toNotebook[0], toPath[0]);
                    },
                    paths,
                    rootIDs,
                    flashcard: false,
                    sourceNotebookIds
                });
            }
            break;
    }
};
