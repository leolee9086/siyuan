import { Menu } from "../../../../plugin/Menu";
import { openMenuPanel } from "../openMenuPanel";
import { unicode2Emoji } from "../../../../emoji";
import { bindRollupData } from "../rollup";
import { Constants } from "../../../../constants";
import { escapeAriaLabel, escapeAttr } from "../../../../util/DOM/escape";
import { getFieldsByData } from "../view/metadata";
import { hasClosestByClassName } from "../../../util/hasClosest";
import { siyuanI18n } from "../../../../util/siyuanEnvironments/i18n.getI18n.environment";
import { buildColHeaderLabel, bindColHeaderEvents, handleFilterClick, handleSortClick } from "./col.showColMenu";
import type { IShowColMenuContext } from "./col.showColMenu.types";
import { getColNameByType, getColIconByType } from "./col.typeUtils";
import { genUpdateColItem, getTypeSpecificEditHTML } from "./col.editPanel";
import { bindNameEvents, bindDescEvents, bindTemplateEvents, bindIncludeTimeEvent, bindWrapEvent, bindAddOptionEvent, bindDateSwitchEvents } from "./col.editPanel.bind";
import { bindBackRelationEvents } from "./col.editPanel.bind.relation";
import type { IBindEditContext } from "./col.editPanel.bind.types";
import { buildMenuCloseCallback, addPinAndHideItems, addSyncAndWrapItems, addInsertColumnItems, addDuplicateDeleteItems } from "./col.showColMenu.items";

export const getColId = (element: Element, viewType: TAVView) => {
    if (viewType === "table" || hasClosestByClassName(element, "custom-attr")) {
        return element.getAttribute("data-col-id");
    } else if (["gallery", "kanban"].includes(viewType)) {
        return element.getAttribute("data-field-id");
    }
};


export const getEditHTML = (options: {
    protyle: IProtyle,
    colId: string,
    data: IAV,
    isCustomAttr: boolean
}) => {
    let colData: IAVColumn;
    getFieldsByData(options.data).find((item) => {
        if (item.id === options.colId) {
            colData = item;
            return true;
        }
    });
    let html = `<button class="b3-menu__item" data-type="nobg" data-col-id="${options.colId}">
    <span class="block__icon${options.isCustomAttr ? " fn__none" : ""}" style="padding: 8px;margin-left: -4px;" data-type="go-properties">
        <svg><use xlink:href="#iconLeft"></use></svg>
    </span>
    <span class="b3-menu__label ft__center">${siyuanI18n.edit}</span>
</button>
<button class="b3-menu__separator" data-id="separator_1"></button>
<button class="b3-menu__item" data-type="nobg">
    <div class="fn__block">
        <div class="fn__flex">
            <span class="b3-menu__avemoji" data-col-type="${colData.type}" data-icon="${colData.icon}" data-type="update-icon">${colData.icon ? unicode2Emoji(colData.icon) : `<svg style="width: 14px;height: 14px"><use xlink:href="#${getColIconByType(colData.type)}"></use></svg>`}</span>
            <div class="b3-form__icona fn__block">
                <input data-type="name" class="b3-text-field b3-form__icona-input" type="text">
                <svg data-position="north" class="b3-form__icona-icon ariaLabel" aria-label="${colData.desc ? escapeAriaLabel(colData.desc) : siyuanI18n.addDesc}"><use xlink:href="#iconInfo"></use></svg>
            </div>
        </div>
        <div class="fn__none">
            <div class="fn__hr"></div>
            <textarea placeholder="${siyuanI18n.addDesc}" rows="1" data-type="desc" class="b3-text-field fn__block" type="text" data-value="${escapeAttr(colData.desc)}">${colData.desc}</textarea>
        </div>
        <div class="fn__hr--small"></div>
    </div>
</button>
<button class="b3-menu__item" data-type="goUpdateColType" ${colData.type === "block" ? "disabled" : ""}>
    <span class="b3-menu__label">${siyuanI18n.type}</span>
    <span class="fn__space"></span>
    <svg class="b3-menu__icon"><use xlink:href="#${getColIconByType(colData.type)}"></use></svg>
    <span class="b3-menu__accelerator" style="margin-left: 0">${getColNameByType(colData.type)}</span>
    <svg class="b3-menu__icon b3-menu__icon--small"><use xlink:href="#iconRight"></use></svg>
</button>`;
    html += getTypeSpecificEditHTML(colData, options.data);
    html += `<button class="b3-menu__separator" data-id="separator_3"></button>
<label class="b3-menu__item">
    <svg class="b3-menu__icon" style=""><use xlink:href="#iconSoftWrap"></use></svg>
    <span class="fn__flex-center">${siyuanI18n.wrap}</span>
    <span class="fn__space fn__flex-1"></span>
    <input type="checkbox" data-type="wrap" class="b3-switch b3-switch--menu"${colData.wrap ? " checked" : ""}>
</label>`;
    if (colData.type !== "block") {
        html += `<button class="b3-menu__item${colData.type === "relation" ? " fn__none" : ""}" data-type="duplicateCol">
    <svg class="b3-menu__icon" style=""><use xlink:href="#iconCopy"></use></svg>
    <span class="b3-menu__label">${siyuanI18n.duplicate}</span>
</button>
<button class="b3-menu__item  b3-menu__item--warning" data-type="removeCol">
    <svg class="b3-menu__icon" style=""><use xlink:href="#iconTrashcan"></use></svg>
    <span class="b3-menu__label">${siyuanI18n.delete}</span>
</button>`;
    }
    return `<div class="b3-menu__items">
    ${html}
</div>
<div class="b3-menu__items fn__none">
    <button class="b3-menu__item" data-type="nobg" data-col-id="${colData.id}">
        <span class="block__icon" style="padding: 8px;margin-left: -4px;" data-type="goEditCol">
            <svg><use xlink:href="#iconLeft"></use></svg>
        </span>
        <span class="b3-menu__label ft__center">${siyuanI18n.edit}</span>
    </button>
    <button class="b3-menu__separator"></button>
    ${genUpdateColItem("text", colData.type)}
    ${genUpdateColItem("number", colData.type)}
    ${genUpdateColItem("select", colData.type)}
    ${genUpdateColItem("mSelect", colData.type)}
    ${genUpdateColItem("date", colData.type)}
    ${genUpdateColItem("mAsset", colData.type)}
    ${genUpdateColItem("checkbox", colData.type)}
    ${genUpdateColItem("url", colData.type)}
    ${genUpdateColItem("email", colData.type)}
    ${genUpdateColItem("phone", colData.type)}
    ${genUpdateColItem("template", colData.type)}
    ${genUpdateColItem("relation", colData.type)}
    ${genUpdateColItem("rollup", colData.type)}
    ${genUpdateColItem("lineNumber", colData.type)}
    ${genUpdateColItem("created", colData.type)}
    ${genUpdateColItem("updated", colData.type)}
</div>`;
};

export const bindEditEvent = (options: {
    protyle: IProtyle,
    data: IAV,
    blockID: string,
    menuElement: HTMLElement,
    isCustomAttr: boolean
}) => {
    const avID = options.data.id;
    const colId = options.menuElement.querySelector(".b3-menu__item")?.getAttribute("data-col-id") ?? "";
    const colData = getFieldsByData(options.data).find((item: IAVColumn) => item.id === colId);
    const nameEl = options.menuElement.querySelector('[data-type="name"]');
    // nameElement 或 colData 不存在时跳过所有事件绑定
    if (!(nameEl instanceof HTMLInputElement) || !colData) {
        return;
    }
    const ctx: IBindEditContext = {
        protyle: options.protyle,
        data: options.data,
        blockID: options.blockID,
        menuElement: options.menuElement,
        isCustomAttr: options.isCustomAttr,
        colId,
        colData,
        avID,
        nameElement: nameEl,
        // @内联回调 — 封装 getEditHTML + bindEditEvent 的刷新逻辑，避免循环依赖
        refreshEditPanel: () => {
            options.menuElement.innerHTML = getEditHTML({
                protyle: options.protyle,
                colId,
                data: options.data,
                isCustomAttr: options.isCustomAttr,
            });
            bindEditEvent(options);
        },
    };
    bindNameEvents(ctx);
    bindDescEvents(ctx);
    bindTemplateEvents(ctx);
    bindIncludeTimeEvent(ctx);
    bindWrapEvent(ctx);
    bindAddOptionEvent(ctx);
    bindDateSwitchEvents(ctx);
    bindBackRelationEvents(ctx);
    bindRollupData(options);
};


export const showColMenu = (protyle: IProtyle, blockElement: Element, cellElement: HTMLElement) => {
    const type = cellElement.getAttribute("data-dtype") as TAVCol;
    const colId = cellElement.getAttribute("data-col-id");
    const avID = blockElement.getAttribute("data-av-id");
    const blockID = blockElement.getAttribute("data-node-id");
    const viewID = blockElement.getAttribute(Constants.CUSTOM_SY_AV_VIEW);
    const oldValue = cellElement.querySelector(".av__celltext").textContent.trim();
    const oldDesc = cellElement.dataset.desc;
    const ctx: IShowColMenuContext = {protyle, blockElement, cellElement, type, colId, avID, blockID, viewID, oldValue, oldDesc};
    // @内联回调 — 菜单关闭时保存名称和描述变更（forward reference 安全：回调仅存储不在构造期调用）
    const menu = new Menu(Constants.MENU_AV_HEADER_CELL, () => {
        buildMenuCloseCallback(ctx, menu)();
    });
    menu.addItem({
        iconHTML: "",
        type: "empty",
        label: buildColHeaderLabel(ctx),
        bind(element) {
            bindColHeaderEvents(element, menu, ctx);
        }
    });
    menu.addItem({
        id: "edit",
        icon: "iconEdit",
        label: siyuanI18n.edit,
        click() {
            const colName = (menu.element.querySelector(".b3-text-field") as HTMLInputElement).value;
            openMenuPanel({
                protyle,
                blockElement,
                type: "edit",
                colId,
                cb(avElement) {
                    // 修改名字后点击编辑，需要更新名字
                    const editNameElement = avElement.querySelector('.b3-text-field[data-type="name"]') as HTMLInputElement;
                    editNameElement.value = colName;
                    editNameElement.select();
                }
            });
        }
    });
    menu.addSeparator({ id: "separator_1" });

    // 行号类型不参与筛选和排序
    if (type !== "lineNumber") {
        menu.addItem({
            id: "filter",
            icon: "iconFilter",
            label: siyuanI18n.filter,
            click() {
                handleFilterClick(ctx);
            }
        });
        menu.addItem({
            id: "asc",
            icon: "iconUp",
            label: siyuanI18n.asc,
            click() {
                handleSortClick(ctx, "ASC");
            }
        });
        menu.addItem({
            id: "desc",
            icon: "iconDown",
            label: siyuanI18n.desc,
            click() {
                handleSortClick(ctx, "DESC");
            }
        });
    }
    addPinAndHideItems(menu, ctx);
    addSyncAndWrapItems(menu, ctx);
    menu.addSeparator({ id: "separator_2" });
    addInsertColumnItems(menu, ctx);
    addDuplicateDeleteItems(menu, ctx);
    const cellRect = cellElement.getBoundingClientRect();
    menu.open({
        x: cellRect.left,
        y: cellRect.bottom,
        h: cellRect.height
    });
    const inputElement = window.siyuan.menus.menu.element.querySelector(".b3-text-field") as HTMLInputElement;
    if (inputElement) {
        inputElement.select();
        inputElement.focus();
    }
};

