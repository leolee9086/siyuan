import {Constants} from "../constants";
import dayjs from "dayjs";
import {fetchPost} from "../util/network/fetch";
import {escapeAttr, escapeHtml} from "../util/DOM/escape";
import {isMobile} from "../util/platform/functions";
import {platform} from "../platform";
import {setStorageVal} from "../protyle/util/compatibility";
import {siyuanI18n} from "../util/siyuanEnvironments/i18n.getI18n.environment";
import {getSiyuanStorage} from "../util/siyuanEnvironments/getSiyuanConfig.environment";
import {requireHistoryElement} from "./history.dom";

const setOperationOptionHidden = (
    selectElement: HTMLSelectElement,
    value: string,
    hidden: boolean,
) => {
    requireHistoryElement(
        selectElement.querySelector<HTMLOptionElement>(`option[value="${value}"]`),
        `history operation option ${value}`,
    ).classList.toggle("fn__none", hidden);
};

const requireHistoryList = (element: Element, description: string): Element =>
    requireHistoryElement(element.lastElementChild, description);

export const renderDoc = (element: HTMLElement, currentPage: number) => {
    const previousElement = requireHistoryElement(
        element.querySelector<HTMLElement>('[data-type="docprevious"]'),
        "document history previous-page action",
    );
    const nextElement = requireHistoryElement(
        element.querySelector<HTMLElement>('[data-type="docnext"]'),
        "document history next-page action",
    );
    element.setAttribute("data-page", currentPage.toString());
    if (currentPage > 1) {
        previousElement.removeAttribute("disabled");
    } else {
        previousElement.setAttribute("disabled", "disabled");
    }
    const pageBtn = requireHistoryElement(
        element.querySelector<HTMLButtonElement>('button[data-type="jumpHistoryPage"]'),
        "document history page action",
    );
    pageBtn.textContent = `${currentPage}`;

    const inputElement = requireHistoryElement(
        element.querySelector<HTMLInputElement>(".b3-text-field"),
        "document history search input",
    );
    const opElement = requireHistoryElement(
        element.querySelector<HTMLSelectElement>('.b3-select[data-type="opselect"]'),
        "document history operation selector",
    );
    const typeElement = requireHistoryElement(
        element.querySelector<HTMLSelectElement>('.b3-select[data-type="typeselect"]'),
        "document history type selector",
    );
    const notebookElement = requireHistoryElement(
        element.querySelector<HTMLSelectElement>('.b3-select[data-type="notebookselect"]'),
        "document history notebook selector",
    );
    const docElement = requireHistoryElement(
        element.querySelector<HTMLElement>('.history__text[data-type="docPanel"]'),
        "document history preview",
    );
    const assetElement = requireHistoryElement(
        element.querySelector<HTMLElement>('.history__text[data-type="assetPanel"]'),
        "asset history preview",
    );
    const mdElement = requireHistoryElement(
        element.querySelector<HTMLTextAreaElement>('.history__text[data-type="mdPanel"]'),
        "large document history preview",
    );
    const listElement = requireHistoryElement(
        element.querySelector<HTMLElement>(".b3-list"),
        "document history result list",
    );
    requireHistoryElement(
        element.querySelector<HTMLElement>(".protyle-title__input"),
        "document history preview title",
    ).classList.add("fn__none");
    assetElement.classList.add("fn__none");
    mdElement.classList.add("fn__none");
    docElement.classList.add("fn__none");
    const localHistory = getSiyuanStorage()[Constants.LOCAL_HISTORY];
    if (typeElement.value === "2" || typeElement.value === "4") {
        notebookElement.setAttribute("disabled", "disabled");
        if (localHistory.type !== 2 && localHistory.type !== 4) {
            opElement.value = "all";
        }
        const isAttributeView = typeElement.value === "4";
        setOperationOptionHidden(opElement, "update", isAttributeView);
        setOperationOptionHidden(opElement, "sync", isAttributeView);
        setOperationOptionHidden(opElement, "clean", false);
        setOperationOptionHidden(opElement, "delete", true);
        setOperationOptionHidden(opElement, "format", true);
        setOperationOptionHidden(opElement, "replace", true);
        setOperationOptionHidden(opElement, "outline", true);
    } else {
        notebookElement.removeAttribute("disabled");
        if (localHistory.type === 2 || localHistory.type === 4) {
            opElement.value = "all";
        }
        setOperationOptionHidden(opElement, "clean", true);
        setOperationOptionHidden(opElement, "update", false);
        setOperationOptionHidden(opElement, "delete", false);
        setOperationOptionHidden(opElement, "format", false);
        setOperationOptionHidden(opElement, "sync", false);
        setOperationOptionHidden(opElement, "replace", false);
        setOperationOptionHidden(opElement, "outline", false);
    }
    localHistory.notebookId = notebookElement.value;
    localHistory.type = parseInt(typeElement.value);
    localHistory.operation = opElement.value;
    setStorageVal(Constants.LOCAL_HISTORY, localHistory);
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
        const pageElement = requireHistoryElement(
            nextElement.nextElementSibling?.nextElementSibling,
            "document history page summary",
        );
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
    const resultList = requireHistoryList(element, "repository history result list");
    if (response.data.snapshots.length === 0) {
        resultList.innerHTML = `<li class="b3-list--empty">${siyuanI18n.emptyContent}</li>`;
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
        JSON.parse(requireHistoryElement(
            element.querySelector<HTMLButtonElement>(".b3-button[data-type='compare']"),
            "repository history compare button",
        ).getAttribute("data-ids") || "[]") : [];
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
    <div class="fn__flex" style="height: 26px" data-type="repoitem" data-id="${item.id}" data-tag="${item.tag}">
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
    resultList.innerHTML = `${repoHTML}`;
};

const renderRepoSearchResult = (response: IWebSocketData, element: Element) => {
    const resultList = requireHistoryList(element, "repository search result list");
    if (response.data.files.length === 0) {
        resultList.innerHTML = `<li class="b3-list--empty">${siyuanI18n.emptyContent}</li>`;
        return;
    }
    let html = "";
    response.data.files.forEach((item: {
        fileID: string,
        indexID: string,
        title: string,
        hPath: string,
        path: string,
        hSize: string,
        updated: number
    }) => {
        if (isMobile()) {
            html += `<li class="b3-list-item" data-type="searchFileItem" data-id="${item.fileID}" data-snapshot="${item.indexID}" data-created="${item.updated}">
    <div class="fn__flex-1">
        <div style="padding-top:8px" class="b3-list-item__text">${escapeHtml(item.title)}</div>
        <div class="b3-list-item__meta">
            ${item.hSize}
            <span class="fn__space"></span>
            ${dayjs(item.updated).format("YYYY-MM-DD HH:mm:ss")}
        </div>
        <div class="fn__flex" style="height: 26px">
            <span class="fn__flex-1"></span>
            <span class="b3-list-item__action" data-type="view">
                <svg><use xlink:href="#iconEye"></use></svg>
                <span class="fn__space"></span>${siyuanI18n.cardPreview}
            </span>
            <span class="fn__space"></span>
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
            html += `<li class="b3-list-item b3-list-item--hide-action" data-type="searchFileItem" data-id="${item.fileID}" data-snapshot="${item.indexID}" data-created="${item.updated}">
    <div class="fn__flex-1">
        <span class="b3-list-item__text">${escapeHtml(item.title)}</span>
        <div class="b3-list-item__meta">
            ${escapeHtml(item.hPath)}
            <span class="fn__space"></span>
            ${item.hSize}
            <span class="fn__space"></span>
            ${dayjs(item.updated).format("YYYY-MM-DD HH:mm:ss")}
        </div>
    </div>
    <span class="b3-list-item__action b3-tooltips b3-tooltips__w" data-type="view" aria-label="${siyuanI18n.cardPreview}">
        <svg><use xlink:href="#iconEye"></use></svg>
    </span>
    <span class="b3-list-item__action b3-tooltips b3-tooltips__w" data-type="saveAs" aria-label="${siyuanI18n.saveAs}">
        <svg><use xlink:href="#iconDownload"></use></svg>
    </span>
    <span class="b3-list-item__action b3-tooltips b3-tooltips__w" data-type="rollback" aria-label="${siyuanI18n.rollback}">
        <svg><use xlink:href="#iconUndo"></use></svg>
    </span>
</li>`;
        }
    });
    resultList.innerHTML = html;
};

export const renderRepo = (element: Element, currentPage: number) => {
    const selectElement = requireHistoryElement(
        element.querySelector<HTMLSelectElement>(".b3-select"),
        "repository history source selector",
    );
    const selectValue = selectElement.value;

    selectElement.disabled = true;
    requireHistoryList(element, "repository history result list").innerHTML = '<li style="position: relative;height: 100%;"><div class="fn__loading"><img width="64px" src="/stage/loading-pure.svg"></div></li>';
    const pageBtn = requireHistoryElement(
        element.querySelector<HTMLButtonElement>('button[data-type="jumpRepoPage"]'),
        "repository history page action",
    );
    pageBtn.textContent = `${currentPage}`;

    const previousElement = requireHistoryElement(
        element.querySelector<HTMLElement>('[data-type="previous"]'),
        "repository history previous-page action",
    );
    const nextElement = requireHistoryElement(
        element.querySelector<HTMLElement>('[data-type="next"]'),
        "repository history next-page action",
    );
    const pageElement = requireHistoryElement(
        nextElement.nextElementSibling?.nextElementSibling,
        "repository history page summary",
    );
    element.setAttribute("data-init", "true");

    const searchInputElement = requireHistoryElement(
        element.querySelector<HTMLInputElement>("input"),
        "repository history search input",
    );
    const searchContainer = requireHistoryElement(
        searchInputElement.parentElement,
        "repository history search container",
    );
    if (selectValue === "getRepoSnapshots") {
        searchContainer.classList.remove("fn__none");
    } else {
        searchContainer.classList.add("fn__none");
    }
    const keyword = searchInputElement.value.trim();
    if (keyword && selectValue === "getRepoSnapshots") {
        const searchBtnElement = requireHistoryElement(
            searchInputElement.nextElementSibling as HTMLButtonElement | null,
            "repository history search button",
        );
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
