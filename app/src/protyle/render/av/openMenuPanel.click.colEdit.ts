import {submitAVColumnEditTransaction} from "../../wysiwyg/transaction/prepared/av/avColumnEdit";
import {submitAVFilterTransaction} from "../../wysiwyg/transaction/prepared/av/view/avFilter";
import {submitAVSortTransaction} from "../../wysiwyg/transaction/prepared/av/view/avSort";
import { setPosition } from "../../../util/DOM/positioning/setPosition";
import { hasClosestByClassName } from "../../util/hasClosest";
import { bindEditEvent, getEditHTML } from "./col/edit/render";
import { getColIconByType, getColNameByType } from "./col/col.typeUtils";
import { formatNumber } from "./number";
import { formatDate } from "./dateFormatMenu";
import { openEmojiPanel, unicode2Emoji } from "../../../emoji";
import {updateAttrViewCellAnimation} from "./action/animation";
import { isHTMLElement } from "../../../util/DOM/element.guard";
import { asTAVCol } from "./openMenuPanel.click.guard";
import { hasFilterForColumn, removeFiltersByColumn } from "./filter";
import type { IMenuPanelContext } from "./openMenuPanel.types";
import {removeSiyuanMenu} from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";

/** 从 menuElement 获取当前列ID @同步豁免: UI构建 */
const getMenuColId = (menuElement: HTMLElement): string => {
    const menuItem = menuElement.querySelector(".b3-menu__item");
    return menuItem?.getAttribute("data-col-id") ?? "";
};

/** 数字格式化选项点击 @同步豁免: UI构建 */
const handleNumberFormat = (ctx: IMenuPanelContext, target: HTMLElement, event: MouseEvent): void => {
    formatNumber({
        avPanelElement: ctx.avPanelElement,
        element: target,
        protyle: ctx.options.protyle,
        oldFormat: target.dataset.format ?? "",
        colId: getMenuColId(ctx.menuElement),
        avID: ctx.avID
    });
    event.preventDefault();
    event.stopPropagation();
};

/** 日期格式化选项点击 @同步豁免: UI构建 */
const handleDateFormat = (ctx: IMenuPanelContext, target: HTMLElement, event: MouseEvent): void => {
    const colId = getMenuColId(ctx.menuElement);
    const colData = ctx.fields.find((item) => item.id === colId);
    formatDate({
        avPanelElement: ctx.avPanelElement,
        element: target,
        protyle: ctx.options.protyle,
        oldFormat: target.dataset.format as TAVDateFormat,
        colId,
        avID: ctx.avID,
        type: (colData?.type ?? "date") as "date" | "created" | "updated",
    });
    event.preventDefault();
    event.stopPropagation();
};

/** 更新自定义属性视图中的列图标 @同步豁免: UI构建 */
const applyCustomAttrIcon = (blockElement: Element, colId: string, unicode: string): void => {
    const iconElement = blockElement.querySelector(`.av__row[data-col-id="${colId}"] .block__logoicon`);
    if (!iconElement) {
        return;
    }
    const dataType = iconElement.nextElementSibling?.getAttribute("data-type") ?? "";
    iconElement.outerHTML = unicode
        ? unicode2Emoji(unicode, "block__logoicon", true)
        : `<svg class="block__logoicon"><use xlink:href="#${getColIconByType(asTAVCol(dataType))}"></use></svg>`;
};

/** emoji选择后更新列图标并同步到视图 @同步豁免: UI构建 */
const applyColIcon = (ctx: IMenuPanelContext, target: HTMLElement, unicode: string): void => {
    const colId = getMenuColId(ctx.menuElement);
    const { protyle, blockElement } = ctx.options;
    submitAVColumnEditTransaction(protyle, [{
        action: "setAttrViewColIcon", id: colId, avID: ctx.avID, data: unicode,
    }], [{
        action: "setAttrViewColIcon", id: colId, avID: ctx.avID, data: target.dataset.icon,
    }]);
    target.innerHTML = unicode
        ? unicode2Emoji(unicode)
        : `<svg style="height: 14px;width: 14px"><use xlink:href="#${getColIconByType(asTAVCol(target.dataset.colType))}"></use></svg>`;
    // 自定义属性视图和普通属性视图的图标更新路径不同
    if (ctx.isCustomAttr) {
        applyCustomAttrIcon(blockElement, colId, unicode);
        target.dataset.icon = unicode;
        return;
    }
    const cellEl = blockElement.querySelector(`.av__row--header .av__cell[data-col-id="${colId}"]`);
    // headerValue 模式不使用 value 参数
    if (isHTMLElement(cellEl)) {
        updateAttrViewCellAnimation(cellEl, undefined, { icon: unicode });
    }
    target.dataset.icon = unicode;
};

/** 打开 emoji 面板选择列图标 @同步豁免: UI构建 */
const handleUpdateIcon = (ctx: IMenuPanelContext, target: HTMLElement, event: MouseEvent): void => {
    const rect = target.getBoundingClientRect();
    // @内联回调
    openEmojiPanel("", "av", {
        x: rect.left, y: rect.bottom + 4, h: rect.height, w: rect.width
    }, (unicode) => {
        applyColIcon(ctx, target, unicode);
    }, target.querySelector("img") ?? undefined);
    event.preventDefault();
    event.stopPropagation();
};

/** 进入列编辑面板 @同步豁免: UI构建 */
const handleEditCol = (ctx: IMenuPanelContext, target: HTMLElement, event: MouseEvent): void => {
    const { menuElement, isCustomAttr, blockID } = ctx;
    const { protyle } = ctx.options;
    menuElement.innerHTML = getEditHTML({ protyle, data: ctx.data, colId: target.dataset.id ?? "", isCustomAttr });
    bindEditEvent({ protyle, data: ctx.data, menuElement, isCustomAttr, blockID });
    setPosition(menuElement, ctx.tabRect.right - menuElement.clientWidth, ctx.tabRect.bottom, ctx.tabRect.height);
    event.preventDefault();
    event.stopPropagation();
};

/** 行号列不支持排序和过滤，类型切换时清理 @同步豁免: UI构建 */
const removeLineNumberSortAndFilter = (ctx: IMenuPanelContext, colId: string): void => {
    const { protyle } = ctx.options;
    const sortExist = ctx.data.view.sorts.find((sort) => sort.column === colId);
    if (sortExist) {
        const oldSorts = Object.assign([], ctx.data.view.sorts);
        const newSorts = ctx.data.view.sorts.filter((sort) => sort.column !== colId);
        submitAVSortTransaction(protyle, [{
            action: "setAttrViewSorts", avID: ctx.data.id, data: newSorts, blockID: ctx.blockID,
        }], [{
            action: "setAttrViewSorts", avID: ctx.data.id, data: oldSorts, blockID: ctx.blockID,
        }]);
    }
    const filterExist = hasFilterForColumn(ctx.data.view.filters, colId);
    if (filterExist) {
        const oldFilters = JSON.parse(JSON.stringify(ctx.data.view.filters));
        let newFilters: IAVFilter[];
        const rootFilter = ctx.data.view.filters[0];
        // 单一复合根需要保留根组合方式，仅移除其内部命中当前列的子筛选。
        if (ctx.data.view.filters.length === 1 && rootFilter && (rootFilter.filters || rootFilter.combination)) {
            const root = JSON.parse(JSON.stringify(rootFilter));
            root.filters = removeFiltersByColumn(root.filters || [], colId);
            newFilters = [root];
        } else {
            newFilters = removeFiltersByColumn(ctx.data.view.filters, colId);
        }
        ctx.data.view.filters = newFilters;
        submitAVFilterTransaction(protyle, [{
            action: "setAttrViewFilters", avID: ctx.data.id, data: newFilters, blockID: ctx.blockID
        }], [{
            action: "setAttrViewFilters", avID: ctx.data.id, data: oldFilters, blockID: ctx.blockID
        }]);
    }
};

/** 执行列类型切换事务 @同步豁免: UI构建 */
const applyColTypeChange = (ctx: IMenuPanelContext, colId: string, target: HTMLElement): void => {
    const { protyle } = ctx.options;
    const nameElement = ctx.avPanelElement.querySelector('.b3-text-field[data-type="name"]');
    const name = (nameElement instanceof HTMLInputElement) ? nameElement.value : "";
    let newName = name;
    const newType = asTAVCol(target.dataset.newType);
    const oldType = asTAVCol(target.dataset.oldType);
    const field = ctx.fields.find((item: IAVColumn) => item.id === colId);
    // 更新 fields 中对应列的类型，列名为默认名称时同步更新
    if (field) {
        field.type = newType;
    }
    // 列名仍为旧类型默认名称时，同步更新为新类型默认名称
    if (field && getColNameByType(oldType) === name) {
        newName = getColNameByType(newType);
        field.name = newName;
    }
    submitAVColumnEditTransaction(protyle, [{
        action: "updateAttrViewCol", id: colId, avID: ctx.avID, name: newName, type: newType,
    }], [{
        action: "updateAttrViewCol", id: colId, avID: ctx.avID, name, type: oldType,
    }]);
    // 行号列不支持排序和过滤
    if (target.dataset.newType === "lineNumber") {
        removeLineNumberSortAndFilter(ctx, colId);
    }
};

/** 列类型更新点击 @同步豁免: UI构建 */
const handleUpdateColType = (ctx: IMenuPanelContext, target: HTMLElement, event: MouseEvent): void => {
    const { menuElement, isCustomAttr, blockID } = ctx;
    const { protyle } = ctx.options;
    const colId = ctx.options.colId || getMenuColId(menuElement);
    // 仅在新旧类型不同时执行类型切换事务
    if (target.dataset.newType !== target.dataset.oldType) {
        applyColTypeChange(ctx, colId, target);
    }
    menuElement.innerHTML = getEditHTML({ protyle, data: ctx.data, colId, isCustomAttr });
    bindEditEvent({ protyle, data: ctx.data, menuElement, isCustomAttr, blockID });
    setPosition(menuElement, ctx.tabRect.right - menuElement.clientWidth, ctx.tabRect.bottom, ctx.tabRect.height);
    event.preventDefault();
    event.stopPropagation();
};

/** 前往类型选择子面板 @同步豁免: UI构建 */
const handleGoUpdateColType = (ctx: IMenuPanelContext, target: HTMLElement, event: MouseEvent): void => {
    removeSiyuanMenu();
    const editMenuElement = hasClosestByClassName(target, "b3-menu");
    if (editMenuElement) {
        editMenuElement.firstElementChild?.classList.add("fn__none");
        editMenuElement.lastElementChild?.classList.remove("fn__none");
    }
    setPosition(ctx.menuElement, ctx.tabRect.right - ctx.menuElement.clientWidth, ctx.tabRect.bottom, ctx.tabRect.height);
    event.preventDefault();
    event.stopPropagation();
};

/** 返回列编辑主面板 @同步豁免: UI构建 */
const handleGoEditCol = (ctx: IMenuPanelContext, target: HTMLElement, event: MouseEvent): void => {
    const editMenuElement = hasClosestByClassName(target, "b3-menu");
    if (editMenuElement) {
        editMenuElement.firstElementChild?.classList.remove("fn__none");
        editMenuElement.lastElementChild?.classList.add("fn__none");
    }
    setPosition(ctx.menuElement, ctx.tabRect.right - ctx.menuElement.clientWidth, ctx.tabRect.bottom, ctx.tabRect.height);
    event.preventDefault();
    event.stopPropagation();
};

/**
 * 列编辑+类型切换 click 事件分支。
 * 覆盖：numberFormat, update-icon, editCol, updateColType, goUpdateColType, goEditCol
 * @同步豁免: 遗留代码 - openMenuPanel click handler 同步事件分发
 */
export const handleColEditClick = (
    ctx: IMenuPanelContext, type: string, target: HTMLElement, event: MouseEvent
): boolean => {
    // 数字格式化选项
    if (type === "numberFormat") {
        handleNumberFormat(ctx, target, event);
        return true;
    }
    // 日期格式化选项
    if (type === "dateFormat") {
        handleDateFormat(ctx, target, event);
        return true;
    }
    // 列图标更新
    if (type === "update-icon") {
        handleUpdateIcon(ctx, target, event);
        return true;
    }
    // 进入列编辑面板
    if (type === "editCol") {
        handleEditCol(ctx, target, event);
        return true;
    }
    // 列类型切换
    if (type === "updateColType") {
        handleUpdateColType(ctx, target, event);
        return true;
    }
    // 前往类型选择子面板
    if (type === "goUpdateColType") {
        handleGoUpdateColType(ctx, target, event);
        return true;
    }
    // 返回列编辑主面板
    if (type === "goEditCol") {
        handleGoEditCol(ctx, target, event);
        return true;
    }
    return false;
};
