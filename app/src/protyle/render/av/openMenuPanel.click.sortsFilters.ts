import { transaction } from "../../wysiwyg/transaction";
import { setPosition } from "../../../util/DOM/setPosition";
import { addFilter, getFiltersHTML, setFilter } from "./filter";
import { addSort, bindSortsEvent, getSortsHTML } from "./sort";
import type { IMenuPanelContext } from "./openMenuPanel.types";

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
        setPosition(menuElement, ctx.tabRect.right - menuElement.clientWidth, ctx.tabRect.bottom, ctx.tabRect.height);
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
        setPosition(menuElement, ctx.tabRect.right - menuElement.clientWidth, ctx.tabRect.bottom, ctx.tabRect.height);
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
        setPosition(menuElement, ctx.tabRect.right - menuElement.clientWidth, ctx.tabRect.bottom, ctx.tabRect.height);
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    if (type === "goFilters") {
        menuElement.innerHTML = getFiltersHTML(ctx.data);
        setPosition(menuElement, ctx.tabRect.right - menuElement.clientWidth, ctx.tabRect.bottom, ctx.tabRect.height);
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
        menuElement.innerHTML = getFiltersHTML(ctx.data);
        setPosition(menuElement, ctx.tabRect.right - menuElement.clientWidth, ctx.tabRect.bottom, ctx.tabRect.height);
        window.siyuan.menus.menu.remove();
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    if (type === "addFilter") {
        addFilter({
            data: ctx.data,
            rect: target.getBoundingClientRect(),
            menuElement,
            tabRect: ctx.tabRect,
            avId: avID,
            protyle,
            blockElement
        });
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    if (type === "removeFilter") {
        window.siyuan.menus.menu.remove();
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
        menuElement.innerHTML = getFiltersHTML(ctx.data);
        setPosition(menuElement, ctx.tabRect.right - menuElement.clientWidth, ctx.tabRect.bottom, ctx.tabRect.height);
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
