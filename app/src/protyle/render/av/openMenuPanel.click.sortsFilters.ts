import { transaction } from "../../wysiwyg/transaction";
import { setPosition } from "../../../util/DOM/setPosition";
import { confirmDialog } from "../../../dialog/confirmDialog";
import {
    addFilter,
    addFilterGroup,
    bindInlineFilterEvents,
    getEditableFilters,
    getFilterByPath,
    getFiltersHTML,
    removeFilterByPath,
    setFilter,
    toggleFoldedFilterPath
} from "./filter";
import { addSort, bindSortsEvent, getSortsHTML } from "./sort";
import type { IMenuPanelContext } from "./openMenuPanel.types";

const positionMenu = (ctx: IMenuPanelContext) => {
    setPosition(ctx.menuElement, ctx.tabRect.right - ctx.menuElement.clientWidth, ctx.tabRect.bottom, ctx.tabRect.height);
};

const renderFilters = (ctx: IMenuPanelContext) => {
    ctx.menuElement.innerHTML = getFiltersHTML(ctx.data);
    positionMenu(ctx);
};

const bindInlineFiltersIfNeeded = (ctx: IMenuPanelContext) => {
    if (ctx.avPanelElement.dataset.inlineFilterEvents === "true") {
        return;
    }
    bindInlineFilterEvents(ctx.avPanelElement, ctx.data, ctx.options.protyle, ctx.blockID, ctx.avID);
    ctx.avPanelElement.dataset.inlineFilterEvents = "true";
};

export const bindFilterCombinationChange = (ctx: IMenuPanelContext) => {
    if (ctx.avPanelElement.dataset.filterCombinationChange === "true") {
        return;
    }
    ctx.avPanelElement.dataset.filterCombinationChange = "true";
    ctx.avPanelElement.addEventListener("change", (event: Event) => {
        const select = event.target as HTMLElement;
        if (select.dataset.type !== "toggleCombination") {
            return;
        }
        const path = select.dataset.path || "";
        const oldFilters = JSON.parse(JSON.stringify(ctx.data.view.filters));
        const node = path === ""
            ? (ctx.data.view.filters[0] && ctx.data.view.filters[0].filters ? ctx.data.view.filters[0] : undefined)
            : getFilterByPath(getEditableFilters(ctx.data), path);
        if (node) {
            node.combination = (select as HTMLSelectElement).value === "or" ? "or" : "and";
        }
        transaction(ctx.options.protyle, [{
            action: "setAttrViewFilters",
            avID: ctx.avID,
            data: ctx.data.view.filters,
            blockID: ctx.blockID
        }], [{
            action: "setAttrViewFilters",
            avID: ctx.avID,
            data: oldFilters,
            blockID: ctx.blockID
        }]);
        event.stopPropagation();
    });
};

/**
 * 处理排序和过滤相关的 click 事件分支。
 *
 * 作用：处理 goSorts/removeSorts/addSort/removeSort/goFilters/removeFilters/addFilter/removeFilter/setFilter 类型的点击事件。
 * 意图：将 openMenuPanel click handler 中排序和过滤逻辑提取为独立模块，减少主文件体积。
 * 调用时机：在 avPanelElement 的 click 事件 while 循环中，由主文件委托调用。
 * 返回值：true 表示已处理（调用方应 break），false 表示未匹配。
 */
export const handleSortsFiltersClick = (
    ctx: IMenuPanelContext,
    type: string,
    target: HTMLElement,
    event: MouseEvent
): boolean => {
    const { menuElement, avID, blockID } = ctx;
    const { protyle, blockElement } = ctx.options;

    if (type === "goSorts") {
        menuElement.innerHTML = getSortsHTML(ctx.fields, ctx.data.view.sorts);
        bindSortsEvent(protyle, menuElement, ctx.data, blockID);
        positionMenu(ctx);
        window.siyuan.menus.menu.remove();
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    if (type === "removeSorts") {
        transaction(protyle, [{
            action: "setAttrViewSorts",
            avID,
            data: [],
            blockID
        }], [{
            action: "setAttrViewSorts",
            avID,
            data: ctx.data.view.sorts,
            blockID
        }]);
        ctx.data.view.sorts = [];
        menuElement.innerHTML = getSortsHTML(ctx.fields, ctx.data.view.sorts);
        bindSortsEvent(protyle, menuElement, ctx.data, blockID);
        positionMenu(ctx);
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    if (type === "addSort") {
        addSort({
            data: ctx.data,
            rect: target.getBoundingClientRect(),
            menuElement,
            tabRect: ctx.tabRect,
            avId: avID,
            protyle,
            blockID,
        });
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    if (type === "removeSort") {
        const oldSorts = Object.assign([], ctx.data.view.sorts);
        ctx.data.view.sorts.find((item: IAVSort, index: number) => {
            if (item.column === target.parentElement.dataset.id) {
                ctx.data.view.sorts.splice(index, 1);
                return true;
            }
        });
        transaction(protyle, [{
            action: "setAttrViewSorts",
            avID,
            data: ctx.data.view.sorts,
            blockID
        }], [{
            action: "setAttrViewSorts",
            avID,
            data: oldSorts,
            blockID
        }]);
        menuElement.innerHTML = getSortsHTML(ctx.fields, ctx.data.view.sorts);
        bindSortsEvent(protyle, menuElement, ctx.data, blockID);
        positionMenu(ctx);
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    if (type === "goFilters") {
        renderFilters(ctx);
        bindInlineFiltersIfNeeded(ctx);
        window.siyuan.menus.menu.remove();
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    if (type === "removeFilters") {
        transaction(protyle, [{
            action: "setAttrViewFilters",
            avID,
            data: [],
            blockID
        }], [{
            action: "setAttrViewFilters",
            avID,
            data: ctx.data.view.filters,
            blockID
        }]);
        ctx.data.view.filters = [];
        renderFilters(ctx);
        window.siyuan.menus.menu.remove();
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    if (type === "addFilter") {
        const path = target.closest("[data-path]")?.getAttribute("data-path") || "";
        addFilter({
            data: ctx.data,
            rect: target.getBoundingClientRect(),
            menuElement,
            tabRect: ctx.tabRect,
            avId: avID,
            protyle,
            blockElement,
            parentPath: path
        });
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    if (type === "addFilterGroup") {
        const path = target.closest("[data-path]")?.getAttribute("data-path") || "";
        let targetFilters: IAVFilter[];
        if (path === "") {
            targetFilters = getEditableFilters(ctx.data);
        } else {
            const node = getFilterByPath(getEditableFilters(ctx.data), path);
            targetFilters = node && node.filters ? node.filters : getEditableFilters(ctx.data);
        }
        const newGroupIndex = targetFilters.length;
        const oldFilters = JSON.parse(JSON.stringify(ctx.data.view.filters));
        addFilterGroup(ctx.data, path);
        transaction(protyle, [{
            action: "setAttrViewFilters",
            avID,
            data: ctx.data.view.filters,
            blockID
        }], [{
            action: "setAttrViewFilters",
            avID,
            data: oldFilters,
            blockID
        }]);
        renderFilters(ctx);
        const newGroupPath = path ? `${path},${newGroupIndex}` : `${newGroupIndex}`;
        const newGroupToggle = menuElement.querySelector(`[data-type="toggleFold"][data-path="${newGroupPath}"]`) as HTMLElement;
        const newGroupRow = newGroupToggle?.closest(".b3-menu__item") as HTMLElement;
        newGroupRow?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    if (type === "removeFilter") {
        window.siyuan.menus.menu.remove();
        const path = target.getAttribute("data-path") || target.closest("[data-path]")?.getAttribute("data-path") || "";
        const removeByPath = () => {
            const oldFilters = JSON.parse(JSON.stringify(ctx.data.view.filters));
            removeFilterByPath(getEditableFilters(ctx.data), path);
            transaction(protyle, [{
                action: "setAttrViewFilters",
                avID,
                data: ctx.data.view.filters,
                blockID
            }], [{
                action: "setAttrViewFilters",
                avID,
                data: oldFilters,
                blockID
            }]);
            renderFilters(ctx);
        };
        if (path) {
            const node = getFilterByPath(getEditableFilters(ctx.data), path);
            if (node && node.filters && node.filters.length > 0) {
                confirmDialog(window.siyuan.languages.removeFilters, window.siyuan.languages.confirmDeleteFilterGroupTip, removeByPath);
            } else {
                removeByPath();
            }
        } else {
            const oldFilters = Object.assign([], ctx.data.view.filters);
            ctx.data.view.filters.find((item: IAVFilter, index: number) => {
                if (item.column === target.parentElement.dataset.id && item.value.type === target.parentElement.dataset.filterType) {
                    ctx.data.view.filters.splice(index, 1);
                    return true;
                }
            });
            transaction(protyle, [{
                action: "setAttrViewFilters",
                avID,
                data: ctx.data.view.filters,
                blockID
            }], [{
                action: "setAttrViewFilters",
                avID,
                data: oldFilters,
                blockID
            }]);
            renderFilters(ctx);
        }
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    if (type === "toggleFold") {
        const path = target.getAttribute("data-path") || target.closest("[data-path]")?.getAttribute("data-path") || "";
        toggleFoldedFilterPath(path);
        menuElement.innerHTML = getFiltersHTML(ctx.data);
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    if (type === "setFilter") {
        ctx.data.view.filters.find((item: IAVFilter) => {
            if (item.column === target.parentElement.parentElement.dataset.id && item.value.type === target.parentElement.parentElement.dataset.filterType) {
                setFilter({
                    empty: false,
                    filter: item,
                    protyle,
                    data: ctx.data,
                    target,
                    blockElement
                });
                return true;
            }
        });
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    return false;
};
