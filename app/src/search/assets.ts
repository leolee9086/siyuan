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

let inputTimeout: number;
export const assetInputEvent = (element: Element, localSearch?: ISearchAssetOption, page = 1) => {
    const loadingElement = element.parentElement?.querySelector(".fn__loading--top");
    loadingElement?.classList.remove("fn__none");
    clearTimeout(inputTimeout);
    inputTimeout = windowSetTimeout(() => {
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
            loadingElement?.classList.add("fn__none");
            const nextElement = element.querySelector('[data-type="assetNext"]');
            if (page < response.data.pageCount) {
                nextElement?.removeAttribute("disabled");
            }
            if (page >= response.data.pageCount) {
                nextElement?.setAttribute("disabled", "disabled");
            }
            let resultHTML = "";
            response.data.assetContents.forEach((item: {
                content: string
                ext: string
                id: string
                path: string
                name: string
                hSize: string
            }, index: number) => {
                resultHTML += `<div data-type="search-item" class="b3-list-item${index === 0 ? " b3-list-item--focus" : ""}" data-id="${item.id}">
<span class="ft__on-surface">${item.ext}</span>
<span class="fn__space"></span>
<span class="b3-list-item__text">${item.content}</span>
<span class="b3-list-item__meta">${item.hSize}</span>
<span class="b3-list-item__meta b3-list-item__meta--ellipsis ariaLabel" aria-label="${escapeAriaLabel(item.path)}">${item.name}</span>
</div>`;
            });
            const previewElement = element.querySelector("#searchAssetPreview");
            const dragElement = element.querySelector(".search__drag");
            const hasAssetContents = response.data.assetContents.length > 0;

            // 卫语句：先处理空列表情况
            if (!hasAssetContents) {
                previewElement?.classList.add("fn__none");
                dragElement?.classList.add("fn__none");
            }
            // 非空情况
            if (hasAssetContents) {
                previewElement?.classList.remove("fn__none");
                dragElement?.classList.remove("fn__none");
            }
            if (hasAssetContents && previewElement) {
                renderPreview(previewElement, response.data.assetContents[0].id, searchInputElement.value, localSearch!.method);
            }
            const searchAssetResult = element.querySelector("#searchAssetResult");
            if (searchAssetResult) {
                searchAssetResult.innerHTML = `<span class="fn__flex-center">${page}/${response.data.pageCount || 1}</span><span class="fn__space"></span>
<span class="ft__on-surface">${siyuanI18n.total} ${response.data.matchedAssetCount}</span>`;
            }
            const searchAssetList = element.querySelector("#searchAssetList");
            if (searchAssetList) {
                searchAssetList.innerHTML = resultHTML || `<div class="search__empty">
    ${siyuanI18n.emptyContent}
</div>`;
            }
        });
    }, Constants.TIMEOUT_INPUT);
};

export const renderPreview = (element: Element, id: string, query: string, queryMethod: number) => {
    fetchPost("/api/search/getAssetContent", { id, query, queryMethod }, (response) => {
        element.innerHTML = `<p style="white-space: pre-wrap;">${response.data.assetContent.content}</p>`;
        const matchElement = element.querySelector("mark");
        if (matchElement) {
            matchElement.classList.add("mark--hl");
            const contentRect = element.getBoundingClientRect();
            element.scrollTop = element.scrollTop + matchElement.getBoundingClientRect().top - contentRect.top - contentRect.height / 2;
        }
    });
};

export const renderNextAssetMark = (element: Element) => {
    let matchElement;
    const allMatchElements = Array.from(element.querySelectorAll("mark"));
    allMatchElements.find((item, itemIndex) => {
        if (item.classList.contains("mark--hl")) {
            item.classList.remove("mark--hl");
            matchElement = allMatchElements[itemIndex + 1];
            return;
        }
    });
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
    const method = getSiyuanStorage()[Constants.LOCAL_SEARCHASSET].method;
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
            getSiyuanStorage()[Constants.LOCAL_SEARCHASSET].method = 0;
            cb();
        }
    }).element);
    globalMenu.append(new MenuItem({
        icon: "iconQuote",
        label: siyuanI18n.querySyntax,
        current: method === 1,
        click() {
            getSiyuanStorage()[Constants.LOCAL_SEARCHASSET].method = 1;
            cb();
        }
    }).element);
    globalMenu.append(new MenuItem({
        icon: "iconRegex",
        label: siyuanI18n.regex,
        current: method === 3,
        click() {
            getSiyuanStorage()[Constants.LOCAL_SEARCHASSET].method = 3;
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

export const assetFilterMenu = (assetsElement: Element) => {
    const localData = getSiyuanStorage()[Constants.LOCAL_SEARCHASSET].types;
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
    btnsElement[0]?.addEventListener("click", () => {
        filterDialog.destroy();
    });
    btnsElement[1]?.addEventListener("click", () => {
        filterDialog.element.querySelectorAll<HTMLInputElement>(".b3-switch").forEach((item) => {
            const dataType = item.getAttribute("data-type");
            if (dataType) {
                localData[dataType] = item.checked;
            }
        });
        assetInputEvent(assetsElement);
        setStorageVal(Constants.LOCAL_SEARCHASSET, getSiyuanStorage()[Constants.LOCAL_SEARCHASSET]);
        filterDialog.destroy();
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
    const sortMenu = [{
        iconHTML: "",
        label: siyuanI18n.sortByRankAsc,
        current: localData.sort === 1,
        click() {
            localData.sort = 1;
            cb();
        }
    }, {
        iconHTML: "",
        label: siyuanI18n.sortByRankDesc,
        current: localData.sort === 0,
        click() {
            localData.sort = 0;
            cb();
        }
    }, {
        iconHTML: "",
        label: siyuanI18n.modifiedASC,
        current: localData.sort === 3,
        click() {
            localData.sort = 3;
            cb();
        }
    }, {
        iconHTML: "",
        label: siyuanI18n.modifiedDESC,
        current: localData.sort === 2,
        click() {
            localData.sort = 2;
            cb();
        }
    }];
    globalMenu.append(new MenuItem({
        iconHTML: "",
        label: siyuanI18n.sort,
        type: "submenu",
        submenu: sortMenu,
    }).element);
    /// #if !MOBILE
    globalMenu.append(new MenuItem({
        iconHTML: "",
        label: siyuanI18n.layout,
        type: "submenu",
        submenu: [{
            iconHTML: "",
            label: siyuanI18n.topBottomLayout,
            current: localData.layout === 0,
            click() {
                element.querySelector(".search__layout")?.classList.remove("search__layout--row");
                const previewElement = element.querySelector("#searchAssetPreview") as HTMLElement;
                previewElement.style.width = "";
                localData.layout = 0;
                if (!localData.row) {
                    previewElement.classList.add("fn__flex-1");
                    setStorageVal(Constants.LOCAL_SEARCHASSET, getSiyuanStorage()[Constants.LOCAL_SEARCHASSET]);
                    return;
                }
                previewElement.style.height = localData.row;
                previewElement.classList.remove("fn__flex-1");
                setStorageVal(Constants.LOCAL_SEARCHASSET, getSiyuanStorage()[Constants.LOCAL_SEARCHASSET]);
            }
        }, {
            iconHTML: "",
            label: siyuanI18n.leftRightLayout,
            current: localData.layout === 1,
            click() {
                const previewElement = element.querySelector("#searchAssetPreview") as HTMLElement;
                element.querySelector(".search__layout")?.classList.add("search__layout--row");
                previewElement.style.height = "";
                localData.layout = 1;
                if (!localData.col) {
                    previewElement.classList.add("fn__flex-1");
                    setStorageVal(Constants.LOCAL_SEARCHASSET, getSiyuanStorage()[Constants.LOCAL_SEARCHASSET]);
                    return;
                }
                previewElement.style.width = localData.col;
                previewElement.classList.remove("fn__flex-1");
                setStorageVal(Constants.LOCAL_SEARCHASSET, getSiyuanStorage()[Constants.LOCAL_SEARCHASSET]);
            }
        }]
    }).element);
    /// #endif
    globalMenu.append(new MenuItem({
        iconHTML: "",
        label: siyuanI18n.rebuildIndex,
        click() {
            element.parentElement?.querySelector(".fn__loading--top")?.classList.remove("fn__none");
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
