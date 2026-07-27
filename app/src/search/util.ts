import { getAllModels } from "../layout/getAll";
import { Constants } from "../constants";
import { escapeHtml } from "../util/DOM/escape";
import { fetchPost } from "../util/network/fetch";
import { openFile } from "../editor/util";
import { openFileById } from "../editor/utils.openFileById";
import { showMessage } from "../dialog/message";
import { reloadProtyle } from "../protyle/util/reload";
import type {ProtyleDomain} from "../protyle/protyle.types";
import { onGet } from "../protyle/util/onGet";
import {addLoading} from "../protyle/ui/loading";
import { hasClosestBlock, hasClosestByClassName } from "../protyle/util/hasClosest";
import {setStorageVal} from "../util/storage/setStorageVal";
import {getKeyByLiElement} from "./result/searchResultKey";
import type { AppFacade } from "../app/AppFacade.types";
import {checkFold} from "../block/fold/checkFold";
import { isSupportCSSHL, searchMarkRender } from "../protyle/render/searchMarkRender";
import {saveKeyList} from "./history/storage";
import { highlightById } from "../util/DOM/highlightById";
import { scrollToCurrent } from "./utils/utils.scrollToCurrent";
import { getSelectionOffset } from "../protyle/util/selection";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import { getContenteditableElement } from "../protyle/wysiwyg/getBlock";

// inputEvent 已拆分到独立文件，导入供内部使用并重新导出
import { inputEvent } from "./inputEvent";
export { inputEvent };

export const openGlobalSearch = (app: AppFacade, text: string, replace: boolean, searchData?: Config.IUILayoutTabSearchConfig) => {
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
            method: searchData ? searchData.method : (localData.method === 4 && !window.siyuan.config.ai.embedding.enabled ? 0 : localData.method),
            hPath: "",
            idPath: [],
            group: localData.group,
            sort: localData.sort,
            types: Object.assign({}, localData.types),
            subTypes: Object.assign({}, localData.subTypes),
            replaceTypes: Object.assign({}, localData.replaceTypes),
            removed: localData.removed,
            page: 1
        },
        position: (!window.siyuan.config.fileTree.noSplitScreenWhenOpenTab && (window.siyuan.layout.centerLayout.children.length > 1 || window.innerWidth > 1024)) ? "right" : undefined
    });
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
    if (options.protyle.block.scroll) {
        currentRange = null;
    }
    if (currentRange) {
        const rangeBlockElement = hasClosestBlock(currentRange.startContainer);
        if (rangeBlockElement) {
            options.id = rangeBlockElement.getAttribute("data-node-id");
            const offset = getSelectionOffset(getContenteditableElement(rangeBlockElement) || rangeBlockElement,
                null, options.protyle.highlight.ranges[options.protyle.highlight.rangeIndex]);
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
            methodTip = siyuanI18n.semanticSearch;
            methodIcon = "Sparkles";
            break;
    }
    return `<span id="${id}" aria-label="${siyuanI18n.searchMethod} ${methodTip}" class="block__icon ariaLabel" data-position="9south">
    <svg><use xlink:href="#icon${methodIcon}"></use></svg>
</span>`;
};


export const updateConfig = (element: Element, item: Config.IUILayoutTabSearchConfig, config: Config.IUILayoutTabSearchConfig,
    edit: ProtyleDomain, clear = false) => {
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
        searchPathInputElement.innerHTML = `${escapeHtml(item.hPath)}<svg class="search__rmpath"><use xlink:href="#iconCloseRound"></use></svg>`;
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


export const renderNextSearchMark = (options: {
    id: string,
    edit: ProtyleDomain,
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
    edit: ProtyleDomain
    value?: string,
}) => {
    articleId = options.id;
    checkFold(options.id, (zoomIn) => {
        if (articleId !== options.id) {
            return;
        }
        options.edit.protyle.scroll.lastScrollTop = 0;
        addLoading(options.edit.protyle);
        const docInfoParam: IObject = {
            id: options.id,
        };
        if (isEncryptedBox(options.edit.protyle.notebookId)) {
            docInfoParam.notebook = options.edit.protyle.notebookId;
        }
        fetchPost("/api/block/getDocInfo", docInfoParam, (response) => {
            if (articleId !== options.id) {
                return;
            }
            const getDocParam: Record<string, any> = {
                id: options.id,
                query: options.value || null,
                queryMethod: options.config?.method || null,
                queryTypes: options.config?.types || null,
                querySubTypes: options.config?.subTypes || null,
                mode: zoomIn ? 0 : 3,
                size: zoomIn ? Constants.SIZE_GET_MAX : window.siyuan.config.editor.dynamicLoadBlocks,
                zoom: zoomIn,
                highlight: !isSupportCSSHL(),
            };
            if (isEncryptedBox(options.edit.protyle.notebookId)) {
                getDocParam.notebook = options.edit.protyle.notebookId;
            }
            fetchPost("/api/filetree/getDoc", getDocParam, getResponse => {
                if (articleId !== options.id) {
                    return;
                }
                options.edit.protyle.query = {
                    key: options.value || null,
                    method: options.config?.method || null,
                    types: options.config?.types || null,
                    subTypes: options.config?.subTypes || null,
                };
                onGet({
                    updateReadonly: true,
                    data: getResponse,
                    protyle: options.edit.protyle,
                    action: zoomIn ? [Constants.CB_GET_ALL, Constants.CB_GET_HTML] : [Constants.CB_GET_HTML],
                    afterCB() {
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
                    }
                });
                if (options.edit.protyle.options.render.title) {
                    options.edit.protyle.title.render(options.edit.protyle, response);
                }
            });
        });
    });
};

export const replace = (element: Element, config: Config.IUILayoutTabSearchConfig, edit: ProtyleDomain, isAll: boolean) => {
    if (config.method === 2 || config.method === 4) {
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
        subTypes: config.subTypes,
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
