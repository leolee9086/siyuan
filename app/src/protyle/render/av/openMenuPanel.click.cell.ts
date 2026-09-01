import { addColOptionOrCell, removeCellOption, setColOption } from "./select";
import { addAssetLink, editAssetItem, updateAssetCell } from "./asset";
import { openSearchAV, setRelationCell, updateRelation } from "./relation";
import { goSearchRollupCol } from "./rollup";
import { openCalcMenu } from "./calc";
import { getColId } from "./col/identity/resolve";
import {updateCellsValue} from "./cell.update";
import { Constants } from "../../../constants";
import { pathPosix } from "../../../util/file/pathName";
import { isMobile } from "../../../platform";
import { openLink } from "../../../editor/openLink";
import { previewAttrViewImages } from "../../preview/image";
import { assetMenu } from "../../../menus/protyleMenus/assetMenu/protyle.asset";
import { escapeAttr } from "../../../util/DOM/escape";
import { removeSiyuanMenu } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { openInNewWindow } from "../../../util/siyuanEnvironments/window.environment";
import { asHTMLElement, asAssetType } from "./openMenuPanel.click.guard";
import type { IMenuPanelContext } from "./openMenuPanel.types";

/** 获取当前列ID（从colId选项或menuElement中获取） @同步豁免: UI构建 */
const getEffectiveColId = (ctx: IMenuPanelContext): string => {
    const menuItem = ctx.menuElement.querySelector(".b3-menu__item");
    return ctx.options.colId || menuItem?.getAttribute("data-col-id") || "";
};

/** 安全获取 cellElements，不存在时返回空数组 @同步豁免: UI构建 */
const getCellElements = (ctx: IMenuPanelContext): HTMLElement[] => {
    return ctx.options.cellElements ?? [];
};

/** 搜索属性视图 @同步豁免: UI构建 */
const handleGoSearchAV = (ctx: IMenuPanelContext, target: HTMLElement, event: MouseEvent): void => {
    openSearchAV(ctx.avID, target, undefined, false, ctx.options.blockElement.getAttribute("data-node-id"));
    event.preventDefault();
    event.stopPropagation();
};

/** 搜索汇总列（关联列） @同步豁免: UI构建 */
const handleGoSearchRollupCol = (ctx: IMenuPanelContext, target: HTMLElement, event: MouseEvent): void => {
    goSearchRollupCol({
        target, data: ctx.data, isRelation: true,
        protyle: ctx.options.protyle, colId: getEffectiveColId(ctx)
    });
    event.preventDefault();
    event.stopPropagation();
};

/** 搜索汇总目标列 @同步豁免: UI构建 */
const handleGoSearchRollupTarget = (ctx: IMenuPanelContext, target: HTMLElement, event: MouseEvent): void => {
    goSearchRollupCol({
        target, data: ctx.data, isRelation: false,
        protyle: ctx.options.protyle, colId: getEffectiveColId(ctx)
    });
    event.preventDefault();
    event.stopPropagation();
};

/** 搜索汇总计算方式 @同步豁免: UI构建 */
const handleGoSearchRollupCalc = (ctx: IMenuPanelContext, target: HTMLElement, event: MouseEvent): void => {
    openCalcMenu(ctx.options.protyle, target, {
        data: ctx.data, colId: getEffectiveColId(ctx), blockID: ctx.blockID
    });
    event.preventDefault();
    event.stopPropagation();
};

/** 更新关联字段 @同步豁免: UI构建 */
const handleUpdateRelation = (ctx: IMenuPanelContext, event: MouseEvent): void => {
    updateRelation({
        protyle: ctx.options.protyle, avElement: ctx.avPanelElement,
        avID: ctx.avID, colsData: ctx.fields, blockElement: ctx.options.blockElement,
    });
    event.preventDefault();
    event.stopPropagation();
};

/** 设置列选项 @同步豁免: UI构建 */
const handleSetColOption = (ctx: IMenuPanelContext, target: HTMLElement, event: MouseEvent): void => {
    setColOption(ctx.options.protyle, ctx.data, target, ctx.options.blockElement, ctx.isCustomAttr, getCellElements(ctx));
    event.preventDefault();
    event.stopPropagation();
};

/** 设置关联单元格 @同步豁免: UI构建 */
const handleSetRelationCell = (ctx: IMenuPanelContext, target: HTMLElement, event: MouseEvent): void => {
    const currentEl = ctx.menuElement.querySelector(".b3-menu__item--current");
    currentEl?.classList.remove("b3-menu__item--current");
    target.classList.add("b3-menu__item--current");
    setRelationCell(ctx.options.protyle, asHTMLElement(ctx.options.blockElement), target, getCellElements(ctx));
    event.preventDefault();
    event.stopPropagation();
};

/** 移除已选中的选项chip @同步豁免: UI构建 */
const removeCheckedChip = (ctx: IMenuPanelContext, target: HTMLElement, cells: HTMLElement[]): void => {
    const chipSelector = `.b3-chips .b3-chip[data-content="${escapeAttr(target.dataset.name ?? "")}"]`;
    const chipEl = ctx.menuElement.querySelector(chipSelector);
    if (chipEl) {
        removeCellOption(ctx.options.protyle, cells, asHTMLElement(chipEl), ctx.options.blockElement);
    }
};

/** 添加列选项或单元格值 @同步豁免: UI构建 */
const handleAddColOptionOrCell = (ctx: IMenuPanelContext, target: HTMLElement, event: MouseEvent): void => {
    const currentEl = ctx.menuElement.querySelector(".b3-menu__item--current");
    currentEl?.classList.remove("b3-menu__item--current");
    target.classList.add("b3-menu__item--current");
    const cells = getCellElements(ctx);
    // 已选中则移除选项
    if (target.querySelector(".b3-menu__checked")) {
        removeCheckedChip(ctx, target, cells);
        removeSiyuanMenu();
        event.preventDefault();
        event.stopPropagation();
        return;
    }
    // 未选中则添加选项
    addColOptionOrCell(ctx.options.protyle, ctx.data, cells, target, ctx.menuElement, ctx.options.blockElement);
    removeSiyuanMenu();
    event.preventDefault();
    event.stopPropagation();
};

/** 移除单元格选项 @同步豁免: UI构建 */
const handleRemoveCellOption = (ctx: IMenuPanelContext, target: HTMLElement, event: MouseEvent): void => {
    const parentEl = target.parentElement;
    if (parentEl) {
        removeCellOption(ctx.options.protyle, getCellElements(ctx), parentEl, ctx.options.blockElement);
    }
    event.preventDefault();
    event.stopPropagation();
};

/** 添加资源链接 @同步豁免: UI构建 */
const handleAddAssetLink = (ctx: IMenuPanelContext, target: HTMLElement, event: MouseEvent): void => {
    addAssetLink(ctx.options.protyle, getCellElements(ctx), target, ctx.options.blockElement,
        asAssetType(target.dataset.assetType));
    event.preventDefault();
    event.stopPropagation();
};

/** 根据URL构建资源值对象 @同步豁免: UI构建 */
const buildAssetValue = (url: string, name: string): IAVCellAssetValue => {
    // 图片类型资源
    if (Constants.SIYUAN_ASSETS_IMAGE.includes(pathPosix().extname(url).toLowerCase())) {
        return { type: "image", content: url, name: "" };
    }
    return { type: "file", content: url, name };
};

/** 从已有资源中添加 @同步豁免: UI构建 */
const handleAddAssetExist = (ctx: IMenuPanelContext, target: HTMLElement, event: MouseEvent): void => {
    const rect = target.getBoundingClientRect();
    // @内联回调
    assetMenu({
        protyle: ctx.options.protyle,
        position: {
            x: rect.right, y: rect.bottom,
            w: (target.parentElement?.clientWidth ?? 0) + 8, h: rect.height,
        },
        destination: {
            kind: "callback",
            select: (url, name) => {
                updateAssetCell({
                    protyle: ctx.options.protyle, cellElements: getCellElements(ctx),
                    addValue: [buildAssetValue(url, name)], blockElement: ctx.options.blockElement
                });
                removeSiyuanMenu();
            },
        },
    });
    event.preventDefault();
    event.stopPropagation();
};

/** 打开资源项（图片预览/链接打开） @同步豁免: UI构建 */
const handleOpenAssetItem = (ctx: IMenuPanelContext, target: HTMLElement, event: MouseEvent): void => {
    const parentData = target.parentElement?.dataset;
    const assetLink = parentData?.content ?? "";
    // 图片类型：预览
    if (parentData?.type === "image") {
        const viewId = ctx.options.blockElement.getAttribute(Constants.CUSTOM_SY_AV_VIEW) ?? "";
        const searchEl = ctx.options.blockElement.querySelector('[data-type="av-search"]');
        previewAttrViewImages(assetLink, ctx.avID, viewId, searchEl?.textContent?.trim() || "");
        event.preventDefault();
        event.stopPropagation();
        return;
    }
    // 其他类型：使用统一的链接打开逻辑
    openLink(ctx.options.protyle.app, assetLink, event, event.ctrlKey || event.metaKey);
    event.preventDefault();
    event.stopPropagation();
};

/** 编辑资源项 @同步豁免: UI构建 */
const handleEditAssetItem = (ctx: IMenuPanelContext, target: HTMLElement, event: MouseEvent): void => {
    const parentData = target.parentElement?.dataset;
    const parentRect = target.parentElement?.getBoundingClientRect();
    editAssetItem({
        protyle: ctx.options.protyle, cellElements: getCellElements(ctx),
        blockElement: ctx.options.blockElement,
        content: parentData?.content ?? "",
        type: asAssetType(parentData?.type),
        name: parentData?.name ?? "",
        index: parseInt(parentData?.index ?? "0"),
        rect: parentRect ?? new DOMRect()
    });
    event.preventDefault();
    event.stopPropagation();
};

/** 清除日期值 @同步豁免: UI构建 */
const handleClearDate = (ctx: IMenuPanelContext, event: MouseEvent): void => {
    const cells = getCellElements(ctx);
    const firstCell = cells[0];
    const colData = firstCell
        ? ctx.fields.find((item: IAVColumn) => item.id === getColId(firstCell, ctx.data.viewType))
        : undefined;
    updateCellsValue(ctx.options.protyle, asHTMLElement(ctx.options.blockElement), {
        isNotEmpty2: false, isNotEmpty: false,
        content: null, content2: null, hasEndDate: false,
        isNotTime: colData?.date ? !colData.date.fillSpecificTime : true,
    }, cells);
    ctx.avPanelElement.remove();
    event.preventDefault();
    event.stopPropagation();
};

/** 搜索/汇总类 click 分发 @同步豁免: UI构建 */
const dispatchSearchClick = (
    ctx: IMenuPanelContext, type: string, target: HTMLElement, event: MouseEvent
): boolean => {
    // 搜索属性视图
    if (type === "goSearchAV") {
        handleGoSearchAV(ctx, target, event);
        return true;
    }
    // 搜索汇总关联列
    if (type === "goSearchRollupCol") {
        handleGoSearchRollupCol(ctx, target, event);
        return true;
    }
    // 搜索汇总目标列
    if (type === "goSearchRollupTarget") {
        handleGoSearchRollupTarget(ctx, target, event);
        return true;
    }
    // 搜索汇总计算方式
    if (type === "goSearchRollupCalc") {
        handleGoSearchRollupCalc(ctx, target, event);
        return true;
    }
    // 更新关联字段
    if (type === "updateRelation") {
        handleUpdateRelation(ctx, event);
        return true;
    }
    return false;
};

/** 选项/关联类 click 分发 @同步豁免: UI构建 */
const dispatchOptionClick = (
    ctx: IMenuPanelContext, type: string, target: HTMLElement, event: MouseEvent
): boolean => {
    // 设置列选项
    if (type === "setColOption") {
        handleSetColOption(ctx, target, event);
        return true;
    }
    // 设置关联单元格
    if (type === "setRelationCell") {
        handleSetRelationCell(ctx, target, event);
        return true;
    }
    // 添加列选项或单元格值
    if (type === "addColOptionOrCell") {
        handleAddColOptionOrCell(ctx, target, event);
        return true;
    }
    // 移除单元格选项
    if (type === "removeCellOption") {
        handleRemoveCellOption(ctx, target, event);
        return true;
    }
    return false;
};

/** 资源/日期类 click 分发 @同步豁免: UI构建 */
const dispatchAssetDateClick = (
    ctx: IMenuPanelContext, type: string, target: HTMLElement, event: MouseEvent
): boolean => {
    // 添加资源链接
    if (type === "addAssetLink") {
        handleAddAssetLink(ctx, target, event);
        return true;
    }
    // 从已有资源添加
    if (type === "addAssetExist") {
        handleAddAssetExist(ctx, target, event);
        return true;
    }
    // 打开资源项
    if (type === "openAssetItem") {
        handleOpenAssetItem(ctx, target, event);
        return true;
    }
    // 编辑资源项
    if (type === "editAssetItem") {
        handleEditAssetItem(ctx, target, event);
        return true;
    }
    // 清除日期
    if (type === "clearDate") {
        handleClearDate(ctx, event);
        return true;
    }
    return false;
};

/**
 * 单元格操作 click 事件分支总入口。
 * 覆盖：goSearchAV, goSearchRollupCol/Target/Calc, updateRelation,
 *       setColOption, setRelationCell, addColOptionOrCell, removeCellOption,
 *       addAssetLink, addAssetExist, openAssetItem, editAssetItem, clearDate
 */
export const handleCellClick = async (
    ctx: IMenuPanelContext, type: string, target: HTMLElement, event: MouseEvent
): Promise<boolean> => {
    return dispatchSearchClick(ctx, type, target, event)
        || dispatchOptionClick(ctx, type, target, event)
        || dispatchAssetDateClick(ctx, type, target, event);
};
