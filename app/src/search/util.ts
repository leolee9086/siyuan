import { getAllModels } from "../layout/getAll";
/// #if !BROWSER
import * as path from "path";
/// #endif
import { Constants } from "../constants";
import { escapeAriaLabel, escapeGreat, escapeHtml } from "../util/escape";
import { fetchPost } from "../util/fetch";
import { openFile } from "../editor/util";
import { openFileById } from "../editor/utils.openFileById";
import { showMessage } from "../dialog/message";
import { reloadProtyle } from "../protyle/util/reload";
import { MenuItem } from "../menus/Menu.Item";
import { genUUID } from "../util/genID";
import { getNotebookName, pathPosix, useShell } from "../util/pathName";
import { movePathTo } from "../util/pathName/movePathTo";
import { Protyle } from "../protyle";
import { onGet } from "../protyle/util/onGet";
import { addLoading } from "../protyle/ui/initUI";
import { hasClosestBlock, hasClosestByClassName } from "../protyle/util/hasClosest";
import { isIPad, isNotCtrl, setStorageVal, updateHotkeyTip } from "../protyle/util/compatibility";
import { newFileByName } from "../util/newFile";
import {
    filterMenu,
    getKeyByLiElement,
    initCriteriaMenu,
    moreMenu,
    queryMenu,
    replaceFilterMenu,
    saveCriterion
} from "./menu";
import { App } from "../index";
import {
    assetFilterMenu,
    assetInputEvent,
    assetMethodMenu,
    assetMoreMenu,
    renderNextAssetMark,
    renderPreview,
} from "./assets";
import { openSearchAsset } from "./assets.openSearchAsset";
import { resize } from "../protyle/util/resize";
import { addClearButton } from "../util/addClearButton";
import { checkFold } from "../util/noRelyPCFunction";
import { getUnRefList, openSearchUnRef, unRefMoreMenu } from "./unRef";
import { getDefaultType } from "./getDefault";
import { isSupportCSSHL, searchMarkRender } from "../protyle/render/searchMarkRender";
import { saveKeyList, toggleAssetHistory, toggleReplaceHistory, toggleSearchHistory } from "./toggleHistory";
import { highlightById } from "../util/highlightById";
import { scrollToCurrent } from "./utils/utils.scrollToCurrent";
import { getSelectionOffset } from "../protyle/util/selection";
import { electronUndo } from "../protyle/undo";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import { getContenteditableElement } from "../protyle/wysiwyg/getBlock";

// inputEvent 已拆分到独立文件，导入供内部使用并重新导出
import { inputEvent } from "./inputEvent";
export { inputEvent };

export const openGlobalSearch = (app: App, text: string, replace: boolean, searchData?: Config.IUILayoutTabSearchConfig) => {
    text = text.trim();
    const searchModel = getAllModels().search.find((item) => {
        item.parent.parent.switchTab(item.parent.headElement);
        item.updateSearch(text, replace);
        return true;
    });
    if (searchModel) {
        return;
    }
    const localData = window.siyuan.storage[Constants.LOCAL_SEARCHDATA];
    openFile({
        app,
        searchData: {
            k: text,
            r: "",
            hasReplace: false,
            method: searchData ? searchData.method : localData.method,
            hPath: "",
            idPath: [],
            group: localData.group,
            sort: localData.sort,
            types: Object.assign({}, localData.types),
            replaceTypes: Object.assign({}, localData.replaceTypes),
            removed: localData.removed,
            page: 1
        },
        position: (window.siyuan.layout.centerLayout.children.length > 1 || window.innerWidth > 1024) ? "right" : undefined
    });
};

// closeCB 不存在为页签搜索
export const genSearch = (app: App, config: Config.IUILayoutTabSearchConfig, element: HTMLElement, closeCB?: () => void, updateCB?: (config: Config.IUILayoutTabSearchConfig) => void) => {
    let includeChild = true;
    let enableIncludeChild = false;
    config.idPath.forEach(item => {
        if (item.endsWith(".sy")) {
            includeChild = false;
        }
        if (item.split("/").length > 1) {
            enableIncludeChild = true;
        }
    });
    const data = window.siyuan.storage[Constants.LOCAL_SEARCHKEYS];
    const unRefLocal = window.siyuan.storage[Constants.LOCAL_SEARCHUNREF];
    element.innerHTML = `<div class="fn__flex-column" style="height: 100%;${closeCB ? "border-radius: var(--b3-border-radius-b);overflow: hidden;" : ""}">
    <div class="block__icons" style="overflow: auto">
        <span data-position="9south" data-type="previous" class="block__icon block__icon--show ariaLabel" disabled="disabled" aria-label="${siyuanI18n.previousLabel}"><svg><use xlink:href='#iconLeft'></use></svg></span>
        <span class="fn__space"></span>
        <span data-position="9south" data-type="next" class="block__icon block__icon--show ariaLabel" disabled="disabled" aria-label="${siyuanI18n.nextLabel}"><svg><use xlink:href='#iconRight'></use></svg></span>
        <span class="fn__space"></span>
        <span id="searchResult" class="fn__flex-shrink ft__selectnone"></span>
        <span class="fn__space"></span>
        <span class="fn__flex-1${closeCB ? " resize__move" : ""}" style="min-height: 100%"></span>
        <span id="searchPathInput" data-position="9south" class="search__path ft__on-surface fn__flex-center ft__smaller fn__ellipsis ariaLabel" aria-label="${escapeAriaLabel(config.hPath)}">
            ${escapeHtml(config.hPath)}
            <svg class="search__rmpath${config.hPath ? "" : " fn__none"}"><use xlink:href="#iconCloseRound"></use></svg>
        </span>
        <span class="fn__space"></span>
        <span data-position="9south" id="searchInclude" ${enableIncludeChild ? "" : "disabled"} aria-label="${siyuanI18n.includeChildDoc}" class="block__icon block__icon--show ariaLabel">
            <svg${includeChild ? ' class="ft__primary"' : ""}><use xlink:href="#iconInclude"></use></svg>
        </span>
        <span class="fn__space"></span>
        <span id="searchPath" aria-label="${siyuanI18n.specifyPath}" class="block__icon block__icon--show ariaLabel" data-position="9south">
            <svg><use xlink:href="#iconFolder"></use></svg>
        </span>
        <span class="fn__space"></span>
        <span id="searchPin" aria-label="${siyuanI18n.pin || "Pin to Dock"}" class="block__icon block__icon--show ariaLabel" data-position="9south">
            <svg><use xlink:href="#iconPin"></use></svg>
        </span>
        <span class="fn__space"></span>
        <span id="searchMore" aria-label="${siyuanI18n.more}" class="block__icon block__icon--show ariaLabel" data-position="9south">
            <svg><use xlink:href="#iconMore"></use></svg>
        </span>
        <span class="${closeCB ? "" : "fn__none "}fn__space"></span>
        <span id="searchOpen" aria-label="${siyuanI18n.openInNewTab}" class="${closeCB ? "" : "fn__none "}block__icon block__icon--show ariaLabel" data-position="9south">
            <svg><use xlink:href="#iconLayoutRight"></use></svg>
        </span>
        <span class="fn__space"></span>
        <span id="searchUnRef" aria-label="${siyuanI18n.listInvalidRefBlocks}" class="block__icon block__icon--show ariaLabel" data-position="9south">
            <svg><use xlink:href="#iconLinkOff"></use></svg>
        </span>
        <span class="fn__space"></span>
        <span id="searchAsset" aria-label="${siyuanI18n.searchAssetContent}" class="block__icon block__icon--show ariaLabel" data-position="9south">
            <svg><use xlink:href="#iconExact"></use></svg>
        </span>
    </div>
    <div class="b3-form__icon search__header">
        <div style="position: relative" class="fn__flex-1">
            <span class="search__history-icon ariaLabel" id="searchHistoryBtn" aria-label="${updateHotkeyTip("⌥↓")}">
                <svg data-menu="true" class="b3-form__icon-icon"><use xlink:href="#iconSearch"></use></svg>
                <svg class="search__arrowdown"><use xlink:href="#iconDown"></use></svg>
            </span>
            <input id="searchInput" class="b3-text-field b3-text-field--text" placeholder="${siyuanI18n.showRecentUpdatedBlocks}" autocomplete="off" autocorrect="off" spellcheck="false">
        </div>
        <div class="block__icons">
            <span id="searchFilter" aria-label="${siyuanI18n.searchType}" class="block__icon ariaLabel" data-position="9south">
                <svg><use xlink:href="#iconFilter"></use></svg>
            </span> 
            <span class="fn__space"></span>
            ${genQueryHTML(config.method, "searchSyntaxCheck")}
            <span class="fn__space"></span>
            <span id="searchReplace" aria-label="${siyuanI18n.replace}" class="block__icon ariaLabel" data-position="9south">
                <svg><use xlink:href="#iconReplace"></use></svg>
            </span>
            <span class="fn__space"></span>
            <span id="searchRefresh" aria-label="${siyuanI18n.refresh}" class="block__icon ariaLabel" data-position="9south">
                <svg><use xlink:href="#iconRefresh"></use></svg>
            </span>
            <div class="fn__flex${config.group === 0 ? " fn__none" : ""}">
                <span class="fn__space"></span>
                <span id="searchExpand" class="block__icon block__icon--show ariaLabel" data-position="9south" aria-label="${siyuanI18n.expand}">
                    <svg><use xlink:href="#iconExpand"></use></svg>
                </span>
                <span class="fn__space"></span>
                <span id="searchCollapse" class="block__icon block__icon--show ariaLabel" data-position="9south" aria-label="${siyuanI18n.collapse}">
                    <svg><use xlink:href="#iconContract"></use></svg>
                </span>
            </div>
        </div>
    </div>
    <div class="b3-form__icon search__header${config.hasReplace ? "" : " fn__none"}">
        <div class="fn__flex-1" style="position: relative">
            <span class="search__history-icon ariaLabel" id="replaceHistoryBtn" aria-label="${updateHotkeyTip("⌥↓")}">
                <svg data-menu="true" class="b3-form__icon-icon"><use xlink:href="#iconReplace"></use></svg>
                <svg class="search__arrowdown"><use xlink:href="#iconDown"></use></svg>
            </span>
            <input id="replaceInput" class="b3-text-field b3-text-field--text">
        </div>
        <div class="fn__space"></div>
        <svg class="fn__rotate fn__none svg" style="padding: 0 8px;align-self: center;margin-right: 8px"><use xlink:href="#iconRefresh"></use></svg>
        <span id="replaceFilter" aria-label="${siyuanI18n.replaceType}" class="block__icon ariaLabel fn__flex-center" data-position="9south">
            <svg><use xlink:href="#iconFilter"></use></svg>
        </span>
        <span class="fn__space"></span>
        <button id="replaceAllBtn" class="b3-button b3-button--small b3-button--outline fn__flex-center">${siyuanI18n.replaceAll}</button>
        <div class="fn__space"></div>
        <button id="replaceBtn" class="b3-button b3-button--small b3-button--outline fn__flex-center">↵ ${siyuanI18n.replace}</button>
        <div class="fn__space"></div>
    </div>
    <div id="criteria" class="search__header"></div>
    <div class="search__layout${(closeCB ? data.layout === 1 : data.layoutTab === 1) ? " search__layout--row" : ""}">
        <div id="searchList" class="fn__flex-1 search__list b3-list b3-list--background"></div>
        <div class="search__drag"></div>
        <div id="searchPreview" class="fn__flex-1 search__preview"></div>
    </div>
    <div class="search__tip${closeCB ? "" : " fn__none"}">
        <kbd>↑/↓/PageUp/PageDown</kbd> ${siyuanI18n.searchTip1}
        <kbd>${updateHotkeyTip(window.siyuan.config.keymap.general.newFile.custom)}</kbd> ${siyuanI18n.new}
        <kbd>${siyuanI18n.enterKey}/${siyuanI18n.doubleClick}</kbd> ${siyuanI18n.searchTip2}
        <kbd>${siyuanI18n.click}</kbd> ${siyuanI18n.searchTip3}
        <kbd>${updateHotkeyTip(window.siyuan.config.keymap.editor.general.insertRight.custom)}/${updateHotkeyTip("⌥" + siyuanI18n.click)}</kbd> ${siyuanI18n.searchTip4}
        <kbd>Esc</kbd> ${siyuanI18n.searchTip5}
    </div>
</div>
<div class="fn__flex-column fn__none" id="searchAssets" style="height: 100%;${closeCB ? "border-radius: var(--b3-border-radius-b);overflow: hidden;" : ""}"></div>
<div class="fn__flex-column fn__none" id="searchUnRefPanel" style="height: 100%;${closeCB ? "border-radius: var(--b3-border-radius-b);overflow: hidden;" : ""}">
    <div class="block__icons">
        <span data-type="unRefPrevious" class="block__icon block__icon--show ariaLabel" data-position="9south" disabled="disabled" aria-label="${siyuanI18n.previousLabel}"><svg><use xlink:href='#iconLeft'></use></svg></span>
        <span class="fn__space"></span>
        <span data-type="unRefNext" class="block__icon block__icon--show ariaLabel" data-position="9south" disabled="disabled" aria-label="${siyuanI18n.nextLabel}"><svg><use xlink:href='#iconRight'></use></svg></span>
        <span class="fn__space"></span>
        <span id="searchUnRefResult" class="ft__selectnone"></span>
        <span class="fn__flex-1${closeCB ? " resize__move" : ""}" style="min-height: 100%"></span>
        <span class="fn__space"></span>
        <span id="unRefMore" aria-label="${siyuanI18n.more}" class="block__icon block__icon--show ariaLabel" data-position="9south">
            <svg><use xlink:href="#iconMore"></use></svg>
        </span>
        <span class="fn__space"></span>
        <span id="searchUnRefClose" aria-label="${!closeCB ? siyuanI18n.stickSearch : siyuanI18n.globalSearch}" class="block__icon block__icon--show ariaLabel" data-position="9south">
            <svg><use xlink:href="#iconBack"></use></svg>
        </span>
    </div>
    <div class="search__layout${unRefLocal.layout === 1 ? " search__layout--row" : ""}">
        <div id="searchUnRefList" class="fn__flex-1 search__list b3-list b3-list--background"></div>
        <div class="search__drag"></div>
        <div id="searchUnRefPreview" class="fn__flex-1 search__preview"></div>
    </div>
    <div class="search__tip${closeCB ? "" : " fn__none"}">
        <kbd>↑/↓/PageUp/PageDown</kbd> ${siyuanI18n.searchTip1}
        <kbd>${siyuanI18n.enterKey}/${siyuanI18n.doubleClick}</kbd> ${siyuanI18n.searchTip2}
        <kbd>${updateHotkeyTip(window.siyuan.config.keymap.editor.general.insertRight.custom)}/${updateHotkeyTip("⌥" + siyuanI18n.click)}</kbd> ${siyuanI18n.searchTip4}
        <kbd>Esc</kbd> ${siyuanI18n.searchTip5}
    </div>
</div>
<div class="fn__loading fn__loading--top"><img width="120px" src="/stage/loading-pure.svg"></div>`;

    const criteriaData: Config.IUILayoutTabSearchConfig[] = [];
    initCriteriaMenu(element.querySelector("#criteria"), criteriaData, config);
    const searchPanelElement = element.querySelector("#searchList");
    const searchInputElement = element.querySelector("#searchInput") as HTMLInputElement;
    const replaceInputElement = element.querySelector("#replaceInput") as HTMLInputElement;

    const edit = new Protyle(app, element.querySelector("#searchPreview") as HTMLElement, {
        blockId: "",
        render: {
            gutter: true,
            breadcrumbDocName: true,
            title: true
        },
    });
    edit.resize();
    const unRefEdit = new Protyle(app, element.querySelector("#searchUnRefPreview") as HTMLElement, {
        blockId: "",
        render: {
            gutter: true,
            breadcrumbDocName: true,
            title: true
        },
    });
    unRefEdit.resize();
    if (closeCB) {
        if (data.layout === 1) {
            if (data.col) {
                edit.protyle.element.style.width = data.col;
                edit.protyle.element.classList.remove("fn__flex-1");
            }
        } else {
            if (data.row) {
                edit.protyle.element.classList.remove("fn__flex-1");
                edit.protyle.element.style.height = data.row;
            }
        }
    } else {
        if (data.layoutTab === 1) {
            if (data.colTab) {
                edit.protyle.element.style.width = data.colTab;
                edit.protyle.element.classList.remove("fn__flex-1");
            }
        } else {
            if (data.rowTab) {
                edit.protyle.element.classList.remove("fn__flex-1");
                edit.protyle.element.style.height = data.rowTab;
            }
        }
    }
    let clickTimeout: number;
    let lastClickTime = new Date().getTime();

    searchInputElement.value = config.k || "";
    replaceInputElement.value = config.r || "";
    searchInputElement.select();

    const dragElement = element.querySelector(".search__drag");
    dragElement.addEventListener("mousedown", (event: MouseEvent) => {
        const documentSelf = document;
        const nextElement = dragElement.nextElementSibling as HTMLElement;
        const previousElement = dragElement.previousElementSibling as HTMLElement;
        const direction = window.siyuan.storage[Constants.LOCAL_SEARCHKEYS][closeCB ? "layout" : "layoutTab"] === 1 ? "lr" : "tb";
        const x = event[direction === "lr" ? "clientX" : "clientY"];
        const previousSize = direction === "lr" ? previousElement.clientWidth : previousElement.clientHeight;
        const nextSize = direction === "lr" ? nextElement.clientWidth : nextElement.clientHeight;

        nextElement.classList.remove("fn__flex-1");
        nextElement.style[direction === "lr" ? "width" : "height"] = nextSize + "px";
        element.style.userSelect = "none";
        documentSelf.onmousemove = (moveEvent: MouseEvent) => {
            moveEvent.preventDefault();
            moveEvent.stopPropagation();
            const previousNowSize = (previousSize + (moveEvent[direction === "lr" ? "clientX" : "clientY"] - x));
            const nextNowSize = (nextSize - (moveEvent[direction === "lr" ? "clientX" : "clientY"] - x));
            if (previousNowSize < 120 || nextNowSize < 120) {
                return;
            }
            nextElement.style[direction === "lr" ? "width" : "height"] = nextNowSize + "px";
        };

        documentSelf.onmouseup = () => {
            element.style.userSelect = "";
            documentSelf.onmousemove = null;
            documentSelf.onmouseup = null;
            documentSelf.ondragstart = null;
            documentSelf.onselectstart = null;
            documentSelf.onselect = null;
            window.siyuan.storage[Constants.LOCAL_SEARCHKEYS][direction === "lr" ? (closeCB ? "col" : "colTab") : (closeCB ? "row" : "rowTab")] = nextElement[direction === "lr" ? "clientWidth" : "clientHeight"] + "px";
            setStorageVal(Constants.LOCAL_SEARCHKEYS, window.siyuan.storage[Constants.LOCAL_SEARCHKEYS]);
            if (direction === "lr") {
                resize(edit.protyle);
            }
        };
    });
    dragElement.addEventListener("dblclick", () => {
        edit.protyle.element.style[localSearch.layout === 1 ? "width" : "height"] = "";
        edit.protyle.element.classList.add("fn__flex-1");
        const direction = window.siyuan.storage[Constants.LOCAL_SEARCHKEYS][closeCB ? "layout" : "layoutTab"] === 1 ? "lr" : "tb";
        window.siyuan.storage[Constants.LOCAL_SEARCHKEYS][direction === "lr" ? (closeCB ? "col" : "colTab") : (closeCB ? "row" : "rowTab")] = "";
        setStorageVal(Constants.LOCAL_SEARCHKEYS, window.siyuan.storage[Constants.LOCAL_SEARCHKEYS]);
        if (direction === "lr") {
            resize(edit.protyle);
        }
    });
    const localSearch = window.siyuan.storage[Constants.LOCAL_SEARCHASSET] as ISearchAssetOption;
    const assetsElement = element.querySelector("#searchAssets") as HTMLElement;
    const unRefPanelElement = element.querySelector("#searchUnRefPanel") as HTMLElement;
    element.addEventListener("click", (event: MouseEvent) => {
        let target = event.target as HTMLElement;
        const searchPathInputElement = element.querySelector("#searchPathInput");
        while (target && target !== element) {
            const type = target.getAttribute("data-type");
            if (type === "removeCriterion") {
                config = updateConfig(element, {
                    removed: true,
                    sort: 0,
                    group: 0,
                    hasReplace: false,
                    method: 0,
                    hPath: "",
                    idPath: [],
                    k: "",
                    r: "",
                    page: 1,
                    types: getDefaultType(),
                    replaceTypes: Object.assign({}, Constants.SIYUAN_DEFAULT_REPLACETYPES),
                }, config, edit, true);
                if (updateCB) {
                    updateCB(config);
                }
                element.querySelector(".b3-chip--current")?.classList.remove("b3-chip--current");
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (type === "saveCriterion") {
                saveCriterion(config, criteriaData, element);
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (type === "next") {
                if (!target.getAttribute("disabled")) {
                    if (config.page < parseInt(target.parentElement.querySelector("#searchResult").getAttribute("data-pagecount"))) {
                        config.page++;
                        inputEvent(element, config, edit);
                    }
                }
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (type === "previous") {
                if (!target.getAttribute("disabled")) {
                    if (config.page > 1) {
                        config.page--;
                        inputEvent(element, config, edit);
                    }
                }
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (target.classList.contains("b3-chip") && type === "set-criteria") {
                config.removed = false;
                target.parentElement.querySelector(".b3-chip--current")?.classList.remove("b3-chip--current");
                target.classList.add("b3-chip--current");
                criteriaData.find(item => {
                    if (item.name === target.innerText.trim()) {
                        config = updateConfig(element, item, config, edit);
                        if (updateCB) {
                            updateCB(config);
                        }
                        return true;
                    }
                });
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (target.classList.contains("b3-chip__close") && type === "remove-criteria") {
                const name = target.parentElement.textContent;
                fetchPost("/api/storage/removeCriterion", { name });
                criteriaData.find((item, index) => {
                    if (item.name === name) {
                        criteriaData.splice(index, 1);
                        return true;
                    }
                });
                if (target.parentElement.classList.contains("b3-chip--current")) {
                    config = updateConfig(element, {
                        removed: true,
                        sort: 0,
                        group: 0,
                        hasReplace: false,
                        method: 0,
                        hPath: "",
                        idPath: [],
                        k: "",
                        r: "",
                        page: 1,
                        types: getDefaultType(),
                        replaceTypes: Object.assign({}, Constants.SIYUAN_DEFAULT_REPLACETYPES),
                    }, config, edit, true);
                }
                target.parentElement.remove();
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (target.classList.contains("search__rmpath")) {
                config.idPath = [];
                config.hPath = "";
                config.page = 1;
                searchPathInputElement.textContent = "";
                searchPathInputElement.setAttribute("aria-label", "");
                inputEvent(element, config, edit, true);
                if (updateCB) {
                    updateCB(config);
                }
                const includeElement = element.querySelector("#searchInclude");
                includeElement.firstElementChild.classList.add("ft__primary");
                includeElement.setAttribute("disabled", "disabled");
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (target.id === "searchExpand") {
                Array.from(searchPanelElement.children).forEach(item => {
                    if (item.classList.contains("b3-list-item")) {
                        item.querySelector(".b3-list-item__arrow").classList.add("b3-list-item__arrow--open");
                        item.nextElementSibling.classList.remove("fn__none");
                    }
                });
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (target.id === "searchCollapse") {
                Array.from(searchPanelElement.children).forEach(item => {
                    if (item.classList.contains("b3-list-item")) {
                        item.querySelector(".b3-list-item__arrow").classList.remove("b3-list-item__arrow--open");
                        item.nextElementSibling.classList.add("fn__none");
                    }
                });
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (target.id === "searchPin") {
                const uuid = genUUID();
                const query = searchInputElement.value;
                const title = query || "Search Results";

                window.siyuan.menus.menu.remove();
                window.siyuan.menus.menu.append(new MenuItem({
                    label: siyuanI18n.pinSearchResult || "Pin Search Result (Static)",
                    iconHTML: "",
                    click: () => {
                        const ids: string[] = [];
                        const listElement = element.querySelector("#searchList");
                        if (listElement) {
                            listElement.querySelectorAll("[data-node-id]").forEach((item) => {
                                ids.push(item.getAttribute("data-node-id"));
                            });
                        }
                        if (ids.length === 0) {
                            return;
                        }
                        const type = "custom_list:static:" + uuid;
                        // Save data
                        if (!window.siyuan.storage["local-customlists"]) {
                            window.siyuan.storage["local-customlists"] = {};
                        }
                        window.siyuan.storage["local-customlists"][uuid] = {
                            id: uuid,
                            title: title,
                            icon: "iconList",
                            type: "static",
                            target: ids
                        };
                        setStorageVal("local-customlists", window.siyuan.storage["local-customlists"]);

                        // Add to Dock
                        const dock = window.siyuan.layout.leftDock || window.siyuan.layout.rightDock;
                        if (dock) {
                            dock.addCustomItem({
                                type: type,
                                title: title,
                                icon: "iconList",
                                show: true,
                                size: { width: 300, height: 0 },
                                hotkey: "",
                            });
                        }
                    }
                }).element);
                window.siyuan.menus.menu.append(new MenuItem({
                    label: siyuanI18n.pinSearchQuery || "Pin Search Query (Dynamic)",
                    iconHTML: "",
                    click: () => {
                        const type = "custom_list:dynamic:" + uuid;
                        // Save data
                        if (!window.siyuan.storage["local-customlists"]) {
                            window.siyuan.storage["local-customlists"] = {};
                        }
                        window.siyuan.storage["local-customlists"][uuid] = {
                            id: uuid,
                            title: title,
                            icon: "iconSearch",
                            type: "dynamic",
                            target: query
                        };
                        setStorageVal("local-customlists", window.siyuan.storage["local-customlists"]);

                        // Add to Dock
                        const dock = window.siyuan.layout.leftDock || window.siyuan.layout.rightDock;
                        if (dock) {
                            dock.addCustomItem({
                                type: type,
                                title: title,
                                icon: "iconSearch",
                                show: true,
                                size: { width: 300, height: 0 },
                                hotkey: "",
                            });
                        }
                    }
                }).element);
                const rect = target.getBoundingClientRect();
                window.siyuan.menus.menu.popup({ x: rect.right, y: rect.bottom, isLeft: true });

                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (target.id === "searchPath") {
                movePathTo({
                    cb: (toPath, toNotebook) => {
                        fetchPost("/api/filetree/getHPathsByPaths", { paths: toPath }, (response) => {
                            config.idPath = [];
                            const hPathList: string[] = [];
                            let enableIncludeChild = false;
                            toPath.forEach((item, index) => {
                                if (item === "/") {
                                    config.idPath.push(toNotebook[index]);
                                    hPathList.push(getNotebookName(toNotebook[index]));
                                } else {
                                    enableIncludeChild = true;
                                    config.idPath.push(pathPosix().join(toNotebook[index], item.replace(".sy", "")));
                                }
                            });
                            if (response.data) {
                                hPathList.push(...response.data);
                            }
                            config.hPath = hPathList.join(" ");
                            config.page = 1;
                            searchPathInputElement.innerHTML = `${escapeGreat(config.hPath)}<svg class="search__rmpath"><use xlink:href="#iconCloseRound"></use></svg>`;
                            searchPathInputElement.setAttribute("aria-label", escapeHtml(config.hPath));
                            const includeElement = element.querySelector("#searchInclude");
                            includeElement.firstElementChild.classList.add("ft__primary");
                            if (enableIncludeChild) {
                                includeElement.removeAttribute("disabled");
                            } else {
                                includeElement.setAttribute("disabled", "disabled");
                            }
                            inputEvent(element, config, edit, true);
                            if (updateCB) {
                                updateCB(config);
                            }
                        });
                    },
                    title: siyuanI18n.specifyPath,
                    flashcard: false
                });
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (target.id === "searchInclude") {
                event.stopPropagation();
                event.preventDefault();
                if (target.hasAttribute("disabled")) {
                    return;
                }
                const svgElement = target.firstElementChild;
                svgElement.classList.toggle("ft__primary");
                if (!svgElement.classList.contains("ft__primary")) {
                    config.idPath.forEach((item, index) => {
                        if (!item.endsWith(".sy") && item.split("/").length > 1) {
                            config.idPath[index] = item + ".sy";
                        }
                    });
                } else {
                    config.idPath.forEach((item, index) => {
                        if (item.endsWith(".sy")) {
                            config.idPath[index] = item.replace(".sy", "");
                        }
                    });
                }
                config.page = 1;
                inputEvent(element, config, edit, true);
                if (updateCB) {
                    updateCB(config);
                }
                break;
            } else if (target.id === "searchReplace") {
                // ctrl+P 不需要保存
                config.hasReplace = !config.hasReplace;
                if (updateCB) {
                    updateCB(config);
                }
                element.querySelectorAll(".search__header")[1].classList.toggle("fn__none");
                element.querySelector("#criteria .b3-chip--current")?.classList.remove("b3-chip--current");
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (target.id === "searchUnRef") {
                openSearchUnRef(unRefPanelElement, unRefEdit);
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (target.id === "unRefMore") {
                unRefMoreMenu(target, unRefPanelElement, unRefEdit);
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (target.id === "searchUnRefClose") {
                window.siyuan.menus.menu.remove();
                unRefPanelElement.classList.add("fn__none");
                assetsElement.previousElementSibling.classList.remove("fn__none");
                searchInputElement.select();
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (type === "unRefPrevious") {
                if (!target.getAttribute("disabled")) {
                    let currentPage = parseInt(unRefPanelElement.querySelector("#searchUnRefResult").textContent);
                    if (currentPage > 1) {
                        currentPage--;
                        getUnRefList(unRefPanelElement, unRefEdit, currentPage);
                    }
                }
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (type === "unRefNext") {
                if (!target.getAttribute("disabled")) {
                    let currentPage = parseInt(unRefPanelElement.querySelector("#searchUnRefResult").textContent);
                    if (currentPage < parseInt(unRefPanelElement.querySelector("#searchUnRefResult").textContent.split("/")[1])) {
                        currentPage++;
                        getUnRefList(unRefPanelElement, unRefEdit, currentPage);
                    }
                }
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (target.id === "searchAsset") {
                openSearchAsset(assetsElement, !closeCB);
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (target.id === "searchAssetClose") {
                window.siyuan.menus.menu.remove();
                assetsElement.classList.add("fn__none");
                assetsElement.previousElementSibling.classList.remove("fn__none");
                searchInputElement.select();
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (target.id === "searchOpen") {
                config.k = searchInputElement.value;
                config.r = replaceInputElement.value;
                openFile({
                    app,
                    searchData: config,
                    position: (window.siyuan.layout.centerLayout.children.length > 1 || window.innerWidth > 1024) ? "right" : undefined
                });
                if (closeCB) {
                    closeCB();
                }
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (target.id === "searchRefresh") {
                inputEvent(element, config, edit);
                if (updateCB) {
                    updateCB(config);
                }
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (target.id === "searchMore") {
                moreMenu(config, criteriaData, element, () => {
                    config.page = 1;
                    inputEvent(element, config, edit, true);
                    if (updateCB) {
                        updateCB(config);
                    }
                }, () => {
                    config = updateConfig(element, {
                        removed: true,
                        sort: 0,
                        group: 0,
                        hasReplace: false,
                        method: 0,
                        hPath: "",
                        idPath: [],
                        k: "",
                        r: "",
                        page: 1,
                        types: getDefaultType(),
                        replaceTypes: Object.assign({}, Constants.SIYUAN_DEFAULT_REPLACETYPES),
                    }, config, edit, true);
                    if (updateCB) {
                        updateCB(config);
                    }
                    element.querySelector("#criteria .b3-chip--current")?.classList.remove("b3-chip--current");
                }, () => {
                    const localData = window.siyuan.storage[Constants.LOCAL_SEARCHKEYS];
                    const isPopover = hasClosestByClassName(element, "b3-dialog__container");
                    window.siyuan.menus.menu.append(new MenuItem({
                        iconHTML: "",
                        label: siyuanI18n.layout,
                        type: "submenu",
                        submenu: [{
                            iconHTML: "",
                            label: siyuanI18n.topBottomLayout,
                            current: isPopover ? localData.layout === 0 : localData.layoutTab === 0,
                            click() {
                                element.querySelector(".search__layout").classList.remove("search__layout--row");
                                edit.protyle.element.style.width = "";
                                if ((isPopover && localData.row) || (!isPopover && localData.rowTab)) {
                                    edit.protyle.element.style.height = isPopover ? localData.row : localData.rowTab;
                                    edit.protyle.element.classList.remove("fn__flex-1");
                                } else {
                                    edit.protyle.element.classList.add("fn__flex-1");
                                }
                                resize(edit.protyle);
                                if (isPopover) {
                                    localData.layout = 0;
                                } else {
                                    localData.layoutTab = 0;
                                }
                                setStorageVal(Constants.LOCAL_SEARCHKEYS, window.siyuan.storage[Constants.LOCAL_SEARCHKEYS]);
                            }
                        }, {
                            iconHTML: "",
                            label: siyuanI18n.leftRightLayout,
                            current: isPopover ? localData.layout === 1 : localData.layoutTab === 1,
                            click() {
                                element.querySelector(".search__layout").classList.add("search__layout--row");
                                edit.protyle.element.style.height = "";
                                if ((isPopover && localData.col) || (!isPopover && localData.colTab)) {
                                    edit.protyle.element.style.width = isPopover ? localData.col : localData.colTab;
                                    edit.protyle.element.classList.remove("fn__flex-1");
                                } else {
                                    edit.protyle.element.classList.add("fn__flex-1");
                                }
                                resize(edit.protyle);
                                if (isPopover) {
                                    localData.layout = 1;
                                } else {
                                    localData.layoutTab = 1;
                                }
                                setStorageVal(Constants.LOCAL_SEARCHKEYS, window.siyuan.storage[Constants.LOCAL_SEARCHKEYS]);
                            }
                        }]
                    }).element);
                });
                const rect = target.getBoundingClientRect();
                window.siyuan.menus.menu.popup({ x: rect.right, y: rect.bottom, isLeft: true });
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (target.id === "searchFilter") {
                window.siyuan.menus.menu.remove();
                filterMenu(config, () => {
                    config.page = 1;
                    inputEvent(element, config, edit, true);
                    if (updateCB) {
                        updateCB(config);
                    }
                });
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (target.id === "replaceFilter") {
                window.siyuan.menus.menu.remove();
                replaceFilterMenu(config);
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (type === "assetPrevious") {
                if (!target.getAttribute("disabled")) {
                    let currentPage = parseInt(assetsElement.querySelector("#searchAssetResult .fn__flex-center").textContent.split("/")[0]);
                    if (currentPage > 1) {
                        currentPage--;
                        assetInputEvent(assetsElement, localSearch, currentPage);
                    }
                }
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (type === "assetNext") {
                if (!target.getAttribute("disabled")) {
                    let currentPage = parseInt(assetsElement.querySelector("#searchAssetResult .fn__flex-center").textContent.split("/")[0]);
                    if (currentPage < parseInt(assetsElement.querySelector("#searchAssetResult .fn__flex-center").textContent.split("/")[1])) {
                        currentPage++;
                        assetInputEvent(assetsElement, localSearch, currentPage);
                    }
                }
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (target.id === "assetMore") {
                assetMoreMenu(target, assetsElement, () => {
                    assetInputEvent(assetsElement);
                    setStorageVal(Constants.LOCAL_SEARCHASSET, localSearch);
                });
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (target.id === "assetFilter") {
                assetFilterMenu(assetsElement);
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (target.id === "assetSyntaxCheck") {
                assetMethodMenu(target, () => {
                    element.querySelector("#assetSyntaxCheck").outerHTML = genQueryHTML(localSearch.method, "assetSyntaxCheck");
                    assetInputEvent(assetsElement, localSearch);
                    setStorageVal(Constants.LOCAL_SEARCHASSET, localSearch);
                });
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (target.id === "searchSyntaxCheck") {
                queryMenu(config, () => {
                    element.querySelector("#searchSyntaxCheck").outerHTML = genQueryHTML(config.method, "searchSyntaxCheck");
                    config.page = 1;
                    inputEvent(element, config, edit, true);
                    if (updateCB) {
                        updateCB(config);
                    }
                });
                const rect = target.getBoundingClientRect();
                window.siyuan.menus.menu.popup({ x: rect.right, y: rect.bottom, isLeft: true });
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (target.id === "searchHistoryBtn") {
                toggleSearchHistory(element, config, edit);
                event.stopPropagation();
                event.preventDefault();
                return;
            } else if (target.id === "assetHistoryBtn") {
                toggleAssetHistory(assetsElement);
                event.stopPropagation();
                event.preventDefault();
                return;
            } else if (target.id === "replaceHistoryBtn") {
                toggleReplaceHistory(element.querySelector("#replaceInput"));
                event.stopPropagation();
                event.preventDefault();
                return;
            } else if (target.id === "replaceAllBtn") {
                replace(element, config, edit, true);
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (type === "assetRefresh") {
                assetInputEvent(assetsElement);
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (target.id === "replaceBtn") {
                replace(element, config, edit, false);
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (target.classList.contains("b3-list-item__toggle")) {
                target.parentElement.nextElementSibling.classList.toggle("fn__none");
                target.firstElementChild.classList.toggle("b3-list-item__arrow--open");
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (target.classList.contains("b3-list-item")) {
                const searchAssetInputElement = element.querySelector("#searchAssetInput") as HTMLInputElement;
                if (type === "search-new") {
                    if (config.method == 0) {
                        newFileByName(app, searchInputElement.value);
                    }
                } else if (type === "search-item") {
                    const searchType = target.dataset.id ? "asset" : (unRefPanelElement.classList.contains("fn__none") ? "doc" : "unRef");
                    let isClick = event.detail === 1;
                    let isDblClick = event.detail === 2;
                    /// #if BROWSER
                    if (isIPad()) { // 需要进行 ipad 判断 https://github.com/siyuan-note/siyuan/issues/12704
                        const newDate = new Date().getTime();
                        isClick = newDate - lastClickTime > Constants.TIMEOUT_DBLCLICK;
                        isDblClick = !isClick;
                        lastClickTime = newDate;
                    }
                    /// #endif
                    if (isClick) {
                        clickTimeout = window.setTimeout(() => {
                            if (searchType === "asset") {
                                if (!target.classList.contains("b3-list-item--focus")) {
                                    assetsElement.querySelector(".b3-list-item--focus").classList.remove("b3-list-item--focus");
                                    target.classList.add("b3-list-item--focus");
                                    renderPreview(element.querySelector("#searchAssetPreview"), target.dataset.id, searchAssetInputElement.value, window.siyuan.storage[Constants.LOCAL_SEARCHASSET].method);
                                    searchAssetInputElement.focus();
                                } else if (target.classList.contains("b3-list-item--focus")) {
                                    renderNextAssetMark(element.querySelector("#searchAssetPreview"));
                                    searchAssetInputElement.focus();
                                }
                            } else {
                                if (event.altKey) {
                                    openSearchEditor({
                                        rootId: target.getAttribute("data-root-id"),
                                        protyle: edit.protyle,
                                        id: target.getAttribute("data-node-id"),
                                        cb: closeCB,
                                        openPosition: "right",
                                    });
                                } else if (!target.classList.contains("b3-list-item--focus")) {
                                    (searchType === "doc" ? searchPanelElement : unRefPanelElement).querySelector(".b3-list-item--focus").classList.remove("b3-list-item--focus");
                                    target.classList.add("b3-list-item--focus");
                                    getArticle({
                                        edit: searchType === "doc" ? edit : unRefEdit,
                                        id: target.getAttribute("data-node-id"),
                                        config: searchType === "doc" ? config : null,
                                        value: searchType === "doc" ? searchInputElement.value : null,
                                    });
                                    searchInputElement.focus();
                                } else if (searchType === "doc" && target.classList.contains("b3-list-item--focus")) {
                                    renderNextSearchMark({
                                        edit,
                                        id: target.getAttribute("data-node-id"),
                                        target,
                                    });
                                    searchInputElement.focus();
                                }
                            }
                        }, Constants.TIMEOUT_DBLCLICK);
                    } else if (isDblClick && isNotCtrl(event)) {
                        clearTimeout(clickTimeout);
                        if (searchType === "asset") {
                            /// #if !BROWSER
                            useShell("showItemInFolder", path.join(window.siyuan.config.system.dataDir, target.lastElementChild.getAttribute("aria-label")));
                            /// #endif
                        } else {
                            openSearchEditor({
                                rootId: target.getAttribute("data-root-id"),
                                protyle: edit.protyle,
                                id: target.getAttribute("data-node-id"),
                                cb: closeCB
                            });
                        }
                    }
                    window.siyuan.menus.menu.remove();
                } else if (target.querySelector(".b3-list-item__toggle")) {
                    target.nextElementSibling.classList.toggle("fn__none");
                    target.firstElementChild.firstElementChild.classList.toggle("b3-list-item__arrow--open");
                }
                event.stopPropagation();
                event.preventDefault();
                break;
            }
            target = target.parentElement;
        }
    }, false);

    searchInputElement.addEventListener("compositionend", (event: InputEvent) => {
        config.page = 1;
        if (event.isComposing) {
            return;
        }
        inputEvent(element, config, edit, true);
        if (updateCB) {
            updateCB(config);
        }
    });
    searchInputElement.addEventListener("input", (event: InputEvent) => {
        config.page = 1;
        if (event.isComposing) {
            return;
        }
        inputEvent(element, config, edit, true);
        if (updateCB) {
            updateCB(config);
        }
    });
    searchInputElement.addEventListener("blur", () => {
        if (config.removed) {
            config.k = searchInputElement.value;
            window.siyuan.storage[Constants.LOCAL_SEARCHDATA] = Object.assign({}, config);
            setStorageVal(Constants.LOCAL_SEARCHDATA, window.siyuan.storage[Constants.LOCAL_SEARCHDATA]);
        }
        saveKeyList("keys", searchInputElement.value);
    });
    searchInputElement.addEventListener("keydown", (event) => {
        electronUndo(event);
    });
    replaceInputElement.addEventListener("keydown", (event) => {
        electronUndo(event);
    });
    addClearButton({
        inputElement: searchInputElement,
        right: 8,
        height: searchInputElement.clientHeight,
        clearCB() {
            config.page = 1;
            inputEvent(element, config, edit);
            if (updateCB) {
                updateCB(config);
            }
        }
    });
    addClearButton({
        right: 8,
        inputElement: replaceInputElement,
        height: searchInputElement.clientHeight,
    });
    inputEvent(element, config, edit);
    return { edit, unRefEdit };
};

export const openSearchEditor = (options: {
    protyle: IProtyle,
    openPosition?: string,
    id: string,
    rootId: string,
    cb: () => void
}) => {
    let currentRange = (options.rootId === options.protyle.block.rootID && options.id === options.protyle.block.id) ?
        options.protyle.highlight.ranges[options.protyle.highlight.rangeIndex] : null;
    if (currentRange) {
        const rangeBlockElement = hasClosestBlock(currentRange.startContainer);
        if (rangeBlockElement) {
            options.id = rangeBlockElement.getAttribute("data-node-id");
            const offset = getSelectionOffset(getContenteditableElement(rangeBlockElement), null, options.protyle.highlight.ranges[options.protyle.highlight.rangeIndex]);
            const scrollAttr: IScrollAttr = {
                rootId: options.protyle.block.rootID,
                focusId: options.id,
                focusStart: offset.start,
                focusEnd: offset.end,
                zoomInId: options.protyle.block.showAll ? options.protyle.block.id : undefined,
                scrollTop: options.protyle.contentElement.scrollTop,
            };
            window.siyuan.storage[Constants.LOCAL_FILEPOSITION][options.protyle.block.rootID] = scrollAttr;
            if (offset.start === offset.end) {
                currentRange = null;
            }
        }
    }
    checkFold(options.id, (zoomIn) => {
        openFileById({
            app: options.protyle.app,
            id: options.id,
            action: currentRange ?
                (zoomIn ? [Constants.CB_GET_FOCUS, Constants.CB_GET_ALL, Constants.CB_GET_SCROLL, Constants.CB_GET_SEARCH] : [Constants.CB_GET_FOCUS, Constants.CB_GET_CONTEXT, Constants.CB_GET_SCROLL, Constants.CB_GET_SEARCH]) :
                (zoomIn ? [Constants.CB_GET_FOCUS, Constants.CB_GET_ALL, Constants.CB_GET_HL] : [Constants.CB_GET_FOCUS, Constants.CB_GET_CONTEXT, Constants.CB_GET_HL]),
            zoomIn,
            position: options.openPosition,
            scrollPosition: "center"
        });
        if (options.cb) {
            options.cb();
        }
    });
};

export const genQueryHTML = (method: number, id: string) => {
    let methodTip = "";
    let methodIcon = "";
    switch (method) {
        case 0:
            methodTip = siyuanI18n.keyword;
            methodIcon = "Exact";
            break;
        case 1:
            methodTip = siyuanI18n.querySyntax;
            methodIcon = "Quote";
            break;
        case 2:
            methodTip = "SQL";
            methodIcon = "Database";
            break;
        case 3:
            methodTip = siyuanI18n.regex;
            methodIcon = "Regex";
            break;
        case 4:
            methodTip = "语义搜索";  // TODO: 后续添加到 i18n
            methodIcon = "Mindmap";
            break;
    }
    return `<span id="${id}" aria-label="${siyuanI18n.searchMethod} ${methodTip}" class="block__icon ariaLabel" data-position="9south">
    <svg><use xlink:href="#icon${methodIcon}"></use></svg>
</span>`;
};


export const updateConfig = (element: Element, item: Config.IUILayoutTabSearchConfig, config: Config.IUILayoutTabSearchConfig,
    edit: Protyle, clear = false) => {
    const dialogElement = hasClosestByClassName(element, "b3-dialog--open");
    if (dialogElement && dialogElement.getAttribute("data-key") === Constants.DIALOG_SEARCH) {
        // https://github.com/siyuan-note/siyuan/issues/6828
        item.hPath = config.hPath;
        item.idPath = [...config.idPath];
    }
    if (config.hasReplace !== item.hasReplace) {
        const replaceHeaderElement = element.querySelectorAll(".search__header")[1];
        if (item.hasReplace) {
            replaceHeaderElement.classList.remove("fn__none");
        } else {
            replaceHeaderElement.classList.add("fn__none");
        }
    }
    const searchPathInputElement = element.querySelector("#searchPathInput");
    if (item.hPath) {
        searchPathInputElement.innerHTML = `${escapeGreat(item.hPath)}<svg class="search__rmpath"><use xlink:href="#iconCloseRound"></use></svg>`;
        searchPathInputElement.setAttribute("aria-label", escapeHtml(item.hPath));
    } else {
        searchPathInputElement.innerHTML = "";
        searchPathInputElement.setAttribute("aria-label", "");
    }
    if (config.group !== item.group) {
        if (item.group === 0) {
            element.querySelector("#searchExpand").parentElement.classList.add("fn__none");
        } else {
            element.querySelector("#searchExpand").parentElement.classList.remove("fn__none");
        }
    }
    let includeChild = true;
    let enableIncludeChild = false;
    item.idPath.forEach(pathItem => {
        if (pathItem.endsWith(".sy")) {
            includeChild = false;
        }
        if (pathItem.split("/").length > 1) {
            enableIncludeChild = true;
        }
    });
    const searchIncludeElement = element.querySelector("#searchInclude");
    if (includeChild) {
        searchIncludeElement.firstElementChild.classList.add("ft__primary");
    } else {
        searchIncludeElement.firstElementChild.classList.remove("ft__primary");
    }
    if (enableIncludeChild) {
        searchIncludeElement.removeAttribute("disabled");
    } else {
        searchIncludeElement.setAttribute("disabled", "disabled");
    }
    if (item.k || clear) {
        (element.querySelector("#searchInput") as HTMLInputElement).value = item.k;
    }
    (element.querySelector("#replaceInput") as HTMLInputElement).value = item.r;
    element.querySelector("#searchSyntaxCheck").outerHTML = genQueryHTML(item.method, "searchSyntaxCheck");
    config = JSON.parse(JSON.stringify(item));
    window.siyuan.storage[Constants.LOCAL_SEARCHDATA] = JSON.parse(JSON.stringify(item));
    setStorageVal(Constants.LOCAL_SEARCHDATA, window.siyuan.storage[Constants.LOCAL_SEARCHDATA]);
    inputEvent(element, config, edit);
    window.siyuan.menus.menu.remove();
};

const scrollToCurrent = (contentElement: HTMLElement, currentRange: Range, contentRect: DOMRect) => {
    contentElement.scrollTop = contentElement.scrollTop + currentRange.getBoundingClientRect().top - contentRect.top - contentRect.height / 2;
    const tableElement = hasClosestByClassName(currentRange.startContainer, "table");
    if (tableElement) {
        const cellElement = hasClosestByTag(currentRange.startContainer, "TD") || hasClosestByTag(currentRange.startContainer, "TH");
        if (cellElement) {
            tableElement.firstElementChild.scrollLeft = cellElement.offsetLeft;
            if (tableElement.getAttribute("custom-pinthead") === "true") {
                contentElement.scrollTop = contentElement.scrollTop + tableElement.getBoundingClientRect().top - contentRect.top;
                tableElement.querySelector("table").scrollTop = cellElement.offsetTop;
            }
        }
    }
};

const renderNextSearchMark = (options: {
    id: string,
    edit: Protyle,
    target: Element,
}) => {
    const contentRect = options.edit.protyle.contentElement.getBoundingClientRect();
    if (isSupportCSSHL()) {
        options.edit.protyle.highlight.markHL.clear();
        options.edit.protyle.highlight.mark.clear();
        options.edit.protyle.highlight.rangeIndex++;
        if (options.edit.protyle.highlight.rangeIndex >= options.edit.protyle.highlight.ranges.length) {
            options.edit.protyle.highlight.rangeIndex = 0;
        }
        let currentRange: Range;
        options.edit.protyle.highlight.ranges.forEach((item, index) => {
            if (options.edit.protyle.highlight.rangeIndex === index) {
                options.edit.protyle.highlight.markHL.add(item);
                currentRange = item;
            } else {
                options.edit.protyle.highlight.mark.add(item);
            }
        });
        if (currentRange) {
            if (!currentRange.toString()) {
                highlightById(options.edit.protyle, options.id, "center");
            } else {
                scrollToCurrent(options.edit.protyle.contentElement, currentRange, contentRect);
            }
        }
        return;
    }
    let matchElement;
    const allMatchElements = Array.from(options.edit.protyle.wysiwyg.element.querySelectorAll('span[data-type~="search-mark"]'));
    allMatchElements.find((item, itemIndex) => {
        if (item.classList.contains("search-mark--hl")) {
            item.classList.remove("search-mark--hl");
            matchElement = allMatchElements[itemIndex + 1];
            return;
        }
    });
    if (!matchElement) {
        matchElement = allMatchElements[0];
    }
    if (matchElement) {
        matchElement.classList.add("search-mark--hl");
        options.edit.protyle.contentElement.scrollTop = options.edit.protyle.contentElement.scrollTop + matchElement.getBoundingClientRect().top - contentRect.top - contentRect.height / 2;
    }
};

let articleId: string;

export const getArticle = (options: {
    id: string,
    config?: Config.IUILayoutTabSearchConfig,
    edit: Protyle
    value?: string,
}) => {
    articleId = options.id;
    checkFold(options.id, (zoomIn) => {
        if (articleId !== options.id) {
            return;
        }
        options.edit.protyle.scroll.lastScrollTop = 0;
        addLoading(options.edit.protyle);
        fetchPost("/api/block/getDocInfo", {
            id: options.id,
        }, (response) => {
            if (articleId !== options.id) {
                return;
            }
            if (options.edit.protyle.options.render.title) {
                options.edit.protyle.title.render(options.edit.protyle, response);
            }
            fetchPost("/api/filetree/getDoc", {
                id: options.id,
                query: options.value || null,
                queryMethod: options.config?.method || null,
                queryTypes: options.config?.types || null,
                mode: zoomIn ? 0 : 3,
                size: zoomIn ? Constants.SIZE_GET_MAX : window.siyuan.config.editor.dynamicLoadBlocks,
                zoom: zoomIn,
                highlight: !isSupportCSSHL(),
            }, getResponse => {
                if (articleId !== options.id) {
                    return;
                }
                options.edit.protyle.query = {
                    key: options.value || null,
                    method: options.config?.method || null,
                    types: options.config?.types || null,
                };
                onGet({
                    updateReadonly: true,
                    data: getResponse,
                    protyle: options.edit.protyle,
                    action: zoomIn ? [Constants.CB_GET_ALL, Constants.CB_GET_HTML] : [Constants.CB_GET_HTML],
                });

                const contentRect = options.edit.protyle.contentElement.getBoundingClientRect();
                if (isSupportCSSHL()) {
                    let observer: ResizeObserver;
                    searchMarkRender(options.edit.protyle, getResponse.data.keywords, options.id, () => {
                        const highlightKeys = () => {
                            const currentRange = options.edit.protyle.highlight.ranges[options.edit.protyle.highlight.rangeIndex];
                            if (options.edit.protyle.highlight.ranges.length > 0 && currentRange) {
                                if (!currentRange.toString()) {
                                    highlightById(options.edit.protyle, options.id, "center");
                                } else {
                                    scrollToCurrent(options.edit.protyle.contentElement, currentRange, contentRect);
                                }
                            } else {
                                highlightById(options.edit.protyle, options.id, "center");
                            }
                        };
                        if (observer) {
                            observer.disconnect();
                        }
                        highlightKeys();
                        observer = new ResizeObserver(() => {
                            highlightKeys();
                        });
                        observer.observe(options.edit.protyle.wysiwyg.element);
                        setTimeout(() => {
                            observer.disconnect();
                        }, Constants.TIMEOUT_COUNT);
                    });
                } else {
                    const matchElements = options.edit.protyle.wysiwyg.element.querySelectorAll('span[data-type~="search-mark"]');
                    if (matchElements.length === 0) {
                        return;
                    }
                    matchElements[0].classList.add("search-mark--hl");
                    options.edit.protyle.contentElement.scrollTop = options.edit.protyle.contentElement.scrollTop + matchElements[0].getBoundingClientRect().top - contentRect.top - contentRect.height / 2;
                }
            });
        });
    });
};

export const replace = (element: Element, config: Config.IUILayoutTabSearchConfig, edit: Protyle, isAll: boolean) => {
    if (config.method === 2) {
        showMessage(siyuanI18n._kernel[132]);
        return;
    }
    const searchPanelElement = element.querySelector("#searchList");
    const replaceInputElement = element.querySelector("#replaceInput") as HTMLInputElement;
    const searchInputElement = element.querySelector("#searchInput") as HTMLInputElement;

    const loadElement = element.querySelector("svg.fn__rotate");
    if (!loadElement.classList.contains("fn__none")) {
        return;
    }
    saveKeyList("replaceKeys", replaceInputElement.value);
    const currentList: HTMLElement = searchPanelElement.querySelector(".b3-list-item--focus");
    if (!currentList || currentList.dataset.type === "search-new") {
        return;
    }
    loadElement.classList.remove("fn__none");
    const currentId = currentList.getAttribute("data-node-id");
    fetchPost("/api/search/findReplace", {
        k: config.method === 0 || config.method === 1 ? getKeyByLiElement(currentList) : searchInputElement.value,
        r: replaceInputElement.value,
        method: config.method,
        types: config.types,
        paths: config.idPath || [],
        groupBy: config.group,
        orderBy: config.sort,
        page: config.page,
        ids: isAll ? [] : [currentId],
        replaceTypes: config.replaceTypes
    }, (response) => {
        loadElement.classList.add("fn__none");
        if (response.code === 1) {
            showMessage(response.msg);
            return;
        }
        if (isAll) {
            inputEvent(element, config, edit, false);
            return;
        }
        const rootId = currentList.getAttribute("data-root-id");
        getAllModels().editor.forEach(item => {
            if (rootId === item.editor.protyle.block.rootID) {
                reloadProtyle(item.editor.protyle, false);
            }
        });
        let newId = currentList.getAttribute("data-node-id");
        if (currentList.nextElementSibling) {
            newId = currentList.nextElementSibling.getAttribute("data-node-id");
        } else if (currentList.previousElementSibling) {
            newId = currentList.previousElementSibling.getAttribute("data-node-id");
        }
        if (config.group === 1 && !newId) {
            const nextDocElement = currentList.parentElement.nextElementSibling || currentList.parentElement.previousElementSibling.previousElementSibling?.previousElementSibling;
            if (nextDocElement) {
                newId = nextDocElement.nextElementSibling.firstElementChild.getAttribute("data-node-id");
            }
        }
        inputEvent(element, config, edit, false, {
            currentId,
            newId
        });
    });
};

// inputEvent 函数已拆分到 inputEvent.ts


export const getAttr = (block: IBlock) => {
    let attrHTML = "";
    if (block.name) {
        attrHTML += `<span class="b3-list-item__meta fn__flex" style="max-width: 30%"><svg class="b3-list-item__hinticon"><use xlink:href="#iconN"></use></svg><span class="b3-list-item__hinttext">${block.name}</span></span>`;
    }
    if (block.alias) {
        attrHTML += `<span class="b3-list-item__meta fn__flex" style="max-width: 30%"><svg class="b3-list-item__hinticon"><use xlink:href="#iconA"></use></svg><span class="b3-list-item__hinttext">${block.alias}</span></span>`;
    }
    if (block.memo) {
        attrHTML += `<span class="b3-list-item__meta fn__flex" style="max-width: 30%"><svg class="b3-list-item__hinticon"><use xlink:href="#iconM"></use></svg><span class="b3-list-item__hinttext">${block.memo}</span></span>`;
    }
    return attrHTML;
};


