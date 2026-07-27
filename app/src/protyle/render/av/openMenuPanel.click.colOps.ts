import {submitAVColumnEditTransaction} from "../../wysiwyg/transaction/prepared/av/avColumnEdit";
import { setPosition } from "../../../util/DOM/positioning/setPosition";
import { duplicateCol, removeCol } from "./col/col.operations";
import { addCol } from "./col/addCol";
import { bindEditEvent, getEditHTML } from "./col/edit/render";
import { Constants } from "../../../constants";
import { Dialog } from "../../runtime/dialog.port";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import { isHTMLElement, isHTMLInputElement, isCustomEvent } from "../../../util/DOM/element.guard";
import type { IMenuPanelContext } from "./openMenuPanel.types";

/** 从 menuElement 获取当前列ID @同步豁免: UI构建 */
const getMenuColId = (menuElement: HTMLElement): string => {
    const menuItem = menuElement.querySelector(".b3-menu__item");
    return menuItem?.getAttribute("data-col-id") ?? "";
};

/** 新建列：关闭面板并打开添加列菜单 @同步豁免: UI构建 */
const handleNewCol = (ctx: IMenuPanelContext, event: MouseEvent): void => {
    ctx.avPanelElement.remove();
    const addMenu = addCol(ctx.options.protyle, ctx.options.blockElement);
    addMenu.open({
        x: ctx.tabRect.right, y: ctx.tabRect.bottom, h: ctx.tabRect.height, isLeft: true
    });
    event.preventDefault();
    event.stopPropagation();
};

/** 批量切换列可见性（显示全部/隐藏全部） @同步豁免: UI构建 */
const handleToggleAllCols = (
    ctx: IMenuPanelContext, event: MouseEvent,
    hidden: boolean, getPropertiesHTML: (fields: IAVColumn[]) => string
): void => {
    const doOperations: IOperation[] = [];
    const undoOperations: IOperation[] = [];
    for (const item of ctx.fields) {
        // hidden=false: 显示全部(仅处理已隐藏列); hidden=true: 隐藏全部(仅处理非block已显示列)
        const shouldToggle = hidden ? (!item.hidden && item.type !== "block") : item.hidden;
        if (!shouldToggle) {
            continue;
        }
        doOperations.push({
            action: "setAttrViewColHidden", id: item.id, avID: ctx.avID, data: hidden, blockID: ctx.blockID,
        });
        undoOperations.push({
            action: "setAttrViewColHidden", id: item.id, avID: ctx.avID, data: !hidden, blockID: ctx.blockID
        });
        item.hidden = hidden;
    }
    // 有变更时提交事务并刷新面板
    if (doOperations.length > 0) {
        submitAVColumnEditTransaction(ctx.options.protyle, doOperations, undoOperations);
        ctx.menuElement.innerHTML = getPropertiesHTML(ctx.fields);
        setPosition(ctx.menuElement, ctx.tabRect.right - ctx.menuElement.clientWidth, ctx.tabRect.bottom, ctx.tabRect.height);
    }
    event.preventDefault();
    event.stopPropagation();
};

/**
 * 获取列ID：编辑面板中从 menuElement 获取，属性列表中从 target 父元素获取。
 * @同步豁免: UI构建
 */
const getColIdForVisibility = (ctx: IMenuPanelContext, target: HTMLElement): { colId: string; isEdit: boolean } => {
    const isEditEl = ctx.menuElement.querySelector('[data-type="go-properties"]');
    const colId = isEditEl
        ? getMenuColId(ctx.menuElement)
        : (target.parentElement?.getAttribute("data-id") ?? "");
    return { colId, isEdit: !!isEditEl };
};

/**
 * 切换单列可见性并刷新面板。
 * @同步豁免: UI构建
 */
const handleToggleCol = (
    ctx: IMenuPanelContext, target: HTMLElement, event: MouseEvent,
    hidden: boolean, getPropertiesHTML: (fields: IAVColumn[]) => string
): void => {
    const { colId, isEdit } = getColIdForVisibility(ctx, target);
    submitAVColumnEditTransaction(ctx.options.protyle, [{
        action: "setAttrViewColHidden", id: colId, avID: ctx.avID, data: hidden, blockID: ctx.blockID
    }], [{
        action: "setAttrViewColHidden", id: colId, avID: ctx.avID, data: !hidden, blockID: ctx.blockID
    }]);
    const field = ctx.fields.find((item: IAVColumn) => item.id === colId);
    if (field) {
        field.hidden = hidden;
    }
    // 编辑面板刷新编辑HTML，属性列表刷新属性HTML
    ctx.menuElement.innerHTML = isEdit
        ? getEditHTML({ protyle: ctx.options.protyle, data: ctx.data, colId, isCustomAttr: ctx.isCustomAttr })
        : getPropertiesHTML(ctx.fields);
    if (isEdit) {
        bindEditEvent({ protyle: ctx.options.protyle, data: ctx.data, menuElement: ctx.menuElement, isCustomAttr: ctx.isCustomAttr, blockID: ctx.blockID });
    }
    setPosition(ctx.menuElement, ctx.tabRect.right - ctx.menuElement.clientWidth, ctx.tabRect.bottom, ctx.tabRect.height);
    event.preventDefault();
    event.stopPropagation();
};

/** 复制列 @同步豁免: UI构建 */
const handleDuplicateCol = (ctx: IMenuPanelContext, event: MouseEvent): void => {
    duplicateCol({
        blockElement: ctx.options.blockElement,
        protyle: ctx.options.protyle,
        colId: getMenuColId(ctx.menuElement),
        data: ctx.data,
        viewID: ctx.data.viewID,
    });
    event.preventDefault();
    event.stopPropagation();
};

/** 构建 removeCol 的参数对象 @同步豁免: UI构建 */
const buildRemoveColArgs = (ctx: IMenuPanelContext, isTwoWay: boolean) => ({
    protyle: ctx.options.protyle,
    fields: ctx.fields,
    avID: ctx.avID,
    blockID: ctx.blockID,
    menuElement: ctx.menuElement,
    isCustomAttr: ctx.isCustomAttr,
    blockElement: ctx.options.blockElement,
    avPanelElement: ctx.avPanelElement,
    tabRect: ctx.tabRect,
    isTwoWay
});

/** 构建简单删除列的对话框HTML @同步豁免: UI构建 */
const buildSimpleRemoveContent = (inputVal: string): string => {
    return `<div class="b3-dialog__content">
    ${siyuanI18n.removeCol.replace("${x}", inputVal)}
    <div class="fn__hr--b"></div>
    <button class="fn__block b3-button b3-button--remove" data-action="delete">${siyuanI18n.delete}</button>
    <div class="fn__hr"></div>
    <button class="fn__block b3-button b3-button--remove fn__none" data-action="keep-relation">${siyuanI18n.removeButKeepRelationField}</button>
    <div class="fn__hr"></div>
    <button class="fn__block b3-button b3-button--cancel">${siyuanI18n.cancel}</button>
</div>`;
};

/** 构建删除列确认对话框的HTML内容 @同步豁免: UI构建 */
const buildRemoveDialogContent = (ctx: IMenuPanelContext, isTwoWay: boolean): string => {
    const inputEl = ctx.menuElement.querySelector("input");
    const inputVal = inputEl?.value || siyuanI18n._kernel[272];
    if (!isTwoWay) {
        return buildSimpleRemoveContent(inputVal);
    }
    const accelEl = ctx.menuElement.querySelector('.b3-menu__item[data-type="goSearchAV"] .b3-menu__accelerator');
    const colNameEl = ctx.menuElement.querySelector('input[data-type="colName"]');
    const colNameVal = isHTMLInputElement(colNameEl) ? (colNameEl.value || siyuanI18n._kernel[272]) : siyuanI18n._kernel[272];
    const bodyText = siyuanI18n.confirmRemoveRelationField
        .replace("${x}", inputVal)
        .replace("${y}", accelEl?.textContent ?? "")
        .replace("${z}", colNameVal);
    return `<div class="b3-dialog__content">
    ${bodyText}
    <div class="fn__hr--b"></div>
    <button class="fn__block b3-button b3-button--remove" data-action="delete">${siyuanI18n.removeBothRelationField}</button>
    <div class="fn__hr"></div>
    <button class="fn__block b3-button b3-button--remove" data-action="keep-relation">${siyuanI18n.removeButKeepRelationField}</button>
    <div class="fn__hr"></div>
    <button class="fn__block b3-button b3-button--cancel">${siyuanI18n.cancel}</button>
</div>`;
};

/** 处理删除列对话框中的按钮点击 @同步豁免: UI构建 */
const handleDialogAction = (ctx: IMenuPanelContext, dialog: Dialog, dialogEvent: Event): void => {
    if (!isHTMLElement(dialogEvent.target)) {
        return;
    }
    let target: HTMLElement = dialogEvent.target;
    const dispatchDetail = isCustomEvent<string>(dialogEvent) ? dialogEvent.detail : null;
    while (target && target !== dialog.element || dispatchDetail) {
        const action = target.getAttribute("data-action");
        // 确认删除或回车键
        if (action === "delete" || dispatchDetail === "Enter") {
            removeCol(buildRemoveColArgs(ctx, true));
            dialog.destroy();
            break;
        }
        // 保留关联但删除列
        if (action === "keep-relation") {
            removeCol(buildRemoveColArgs(ctx, false));
            dialog.destroy();
            break;
        }
        // 取消或ESC
        if (target.classList.contains("b3-button--cancel") || dispatchDetail === "Escape") {
            dialog.destroy();
            break;
        }
        const parent = target.parentElement;
        if (!parent) {
            break;
        }
        target = parent;
    }
};

/** 删除列（含确认对话框逻辑） @同步豁免: UI构建 */
const handleRemoveCol = (ctx: IMenuPanelContext, event: MouseEvent): void => {
    // 非自定义属性时更新 tabRect
    if (!ctx.isCustomAttr) {
        const viewsEl = ctx.options.blockElement.querySelector(".av__views");
        ctx.tabRect = viewsEl?.getBoundingClientRect() ?? ctx.tabRect;
    }
    const colId = getMenuColId(ctx.menuElement);
    const colData = ctx.fields.find((item: IAVColumn) => item.id === colId);
    const isTwoWay = colData?.type === "relation" && colData.relation?.isTwoWay;
    // 非自定义属性且非双向关联：直接删除
    if (!ctx.isCustomAttr && !isTwoWay) {
        removeCol(buildRemoveColArgs(ctx, false));
        event.preventDefault();
        event.stopPropagation();
        return;
    }
    // 自定义属性或双向关联需要确认对话框
    const dialog = new Dialog({
        title: isTwoWay ? siyuanI18n.removeColConfirm : siyuanI18n.deleteOpConfirm,
        content: buildRemoveDialogContent(ctx, !!isTwoWay),
        width: "520px",
    });
    // @内联回调
    dialog.element.addEventListener("click", (dialogEvent) => {
        handleDialogAction(ctx, dialog, dialogEvent);
    });
    dialog.element.setAttribute("data-key", Constants.DIALOG_CONFIRM);
    event.preventDefault();
    event.stopPropagation();
};

/**
 * 列操作+可见性 click 事件分支。
 * 覆盖：newCol, showAllCol, hideAllCol, hideCol, showCol, duplicateCol, removeCol
 * @同步豁免: 遗留代码 - openMenuPanel click handler 同步事件分发
 */
export const handleColOpsClick = (
    ctx: IMenuPanelContext, type: string, target: HTMLElement, event: MouseEvent,
    getPropertiesHTML: (fields: IAVColumn[]) => string
): boolean => {
    // 新建列
    if (type === "newCol") {
        handleNewCol(ctx, event);
        return true;
    }
    // 显示全部列
    if (type === "showAllCol") {
        handleToggleAllCols(ctx, event, false, getPropertiesHTML);
        return true;
    }
    // 隐藏全部列
    if (type === "hideAllCol") {
        handleToggleAllCols(ctx, event, true, getPropertiesHTML);
        return true;
    }
    // 隐藏单列
    if (type === "hideCol") {
        handleToggleCol(ctx, target, event, true, getPropertiesHTML);
        return true;
    }
    // 显示单列
    if (type === "showCol") {
        handleToggleCol(ctx, target, event, false, getPropertiesHTML);
        return true;
    }
    // 复制列
    if (type === "duplicateCol") {
        handleDuplicateCol(ctx, event);
        return true;
    }
    // 删除列
    if (type === "removeCol") {
        handleRemoveCol(ctx, event);
        return true;
    }
    return false;
};
