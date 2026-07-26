import { Constants } from "../constants";
import { fetchPost } from "../util/network/fetch";
import { escapeAriaLabel } from "../util/DOM/escape";
import {setStorageVal} from "../util/storage/setStorageVal";
import { MenuItem } from "../menus/Menu.Item";
import { Dialog } from "../dialog";
import { getSiyuanStorage } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanGlobalMenus } from "../util/siyuanEnvironments/getMenu.environment";
import { setTimeout } from "../util/siyuanEnvironments/windowTimer.environment";
import { filterTypesHTML } from "./filterTypesHTML";
import { createSortMenuItems, createLayoutSubmenu } from "./assetMenuItems";
import { 生成素材过滤面板HTML, 解析过滤面板值, 初始化过滤面板事件 } from "./assetFilterPanel";
import { isMobile } from "../platform";

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
    const loadingElement = element.parentElement?.querySelector<HTMLElement>(".fn__loading");
    loadingElement?.classList.remove("fn__none");
    if (loadingElement) {
        loadingElement.style.top = "84px";
    }
    clearTimeout(inputTimeout);
    inputTimeout = setTimeout(() => {
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
    // 移动端全屏展示菜单，桌面端以弹出菜单形式定位到按钮下方
    if (isMobile) {
        globalMenu.fullscreen();
    }
    if (!isMobile) {
        const rect = target.getBoundingClientRect();
        globalMenu.popup({ x: rect.right, y: rect.bottom, isLeft: true });
    }
};

/**
 * 处理过滤确认：解析原有文件类型开关和 S-Forge 高级过滤
 */
const handleAssetFilterConfirm = (
    filterDialog: Dialog,
    localData: Record<string, boolean>,
    assetsElement: Element
) => {
    const searchAsset = getSiyuanStorage()[Constants.LOCAL_SEARCHASSET] as ISearchAssetOption;

    // 1. 处理原有的文件类型开关
    const switches = filterDialog.element.querySelectorAll<HTMLInputElement>(".b3-switch[data-type]");
    for (const item of switches) {
        const dataType = item.getAttribute("data-type");
        if (dataType) {
            localData[dataType] = item.checked;
        }
    }

    // 2. 处理 S-Forge 高级过滤选项
    const sForgeFilters = 解析过滤面板值(filterDialog.element);
    searchAsset.sForgeFilters = sForgeFilters;

    assetInputEvent(assetsElement);
    setStorageVal(Constants.LOCAL_SEARCHASSET, searchAsset);
    filterDialog.destroy();
};

/**
 * 素材过滤菜单
 * 
 * @description 打开过滤对话框，包含原有的文件类型过滤和 S-Forge 高级过滤
 * @param assetsElement - 素材搜索面板元素
 */
export const assetFilterMenu = (assetsElement: Element) => {
    const searchAsset = getSiyuanStorage()[Constants.LOCAL_SEARCHASSET] as ISearchAssetOption;
    const localData = searchAsset.types;

    // 生成组合过滤面板：原有类型 + S-Forge 高级过滤
    const combinedContent = `
        <div class="b3-dialog__content" style="max-height: 60vh; overflow-y: auto;">
            <div class="b3-label b3-label--noborder" style="padding-bottom: 0;">
                <span class="ft__primary b3-label__text">文件类型过滤</span>
            </div>
            ${filterTypesHTML(localData)}
            <div style="margin-top: 16px; border-top: 1px solid var(--b3-border-color); padding-top: 16px;">
                ${生成素材过滤面板HTML(searchAsset.sForgeFilters)}
            </div>
        </div>
        <div class="b3-dialog__action">
            <button class="b3-button b3-button--cancel">${siyuanI18n.cancel}</button>
            <div class="fn__space"></div>
            <button class="b3-button b3-button--text">${siyuanI18n.confirm}</button>
        </div>
    `;

    const filterDialog = new Dialog({
        title: "素材过滤条件",
        content: combinedContent,
        width: "680px",
        height: "75vh",
    });
    filterDialog.element.setAttribute("data-key", Constants.DIALOG_SEARCHASSETSTYPE);

    // 初始化 S-Forge 过滤面板交互事件
    初始化过滤面板事件(filterDialog.element);

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
    // 桌面端显示布局切换子菜单，移动端不需要布局选项
    if (!isMobile) {
        globalMenu.append(new MenuItem({
            iconHTML: "",
            label: siyuanI18n.layout,
            type: "submenu",
            submenu: createLayoutSubmenu(element, localData),
        }).element);
    }
    globalMenu.append(new MenuItem({
        iconHTML: "",
        label: siyuanI18n.rebuildAssetContentIndex,
        click() {
            const loadingElement = element.parentElement?.querySelector<HTMLElement>(".fn__loading");
            loadingElement?.classList.remove("fn__none");
            if (loadingElement) {
                loadingElement.style.top = "84px";
            }
            fetchPost("/api/asset/fullReindexAssetContent", {}, () => {
                assetInputEvent(element, localData);
            });
        },
    }).element);
    // 移动端全屏展示菜单，桌面端以弹出菜单形式定位到按钮下方
    if (isMobile) {
        globalMenu.fullscreen();
    }
    if (!isMobile) {
        const rect = target.getBoundingClientRect();
        globalMenu.popup({ x: rect.right, y: rect.bottom, isLeft: true });
    }
};
