import {fetchSyncPost} from "../../../util/network/fetch";
import {Constants} from "../../../constants";
import {unicode2Emoji} from "../../../emoji";
import {hasClosestByClassName} from "../../util/hasClosest";
import {escapeAriaLabel, escapeHtml} from "../../../util/DOM/escape";
import {isMobile} from "../../../platform";
import {isInMobileApp} from "../../util/compatibility";
import {renderGallery} from "./gallery/render";
import {getFieldsByData, getViewIcon} from "./view";
import {getPageSize} from "./groups";
import {renderKanban} from "./kanban/render";
import {getTableHTMLs, renderGroupTable, afterRenderTable} from "./render.table";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";

export {getGroupTitleHTML} from "./render.table";
export {refreshAV} from "./render.refresh";

export const genTabHeaderHTML = (data: IAV, showSearch: boolean, editable: boolean) => {
    let tabHTML = "";
    let viewData: IAVView;
    let hasFilter = false;
    const findLeafFilter = (nodes: IAVFilter[], columnId: string, columnType: string): boolean => {
        for (const node of nodes) {
            if (node.filters) {
                if (findLeafFilter(node.filters, columnId, columnType)) {
                    return true;
                }
            } else if (node.value && node.value.type === columnType && node.column === columnId) {
                return true;
            }
        }
        return false;
    };
    getFieldsByData(data).forEach((item) => {
        if (!hasFilter && findLeafFilter(data.view.filters, item.id, item.type)) {
            hasFilter = true;
        }
    });
    data.views.forEach((item: IAVView) => {
        tabHTML += `<div draggable="true" data-position="north" data-av-type="${item.type}" data-id="${item.id}" data-page="${item.pageSize}" data-desc="${escapeAriaLabel(item.desc || "")}" class="ariaLabel item${item.id === data.viewID ? " item--focus" : ""}">
    ${item.icon ? unicode2Emoji(item.icon, "item__graphic", true) : `<svg class="item__graphic"><use xlink:href="#${getViewIcon(item.type)}"></use></svg>`}
    <span class="item__text">${escapeHtml(item.name)}</span>
</div>`;
        if (item.id === data.viewID) {
            viewData = item;
        }
    });
    return `<div class="av__header">
        <div class="fn__flex av__views${showSearch ? " av__views--show" : ""}">
            <div class="layout-tab-bar fn__flex">
                ${tabHTML}
            </div>
            <div class="fn__space"></div>
            <span data-type="av-add" class="block__icon ariaLabel" data-position="8south" aria-label="${siyuanI18n.newView}">
                <svg><use xlink:href="#iconAdd"></use></svg>
            </span>
            <div class="fn__flex-1"></div>
            <div class="fn__space"></div>
            <span data-type="av-switcher" aria-label="${siyuanI18n.allViews}" data-position="8south" class="ariaLabel block__icon${data.views.length > 0 ? "" : " fn__none"}">
                <svg><use xlink:href="#iconDown"></use></svg>
                <span class="fn__space"></span>
                <small>${data.views.length}</small>
            </span>
            <div class="fn__space"></div>
            <span data-type="av-filter" aria-label="${siyuanI18n.filter}" data-position="8south" class="ariaLabel block__icon${hasFilter ? " block__icon--active" : ""}">
                <svg><use xlink:href="#iconFilter"></use></svg>
            </span>
            <div class="fn__space"></div>
            <span data-type="av-sort" aria-label="${siyuanI18n.sort}" data-position="8south" class="ariaLabel block__icon${data.view.sorts.length > 0 ? " block__icon--active" : ""}">
                <svg><use xlink:href="#iconSort"></use></svg>
            </span>
            <div class="fn__space"></div>
            <button data-type="av-search-icon" aria-label="${siyuanI18n.search}" data-position="8south" class="ariaLabel block__icon">
                <svg><use xlink:href="#iconSearch"></use></svg>
            </button>
            <div style="position: relative" class="fn__flex">
                <div contenteditable="plaintext-only" style="${showSearch ? "width:128px" : "width:0;padding-left: 0;padding-right: 0;"}" data-type="av-search" class="b3-text-field b3-text-field--text" placeholder="${siyuanI18n.search}"></div>
            </div>
            <div class="fn__space"></div>
            <span data-type="av-more" aria-label="${siyuanI18n.config}" data-position="8south" class="ariaLabel block__icon">
                <svg><use xlink:href="#iconSettings"></use></svg>
            </span>
            <div class="fn__space"></div>
            <span data-type="av-add-more" class="block__icon ariaLabel" data-position="8south" aria-label="${siyuanI18n.newRow}">
                <svg><use xlink:href="#iconAdd"></use></svg>
            </span>
            <div class="fn__space"></div>
            ${data.isMirror ? ` <span data-av-id="${data.id}" data-popover-url="/api/av/getMirrorDatabaseBlocks" class="popover__block block__icon block__icon--show ariaLabel" data-position="8south" aria-label="${siyuanI18n.mirrorTip}">
    <svg><use xlink:href="#iconSplitLR"></use></svg></span><div class="fn__space"></div>` : ""}
        </div>
        <div contenteditable="${editable}" spellcheck="${window.siyuan.config.editor.spellcheck.toString()}" class="av__title${viewData.hideAttrViewName ? " fn__none" : ""}" data-title="${Lute.EscapeHTMLStr(data.name || "")}" data-tip="${siyuanI18n._kernel[267]}">${Lute.EscapeHTMLStr(data.name || "")}</div>
        <div class="av__counter fn__none"></div>
    </div>`;
};

export const avRender = async (element: Element, protyle: IProtyle, cb?: (data: IAV) => void, renderAll = true, avData?: IAV) => {
    let avElements: Element[] = [];
    if (element.getAttribute("data-type") === "NodeAttributeView") {
        avElements = [element];
    } else {
        avElements = Array.from(element.querySelectorAll('[data-type="NodeAttributeView"]'));
    }
    if (avElements.length === 0) {
        return;
    }
    for (let i = 0; i < avElements.length; i++) {
        const e = avElements[i] as HTMLElement;
        e.removeAttribute("data-rendering");
        if (e.getAttribute("data-render") === "true" || hasClosestByClassName(e, "av__gallery-content")) {
            continue;
        }
        if (isMobile || isInMobileApp()) {
            e.classList.add("av--touch");
        }

        if (e.getAttribute("data-av-type") === "gallery") {
            await renderGallery({blockElement: e, protyle, cb, renderAll});
            continue;
        }
        if (e.getAttribute("data-av-type") === "kanban") {
            await renderKanban({blockElement: e, protyle, cb, renderAll});
            continue;
        }

        let selectCellId;
        const selectCellElement = e.querySelector(".av__cell--select") as HTMLElement;
        if (selectCellElement) {
            selectCellId = {
                groupId: (hasClosestByClassName(selectCellElement, "av__body") as HTMLElement).dataset.groupId || "",
                rowId: (hasClosestByClassName(selectCellElement, "av__row") as HTMLElement).dataset.id,
                colId: selectCellElement.getAttribute("data-col-id"),
            };
        }
        const selectRowIds: {groupId: string, rowId: string, colId?: string}[] = [];
        e.querySelectorAll(".av__row--select").forEach(rowItem => {
            const rowId = rowItem.getAttribute("data-id");
            if (rowId) {
                selectRowIds.push({
                    groupId: (hasClosestByClassName(rowItem, "av__body") as HTMLElement).dataset.groupId || "",
                    rowId
                });
            }
        });
        let dragFillId;
        const dragFillElement = e.querySelector(".av__drag-fill") as HTMLElement;
        if (dragFillElement) {
            dragFillId = {
                groupId: (hasClosestByClassName(dragFillElement, "av__body") as HTMLElement).dataset.groupId || "",
                rowId: (hasClosestByClassName(dragFillElement, "av__row") as HTMLElement).dataset.id,
                colId: dragFillElement.parentElement.getAttribute("data-col-id"),
            };
        }
        const activeIds: {groupId: string, rowId: string, colId?: string}[] = [];
        e.querySelectorAll(".av__cell--active").forEach((item) => {
            activeIds.push({
                groupId: (hasClosestByClassName(item, "av__body") as HTMLElement).dataset.groupId || "",
                rowId: (hasClosestByClassName(item, "av__row") as HTMLElement).dataset.id,
                colId: item.getAttribute("data-col-id"),
            });
        });
        const searchInputElement = e.querySelector('[data-type="av-search"]') as HTMLInputElement;
        const pageSizes: { [key: string]: string } = {};
        const virtualData: { [key: string]: IAVVirtualData } = {};
        e.querySelectorAll(".av__body").forEach((item: HTMLElement) => {
            pageSizes[item.dataset.groupId || "unGroup"] = item.dataset.pageSize;
            if (e.getAttribute(Constants.ATTRIBUTE_V_SCROLL) !== "true") {
                return;
            }
            const firstRow = item.querySelectorAll(".av__row")[1] as HTMLElement;
            const lastRow = item.querySelector(".av__row--util")?.previousElementSibling as HTMLElement;
            if (!firstRow || !lastRow) {
                return;
            }
            virtualData[item.getAttribute("data-group-id") || "all"] = {
                renderedStart: parseInt(firstRow.getAttribute("data-index")),
                renderedEnd: parseInt(lastRow.getAttribute("data-index")),
                topSpacerHeight: item.querySelector(".av__spacer")?.clientHeight || 0,
            };
        });
        const headerTransformElement = e.querySelector('.av__row--header[style^="transform"]') as HTMLElement;
        const footerTransformElement = e.querySelector('.av__row--footer[style^="transform"]') as HTMLElement;
        const resetData = {
            selectCellId,
            alignSelf: e.style.alignSelf,
            left: e.querySelector(".av__scroll")?.scrollLeft || 0,
            headerTransform: headerTransformElement ? {
                groupId: headerTransformElement.parentElement.getAttribute("data-group-id"),
                transform: headerTransformElement.style.transform
            } : null,
            footerTransform: footerTransformElement ? {
                groupId: footerTransformElement.parentElement.getAttribute("data-group-id"),
                transform: footerTransformElement.style.transform
            } : null,
            isSearching: searchInputElement && document.activeElement === searchInputElement,
            selectRowIds,
            dragFillId,
            activeIds,
            query: searchInputElement?.textContent || "",
            pageSizes,
            virtualData
        };
        if (e.firstElementChild.innerHTML === "") {
            e.style.alignSelf = "";
            let html = "";
            [1, 2, 3].forEach(() => {
                html += `<div class="av__row">
    <div style="width: 24px;flex-shrink: 0"></div>
    <div class="av__cell" style="width: 200px"><span class="av__pulse"></span></div>
    <div class="av__cell" style="width: 200px"><span class="av__pulse"></span></div>
    <div class="av__cell" style="width: 200px"><span class="av__pulse"></span></div>
    <div class="av__cell" style="width: 200px"><span class="av__pulse"></span></div>
</div>`;
            });
            e.firstElementChild.innerHTML = html;
        }
        const avPageSize = getPageSize(e);
        let data: IAV;
        if (!avData) {
            const created = protyle.options.history?.created;
            const snapshot = protyle.options.history?.snapshot;
            const response = await fetchSyncPost(created ? "/api/av/renderHistoryAttributeView" : (snapshot ? "/api/av/renderSnapshotAttributeView" : "/api/av/renderAttributeView"), {
                id: e.getAttribute("data-av-id"),
                created,
                snapshot,
                pageSize: avPageSize.unGroupPageSize,
                groupPaging: avPageSize.groupPageSize,
                viewID: e.getAttribute(Constants.CUSTOM_SY_AV_VIEW) || "",
                query: resetData.query.trim(),
                blockID: e.getAttribute("data-node-id"),
                createIfNotExist: !protyle.block.action?.includes(Constants.CB_GET_AV_NO_CREATE),
            });
            data = response.data;
        } else {
            data = avData;
        }
        if (data.viewType === "gallery") {
            e.setAttribute("data-av-type", data.viewType);
            await renderGallery({blockElement: e, protyle, cb, renderAll, data});
            continue;
        }
        if (data.viewType === "kanban") {
            e.setAttribute("data-av-type", data.viewType);
            await renderKanban({blockElement: e, protyle, cb, renderAll, data});
            continue;
        }
        const view = data.view as IAVTable;
        if (view.groups?.length > 0) {
            await renderGroupTable({blockElement: e, protyle, cb, renderAll, data, resetData});
            continue;
        }
        const tableHTMLs = await getTableHTMLs(view, e, resetData.virtualData.all);
        const avBodyHTML = `<div class="av__body" data-group-id="" data-page-size="${view.pageSize}" style="float: left">
    ${tableHTMLs}
</div>`;
        if (renderAll) {
            e.firstElementChild.outerHTML = `<div class="av__container">
    ${genTabHeaderHTML(data, resetData.isSearching || !!resetData.query, !protyle.disabled)}
    <div class="av__scroll">
        ${avBodyHTML}
    </div>
    <div class="av__cursor" contenteditable="true">${Constants.ZWSP}</div>
</div>`;
        } else {
            e.firstElementChild.querySelector(".av__scroll").innerHTML = avBodyHTML;
        }
        afterRenderTable({
            renderAll,
            data,
            cb,
            protyle,
            blockElement: e,
            resetData
        });
        // 历史兼容
        e.style.margin = "";
    }
};

let searchTimeout: number;

export const updateSearch = (e: HTMLElement, protyle: IProtyle) => {
    clearTimeout(searchTimeout);
    searchTimeout = window.setTimeout(() => {
        e.removeAttribute("data-render");
        avRender(e, protyle, undefined, false);
    }, Constants.TIMEOUT_INPUT);
};
