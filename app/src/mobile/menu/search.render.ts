import {Constants} from "../../constants";
import {fetchPost} from "../../util/network/fetch";
import {getIconByType} from "../../editor/getIcon";
import {getDisplayName, getNotebookIcon, getNotebookName} from "../../util/file/pathName";
import {getKeyByLiElement} from "../../search/menu";
import {setStorageVal} from "../../protyle/util/compatibility";
import {escapeHtml} from "../../util/DOM/escape";
import {unicode2Emoji} from "../../emoji";
import {showMessage} from "../../dialog/message";
import {reloadProtyle} from "../../protyle/util/reload";
import {saveKeyList} from "../../search/toggleHistory";
import {siyuanI18n} from "../../util/siyuanEnvironments/i18n.getI18n.environment";

export type UpdateSearchResultFn = (
    config: Config.IUILayoutTabSearchConfig,
    element: Element,
    rmCurrentCriteria?: boolean,
    focusId?: { currentId?: string, newId?: string }
) => void;

export const replace = (element: Element, config: Config.IUILayoutTabSearchConfig, isAll: boolean,
                        updateSearchResult: UpdateSearchResultFn) => {
    if (config.method === 2) {
        showMessage(siyuanI18n._kernel[132]);
        return;
    }
    const searchListElement = element.querySelector("#searchList");
    const replaceInputElement = element.querySelector("#toolbarReplace") as HTMLInputElement;

    const loadElement = replaceInputElement.parentElement.querySelector(".fn__rotate");
    if (!loadElement.classList.contains("fn__none")) {
        return;
    }
    saveKeyList("replaceKeys", replaceInputElement.value);
    const currentLiElement: HTMLElement = searchListElement.querySelector(".b3-list-item--focus");
    if (!currentLiElement) {
        return;
    }
    loadElement.classList.remove("fn__none");
    loadElement.nextElementSibling.classList.add("fn__none");
    const currentId = currentLiElement.getAttribute("data-node-id");
    fetchPost("/api/search/findReplace", {
        k: config.method === 0 || config.method === 1 ? getKeyByLiElement(currentLiElement) : (document.querySelector("#toolbarSearch") as HTMLInputElement).value,
        r: replaceInputElement.value,
        ids: isAll ? [] : [currentId],
        types: config.types,
        subTypes: config.subTypes,
        method: config.method,
        replaceTypes: config.replaceTypes,
        paths: config.idPath || [],
        groupBy: config.group,
        orderBy: config.sort,
        page: config.page,
    }, (response) => {
        loadElement.classList.add("fn__none");
        loadElement.nextElementSibling.classList.remove("fn__none");

        if (response.code === 1) {
            showMessage(response.msg);
            return;
        }
        if (isAll) {
            updateSearchResult(config, element, false);
            return;
        }
        reloadProtyle(window.siyuan.mobile.editor.protyle, false);

        let newId = currentLiElement.getAttribute("data-node-id");
        if (currentLiElement.nextElementSibling) {
            newId = currentLiElement.nextElementSibling.getAttribute("data-node-id");
        } else if (currentLiElement.previousElementSibling) {
            newId = currentLiElement.previousElementSibling.getAttribute("data-node-id");
        }
        if (config.group === 1 && !newId) {
            const nextDocElement = currentLiElement.parentElement.nextElementSibling || currentLiElement.parentElement.previousElementSibling.previousElementSibling?.previousElementSibling;
            if (nextDocElement) {
                newId = nextDocElement.nextElementSibling.firstElementChild.getAttribute("data-node-id");
            }
        }
        updateSearchResult(config, element, false, {
            currentId,
            newId
        });
    });
};

export const updateConfig = (element: Element, newConfig: Config.IUILayoutTabSearchConfig,
                             config: Config.IUILayoutTabSearchConfig,
                             updateSearchResult: UpdateSearchResultFn) => {
    if (config.hasReplace !== newConfig.hasReplace) {
        if (newConfig.hasReplace) {
            element.querySelector('[data-type="toggle-replace"]').classList.add("toolbar__icon--active");
            element.querySelector(".toolbar").classList.remove("fn__none");
        } else {
            element.querySelector('[data-type="toggle-replace"]').classList.remove("toolbar__icon--active");
            element.querySelector(".toolbar").classList.add("fn__none");
        }
    }
    const searchPathElement = element.querySelector("#searchPath");
    if (newConfig.hPath) {
        searchPathElement.classList.remove("fn__none");
        searchPathElement.innerHTML = `<div class="b3-chip b3-chip--middle">${escapeHtml(newConfig.hPath)}<svg data-type="remove-path" class="b3-chip__close"><use xlink:href="#iconClose"></use></svg></div>`;
    } else {
        searchPathElement.classList.add("fn__none");
    }
    if (config.group !== newConfig.group) {
        if (newConfig.group === 0) {
            element.querySelector('[data-type="expand"]').classList.add("fn__none");
            element.querySelector('[data-type="contract"]').classList.add("fn__none");
        } else {
            element.querySelector('[data-type="expand"]').classList.remove("fn__none");
            element.querySelector('[data-type="contract"]').classList.remove("fn__none");
        }
    }
    let includeChild = true;
    let enableIncludeChild = false;
    newConfig.idPath.forEach(newConfig => {
        if (newConfig.endsWith(".sy")) {
            includeChild = false;
        }
        if (newConfig.split("/").length > 1) {
            enableIncludeChild = true;
        }
    });
    const searchIncludeElement = element.querySelector('[data-type="include"]');
    if (includeChild) {
        searchIncludeElement.classList.add("toolbar__icon--active");
    } else {
        searchIncludeElement.classList.remove("toolbar__icon--active");
    }
    if (enableIncludeChild) {
        searchIncludeElement.removeAttribute("disabled");
    } else {
        searchIncludeElement.setAttribute("disabled", "disabled");
    }
    (document.querySelector("#toolbarSearch") as HTMLInputElement).value = newConfig.k;
    (element.querySelector("#toolbarReplace") as HTMLInputElement).value = newConfig.r;
    config = JSON.parse(JSON.stringify(newConfig));
    window.siyuan.storage[Constants.LOCAL_SEARCHDATA] = Object.assign({}, config);
    setStorageVal(Constants.LOCAL_SEARCHDATA, window.siyuan.storage[Constants.LOCAL_SEARCHDATA]);
    updateSearchResult(config, element);
    window.siyuan.menus.menu.remove();
    return config;
};

export const onRecentBlocks = (data: IBlock[], config: Config.IUILayoutTabSearchConfig,
                               response?: IWebSocketData, focusId?: {
        currentId?: string,
        newId?: string
    }) => {
    const listElement = document.querySelector("#searchList");
    let resultHTML = "";
    let currentData;
    let newData;
    data.forEach((item: IBlock) => {
        const title = escapeHtml(getNotebookName(item.box)) + getDisplayName(item.hPath, false);
        if (item.children) {
            resultHTML += `<div class="b3-list-item">
<span class="b3-list-item__toggle b3-list-item__toggle--hl">
    <svg class="b3-list-item__arrow b3-list-item__arrow--open"><use xlink:href="#iconRight"></use></svg>
</span>
${unicode2Emoji(getNotebookIcon(item.box) || window.siyuan.storage[Constants.LOCAL_IMAGES].note, "b3-list-item__graphic", true)}
<span class="b3-list-item__text" style="color: var(--b3-theme-on-surface)">${escapeHtml(title)}</span>
</div><div>`;
            item.children.forEach((childItem) => {
                if (focusId) {
                    if (childItem.id === focusId.currentId) {
                        currentData = childItem;
                    }
                    if (childItem.id === focusId.newId) {
                        newData = childItem;
                    }
                }
                resultHTML += `<div style="padding-left: 36px" data-type="search-item" class="b3-list-item" data-node-id="${childItem.id}">
<svg class="b3-list-item__graphic"><use xlink:href="#${getIconByType(childItem.type)}"></use></svg>
${unicode2Emoji(childItem.ial.icon, "b3-list-item__graphic", true)}
<span class="b3-list-item__text">${childItem.content}</span>
${childItem.tag ? `<span class="b3-list-item__meta b3-list-item__meta--ellipsis">${childItem.tag.replace(/#/g, "")}</span>` : ""}
</div>`;
            });
            resultHTML += "</div>";
        } else {
            if (focusId) {
                if (item.id === focusId.currentId) {
                    currentData = item;
                }
                if (item.id === focusId.newId) {
                    newData = item;
                }
            }
            resultHTML += `<div class="b3-list-item b3-list-item--two" data-type="search-item" data-node-id="${item.id}">
    <div class="b3-list-item__first">
        <svg class="b3-list-item__graphic"><use xlink:href="#${getIconByType(item.type)}"></use></svg>
        ${unicode2Emoji(item.ial.icon, "b3-list-item__graphic", true)}
        <span class="b3-list-item__text">${item.content}</span>
    </div>
    <div class="fn__flex">
        ${item.tag ? `<span class="b3-list-item__meta b3-list-item__meta--ellipsis">${item.tag.replace(/#/g, "")}</span><span class="fn__space"></span>` : ""}
        <span class="b3-list-item__text b3-list-item__meta">${escapeHtml(title)}</span>
    </div>
</div>`;
        }
    });
    listElement.innerHTML = resultHTML ||
        `<div class="b3-list-item b3-list-item--focus" data-type="search-new">
    <svg class="b3-list-item__graphic"><use xlink:href="#iconFile"></use></svg>
    <span class="b3-list-item__text">
        ${siyuanI18n.newFile} <mark>${(document.querySelector("#toolbarSearch") as HTMLInputElement).value}</mark>
    </span>
</div>`;
    listElement.scrollTop = 0;
    let countHTML = "";
    if (response) {
        let text = siyuanI18n.findInDoc.replace("${x}", response.data.matchedRootCount).replace("${y}", response.data.matchedBlockCount);
        if (response.data.docMode) {
            text = siyuanI18n.matchDoc.replace("${x}", response.data.matchedRootCount);
        }
        countHTML = `<span class="fn__flex-center">${text}</span>
<span class="fn__flex-1"></span>
<span class="fn__flex-center">${config.page}/${response.data.pageCount || 1}</span>`;
    }
    listElement.previousElementSibling.querySelector('[data-type="result"]').innerHTML = countHTML;
    if (!currentData) {
        currentData = newData;
    }
    if (!currentData && data.length > 0) {
        if (data[0].children) {
            currentData = data[0].children[0];
        } else {
            currentData = data[0];
        }
    }
    if (currentData) {
        const currentList = listElement.querySelector(`[data-node-id="${currentData.id}"]`) as HTMLElement;
        if (currentList) {
            currentList.classList.add("b3-list-item--focus");
            currentList.scrollIntoView();
        }
    }
};
