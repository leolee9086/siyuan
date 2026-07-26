import {setStorageVal} from "../util/storage/setStorageVal";
import { Constants } from "../constants";
import { updateHotkeyTip } from "../protyle/util/compatibility";
import { addClearButton } from "../util/DOM/addClearButton";
import { getSiyuanGlobalMenus } from "../util/siyuanEnvironments/getMenu.environment";
import { getSiyuanStorage } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import { assetInputEvent } from "./assets";
import { saveAssetKeyList } from "./toggleHistory";
import { genQueryHTML } from "./util";
import { isMobile, isElectron } from "../platform";

/** 生成搜索资源的 HTML 模板 */
const 生成搜索资源HTML = (localSearch: ISearchAssetOption, isStick: boolean, enterTip: string): string => {
    return /*HTML*/`<div class="block__icons">
    <span data-type="assetPrevious" class="block__icon block__iconHTML--show ariaLabel" data-position="9south" disabled="disabled" aria-label="${siyuanI18n.previousLabel}"><svg><use xlink:href='#iconLeft'></use></svg></span>
    <span class="fn__space"></span>
    <span data-type="assetNext" class="block__icon block__icon--show ariaLabel" data-position="9south" disabled="disabled" aria-label="${siyuanI18n.nextLabel}"><svg><use xlink:href='#iconRight'></use></svg></span>
    <span class="fn__space"></span>
    <span id="searchAssetResult" class="ft__selectnone"></span>
    <span class="fn__flex-1${!isStick ? " resize__move" : ""}" style="min-height: 100%"></span>
    <span class="fn__space"></span>
    <span id="assetMore" aria-label="${siyuanI18n.more}" class="block__icon block__icon--show ariaLabel" data-position="9south">
        <svg><use xlink:href="#iconMore"></use></svg>
    </span>
    <span class="fn__space"></span>
    <span id="searchAssetClose" aria-label="${isStick ? siyuanI18n.stickSearch : siyuanI18n.globalSearch}" class="block__icon block__icon--show ariaLabel" data-position="9south">
        <svg><use xlink:href="#iconBack"></use></svg>
    </span>
</div>
<div class="b3-form__icon search__header">
    <div class="fn__flex-1" style="position: relative">
        <span class="search__history-icon ariaLabel" id="assetHistoryBtn" aria-label="${updateHotkeyTip("⌥↓")}">
            <svg data-menu="true" class="b3-form__icon-icon"><use xlink:href="#iconSearch"></use></svg>
            <svg class="search__arrowdown"><use xlink:href="#iconDown"></use></svg>
        </span>
        <input id="searchAssetInput" value="${localSearch.k}" class="b3-text-field b3-text-field--text" placeholder="${siyuanI18n.keyword}">
    </div>
    <div class="block__icons">
        <span data-type="assetRefresh" aria-label="${siyuanI18n.refresh}" class="block__icon ariaLabel" data-position="9south">
            <svg><use xlink:href="#iconRefresh"></use></svg>
        </span>
        <span class="fn__space"></span>
        ${genQueryHTML(localSearch.method, "assetSyntaxCheck")}
        <span class="fn__space"></span>
        <span id="assetFilter" aria-label="${siyuanI18n.type}" class="block__icon ariaLabel" data-position="9south">
            <svg><use xlink:href="#iconFilter"></use></svg>
        </span>
    </div>
</div>
<div class="search__layout${localSearch.layout === 1 ? " search__layout--row" : ""}">
    <div id="searchAssetList" class="fn__flex-1 search__list b3-list b3-list--background"></div>
    <div class="search__drag"></div>
    <div id="searchAssetPreview" class="fn__flex-1 search__preview b3-typography" style="padding: 8px;box-sizing: border-box;"></div>
</div>
<div class="search__tip${isStick ? " fn__none" : ""}">
    <kbd>↑/↓/PageUp/PageDown</kbd> ${siyuanI18n.searchTip1}
    ${enterTip}
    <kbd>${siyuanI18n.click}</kbd> ${siyuanI18n.searchTip3}
    <kbd>Esc</kbd> ${siyuanI18n.searchTip5}
</div>`;
};

/** 设置预览元素的布局样式 */
const 设置预览元素布局 = (previewElement: HTMLElement, localSearch: ISearchAssetOption): void => {
    if (localSearch.layout === 1 && localSearch.col) {
        previewElement.style.width = localSearch.col;
        previewElement.classList.remove("fn__flex-1");
    }
    if (localSearch.layout !== 1 && localSearch.row) {
        previewElement.classList.remove("fn__flex-1");
        previewElement.style.height = localSearch.row;
    }
};

/** 初始化搜索输入框的事件监听 */
const 初始化搜索输入框 = (element: HTMLElement, localSearch: ISearchAssetOption): void => {
    const searchInputElement = element.querySelector("#searchAssetInput");
    if (!(searchInputElement instanceof HTMLInputElement)) {
        return;
    }
    searchInputElement.select();
    searchInputElement.addEventListener("compositionend", () => {
        assetInputEvent(element, localSearch);
    });
    searchInputElement.addEventListener("input", (event: Event) => {
        if ("isComposing" in event && event.isComposing) {
            return;
        }
        assetInputEvent(element, localSearch);
    });
    searchInputElement.addEventListener("blur", () => {
        saveAssetKeyList(searchInputElement);
    });
    assetInputEvent(element, localSearch);
    addClearButton({
        right: 8,
        height: searchInputElement.clientHeight,
        inputElement: searchInputElement,
        clearAriaLabel: siyuanI18n.clear,
        clearCB() {
            assetInputEvent(element, localSearch);
        }
    });
};

/** 处理拖拽的 mousedown 事件 */
const 处理拖拽mousedown = (
    event: MouseEvent,
    element: HTMLElement,
    previewElement: HTMLElement,
    dragElement: HTMLElement,
    localSearch: ISearchAssetOption
): void => {
    const documentSelf = document;
    const previousElement = dragElement.previousElementSibling;
    if (!(previousElement instanceof HTMLElement)) {
        return;
    }
    const direction = localSearch.layout === 1 ? "lr" : "tb";
    const x = event[direction === "lr" ? "clientX" : "clientY"];
    const previousSize = direction === "lr" ? previousElement.offsetWidth : previousElement.offsetHeight;
    const nextSize = direction === "lr" ? previewElement.offsetWidth : previewElement.offsetHeight;

    previewElement.classList.remove("fn__flex-1");
    previewElement.style[direction === "lr" ? "width" : "height"] = nextSize + "px";
    element.style.userSelect = "none";
    documentSelf.onmousemove = (moveEvent: MouseEvent) => {
        moveEvent.preventDefault();
        moveEvent.stopPropagation();
        const previousNowSize = (previousSize + (moveEvent[direction === "lr" ? "clientX" : "clientY"] - x));
        const nextNowSize = (nextSize - (moveEvent[direction === "lr" ? "clientX" : "clientY"] - x));
        if (previousNowSize < 120 || nextNowSize < 120) {
            return;
        }
        previewElement.style[direction === "lr" ? "width" : "height"] = nextNowSize + "px";
    };

    documentSelf.onmouseup = () => {
        element.style.userSelect = "none";
        documentSelf.onmousemove = null;
        documentSelf.onmouseup = null;
        documentSelf.ondragstart = null;
        documentSelf.onselectstart = null;
        documentSelf.onselect = null;
        const searchAsset = getSiyuanStorage()[Constants.LOCAL_SEARCHASSET];
        searchAsset[direction === "lr" ? "col" : "row"] = previewElement[direction === "lr" ? "offsetWidth" : "offsetHeight"] + "px";
        setStorageVal(Constants.LOCAL_SEARCHASSET, searchAsset);
    };
};

/** 处理拖拽的 dblclick 事件 - 重置预览区域大小 */
const 处理拖拽dblclick = (
    previewElement: HTMLElement,
    localSearch: ISearchAssetOption
): void => {
    previewElement.style[localSearch.layout === 1 ? "width" : "height"] = "";
    previewElement.classList.add("fn__flex-1");
    const direction = localSearch.layout === 1 ? "lr" : "tb";
    const searchAsset = getSiyuanStorage()[Constants.LOCAL_SEARCHASSET];
    searchAsset[direction === "lr" ? "col" : "row"] = "";
    setStorageVal(Constants.LOCAL_SEARCHASSET, searchAsset);
};

/** 初始化拖拽调整大小功能 */
const 初始化拖拽功能 = (
    element: HTMLElement,
    previewElement: HTMLElement,
    localSearch: ISearchAssetOption
): void => {
    const dragElement = element.querySelector(".search__drag");
    if (!(dragElement instanceof HTMLElement)) {
        return;
    }
    dragElement.addEventListener("mousedown", (event: MouseEvent) => {
        处理拖拽mousedown(event, element, previewElement, dragElement, localSearch);
    });
    dragElement.addEventListener("dblclick", () => {
        处理拖拽dblclick(previewElement, localSearch);
    });
};

/** 选中搜索输入框 */
const 选中搜索输入框 = (element: HTMLElement): void => {
    const inputEl = element.querySelector("#searchAssetInput");
    if (inputEl instanceof HTMLInputElement) {
        inputEl.select();
    }
};

/** 打开搜索资源面板 */
export const 打开搜索资源面板 = (element: HTMLElement, isStick: boolean) => {
    // 资源搜索面板仅在桌面端可用，移动端无此功能
    if (isMobile) {
        return;
    }
    getSiyuanGlobalMenus().menu.remove();
    element.previousElementSibling?.classList.add("fn__none");
    element.classList.remove("fn__none");
    if (element.innerHTML) {
        选中搜索输入框(element);
        return;
    }
    const localSearch: ISearchAssetOption = getSiyuanStorage()[Constants.LOCAL_SEARCHASSET];
    const parent = element.parentElement;
    const loadingElement = parent?.querySelector<HTMLElement>(".fn__loading");
    loadingElement?.classList.remove("fn__none");
    if (loadingElement) {
        loadingElement.style.top = "84px";
    }
    let enterTip = "";
    // Electron 环境下显示"在文件夹中显示"的快捷键提示
    if (isElectron) {
        enterTip = `<kbd>${siyuanI18n.enterKey}/${siyuanI18n.doubleClick}</kbd> ${siyuanI18n.showInFolder}`;
    }
    element.innerHTML = 生成搜索资源HTML(localSearch, isStick, enterTip);
    const searchAssetListElement = element.querySelector("#searchAssetList");
    if (searchAssetListElement && searchAssetListElement.innerHTML !== "") {
        return;
    }
    const previewElement = element.querySelector("#searchAssetPreview");
    if (!(previewElement instanceof HTMLElement)) {
        return;
    }
    设置预览元素布局(previewElement, localSearch);
    初始化搜索输入框(element, localSearch);
    初始化拖拽功能(element, previewElement, localSearch);
};

/** 英文别名导出 */
export const openSearchAsset = 打开搜索资源面板;
