import {Menu} from "../../../../plugin/Menu";
import {transaction} from "../../../wysiwyg/transaction/submit";
import {fetchPost, fetchSyncPost} from "../../../../util/network/fetch";
import {getDefaultOperatorByType, setFilter} from "../filter";
import {genCellValue} from "../cell.value";
import {openEmojiPanel, unicode2Emoji} from "../../../../emoji";
import {getColIconByType} from "./col.typeUtils";
import {escapeAriaLabel, escapeAttr, escapeHtml} from "../../../../util/DOM/escape";
import {updateAttrViewColAnimation} from "../action/animation";
/** 用途：从当前 Protyle 宿主创建关系删除确认框；使用范围：双向关联列删除；解耦评估：依赖完整 Dialog Port，不加载具体 Dialog class。 */
import {getProtyleDialogPort} from "../../../runtime/dialog.port";
/** 用途：约束关系删除对话框完整生命周期；使用范围：关系确认事件处理；解耦评估：纯类型依赖稳定领域抽象，不依赖具体实现。 */
import type {IProtyleDialog} from "../../../runtime/dialog.port";
import {isMobile} from "../../../../util/platform/functions";
import {Constants} from "../../../../constants";
import {removeColByMenu} from "./structure/removeByMenu";
import {siyuanI18n} from "../../../../util/siyuanEnvironments/i18n.getI18n.environment";
import {isHTMLElement, isCustomEvent} from "../../../../util/DOM/element.guard";
import type {IShowColMenuContext} from "./col.showColMenu.types";
/** 用途：打开字段编辑 Panel；使用范围：筛选值菜单发现 Rollup 配置不足后的既有导航；解耦评估：经列子域网关直达 Panel 唯一实现，不由 Filter 反向依赖组合根。 */
import {openMenuPanel} from "./imports";
/** 用途：提交当前列排序列表；使用范围：列菜单排序动作；解耦评估：经列网关直达现有严格命令。 */
import {submitAVSortTransaction} from "./imports";

/** 生成列菜单表头项 HTML（图标+名称输入框+描述文本域），由 showColMenu 调用 @同步豁免: UI构建 */
export const buildColHeaderLabel = (ctx: IShowColMenuContext): string => {
    const {cellElement, type, oldDesc} = ctx;
    const iconHTML = cellElement.dataset.icon
        ? unicode2Emoji(cellElement.dataset.icon)
        : `<svg style="height: 14px;width: 14px;"><use xlink:href="#${getColIconByType(type)}"></use></svg>`;
    const descAriaLabel = oldDesc ? escapeAriaLabel(oldDesc) : siyuanI18n.addDesc;
    return `<div class="fn__hr"></div><div class="fn__flex">
    <div class="fn__space"></div>
    <span class="b3-menu__avemoji">${iconHTML}</span>
    <div class="b3-form__icona fn__block">
        <input class="b3-text-field b3-form__icona-input" type="text">
        <svg data-position="north" class="b3-form__icona-icon ariaLabel" aria-label="${descAriaLabel}"><use xlink:href="#iconInfo"></use></svg>
    </div>
    <div class="fn__space"></div>
</div>
<div class="fn__none">
    <div class="fn__hr"></div>
    <div class="fn__flex">
        <span class="fn__space"></span>
        <textarea placeholder="${siyuanI18n.addDesc}" rows="1" class="b3-text-field fn__block" type="text" data-value="${escapeAttr(oldDesc)}">${oldDesc}</textarea>
        <span class="fn__space"></span>    
    </div>
</div>
<div class="fn__hr--small"></div>`;
};

/** emoji 选择后更新列图标并同步动画到表头，由 bindColHeaderEvents 调用 @同步豁免: UI构建 */
export const applyColIcon = (
    ctx: IShowColMenuContext, iconElement: HTMLElement, unicode: string,
): void => {
    const {protyle, colId, avID, cellElement, type} = ctx;
    transaction(protyle, [{
        action: "setAttrViewColIcon", id: colId, avID, data: unicode,
    }], [{
        action: "setAttrViewColIcon", id: colId, avID, data: cellElement.dataset.icon,
    }]);
    iconElement.innerHTML = unicode
        ? unicode2Emoji(unicode)
        : `<svg style="height: 14px;width: 14px"><use xlink:href="#${getColIconByType(type)}"></use></svg>`;
    updateAttrViewColAnimation(protyle, avID, colId, {icon: unicode});
};

/** 绑定描述文本域的展开/折叠和键盘事件，由 bindColHeaderEvents 调用 @同步豁免: UI构建 */
export const bindDescEvents = (
    inputElement: HTMLInputElement, descElement: HTMLTextAreaElement, menu: Menu,
): void => {
    const infoIcon = inputElement.nextElementSibling;
    // 点击 info 图标切换描述面板的显示/隐藏
    if (infoIcon) {
        // @内联回调
        infoIcon.addEventListener("click", () => {
            const descPanelElement = descElement.parentElement?.parentElement;
            if (!descPanelElement) {
                return;
            }
            descPanelElement.classList.toggle("fn__none");
            // 面板展开后自动聚焦描述输入框
            if (!descPanelElement.classList.contains("fn__none")) {
                descElement.focus();
            }
        });
    }
    // @内联回调
    descElement.addEventListener("keydown", (event: KeyboardEvent) => {
        if (event.isComposing) {
            return;
        }
        // 回车确认并关闭菜单
        if (event.key === "Enter") {
            menu.close();
            event.preventDefault();
        }
    });
    descElement.addEventListener("input", () => {
        infoIcon?.setAttribute("aria-label", descElement.value ? escapeHtml(descElement.value) : siyuanI18n.addDesc);
    });
};

/** 绑定列菜单表头项的交互事件（图标/名称/描述），由 showColMenu 的 bind 回调调用 @同步豁免: UI构建 */
export const bindColHeaderEvents = (
    element: HTMLElement, menu: Menu, ctx: IShowColMenuContext,
): void => {
    const {oldValue} = ctx;
    const iconElement = element.querySelector(".b3-menu__avemoji");
    // 图标区域存在时绑定 emoji 选择面板
    if (iconElement instanceof HTMLElement) {
        // @内联回调
        iconElement.addEventListener("click", (event) => {
            const rect = iconElement.getBoundingClientRect();
            // @内联回调
            openEmojiPanel("", "av", {
                x: rect.left, y: rect.bottom + 4, h: rect.height, w: rect.width
            }, (unicode) => {
                applyColIcon(ctx, iconElement, unicode);
            }, iconElement.querySelector("img") ?? undefined);
            event.preventDefault();
            event.stopPropagation();
        });
    }
    const inputElement = element.querySelector("input");
    const descElement = element.querySelector("textarea");
    // 输入框和描述文本域必须存在（由 buildColHeaderLabel 生成）
    if (!inputElement || !descElement) {
        return;
    }
    inputElement.value = oldValue;
    // @内联回调
    inputElement.addEventListener("keydown", (event: KeyboardEvent) => {
        if (event.isComposing) {
            return;
        }
        // 回车确认并关闭菜单
        if (event.key === "Enter") {
            menu.close();
            event.preventDefault();
        }
    });
    bindDescEvents(inputElement, descElement, menu);
};

/** 筛选菜单项点击：获取 AV 数据并打开筛选面板，由 showColMenu 调用 @同步豁免: UI构建 */
export const handleFilterClick = (ctx: IShowColMenuContext): void => {
    const {avID, colId, type, protyle, blockElement} = ctx;
    // @内联回调
    fetchPost("/api/av/renderAttributeView", {id: avID}, async (response) => {
        const avData: IAV = response.data;
        let filter: IAVFilter | undefined;
        avData.view.filters.find((item) => {
            // 匹配当前列和类型的已有筛选条件
            if (item.column === colId && item.value.type === type) {
                filter = item;
                return true;
            }
        });
        let empty = false;
        // 不存在匹配的筛选条件时创建默认条件
        if (!filter) {
            empty = true;
            filter = {
                column: colId,
                operator: getDefaultOperatorByType(type) ?? "Contains",
                value: genCellValue(type, ""),
            };
            avData.view.filters.push(filter);
        }
        const target = blockElement.querySelector(`.av__row--header .av__cell[data-col-id="${colId}"]`);
        if (!(target instanceof HTMLElement)) {
            return;
        }
        const editColumnId = await setFilter({empty, filter, protyle, data: avData, blockElement, target});
        if (!editColumnId) {
            return;
        }
        openMenuPanel({
            protyle,
            blockElement,
            type: "edit",
            colId: editColumnId,
        });
    });
};

/** 构建双向关联列删除确认对话框 HTML，由 handleDeleteColClick 调用 @同步豁免: UI构建 */
export const buildTwoWayRelationDialogContent = (
    colData: { key: { name: string; relation: { backKeyID: string } } },
    relData: { av: { name: string; keyValues: Array<{ key: { id: string; name: string } }> } },
): string => {
    const backKey = relData.av.keyValues.find(
        (item) => item.key.id === colData.key.relation.backKeyID
    );
    const colName = colData.key.name || siyuanI18n._kernel[272];
    const avName = relData.av.name || siyuanI18n._kernel[267];
    const backKeyName = backKey?.key.name || siyuanI18n._kernel[272];
    return `<div class="b3-dialog__content">
    ${siyuanI18n.confirmRemoveRelationField
        .replace("${x}", colName).replace("${y}", avName).replace("${z}", backKeyName)}
    <div class="fn__hr--b"></div>
    <button class="fn__block b3-button b3-button--remove" data-action="delete">${siyuanI18n.removeBothRelationField}</button>
    <div class="fn__hr"></div>
    <button class="fn__block b3-button b3-button--remove" data-action="keep-relation">${siyuanI18n.removeButKeepRelationField}</button>
    <div class="fn__hr"></div>
    <button class="fn__block b3-button b3-button--cancel">${siyuanI18n.cancel}</button>
</div>`;
};

/** 排序菜单项点击：获取 AV 数据并设置排序事务，由 showColMenu 调用 @同步豁免: UI构建 */
export const handleSortClick = (ctx: IShowColMenuContext, order: "ASC" | "DESC"): void => {
    const {avID, colId, blockID, protyle} = ctx;
    // @内联回调
    fetchPost("/api/av/renderAttributeView", {id: avID}, (response) => {
        submitAVSortTransaction(protyle, [{
            action: "setAttrViewSorts",
            avID: response.data.id,
            data: [{column: colId, order}],
            blockID
        }], [{
            action: "setAttrViewSorts",
            avID: response.data.id,
            data: response.data.view.sorts,
            blockID
        }]);
    });
};

/** 处理双向关联删除确认对话框的按钮点击，由 handleDeleteColClick 调用 @同步豁免: UI构建 */
export const handleRelationDialogAction = (
    ctx: IShowColMenuContext, dialog: IProtyleDialog, event: Event,
): void => {
    if (!isHTMLElement(event.target)) {
        return;
    }
    let target: HTMLElement = event.target;
    const dispatchDetail = isCustomEvent<string>(event) ? event.detail : null;
    while (target && target !== dialog.element || dispatchDetail) {
        const action = target.getAttribute("data-action");
        // 确认删除双方关联字段，或回车键确认
        if (action === "delete" || dispatchDetail === "Enter") {
            removeColByMenu({...ctx, removeDest: true});
            dialog.destroy();
            break;
        }
        // 仅删除本方，保留对方关联字段
        if (action === "keep-relation") {
            removeColByMenu({...ctx, removeDest: false});
            dialog.destroy();
            break;
        }
        // 取消或 ESC
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

/** 删除列点击处理：关联列显示确认对话框，其他列直接删除，由 showColMenu 调用 */
export const handleDeleteColClick = async (ctx: IShowColMenuContext): Promise<void> => {
    const {type, avID, colId} = ctx;
    // 非关联列直接删除
    if (type !== "relation") {
        removeColByMenu({...ctx, removeDest: false});
        return;
    }
    const response = await fetchSyncPost("/api/av/getAttributeView", {id: avID});
    const colData = response.data.av.keyValues.find((item: {
        key: { id: string }
    }) => item.key.id === colId);
    // 非双向关联直接删除
    if (!colData.key.relation?.isTwoWay) {
        removeColByMenu({...ctx, removeDest: false});
        return;
    }
    const relResponse = await fetchSyncPost("/api/av/getAttributeView", {id: colData.key.relation.avID});
    const dialog = getProtyleDialogPort().create({
        title: siyuanI18n.removeColConfirm,
        content: buildTwoWayRelationDialogContent(colData, relResponse.data),
        width: isMobile() ? "92vw" : "520px",
    });
    // @内联回调
    dialog.element.addEventListener("click", (event) => {
        handleRelationDialogAction(ctx, dialog, event);
    });
    const firstBtn = dialog.element.querySelector("button");
    firstBtn?.focus();
    dialog.element.setAttribute("data-key", Constants.DIALOG_CONFIRM);
};
