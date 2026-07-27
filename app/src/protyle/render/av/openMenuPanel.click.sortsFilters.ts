import {transaction} from "../../wysiwyg/transaction/submit";
import {submitAVFilterTransaction} from "../../wysiwyg/transaction/prepared/av/view/avFilter";
import { setPosition } from "../../../util/DOM/positioning/setPosition";
import { confirmDialog } from "../../runtime/dialog.port";
import { Menu } from "../../../plugin/Menu";
import {
    addFilter,
    addFilterGroup,
    bindInlineFilterEvents,
    convertFilterToGroup,
    convertGroupToFilter,
    duplicateFilterByPath,
    getDefaultOperatorByType,
    getEditableFilters,
    getFilterByPath,
    getFiltersHTML,
    removeFilterByPath
} from "./filter";
import { addSort, bindSortsEvent, getSortsHTML } from "./sort";
import {genCellValue} from "./cell.value";
import type { IMenuPanelContext } from "./openMenuPanel.types";

const cloneFilters = (filters: IAVFilter[]): IAVFilter[] => JSON.parse(JSON.stringify(filters));

const positionMenu = (ctx: IMenuPanelContext) => {
    setPosition(ctx.menuElement, ctx.tabRect.right - ctx.menuElement.clientWidth, ctx.tabRect.bottom, ctx.tabRect.height);
};

const bindInlineFilters = (ctx: IMenuPanelContext) => {
    bindInlineFilterEvents(ctx.avPanelElement, ctx.data, ctx.options.protyle, ctx.blockID, ctx.avID);
};

const renderFilters = (ctx: IMenuPanelContext) => {
    ctx.menuElement.innerHTML = getFiltersHTML(ctx.data);
    bindInlineFilters(ctx);
    positionMenu(ctx);
};

const commitFilters = (ctx: IMenuPanelContext, oldFilters: IAVFilter[]) => {
    submitAVFilterTransaction(ctx.options.protyle, [{
        action: "setAttrViewFilters",
        avID: ctx.avID,
        data: cloneFilters(ctx.data.view.filters),
        blockID: ctx.blockID
    }], [{
        action: "setAttrViewFilters",
        avID: ctx.avID,
        data: oldFilters,
        blockID: ctx.blockID
    }]);
};

const getPath = (target: HTMLElement): string => {
    return target.dataset.path || target.closest("[data-path]")?.getAttribute("data-path") || "";
};

const getDepth = (target: HTMLElement): number => {
    return parseInt(target.dataset.depth || target.closest("[data-depth]")?.getAttribute("data-depth") || "0", 10);
};

const getTargetFilters = (ctx: IMenuPanelContext, path: string): IAVFilter[] => {
    if (path === "") {
        return getEditableFilters(ctx.data);
    }
    const node = getFilterByPath(getEditableFilters(ctx.data), path);
    return node?.filters || getEditableFilters(ctx.data);
};

const openAddFilter = (ctx: IMenuPanelContext, path: string, rect: DOMRect) => {
    addFilter({
        data: ctx.data,
        rect,
        menuElement: ctx.menuElement,
        tabRect: ctx.tabRect,
        avId: ctx.avID,
        protyle: ctx.options.protyle,
        blockElement: ctx.options.blockElement,
        parentPath: path
    });
};

const addFilterGroupWithDefaultCondition = (ctx: IMenuPanelContext, path: string) => {
    const oldFilters = cloneFilters(ctx.data.view.filters);
    const targetFilters = getTargetFilters(ctx, path);
    addFilterGroup(ctx.data, path);
    const blockField = ctx.fields.find((field) => field.type === "block") || ctx.fields.find((field) => field.type !== "lineNumber");
    const newGroup = targetFilters[targetFilters.length - 1];
    if (blockField && newGroup?.filters) {
        newGroup.filters.push({
            column: blockField.id,
            operator: getDefaultOperatorByType(blockField.type),
            value: genCellValue(blockField.type, ""),
        });
    }
    commitFilters(ctx, oldFilters);
    renderFilters(ctx);
};

const openAddFilterConditionMenu = (ctx: IMenuPanelContext, target: HTMLElement, event: MouseEvent) => {
    const path = getPath(target);
    const depth = getDepth(target);
    const menu = new Menu("addFilterCondition");
    menu.addItem({
        icon: "iconAdd",
        label: window.siyuan.languages.addFilter,
        click: () => {
            openAddFilter(ctx, path, { left: event.clientX, bottom: event.clientY, height: 28 } as DOMRect);
        }
    });
    if (depth < 3) {
        menu.addItem({
            icon: "iconListFilterPlus",
            label: window.siyuan.languages.addFilterGroup,
            click: () => {
                addFilterGroupWithDefaultCondition(ctx, path);
            }
        });
    }
    menu.open({ x: event.clientX, y: event.clientY, h: 28 });
};

const mutateFilterByPath = (
    ctx: IMenuPanelContext,
    mutate: (filters: IAVFilter[], path: string) => boolean,
    path: string
) => {
    const oldFilters = cloneFilters(ctx.data.view.filters);
    if (!mutate(getEditableFilters(ctx.data), path)) {
        return;
    }
    commitFilters(ctx, oldFilters);
    renderFilters(ctx);
};

const openMoreFilterMenu = (ctx: IMenuPanelContext, target: HTMLElement, event: MouseEvent) => {
    const path = getPath(target);
    const node = getFilterByPath(getEditableFilters(ctx.data), path);
    if (!node) {
        return;
    }
    const isGroup = !!node.filters;
    const menu = new Menu("moreFilter");
    menu.addItem({
        icon: "iconAdd",
        label: window.siyuan.languages.duplicate,
        click: () => {
            mutateFilterByPath(ctx, duplicateFilterByPath, path);
        }
    });
    if (!isGroup) {
        menu.addItem({
            icon: "iconListFilterPlus",
            label: window.siyuan.languages.convertToFilterGroup,
            click: () => {
                mutateFilterByPath(ctx, convertFilterToGroup, path);
            }
        });
    } else if (node.filters.length === 1) {
        menu.addItem({
            icon: "iconListFilterPlus",
            label: window.siyuan.languages.convertGroupToFilter,
            click: () => {
                mutateFilterByPath(ctx, convertGroupToFilter, path);
            }
        });
    }
    menu.addItem({
        icon: "iconTrashcan",
        label: window.siyuan.languages.delete,
        click: () => {
            const doRemove = () => {
                mutateFilterByPath(ctx, removeFilterByPath, path);
            };
            if (node.filters && node.filters.length > 0) {
                confirmDialog(window.siyuan.languages.deleteOpConfirm, window.siyuan.languages.confirmDeleteFilterGroupTip, doRemove);
            } else {
                doRemove();
            }
        }
    });
    menu.open({ x: event.clientX, y: event.clientY, h: 28 });
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
        const oldFilters = cloneFilters(ctx.data.view.filters);
        const node = path === ""
            ? (ctx.data.view.filters[0] && (ctx.data.view.filters[0].filters || ctx.data.view.filters[0].combination) ? ctx.data.view.filters[0] : undefined)
            : getFilterByPath(getEditableFilters(ctx.data), path);
        if (node) {
            node.combination = (select as HTMLSelectElement).value === "or" ? "or" : "and";
        }
        commitFilters(ctx, oldFilters);
        renderFilters(ctx);
        event.stopPropagation();
    });
};

/**
 * 处理排序和过滤相关的 click 事件分支。
 *
 * 作用：处理 goSorts/removeSorts/addSort/removeSort/goFilters/removeFilters/addFilter/removeFilter 等类型的点击事件。
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
    const { protyle } = ctx.options;

    if (type === "goSorts") {
        menuElement.classList.remove("av__filter-panel");
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
        menuElement.classList.add("av__filter-panel");
        renderFilters(ctx);
        window.siyuan.menus.menu.remove();
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    if (type === "removeFilters") {
        const oldFilters = cloneFilters(ctx.data.view.filters);
        submitAVFilterTransaction(protyle, [{
            action: "setAttrViewFilters",
            avID,
            data: [],
            blockID
        }], [{
            action: "setAttrViewFilters",
            avID,
            data: oldFilters,
            blockID
        }]);
        ctx.data.view.filters = [{ combination: "and", filters: [] }];
        renderFilters(ctx);
        window.siyuan.menus.menu.remove();
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    if (type === "addFilter") {
        openAddFilter(ctx, getPath(target), target.getBoundingClientRect());
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    if (type === "addFilterCondition") {
        openAddFilterConditionMenu(ctx, target, event);
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    if (type === "moreFilter") {
        openMoreFilterMenu(ctx, target, event);
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    if (type === "removeFilter") {
        window.siyuan.menus.menu.remove();
        const path = getPath(target);
        const node = getFilterByPath(getEditableFilters(ctx.data), path);
        const removeByPath = () => {
            mutateFilterByPath(ctx, removeFilterByPath, path);
        };
        if (node && node.filters && node.filters.length > 0) {
            confirmDialog(window.siyuan.languages.removeFilters, window.siyuan.languages.confirmDeleteFilterGroupTip, removeByPath);
        } else {
            removeByPath();
        }
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    return false;
};
