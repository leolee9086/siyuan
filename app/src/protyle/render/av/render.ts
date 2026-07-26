import {fetchSyncPost} from "../../../util/network/fetch";
import {Constants} from "../../../constants";
import {hasClosestByClassName} from "../../util/hasClosest";
import {isMobile} from "../../../platform";
import {isInMobileApp} from "../../util/compatibility";
import {renderGallery} from "./gallery/render";
import {getPageSize} from "./groups";
import {renderKanban} from "./kanban/render";
import {getTableHTMLs, renderGroupTable, afterRenderTable} from "./render.table";
import {getBodyVirtualData} from "./virtualScroll";
import {beginAVRender, getAVLocateParams, isCurrentAVRender} from "./locate/state/state";
import {prepareAVLocate} from "./locate/window/prepare";
import {genTabHeaderHTML} from "./view/header";
import type {AVRenderer, AVViewRenderer} from "./view/render.types";

export {getGroupTitleHTML} from "./render.table";

const renderResolvedView: AVViewRenderer = async (request) => {
    request.blockElement.setAttribute("data-av-type", request.data.viewType);
    const onSearchChange = () => updateSearch(request.blockElement, request.protyle);
    if (request.data.viewType === "gallery") {
        await renderGallery({...request, renderView: renderResolvedView, onSearchChange});
        return;
    }
    if (request.data.viewType === "kanban") {
        await renderKanban({...request, renderView: renderResolvedView, onSearchChange});
        return;
    }
    await avRender(request.blockElement, request.protyle, request.cb, request.renderAll, request.data);
};

export const avRender: AVRenderer = async (element, protyle, cb, renderAll = true, avData) => {
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
        const renderToken = beginAVRender(e);

        if (e.getAttribute("data-av-type") === "gallery") {
            await renderGallery({
                blockElement: e,
                protyle,
                cb,
                renderAll,
                renderView: renderResolvedView,
                onSearchChange: () => updateSearch(e, protyle),
            });
            continue;
        }
        if (e.getAttribute("data-av-type") === "kanban") {
            await renderKanban({
                blockElement: e,
                protyle,
                cb,
                renderAll,
                renderView: renderResolvedView,
                onSearchChange: () => updateSearch(e, protyle),
            });
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
            if (item.dataset.avLocateWindow === "true") {
                return;
            }
            const firstRow = item.querySelectorAll(".av__row")[1] as HTMLElement;
            if (!firstRow || e.getAttribute(Constants.ATTRIBUTE_V_SCROLL) !== "true") {
                return;
            }
            virtualData[item.getAttribute("data-group-id") || "all"] = getBodyVirtualData(
                item, ".av__row--util", parseInt(firstRow.getAttribute("data-index")));
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
        const created = protyle.options.history?.created;
        const snapshot = protyle.options.history?.snapshot;
        const locateParams = getAVLocateParams(e, !created && !snapshot);
        let data: IAV;
        if (!avData) {
            const response = await fetchSyncPost(created ? "/api/av/renderHistoryAttributeView" : (snapshot ? "/api/av/renderSnapshotAttributeView" : "/api/av/renderAttributeView"), {
                id: e.getAttribute("data-av-id"),
                created,
                snapshot,
                pageSize: avPageSize.unGroupPageSize,
                groupPaging: avPageSize.groupPageSize,
                viewID: locateParams?.viewID || e.getAttribute(Constants.CUSTOM_SY_AV_VIEW) || "",
                query: resetData.query.trim(),
                blockID: e.getAttribute("data-node-id"),
                createIfNotExist: !protyle.block.action?.includes(Constants.CB_GET_AV_NO_CREATE),
                targetItemID: locateParams?.targetItemID || "",
                targetGroupID: locateParams?.targetGroupID || "",
            });
            data = response.data;
        } else {
            data = avData;
        }
        if (!isCurrentAVRender(e, renderToken)) {
            continue;
        }
        prepareAVLocate(e, data, resetData);
        if (data.viewType === "gallery") {
            await renderResolvedView({blockElement: e, protyle, cb, renderAll, data});
            continue;
        }
        if (data.viewType === "kanban") {
            await renderResolvedView({blockElement: e, protyle, cb, renderAll, data});
            continue;
        }
        const view = data.view as IAVTable;
        if (view.groups?.length > 0) {
            await renderGroupTable({
                blockElement: e,
                protyle,
                cb,
                renderAll,
                data,
                resetData,
                onSearchChange: () => updateSearch(e, protyle),
            });
            continue;
        }
        const tableHTMLs = await getTableHTMLs(view, e, resetData.virtualData.all);
        const avBodyHTML = `<div class="av__body" data-group-id="" data-page-size="${view.pageSize}"${resetData.virtualData.all?.locate ? ' data-av-locate-window="true"' : ""} style="float: left">
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
            resetData,
            onSearchChange: () => updateSearch(e, protyle),
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
