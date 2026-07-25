import {getCurrentEditor} from "../util/getCurrentEditor";
import {Constants} from "../../constants";
import {fetchPost} from "../../util/network/fetch";
import {getIconByType} from "../../editor/getIcon";
import {openModel} from "./model";
import {getDisplayName, getNotebookName} from "../../util/file/pathName";
import {escapeHtml} from "../../util/DOM/escape";
import {isEncryptedBox} from "../../util/pathName";
import {unicode2Emoji} from "../../emoji";
import {newFile} from "../../util/file/newFile";
import {activeBlur} from "../util/keyboardToolbar";
import type { AppFacade } from "../../app/AppFacade.types";
import {
    assetInputEvent,
} from "../../search/assets";
import {siyuanI18n} from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import {onRecentBlocks} from "./search.render";
import {initSearchEvent} from "./search.event";

let toolbarSearchTimeout = 0;
export const updateSearchResult = (config: Config.IUILayoutTabSearchConfig, element: Element, rmCurrentCriteria = false,
                                   focusId?: {
                                       currentId?: string,
                                       newId?: string
                                   }) => {
    clearTimeout(toolbarSearchTimeout);
    toolbarSearchTimeout = window.setTimeout(() => {
        if (rmCurrentCriteria) {
            element.querySelector("#criteria .b3-chip--current")?.classList.remove("b3-chip--current");
        }
        const loadingElement = element.querySelector(".fn__loading") as HTMLElement;
        loadingElement.classList.remove("fn__none");
        loadingElement.style.top = element.querySelector(".b3-list--background").getBoundingClientRect().top + "px";
        const previousElement = element.querySelector('[data-type="previous"]');
        const nextElement = element.querySelector('[data-type="next"]');
        const inputElement = document.getElementById("toolbarSearch") as HTMLInputElement;
        config.query = inputElement.value;
        if (config.query === "" && (!config.idPath || config.idPath.length === 0)) {
            fetchPost("/api/block/getRecentUpdatedBlocks", {}, (response) => {
                onRecentBlocks(response.data, config, undefined, focusId);
                loadingElement.classList.add("fn__none");
                previousElement.setAttribute("disabled", "true");
                nextElement.setAttribute("disabled", "true");
            });
        } else {
            if (!config.page) {
                config.page = 1;
            }
            if (config.page > 1) {
                previousElement.removeAttribute("disabled");
            } else {
                previousElement.setAttribute("disabled", "disabled");
            }
            const endpoint = config.method === 4 ? "/api/search/semanticSearchBlock" : "/api/search/fullTextSearchBlock";
            const searchParam: IObject = {
                query: config.query,
                method: config.method,
                types: config.types,
                subTypes: config.subTypes,
                paths: config.idPath || [],
                groupBy: config.group,
                orderBy: config.sort,
                page: config.page,
                pageSize: 32,
            };
            // 限定在单个加密 box 内搜索时带 notebook，让内核走加密 db；跨 box 或全局搜索走原函数
            const idPaths = config.idPath || [];
            if (idPaths.length > 0) {
                const box = idPaths[0].split("/")[0];
                if (isEncryptedBox(box) && idPaths.every(p => p.split("/")[0] === box)) {
                    searchParam.notebook = box;
                }
            }
            fetchPost(endpoint, searchParam, (response) => {
                onRecentBlocks(response.data.blocks, config, response, focusId);
                loadingElement.classList.add("fn__none");
                if (config.page < response.data.pageCount) {
                    nextElement.removeAttribute("disabled");
                } else {
                    nextElement.setAttribute("disabled", "disabled");
                }
            });
        }
    }, Constants.TIMEOUT_INPUT);
};

export const popSearch = (app: AppFacade, searchConfig?: Config.IUILayoutTabSearchConfig) => {
    const config: Config.IUILayoutTabSearchConfig = JSON.parse(JSON.stringify(window.siyuan.storage[Constants.LOCAL_SEARCHDATA]));
    if (config.method === 4 && !window.siyuan.config.ai.embedding.enabled) {
        config.method = 0;
    }
    const rangeText = (getCurrentEditor()?.protyle.toolbar.range || (getSelection().rangeCount > 0 ? getSelection().getRangeAt(0) : document.createRange())).toString();
    if (rangeText) {
        config.k = rangeText;
    }
    if (searchConfig) {
        Object.keys(searchConfig).forEach((key: keyof Config.IUILayoutTabSearchConfig) => {
            if (key === "idPath") {
                config[key] = [...searchConfig[key]];
            } else {
                config[key as "r"] = searchConfig[key as "r"];
            }
        });
    }

    activeBlur();
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

    openModel({
        title: `<div class="fn__flex">
    <span data-menu="true" class="toolbar__icon toolbar__icon--history" data-type="history">
        <svg class="svg--mid"><use xlink:href="#iconSearch"></use></svg>
        <svg class="svg--smaller"><use xlink:href="#iconDown"></use></svg>
    </span>
    <input id="toolbarSearch" placeholder="${siyuanI18n.showRecentUpdatedBlocks}" class="toolbar__title fn__block" autocomplete="off" autocorrect="off" spellcheck="false">
    <svg id="toolbarSearchNew" class="toolbar__icon"><use xlink:href="#iconFile"></use></svg>
</div>`,
        html: `<div class="fn__flex-column" style="height: 100%">
    <div class="toolbar toolbar--border${config.hasReplace ? "" : " fn__none"}">
        <span data-menu="true" class="toolbar__icon toolbar__icon--history" data-type="replaceHistory">
            <svg class="svg--mid"><use xlink:href="#iconReplace"></use></svg>
            <svg class="svg--smaller"><use xlink:href="#iconDown"></use></svg>
        </span>
        <input id="toolbarReplace" class="toolbar__title">
        <svg class="fn__rotate fn__none toolbar__icon"><use xlink:href="#iconRefresh"></use></svg>
        <div class="fn__space"></div>
        <button data-type="replace-all" class="b3-button b3-button--outline fn__flex-center">${siyuanI18n.replaceAll}</button>
        <div class="fn__space"></div>
        <button data-type="replace" class="b3-button b3-button--outline fn__flex-center">${siyuanI18n.replace}</button>
        <div class="fn__space"></div>
    </div>
    <div id="criteria" style="background-color: var(--b3-theme-background);"></div>
    <div class="toolbar">
        <span class="fn__space"></span>
        <span data-type="result" class="fn__flex-1 fn__flex"></span>
        <span class="fn__space"></span>
        <svg data-type="previous" disabled="disabled" class="toolbar__icon"><use xlink:href="#iconLeft"></use></svg>
        <svg data-type="next" disabled="disabled" class="toolbar__icon"><use xlink:href="#iconRight"></use></svg>
    </div>
    <div id="searchList" style="overflow:auto;" class="fn__flex-1 b3-list b3-list--background"></div>
    <div id="searchPath" class="b3-chips${config.hPath ? "" : " fn__none"}" style="background-color: var(--b3-theme-background);">
        <div class="b3-chip b3-chip--middle">
            ${escapeHtml(config.hPath)}
            <svg data-type="remove-path" class="b3-chip__close"><use xlink:href="#iconClose"></use></svg>
        </div>
    </div>
    <div class="toolbar">
        <span class="fn__flex-1"></span>
        <svg data-type="toggle-replace" class="toolbar__icon${config.hasReplace ? " toolbar__icon--active" : ""}"><use xlink:href="#iconReplace"></use></svg>
        <svg ${enableIncludeChild ? "" : "disabled"} data-type="include" class="toolbar__icon${includeChild ? " toolbar__icon--active" : ""}"><use xlink:href="#iconInclude"></use></svg>
        <svg data-type="path" class="toolbar__icon"><use xlink:href="#iconFolder"></use></svg>
        <svg ${document.querySelector("#empty").classList.contains("fn__none") ? "" : "disabled"} data-type="currentPath" class="toolbar__icon"><use xlink:href="#iconFocus"></use></svg>
        <svg data-type="expand" class="toolbar__icon${config.group === 0 ? " fn__none" : ""}"><use xlink:href="#iconExpand"></use></svg>
        <svg data-type="contract" class="toolbar__icon${config.group === 0 ? " fn__none" : ""}"><use xlink:href="#iconContract"></use></svg>
        <svg data-type="more" class="toolbar__icon"><use xlink:href="#iconMore"></use></svg>
        <svg data-type="goAsset" class="toolbar__icon"><use xlink:href="#iconExact"></use></svg>
        <span class="fn__flex-1"></span>
     </div>
     <div class="fn__none fn__flex-column" style="position: fixed;top: 0;width: 100%;background: var(--b3-theme-surface);height: 100%;" id="searchAssetsPanel">
        <div class="toolbar toolbar--border">
           <span data-menu="true" class="toolbar__icon toolbar__icon--history" data-type="assetHistory">
                <svg class="svg--mid"><use xlink:href="#iconSearch"></use></svg>
                <svg class="svg--smaller"><use xlink:href="#iconDown"></use></svg>
            </span>
            <input id="searchAssetInput" placeholder="${siyuanI18n.keyword}" class="toolbar__title fn__block">
        </div>
        <div class="toolbar">
            <span class="fn__space"></span>
            <span id="searchAssetResult" class="fn__flex-1 fn__flex"><span class="fn__flex-1"></span></span>
            <span class="fn__space"></span>
            <svg data-type="assetPrevious" disabled="disabled" class="toolbar__icon"><use xlink:href="#iconLeft"></use></svg>
            <svg data-type="assetNext" disabled="disabled" class="toolbar__icon"><use xlink:href="#iconRight"></use></svg>
        </div>
        <div id="searchAssetList" style="overflow:auto;" class="fn__flex-1 b3-list b3-list--background"></div>
        <div id="searchAssetPreview" class="fn__flex-1 search__preview b3-typography" style="padding: 8px;border-bottom: 1px solid var(--b3-border-color);"></div>
        <div class="toolbar">
            <span class="fn__flex-1"></span>
            <svg data-type="queryAsset" class="toolbar__icon"><use xlink:href="#iconRegex"></use></svg>
            <svg data-type="filterAsset" class="toolbar__icon"><use xlink:href="#iconFilter"></use></svg>
            <svg data-type="moreAsset" class="toolbar__icon"><use xlink:href="#iconMore"></use></svg>
            <svg data-type="goSearch" class="toolbar__icon"><use xlink:href="#iconBack"></use></svg>
            <span class="fn__flex-1"></span>
         </div>
    </div>
     <div class="fn__none fn__flex-column" style="position: fixed;top: 0;width: 100%;background: var(--b3-theme-surface);height: 100%;" id="searchUnRefPanel">
        <div class="toolbar">
            <span class="fn__space"></span>
            <span id="searchUnRefResult" class="fn__flex-1 fn__flex"></span>
            <span class="fn__space"></span>
            <svg data-type="unRefPrevious" disabled="disabled" class="toolbar__icon"><use xlink:href="#iconLeft"></use></svg>
            <svg data-type="unRefNext" disabled="disabled" class="toolbar__icon"><use xlink:href="#iconRight"></use></svg>
        </div>
        <div id="searchUnRefList" style="overflow:auto;" class="fn__flex-1 b3-list b3-list--background"></div>
        <div class="toolbar">
            <span class="fn__flex-1"></span>
            <svg data-type="refreshUnRef" class="toolbar__icon"><use xlink:href="#iconRefresh"></use></svg>
            <svg data-type="goSearch" class="toolbar__icon"><use xlink:href="#iconBack"></use></svg>
            <span class="fn__flex-1"></span>
         </div>
    </div>
     <div class="fn__loading"><img width="120px" src="/stage/loading-pure.svg"></div>
</div>`,
        bindEvent(element) {
            document.querySelector("#toolbarSearchNew").addEventListener("click", () => {
                newFile(app, (document.querySelector("#toolbarSearch") as HTMLInputElement).value);
            });
            const historyElement = document.querySelector('.toolbar [data-type="history"]');
            historyElement.addEventListener("click", () => {
                toggleSearchHistory(document.querySelector("#model"), config, undefined);
            });
            initSearchEvent(app, element.firstElementChild, config, updateSearchResult, goAsset, getUnRefListMobile);
            updateSearchResult(config, element);
        }
    });
};

const goAsset = () => {
    const assetsElement = document.querySelector("#searchAssetsPanel");
    assetsElement.classList.remove("fn__none");
    const listElement = assetsElement.querySelector("#searchAssetList");
    if (listElement.innerHTML) {
        return;
    }
    const localSearch = window.siyuan.storage[Constants.LOCAL_SEARCHASSET] as ISearchAssetOption;
    const inputElement = assetsElement.querySelector("input");
    inputElement.value = localSearch.k;
    inputElement.addEventListener("compositionend", (event: InputEvent) => {
        if (event.isComposing) {
            return;
        }
        assetInputEvent(assetsElement, localSearch);
    });
    inputElement.addEventListener("input", (event: InputEvent) => {
        if (event.isComposing) {
            return;
        }
        assetInputEvent(assetsElement, localSearch);
    });
    inputElement.addEventListener("blur", () => {
        saveAssetKeyList(inputElement);
    });
    assetInputEvent(assetsElement, localSearch);
    addClearButton({
        inputElement,
        className: "toolbar__icon",
        clearAriaLabel: siyuanI18n.clear,
        clearCB() {
            assetInputEvent(assetsElement, localSearch);
        }
    });
};

export const goUnRef = () => {
    window.siyuan.menus.menu.remove();
    const unRefElement = document.querySelector("#searchUnRefPanel");
    unRefElement.classList.remove("fn__none");
    const listElement = unRefElement.querySelector("#searchUnRefList");
    if (listElement.innerHTML) {
        return;
    }
    getUnRefListMobile(unRefElement);
};

const getUnRefListMobile = (element: Element, page = 1) => {
    const previousElement = element.querySelector('[data-type="unRefPrevious"]');
    if (page > 1) {
        previousElement.removeAttribute("disabled");
    } else {
        previousElement.setAttribute("disabled", "disabled");
    }
    fetchPost("/api/search/listInvalidBlockRefs", {
        page,
    }, (response) => {
        element.parentElement.querySelector(".fn__loading").classList.add("fn__none");
        const nextElement = element.querySelector('[data-type="unRefNext"]');
        if (page < response.data.pageCount) {
            nextElement.removeAttribute("disabled");
        } else {
            nextElement.setAttribute("disabled", "disabled");
        }
        let resultHTML = "";
        response.data.blocks.forEach((item: IBlock, index: number) => {
            const title = escapeHtml(getNotebookName(item.box)) + getDisplayName(item.hPath, false);
            resultHTML += `<div class="b3-list-item b3-list-item--two${index === 0 ? " b3-list-item--focus" : ""}" data-type="search-item" data-node-id="${item.id}">
<div class="b3-list-item__first">
    <svg class="b3-list-item__graphic"><use xlink:href="#${getIconByType(item.type)}"></use></svg>
    ${unicode2Emoji(item.ial.icon, "b3-list-item__graphic", true)}
    <span class="b3-list-item__text">${item.content}</span>
</div>
<span class="b3-list-item__text b3-list-item__meta">${escapeHtml(title)}</span>
</div>`;
        });
        element.querySelector("#searchUnRefResult").innerHTML = `<span class="fn__flex-center">${siyuanI18n.findInDoc.replace("${x}", response.data.matchedRootCount).replace("${y}", response.data.matchedBlockCount)}</span>
<span class="fn__flex-1"></span>
<span class="fn__flex-center">${page}/${response.data.pageCount || 1}</span>`;
        element.querySelector("#searchUnRefList").innerHTML = resultHTML || `<div class="search__empty">
    ${siyuanI18n.emptyContent}
</div>`;
    });
};
