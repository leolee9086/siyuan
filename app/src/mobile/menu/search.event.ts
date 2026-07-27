import {Constants} from "../../constants";
import {getCurrentEditor} from "../util/getCurrentEditor";
import {fetchPost} from "../../util/network/fetch";
import {preventScroll} from "../../protyle/scroll/preventScroll";
import {getNotebookName, pathPosix} from "../../util/file/pathName";
import {movePathTo} from "../../util/file/movePath/movePathTo";
import {initCriteriaMenu, moreMenu} from "../../search/menu";
import {setStorageVal} from "../../protyle/util/compatibility";
import {escapeHtml} from "../../util/DOM/escape";
import {closePanel} from "../util/closePanel";
import {
    assetFilterMenu,
    assetInputEvent,
    assetMethodMenu,
    assetMoreMenu,
    renderNextAssetMark,
    renderPreview,
} from "../../search/assets";
import {addClearButton} from "../../util/DOM/addClearButton";
import {checkFold} from "../../util/platform/noRelyPCFunction";
import {getDefaultSubType, getDefaultType} from "../../search/defaults/searchDefaults";
import {
    saveKeyList,
    toggleReplaceHistory,
    toggleAssetHistory,
    saveAssetKeyList,
} from "../../search/toggleHistory";
import type { AppFacade } from "../../app/AppFacade.types";
import {siyuanI18n} from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import {MenuItem} from "../../menus/Menu.Item";
import {goUnRef} from "./searchInvalidRefs";
import {replace, updateConfig} from "./search.render";
import type {UpdateSearchResultFn} from "./search.render";

export const initSearchEvent = (
    app: AppFacade,
    element: Element,
    config: Config.IUILayoutTabSearchConfig,
    updateSearchResult: UpdateSearchResultFn,
    goAsset: () => void,
    getUnRefListMobile: (element: Element, page?: number) => void,
) => {
    const searchInputElement = document.getElementById("toolbarSearch") as HTMLInputElement;
    searchInputElement.value = config.k || "";
    searchInputElement.addEventListener("compositionend", (event: InputEvent) => {
        if (event && event.isComposing) {
            return;
        }
        config.page = 1;
        updateSearchResult(config, element, true);
    });
    searchInputElement.addEventListener("input", (event: InputEvent) => {
        if (event && event.isComposing) {
            return;
        }
        config.page = 1;
        updateSearchResult(config, element, true);
    });
    searchInputElement.addEventListener("blur", () => {
        if (config.removed) {
            config.k = searchInputElement.value;
            window.siyuan.storage[Constants.LOCAL_SEARCHDATA] = Object.assign({}, config);
            setStorageVal(Constants.LOCAL_SEARCHDATA, window.siyuan.storage[Constants.LOCAL_SEARCHDATA]);
        }
        saveKeyList("keys", searchInputElement.value);
    });
    addClearButton({
        inputElement: searchInputElement,
        className: "toolbar__icon",
        clearAriaLabel: siyuanI18n.clear,
        clearCB() {
            config.page = 1;
            updateSearchResult(config, element);
        }
    });
    const replaceInputElement = element.querySelector(".toolbar .toolbar__title") as HTMLInputElement;
    replaceInputElement.value = config.r || "";
    addClearButton({
        inputElement: replaceInputElement,
        className: "toolbar__icon",
        clearAriaLabel: siyuanI18n.clear,
    });
    const criteriaData: Config.IUILayoutTabSearchConfig[] = [];
    initCriteriaMenu(element.querySelector("#criteria"), criteriaData, config);

    const assetsElement = document.querySelector("#searchAssetsPanel");
    const unRefElement = document.querySelector("#searchUnRefPanel");
    const searchListElement = element.querySelector("#searchList") as HTMLElement;
    const localSearch = window.siyuan.storage[Constants.LOCAL_SEARCHASSET] as ISearchAssetOption;
    element.addEventListener("click", (event: MouseEvent) => {
        let target = event.target as HTMLElement;
        while (target && (target !== element)) {
            const type = target.getAttribute("data-type");
            if (type === "replaceHistory") {
                toggleReplaceHistory(target.nextElementSibling as HTMLInputElement);
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (type === "assetHistory") {
                toggleAssetHistory(assetsElement);
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (type === "previous") {
                if (!target.getAttribute("disabled")) {
                    config.page--;
                    updateSearchResult(config, element);
                }
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (type === "next") {
                if (!target.getAttribute("disabled")) {
                    config.page++;
                    updateSearchResult(config, element);
                }
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (type === "set-criteria") {
                config.removed = false;
                target.parentElement.querySelector(".b3-chip--current")?.classList.remove("b3-chip--current");
                target.classList.add("b3-chip--current");
                criteriaData.find(item => {
                    if (item.name === target.innerText.trim()) {
                        item = updateConfig(element, item, config, updateSearchResult);
                        return true;
                    }
                });
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (type === "remove-criteria") {
                const name = target.parentElement.innerText.trim();
                fetchPost("/api/storage/removeCriterion", {name});
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
                        subTypes: getDefaultSubType(),
                        replaceTypes: Object.assign({}, Constants.SIYUAN_DEFAULT_REPLACETYPES),
                    }, config, updateSearchResult, true);
                }
                if (target.parentElement.parentElement.childElementCount === 1) {
                    target.parentElement.parentElement.classList.add("fn__none");
                }
                target.parentElement.remove();
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (type === "remove-path") {
                config.idPath = [];
                config.hPath = "";
                element.querySelector("#searchPath").classList.add("fn__none");
                config.page = 1;
                updateSearchResult(config, element, true);
                const includeElement = element.querySelector('[data-type="include"]');
                includeElement.classList.remove("toolbar__icon--active");
                includeElement.setAttribute("disabled", "disabled");
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (type === "expand") {
                Array.from(searchListElement.children).forEach(item => {
                    if (item.classList.contains("b3-list-item")) {
                        item.querySelector(".b3-list-item__arrow").classList.add("b3-list-item__arrow--open");
                        item.nextElementSibling.classList.remove("fn__none");
                    }
                });
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (type === "contract") {
                Array.from(searchListElement.children).forEach(item => {
                    if (item.classList.contains("b3-list-item")) {
                        item.querySelector(".b3-list-item__arrow").classList.remove("b3-list-item__arrow--open");
                        item.nextElementSibling.classList.add("fn__none");
                    }
                });
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (type === "currentPath" && !target.hasAttribute("disabled")) {
                const editProtyle = getCurrentEditor().protyle;
                fetchPost("/api/filetree/getHPathsByPaths", {paths: [editProtyle.path]}, (response) => {
                    config.idPath = [pathPosix().join(editProtyle.notebookId, editProtyle.path)];
                    config.hPath = response.data[0];
                    const searchPathElement = element.querySelector("#searchPath");
                    searchPathElement.classList.remove("fn__none");
                    searchPathElement.innerHTML = `<div class="b3-chip b3-chip--middle">${escapeHtml(config.hPath)}<svg data-type="remove-path" class="b3-chip__close"><use xlink:href="#iconClose"></use></svg></div>`;

                    const includeElement = element.querySelector('[data-type="include"]');
                    includeElement.classList.remove("toolbar__icon--active");
                    includeElement.removeAttribute("disabled");
                    config.page = 1;
                    updateSearchResult(config, element, true);
                });
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (type === "path") {
                movePathTo({
                    cb: (toPath, toNotebook) => {
                        fetchPost("/api/filetree/getHPathsByPaths", {paths: toPath}, (response) => {
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

                            const searchPathElement = element.querySelector("#searchPath");
                            searchPathElement.classList.remove("fn__none");
                            searchPathElement.innerHTML = `<div class="b3-chip b3-chip--middle">${escapeHtml(config.hPath)}<svg data-type="remove-path" class="b3-chip__close"><use xlink:href="#iconClose"></use></svg></div>`;

                            const includeElement = element.querySelector('[data-type="include"]');
                            includeElement.classList.add("toolbar__icon--active");
                            if (enableIncludeChild) {
                                includeElement.removeAttribute("disabled");
                            } else {
                                includeElement.setAttribute("disabled", "disabled");
                            }
                            config.page = 1;
                            updateSearchResult(config, element, true);
                        });
                    },
                    flashcard: false,
                    title: siyuanI18n.specifyPath
                });
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (type === "include" && !target.hasAttribute("disabled")) {
                target.classList.toggle("toolbar__icon--active");
                if (target.classList.contains("toolbar__icon--active")) {
                    config.idPath.forEach((item, index) => {
                        if (item.endsWith(".sy")) {
                            config.idPath[index] = item.replace(".sy", "");
                        }
                    });
                } else {
                    config.idPath.forEach((item, index) => {
                        if (!item.endsWith(".sy") && item.split("/").length > 1) {
                            config.idPath[index] = item + ".sy";
                        }
                    });
                }
                config.page = 1;
                updateSearchResult(config, element, true);
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (type === "toggle-replace") {
                config.hasReplace = !config.hasReplace;
                replaceInputElement.parentElement.classList.toggle("fn__none");
                target.classList.toggle("toolbar__icon--active");
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (type === "more") {
                moreMenu(config, criteriaData, element, {
                    onChange: () => {
                        config.page = 1;
                        updateSearchResult(config, element, true);
                    },
                    removeCriterion: () => {
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
                            subTypes: getDefaultSubType(),
                            replaceTypes: Object.assign({}, Constants.SIYUAN_DEFAULT_REPLACETYPES),
                        }, config, updateSearchResult, true);
                        element.querySelector("#criteria .b3-chip--current")?.classList.remove("b3-chip--current");
                    },
                    appendLeadingItems: () => {
                        window.siyuan.menus.menu.append(new MenuItem({
                            iconHTML: "",
                            label: siyuanI18n.listInvalidRefBlocks,
                            click: goUnRef,
                        }).element);
                        window.siyuan.menus.menu.append(new MenuItem({type: "separator"}).element);
                    },
                });
                window.siyuan.menus.menu.fullscreen();
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (type === "replace-all") {
                replace(element, config, true, updateSearchResult);
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (type === "refreshUnRef") {
                getUnRefListMobile(unRefElement);
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (type === "unRefPrevious") {
                if (!target.getAttribute("disabled")) {
                    let currentPage = parseInt(unRefElement.querySelector("#searchUnRefResult").lastElementChild.textContent);
                    if (currentPage > 1) {
                        currentPage--;
                        getUnRefListMobile(unRefElement, currentPage);
                    }
                }
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (type === "unRefNext") {
                const unRefRageElement = unRefElement.querySelector("#searchUnRefResult").lastElementChild;
                let currentPage = parseInt(unRefRageElement.textContent);
                if (currentPage < parseInt(unRefRageElement.textContent.split("/")[1])) {
                    currentPage++;
                    getUnRefListMobile(unRefElement, currentPage);
                }
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (type === "queryAsset") {
                assetMethodMenu(target, () => {
                    assetInputEvent(assetsElement, localSearch);
                    setStorageVal(Constants.LOCAL_SEARCHASSET, localSearch);
                });
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (type === "filterAsset") {
                assetFilterMenu(assetsElement);
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (type === "moreAsset") {
                assetMoreMenu(target, assetsElement, () => {
                    assetInputEvent(assetsElement);
                    setStorageVal(Constants.LOCAL_SEARCHASSET, localSearch);
                });
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (type === "goAsset") {
                goAsset();
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (type === "goSearch") {
                assetsElement.classList.add("fn__none");
                unRefElement.classList.add("fn__none");
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (type === "assetPrevious") {
                if (!target.getAttribute("disabled")) {
                    assetInputEvent(assetsElement, localSearch, parseInt(assetsElement.querySelector("#searchAssetResult .fn__flex-center").textContent.split("/")[1]) - 1);
                }
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (type === "assetNext") {
                if (!target.getAttribute("disabled")) {
                    assetInputEvent(assetsElement, localSearch, parseInt(assetsElement.querySelector("#searchAssetResult .fn__flex-center").textContent.split("/")[1]) + 1);
                }
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (type === "replace") {
                replace(element, config, false, updateSearchResult);
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
                if (target.getAttribute("data-type") === "search-new") {
                    void app.createDocument(searchInputElement.value);
                } else if (target.getAttribute("data-type") === "search-item") {
                    const id = target.getAttribute("data-node-id");
                    if (id) {
                        if (window.siyuan.mobile.editor?.protyle) {
                            preventScroll(window.siyuan.mobile.editor.protyle);
                        }
                        checkFold(id, (zoomIn) => {
                            app.openBlock({
                                id,
                                action: zoomIn
                                    ? [Constants.CB_GET_ALL]
                                    : [Constants.CB_GET_HL, Constants.CB_GET_CONTEXT, Constants.CB_GET_ROOTSCROLL],
                                zoomIn,
                            });
                        });
                        closePanel();
                    } else {
                        if (!target.classList.contains("b3-list-item--focus")) {
                            element.querySelector("#searchAssetList .b3-list-item--focus").classList.remove("b3-list-item--focus");
                            target.classList.add("b3-list-item--focus");
                            renderPreview(element.querySelector("#searchAssetPreview"), target.dataset.id, (element.querySelector("#searchAssetInput") as HTMLInputElement).value, window.siyuan.storage[Constants.LOCAL_SEARCHASSET].method);
                        } else if (target.classList.contains("b3-list-item--focus")) {
                            renderNextAssetMark(element.querySelector("#searchAssetPreview"));
                        }
                    }
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
};
