import { Constants } from "../constants";
import { fetchPost } from "../util/fetch";
import { escapeAriaLabel } from "../util/escape";
import { setStorageVal } from "../protyle/util/compatibility";
import { MenuItem } from "../menus/Menu.Item";
import { Dialog } from "../dialog";
import { getSiyuanStorage } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanGlobalMenus } from "../util/siyuanEnvironments/getMenu.environment";
import { windowSetTimeout } from "../util/siyuanEnvironments/windowTimer.environment";
import { filterTypesHTML } from "./filterTypesHTML";
import { createSortMenuItems, createLayoutSubmenu } from "./assetMenuItems";

/** 处理资源搜索响应的参数 */
interface HandleAssetSearchResponseParams {
    element: Element;
    loadingElement: Element | null | undefined;
    page: number;
    response: IWebSocketData;
    searchInputElement: HTMLInputElement;
    localSearch: ISearchAssetOption;
}

/** 处理资源搜索响应 */
const handleAssetSearchResponse = (params: HandleAssetSearchResponseParams) => {
    const { element, loadingElement, page, response, searchInputElement, localSearch } = params;

    loadingElement?.classList.add("fn__none");
    updateNextButton(element, page, response.data.pageCount);
    const resultHTML = buildAssetResultHTML(response.data.assetContents);
    updatePreviewVisibility(element, response.data.assetContents, searchInputElement.value, localSearch.method);
    updateSearchResults(element, page, response.data.pageCount, response.data.matchedAssetCount, resultHTML);
};

/** 更新"下一页"按钮状态 */
const updateNextButton = (element: Element, page: number, pageCount: number) => {
    const nextElement = element.querySelector('[data-type="assetNext"]');
    if (page < pageCount) {
        nextElement?.removeAttribute("disabled");
    }
    if (page >= pageCount) {
        nextElement?.setAttribute("disabled", "disabled");
    }
};

interface AssetContentItem {
    content: string;
    ext: string;
    id: string;
    path: string;
    name: string;
    hSize: string;
}

/** 生成单个资源结果的 HTML */
const generateAssetItemHTML = (item: AssetContentItem, index: number) => {
    return `<div data-type="search-item" class="b3-list-item${index === 0 ? " b3-list-item--focus" : ""}" data-id="${item.id}">
<span class="ft__on-surface">${item.ext}</span>
<span class="fn__space"></span>
<span class="b3-list-item__text">${item.content}</span>
<span class="b3-list-item__meta">${item.hSize}</span>
<span class="b3-list-item__meta b3-list-item__meta--ellipsis ariaLabel" aria-label="${escapeAriaLabel(item.path)}">${item.name}</span>
</div>`;
};

/** 构建资源结果HTML */
const buildAssetResultHTML = (assetContents: AssetContentItem[]) => {
    return assetContents.map((item, index) => generateAssetItemHTML(item, index)).join("");
};

/** 更新预览区域可见性 */
const updatePreviewVisibility = (
    element: Element,
    assetContents: Array<{ id: string }>,
    query: string,
    method: number
) => {
    const previewElement = element.querySelector("#searchAssetPreview");
    const dragElement = element.querySelector(".search__drag");
    const hasAssetContents = assetContents.length > 0;

    if (!hasAssetContents) {
        previewElement?.classList.add("fn__none");
        dragElement?.classList.add("fn__none");
        return;
    }
    previewElement?.classList.remove("fn__none");
    dragElement?.classList.remove("fn__none");
    const firstAsset = assetContents[0];
    if (previewElement && firstAsset) {
        renderPreview(previewElement, firstAsset.id, query, method);
    }
};

/** 更新搜索结果显示 */
const updateSearchResults = (
    element: Element,
    page: number,
    pageCount: number,
    matchedAssetCount: number,
    resultHTML: string
) => {
    const searchAssetResult = element.querySelector("#searchAssetResult");
    if (searchAssetResult) {
        searchAssetResult.innerHTML = `<span class="fn__flex-center">${page}/${pageCount || 1}</span><span class="fn__space"></span>
<span class="ft__on-surface">${siyuanI18n.total} ${matchedAssetCount}</span>`;
    }
    const searchAssetList = element.querySelector("#searchAssetList");
    if (searchAssetList) {
        searchAssetList.innerHTML = resultHTML || `<div class="search__empty">
    ${siyuanI18n.emptyContent}
</div>`;
    }
};

/** 执行资源搜索 */
const executeAssetSearch = (element: Element, loadingElement: Element | null | undefined, page: number, localSearch?: ISearchAssetOption) => {
    if (!localSearch) {
        localSearch = getSiyuanStorage()[Constants.LOCAL_SEARCHASSET] as ISearchAssetOption;
    }
    const previousElement = element.querySelector('[data-type="assetPrevious"]');
    if (page > 1) {
        previousElement?.removeAttribute("disabled");
    }
    if (page <= 1) {
        previousElement?.setAttribute("disabled", "disabled");
    }
    const searchInputElement = element.querySelector("#searchAssetInput") as HTMLInputElement;
    fetchPost("/api/search/fullTextSearchAssetContent", {
        page,
        query: searchInputElement.value,
        types: localSearch.types,
        method: localSearch.method,
        orderBy: localSearch.sort
    }, (response) => {
        handleAssetSearchResponse({
            element, loadingElement, page, response, searchInputElement, localSearch: localSearch!
        });
    });
};

let inputTimeout: number;
export const assetInputEvent = (element: Element, localSearch?: ISearchAssetOption, page = 1) => {
    const loadingElement = element.parentElement?.querySelector(".fn__loading--top");
    loadingElement?.classList.remove("fn__none");
    clearTimeout(inputTimeout);
    inputTimeout = windowSetTimeout(() => {
        executeAssetSearch(element, loadingElement, page, localSearch);
    }, Constants.TIMEOUT_INPUT);
};

const handlePreviewResponse = (element: Element, response: IWebSocketData) => {
    element.innerHTML = `<p style="white-space: pre-wrap;">${response.data.assetContent.content}</p>`;
    const matchElement = element.querySelector("mark");
    if (matchElement) {
        matchElement.classList.add("mark--hl");
        const contentRect = element.getBoundingClientRect();
        element.scrollTop = element.scrollTop + matchElement.getBoundingClientRect().top - contentRect.top - contentRect.height / 2;
    }
};

export const renderPreview = (element: Element, id: string, query: string, queryMethod: number) => {
    fetchPost("/api/search/getAssetContent", { id, query, queryMethod }, (response) => {
        handlePreviewResponse(element, response);
    });
};

export const renderNextAssetMark = (element: Element) => {
    let matchElement;
    const allMatchElements = Array.from(element.querySelectorAll("mark"));
    for (const [i, item] of allMatchElements.entries()) {
        if (item.classList.contains("mark--hl")) {
            item.classList.remove("mark--hl");
            matchElement = allMatchElements[i + 1];
            break;
        }
    }
    if (!matchElement) {
        matchElement = allMatchElements[0];
    }
    if (matchElement) {
        matchElement.classList.add("mark--hl");
        const contentRect = element.getBoundingClientRect();
        element.scrollTop = element.scrollTop + matchElement.getBoundingClientRect().top - contentRect.top - contentRect.height / 2;
    }
};

export const assetMethodMenu = (target: HTMLElement, cb: () => void) => {
    const localData = getSiyuanStorage()[Constants.LOCAL_SEARCHASSET];
    const method = localData.method;
    const globalMenu = getSiyuanGlobalMenus().menu;
    if (!globalMenu.element.classList.contains("fn__none") &&
        globalMenu.element.getAttribute("data-name") === Constants.MENU_SEARCH_ASSET_METHOD) {
        globalMenu.remove();
        return;
    }
    globalMenu.remove();
    globalMenu.element.setAttribute("data-name", Constants.MENU_SEARCH_ASSET_METHOD);
    globalMenu.append(new MenuItem({
        icon: "iconExact",
        label: siyuanI18n.keyword,
        current: method === 0,
        click() {
            localData.method = 0;
            cb();
        }
    }).element);
    globalMenu.append(new MenuItem({
        icon: "iconQuote",
        label: siyuanI18n.querySyntax,
        current: method === 1,
        click() {
            localData.method = 1;
            cb();
        }
    }).element);
    globalMenu.append(new MenuItem({
        icon: "iconRegex",
        label: siyuanI18n.regex,
        current: method === 3,
        click() {
            localData.method = 3;
            cb();
        }
    }).element);
    /// #if MOBILE
    globalMenu.fullscreen();
    /// #else
    const rect = target.getBoundingClientRect();
    globalMenu.popup({ x: rect.right, y: rect.bottom, isLeft: true });
    /// #endif
};

const handleAssetFilterConfirm = (
    filterDialog: Dialog,
    localData: any,
    assetsElement: Element
) => {
    const switches = filterDialog.element.querySelectorAll<HTMLInputElement>(".b3-switch");
    for (const item of switches) {
        const dataType = item.getAttribute("data-type");
        if (dataType) {
            localData[dataType] = item.checked;
        }
    }
    assetInputEvent(assetsElement);
    setStorageVal(Constants.LOCAL_SEARCHASSET, getSiyuanStorage()[Constants.LOCAL_SEARCHASSET]);
    filterDialog.destroy();
};

export const assetFilterMenu = (assetsElement: Element) => {
    const searchAsset = getSiyuanStorage()[Constants.LOCAL_SEARCHASSET];
    const localData = searchAsset.types;
    const filterDialog = new Dialog({
        title: siyuanI18n.type,
        content: `<div class="b3-dialog__content">${filterTypesHTML(localData)}</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${siyuanI18n.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${siyuanI18n.confirm}</button>
</div>`,
        width: "520px",
        height: "70vh",
    });
    filterDialog.element.setAttribute("data-key", Constants.DIALOG_SEARCHASSETSTYPE);
    const btnsElement = filterDialog.element.querySelectorAll(".b3-button");
    const cancelBtn = btnsElement[0];
    cancelBtn?.addEventListener("click", () => {
        filterDialog.destroy();
    });
    const confirmBtn = btnsElement[1];
    confirmBtn?.addEventListener("click", () => {
        handleAssetFilterConfirm(filterDialog, localData, assetsElement);
    });
};

export const assetMoreMenu = (target: Element, element: Element, cb: () => void) => {
    const globalMenu = getSiyuanGlobalMenus().menu;
    if (!globalMenu.element.classList.contains("fn__none") &&
        globalMenu.element.getAttribute("data-name") === Constants.MENU_SEARCH_ASSET_MORE) {
        globalMenu.remove();
        return;
    }
    globalMenu.remove();
    globalMenu.element.setAttribute("data-name", Constants.MENU_SEARCH_ASSET_MORE);
    const localData = getSiyuanStorage()[Constants.LOCAL_SEARCHASSET];

    globalMenu.append(new MenuItem({
        iconHTML: "",
        label: siyuanI18n.sort,
        type: "submenu",
        submenu: createSortMenuItems(localData, cb),
    }).element);
    /// #if !MOBILE
    globalMenu.append(new MenuItem({
        iconHTML: "",
        label: siyuanI18n.layout,
        type: "submenu",
        submenu: createLayoutSubmenu(element, localData),
    }).element);
    /// #endif
    globalMenu.append(new MenuItem({
        iconHTML: "",
        label: siyuanI18n.rebuildIndex,
        click() {
            const loadingElement = element.parentElement?.querySelector(".fn__loading--top");
            loadingElement?.classList.remove("fn__none");
            fetchPost("/api/asset/fullReindexAssetContent", {}, () => {
                assetInputEvent(element, localData);
            });
        },
    }).element);
    /// #if MOBILE
    globalMenu.fullscreen();
    /// #else
    const rect = target.getBoundingClientRect();
    globalMenu.popup({ x: rect.right, y: rect.bottom, isLeft: true });
    /// #endif
};
