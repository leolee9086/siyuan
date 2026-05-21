import {Constants} from "../constants";
import * as dayjs from "dayjs";
import {fetchPost} from "../util/network/fetch";
import {escapeAttr, escapeHtml} from "../util/DOM/escape";
import {isMobile} from "../util/platform/functions";
import {platform} from "../platform";
import {setStorageVal} from "../protyle/util/compatibility";
import {siyuanI18n} from "../util/siyuanEnvironments/i18n.getI18n.environment";

export const renderDoc = (element: HTMLElement, currentPage: number) => {
    const previousElement = element.querySelector('[data-type="docprevious"]');
    const nextElement = element.querySelector('[data-type="docnext"]');
    element.setAttribute("data-page", currentPage.toString());
    if (currentPage > 1) {
        previousElement.removeAttribute("disabled");
    } else {
        previousElement.setAttribute("disabled", "disabled");
    }
    const pageBtn = element.querySelector('button[data-type="jumpHistoryPage"]');
    pageBtn.textContent = `${currentPage}`;

    const inputElement = element.querySelector(".b3-text-field") as HTMLInputElement;
    const opElement = element.querySelector('.b3-select[data-type="opselect"]') as HTMLSelectElement;
    const typeElement = element.querySelector('.b3-select[data-type="typeselect"]') as HTMLSelectElement;
    const notebookElement = element.querySelector('.b3-select[data-type="notebookselect"]') as HTMLSelectElement;
    const docElement = element.querySelector('.history__text[data-type="docPanel"]');
    const assetElement = element.querySelector('.history__text[data-type="assetPanel"]');
    const mdElement = element.querySelector('.history__text[data-type="mdPanel"]') as HTMLTextAreaElement;
    const listElement = element.querySelector(".b3-list");
    element.querySelector(".protyle-title__input").classList.add("fn__none");
    assetElement.classList.add("fn__none");
    mdElement.classList.add("fn__none");
    docElement.classList.add("fn__none");
    if (typeElement.value === "2" || typeElement.value === "4") {
        notebookElement.setAttribute("disabled", "disabled");
        if (window.siyuan.storage[Constants.LOCAL_HISTORY].type !== 2 && window.siyuan.storage[Constants.LOCAL_HISTORY].type !== 4) {
            opElement.value = "all";
        }
        if (typeElement.value === "4") {
            opElement.querySelector('option[value="update"]').classList.add("fn__none");
            opElement.querySelector('option[value="sync"]').classList.add("fn__none");
        } else {
            opElement.querySelector('option[value="update"]').classList.remove("fn__none");
            opElement.querySelector('option[value="sync"]').classList.remove("fn__none");
        }
        opElement.querySelector('option[value="clean"]').classList.remove("fn__none");
        opElement.querySelector('option[value="delete"]').classList.add("fn__none");
        opElement.querySelector('option[value="format"]').classList.add("fn__none");
        opElement.querySelector('option[value="replace"]').classList.add("fn__none");
        opElement.querySelector('option[value="outline"]').classList.add("fn__none");
    } else {
        notebookElement.removeAttribute("disabled");
        if (window.siyuan.storage[Constants.LOCAL_HISTORY].type === 2 || window.siyuan.storage[Constants.LOCAL_HISTORY].type === 4) {
            opElement.value = "all";
        }
        opElement.querySelector('option[value="clean"]').classList.add("fn__none");
        opElement.querySelector('option[value="update"]').classList.remove("fn__none");
        opElement.querySelector('option[value="delete"]').classList.remove("fn__none");
        opElement.querySelector('option[value="format"]').classList.remove("fn__none");
        opElement.querySelector('option[value="sync"]').classList.remove("fn__none");
        opElement.querySelector('option[value="replace"]').classList.remove("fn__none");
        opElement.querySelector('option[value="outline"]').classList.remove("fn__none");
    }
    window.siyuan.storage[Constants.LOCAL_HISTORY].notebookId = notebookElement.value;
    window.siyuan.storage[Constants.LOCAL_HISTORY].type = parseInt(typeElement.value);
    window.siyuan.storage[Constants.LOCAL_HISTORY].operation = opElement.value;
    setStorageVal(Constants.LOCAL_HISTORY, window.siyuan.storage[Constants.LOCAL_HISTORY]);
    fetchPost("/api/history/searchHistory", {
        notebook: notebookElement.value,
        query: inputElement.value,
        page: currentPage,
        op: opElement.value,
        type: parseInt(typeElement.value)
    }, (response) => {
        if (currentPage < response.data.pageCount) {
            nextElement.removeAttribute("disabled");
        } else {
            nextElement.setAttribute("disabled", "disabled");
        }
        pageBtn.setAttribute("data-totalpage", (response.data.pageCount || 1).toString());
        const pageElement = nextElement.nextElementSibling.nextElementSibling;
        pageElement.textContent = `${siyuanI18n.pageCountAndHistoryCount.replace("${x}", response.data.pageCount).replace("${y}", response.data.totalCount || 1)}`;
        pageElement.classList.remove("fn__none");
        if (response.data.histories.length === 0) {
            listElement.innerHTML = `<li class="b3-list--empty">${siyuanI18n.emptyContent}</li>`;
            return;
        }
        let logsHTML = "";
        response.data.histories.forEach((item: string) => {
            logsHTML += `<li class="b3-list-item" data-type="toggle" data-created="${item}">
    <span class="b3-list-item__toggle b3-list-item__toggle--hl"><svg class="b3-list-item__arrow"><use xlink:href="#iconRight"></use></svg></span>
    <span style="padding-left: 4px" class="b3-list-item__text">${dayjs(parseInt(item) * 1000).format("YYYY-MM-DD HH:mm:ss")}</span>
</li>`;
        });
        listElement.innerHTML = logsHTML;
    });
};

export const renderRepoItem = (response: IWebSocketData, element: Element, type: string) => {
    if (response.data.snapshots.length === 0) {
        element.lastElementChild.innerHTML = `<li class="b3-list--empty">${siyuanI18n.emptyContent}</li>`;
        return;
    }
    let actionHTML = "";
    // 移动端使用带文字标签的操作按钮，提供更大的点击区域
    if (platform === "browser-mobile") {
    if (type === "getCloudRepoTagSnapshots") {
        actionHTML = `<span class="fn__flex-1"></span>
<span class="b3-list-item__action" data-type="downloadSnapshot">
    <svg><use xlink:href="#iconDownload"></use></svg>
    <span class="fn__space"></span>
    ${siyuanI18n.download}
</span>
<span class="fn__flex-1"></span>
<span class="b3-list-item__action" data-type="downloadRollback">
    <svg><use xlink:href="#iconUndo"></use></svg>
    <span class="fn__space"></span>
    ${window.siyuan.languages.downloadRollback}
</span>
<span class="fn__flex-1"></span>
<span class="b3-list-item__action" data-type="removeCloudRepoTagSnapshot">
    <svg><use xlink:href="#iconTrashcan"></use></svg>
    <span class="fn__space"></span>
    ${siyuanI18n.remove}
</span>
<span class="fn__flex-1"></span>`;
    } else if (type === "getCloudRepoSnapshots") {
        actionHTML = `<span class="fn__flex-1"></span>
<span class="b3-list-item__action" data-type="downloadSnapshot">
    <svg><use xlink:href="#iconDownload"></use></svg>
    <span class="fn__space"></span>
    ${siyuanI18n.download}
</span>
<span class="fn__flex-1"></span>
<span class="b3-list-item__action" data-type="downloadRollback">
    <svg><use xlink:href="#iconUndo"></use></svg>
    <span class="fn__space"></span>
    ${window.siyuan.languages.downloadRollback}
</span>
<span class="fn__flex-1"></span>`;
    } else if (type === "getRepoTagSnapshots") {
        actionHTML = `<span class="fn__flex-1"></span>
<span class="b3-list-item__action" data-type="uploadSnapshot">
    <svg><use xlink:href="#iconUpload"></use></svg>
    <span class="fn__space"></span>
    ${siyuanI18n.upload}
</span>
<span class="fn__flex-1"></span>
<span class="b3-list-item__action" data-type="rollback">
    <svg><use xlink:href="#iconUndo"></use></svg>
    <span class="fn__space"></span>
    ${siyuanI18n.rollback}
</span>
<span class="fn__flex-1"></span>
<span class="b3-list-item__action" data-type="removeRepoTagSnapshot">
    <svg><use xlink:href="#iconTrashcan"></use></svg>
    <span class="fn__space"></span>
    ${siyuanI18n.remove}
</span>
<span class="fn__flex-1"></span>`;
    } else if (type === "getRepoSnapshots") {
        actionHTML = `<span class="fn__flex-1"></span>
<span class="b3-list-item__action" data-type="genTag">
    <svg><use xlink:href="#iconTag"></use></svg>
    <span class="fn__space"></span>
    ${siyuanI18n.tagSnapshot}
</span>
<span class="fn__flex-1"></span>
<span class="b3-list-item__action" data-type="rollback">
    <svg><use xlink:href="#iconUndo"></use></svg>
    <span class="fn__space"></span>
    ${siyuanI18n.rollback}
</span>
<span class="fn__flex-1"></span>`;
    }
    }
    // 桌面端使用带tooltip的紧凑操作按钮
    if (platform !== "browser-mobile") {
    if (type === "getCloudRepoTagSnapshots") {
        actionHTML = `<span class="b3-list-item__action b3-tooltips b3-tooltips__w" data-type="downloadSnapshot" aria-label="${siyuanI18n.download}"><svg><use xlink:href="#iconDownload"></use></svg></span>
<span class="b3-list-item__action b3-tooltips b3-tooltips__w" data-type="downloadRollback" aria-label="${siyuanI18n.downloadRollback}"><svg><use xlink:href="#iconUndo"></use></svg></span>
<span class="b3-list-item__action b3-tooltips b3-tooltips__w" data-type="removeCloudRepoTagSnapshot" aria-label="${siyuanI18n.remove}"><svg><use xlink:href="#iconTrashcan"></use></svg></span>`;
    } else if (type === "getCloudRepoSnapshots") {
        actionHTML = `<span class="b3-list-item__action b3-tooltips b3-tooltips__w" data-type="downloadSnapshot" aria-label="${siyuanI18n.download}"><svg><use xlink:href="#iconDownload"></use></svg></span>
<span class="b3-list-item__action b3-tooltips b3-tooltips__w" data-type="downloadRollback" aria-label="${siyuanI18n.downloadRollback}"><svg><use xlink:href="#iconUndo"></use></svg></span>`;
    } else if (type === "getRepoTagSnapshots") {
        actionHTML = `<span class="b3-list-item__action b3-tooltips b3-tooltips__w" data-type="uploadSnapshot" aria-label="${siyuanI18n.upload}"><svg><use xlink:href="#iconUpload"></use></svg></span>
<span class="b3-list-item__action b3-tooltips b3-tooltips__w" data-type="rollback" aria-label="${siyuanI18n.rollback}"><svg><use xlink:href="#iconUndo"></use></svg></span>
<span class="b3-list-item__action b3-tooltips b3-tooltips__w" data-type="removeRepoTagSnapshot" aria-label="${siyuanI18n.remove}"><svg><use xlink:href="#iconTrashcan"></use></svg></span>`;
    } else if (type === "getRepoSnapshots") {
        actionHTML = `<span class="b3-list-item__action b3-tooltips b3-tooltips__w" data-type="genTag" aria-label="${siyuanI18n.tagSnapshot}"><svg><use xlink:href="#iconTag"></use></svg></span>
<span class="b3-list-item__action b3-tooltips b3-tooltips__w" data-type="rollback" aria-label="${siyuanI18n.rollback}"><svg><use xlink:href="#iconUndo"></use></svg></span>`;
    }
    }
    let repoHTML = "";
    const isPhone = isMobile();
    const selectId: { id: string, time: string }[] = ["getRepoTagSnapshots", "getRepoSnapshots"].includes(type) ?
        JSON.parse(element.querySelector(".b3-button[data-type='compare']").getAttribute("data-ids") || "[]") : [];
    response.data.snapshots.forEach((item: {
        memo: string,
        id: string,
        hCreated: string,
        count: number,
        hSize: string,
        systemID: string,
        systemName: string,
        systemOS: string,
        tag: string,
        typesCount: { type: string, count: number }[]
    }) => {
        let statHTML = "";
        if (item.typesCount) {
            statHTML = `<div class="b3-list-item__meta${isPhone ? " fn__none" : ""}">
${siyuanI18n.fileCount} ${item.count}<span class="fn__space"></span>`;
            item.typesCount.forEach(subItem => {
                statHTML += `${subItem.type} ${subItem.count}<span class="fn__space"></span>`;
            });
            statHTML += "</div>";
        }
        const infoHTML = `<div${isPhone ? ' style="padding-top:8px"' : ""}>
    <span data-type="hCreated">${item.hCreated}</span>
    <span class="fn__space"></span>
    ${item.hSize}
    <span class="fn__space"></span>
    ${item.systemOS}${(item.systemName && item.systemOS) ? "/" : ""}${item.systemName}
    <span class="fn__space"></span>
    <span class="b3-chip b3-chip--secondary b3-chip--small${item.tag ? "" : " fn__none"}">${item.tag}</span>
</div>
<div class="b3-list-item__meta${isPhone ? " fn__none" : ""}">
    ${escapeHtml(item.memo)}
    <span class="fn__space"></span>
    <code class="fn__code">${item.id.substring(0, 7)}</code>
</div>
${statHTML}`;
        const hasSelected = selectId.find(subItem => subItem.id === item.id);
        // 移动端使用展开式布局，包含更多操作按钮和文字标签
        if (platform === "browser-mobile") {
        repoHTML += `<li class="b3-list-item${hasSelected ? " b3-list-item--focus" : ""}" data-type="repoitem" data-id="${item.id}" data-tag="${item.tag}">
<div class="fn__flex-1">
    ${infoHTML}
    <div class="fn__flex" style="height: 26px" data-type="repoitem"" data-id="${item.id}" data-tag="${item.tag}">
        ${actionHTML}
        <span class="b3-list-item__action" data-type="more">
            <svg><use xlink:href="#iconMore"></use></svg>
            <span class="fn__space"></span>
            ${siyuanI18n.more}
        </span>
        <span class="fn__flex-1"></span>
    </div>
</div>
</li>`;
        }
        // 桌面端使用紧凑布局，操作按钮悬停显示
        if (platform !== "browser-mobile") {
        repoHTML += `<li class="b3-list-item b3-list-item--hide-action${hasSelected ? " b3-list-item--focus" : ""}" data-type="repoitem" data-id="${item.id}" data-tag="${item.tag}">
<div class="fn__flex-1">${infoHTML}</div>
${actionHTML}
</li>`;
        }
    });
    element.lastElementChild.innerHTML = `${repoHTML}`;
};

const renderRepoSearchResult = (response: IWebSocketData, element: Element) => {
    if (response.data.files.length === 0) {
        element.lastElementChild.innerHTML = `<li class="b3-list--empty">${siyuanI18n.emptyContent}</li>`;
        return;
    }
    let html = "";
    response.data.files.forEach((item: {
        fileID: string,
        title: string,
        path: string,
        hSize: string,
        updated: number
    }) => {
        if (isMobile()) {
            html += `<li class="b3-list-item" data-type="searchFileItem" data-id="${item.fileID}" data-created="${item.updated}">
    <div class="fn__flex-1">
        <div style="padding-top:8px" class="b3-list-item__text">${escapeHtml(item.title)}</div>
        <div class="b3-list-item__meta">
            ${item.hSize}
            <span class="fn__space"></span>
            ${dayjs(item.updated).format("YYYY-MM-DD HH:mm:ss")}
        </div>
        <div class="fn__flex" style="height: 26px">
            <span class="fn__flex-1"></span>
            <span class="b3-list-item__action" data-type="saveAs">
                <svg><use xlink:href="#iconDownload"></use></svg>
                <span class="fn__space"></span>${siyuanI18n.saveAs}
            </span>
            <span class="fn__space"></span>
            <span class="b3-list-item__action" data-type="rollback">
                <svg><use xlink:href="#iconUndo"></use></svg>
                <span class="fn__space"></span> ${siyuanI18n.rollback}
            </span>
        </div>
    </div>
</li>`;
        } else {
            html += `<li class="b3-list-item b3-list-item--hide-action" data-type="searchFileItem" data-id="${item.fileID}" data-created="${item.updated}">
    <div class="fn__flex-1">
        <span class="b3-list-item__text">${escapeHtml(item.title)}</span>
        <div class="b3-list-item__meta">
            ${escapeHtml(item.path)}
            <span class="fn__space"></span>
            ${item.hSize}
            <span class="fn__space"></span>
            ${dayjs(item.updated).format("YYYY-MM-DD HH:mm:ss")}
        </div>
    </div>
    <span class="b3-list-item__action b3-tooltips b3-tooltips__w" data-type="rollback" aria-label="${siyuanI18n.rollback}">
        <svg><use xlink:href="#iconUndo"></use></svg>
    </span>
    <span class="b3-list-item__action b3-tooltips b3-tooltips__w" data-type="saveAs" aria-label="${siyuanI18n.saveAs}">
        <svg><use xlink:href="#iconDownload"></use></svg>
    </span>
</li>`;
        }
    });
    element.lastElementChild.innerHTML = html;
};

export const renderRepo = (element: Element, currentPage: number) => {
    const selectElement = element.querySelector(".b3-select") as HTMLSelectElement;
    const selectValue = selectElement.value;

    selectElement.disabled = true;
    element.lastElementChild.innerHTML = '<li style="position: relative;height: 100%;"><div class="fn__loading"><img width="64px" src="/stage/loading-pure.svg"></div></li>';
    const pageBtn = element.querySelector('button[data-type="jumpRepoPage"]');
    pageBtn.textContent = `${currentPage}`;

    const previousElement = element.querySelector('[data-type="previous"]');
    const nextElement = element.querySelector('[data-type="next"]');
    const pageElement = nextElement.nextElementSibling.nextElementSibling;
    element.setAttribute("data-init", "true");

    const searchInputElement = element.querySelector("input") as HTMLInputElement;
    if (selectValue === "getRepoSnapshots") {
        searchInputElement.parentElement.classList.remove("fn__none");
    } else {
        searchInputElement.parentElement.classList.add("fn__none");
    }
    const keyword = searchInputElement.value.trim();
    if (keyword && selectValue === "getRepoSnapshots") {
        const searchBtnElement = searchInputElement.nextElementSibling as HTMLButtonElement;
        searchBtnElement.disabled = true;
        previousElement.classList.remove("fn__none");
        nextElement.classList.remove("fn__none");
        pageBtn.classList.remove("fn__none");
        element.setAttribute("data-page", currentPage.toString());
        if (currentPage > 1) {
            previousElement.removeAttribute("disabled");
        } else {
            previousElement.setAttribute("disabled", "disabled");
        }
        nextElement.setAttribute("disabled", "disabled");
        fetchPost("/api/repo/searchRepoFile", {keyword, page: currentPage}, (response) => {
            searchBtnElement.disabled = false;
            selectElement.disabled = false;
            if (currentPage < response.data.pageCount) {
                nextElement.removeAttribute("disabled");
            } else {
                nextElement.setAttribute("disabled", "disabled");
            }
            pageBtn.setAttribute("data-totalpage", (response.data.pageCount || 1).toString());
            pageElement.textContent = `${siyuanI18n.pageCountAndSnapshotCount.replace("${x}", response.data.pageCount).replace("${y}", response.data.totalCount || 1)}`;
            pageElement.classList.remove("fn__none");
            renderRepoSearchResult(response, element);
        });
    } else if (selectValue === "getRepoTagSnapshots" || selectValue === "getCloudRepoTagSnapshots") {
        fetchPost(`/api/repo/${selectValue}`, {}, (response) => {
            renderRepoItem(response, element, selectValue);
            selectElement.disabled = false;
        });
        previousElement.classList.add("fn__none");
        nextElement.classList.add("fn__none");
        pageElement.classList.add("fn__none");
        pageBtn.classList.add("fn__none");
    } else {
        previousElement.classList.remove("fn__none");
        nextElement.classList.remove("fn__none");
        pageBtn.classList.remove("fn__none");
        element.setAttribute("data-page", currentPage.toString());
        if (currentPage > 1) {
            previousElement.removeAttribute("disabled");
        } else {
            previousElement.setAttribute("disabled", "disabled");
        }
        nextElement.setAttribute("disabled", "disabled");
        fetchPost(`/api/repo/${selectValue}`, { page: currentPage }, (response) => {
            selectElement.disabled = false;
            if (currentPage < response.data.pageCount) {
                nextElement.removeAttribute("disabled");
            } else {
                nextElement.setAttribute("disabled", "disabled");
            }
            pageBtn.setAttribute("data-totalpage", (response.data.pageCount || 1).toString());
            pageElement.textContent = `${siyuanI18n.pageCountAndSnapshotCount.replace("${x}", response.data.pageCount).replace("${y}", response.data.totalCount || 1)}`;
            pageElement.classList.remove("fn__none");
            renderRepoItem(response, element, selectValue);
        });
    }
};

export const renderRmNotebook = (element: HTMLElement) => {
    element.setAttribute("data-init", "true");
    fetchPost("/api/history/getNotebookHistory", {}, (response) => {
        if (response.data.histories.length === 0) {
            element.innerHTML = `<li class="b3-list--empty">${siyuanI18n.emptyContent}</li>`;
            return;
        }
        let logsHTML = "";
        response.data.histories.forEach((item: {
            items: { path: string, title: string }[],
            hCreated: string
        }, index: number) => {
            logsHTML += `<li class="b3-list-item" style="padding-left: 0" data-type="rmtoggle">
    <span style="padding-left: 8px" class="b3-list-item__toggle"><svg class="b3-list-item__arrow${index === 0 ? " b3-list-item__arrow--open" : ""}${item.items.length > 0 ? "" : " fn__hidden"}"><use xlink:href="#iconRight"></use></svg></span>
    <span class="b3-list-item__text">${item.hCreated}</span>
</li>`;
            if (item.items.length > 0) {
                logsHTML += `<ul class="${index === 0 ? "" : "fn__none"}">`;
                item.items.forEach((docItem) => {
                    logsHTML += `<li data-type="notebook" data-path="${docItem.path}" class="b3-list-item b3-list-item--hide-action" style="padding-left: 32px">
    <span class="b3-list-item__text">${escapeHtml(docItem.title)}</span>
    <span class="fn__space"></span>
    <span class="b3-list-item__action b3-tooltips b3-tooltips__w" data-type="rollback" aria-label="${siyuanI18n.rollback}">
        <svg><use xlink:href="#iconUndo"></use></svg>
    </span>
</li>`;
                });
                logsHTML += "</ul>";
            }
        });
        element.innerHTML = logsHTML;
    });
};
