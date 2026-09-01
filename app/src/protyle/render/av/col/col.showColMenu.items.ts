import {Menu} from "../../../../plugin/Menu";
import {transaction} from "../../../wysiwyg/transaction/submit";
import {fetchPost} from "../../../../util/network/fetch";
import {updateAttrViewCellAnimation, updateAttrViewColAnimation} from "../action/animation";
import {focusBlock} from "../../../util/selection";
import {handleDeleteColClick} from "./col.showColMenu";
import {addCol} from "./add/menu.factory";
import {avMenuPanel} from "./imports";
import {duplicateCol} from "./structure/operations";
import {siyuanI18n} from "../../../../util/siyuanEnvironments/i18n.getI18n.environment";
import {isHTMLInputElement} from "../../../../util/DOM/element.guard";
import {openFieldVisibility} from "../fieldVisibility";
import type {IShowColMenuContext} from "./col.showColMenu.types";

/** @同步豁免: UI构建 — 菜单关闭时保存名称变更 */
const saveNameChange = (
    ctx: IShowColMenuContext, menu: Menu,
): void => {
    const {protyle, colId, avID, type, oldValue} = ctx;
    const textField = menu.element.querySelector(".b3-text-field");
    // 文本输入框不存在或非 HTMLInputElement 时跳过
    if (!(textField instanceof HTMLInputElement)) {
        return;
    }
    const newValue = textField.value;
    // 名称未变更时跳过
    if (newValue === oldValue) {
        return;
    }
    transaction(protyle, [{
        action: "updateAttrViewCol",
        id: colId, avID, name: newValue, type,
    }], [{
        action: "updateAttrViewCol",
        id: colId, avID, name: oldValue, type,
    }]);
    updateAttrViewColAnimation(protyle, avID, colId, {name: newValue});
};

/** @同步豁免: UI构建 — 菜单关闭时保存描述变更 */
const saveDescChange = (
    ctx: IShowColMenuContext, menu: Menu,
): void => {
    const {protyle, colId, avID, oldDesc} = ctx;
    const textarea = menu.element.querySelector("textarea");
    const newDesc = textarea?.value ?? "";
    // 描述未变更时跳过
    if (newDesc === oldDesc) {
        return;
    }
    transaction(protyle, [{
        action: "setAttrViewColDesc",
        id: colId, avID, data: newDesc,
    }], [{
        action: "setAttrViewColDesc",
        id: colId, avID, data: oldDesc,
    }]);
};

/** @同步豁免: UI构建 — 创建菜单关闭时的保存回调 */
export const buildMenuCloseCallback = (
    ctx: IShowColMenuContext, menu: Menu,
): (() => void) => {
    return () => {
        saveNameChange(ctx, menu);
        saveDescChange(ctx, menu);
        // https://github.com/siyuan-note/siyuan/issues/9862
        focusBlock(ctx.blockElement);
    };
};

/** 添加固定列/隐藏列菜单项，由 showColMenu 调用 @同步豁免: UI构建 */
export const addPinAndHideItems = (menu: Menu, ctx: IShowColMenuContext): void => {
    const {cellElement, protyle, colId, avID, blockID, blockElement, type} = ctx;
    const isPin = cellElement.dataset.pin === "true";
    menu.addItem({
        id: isPin ? "unfreezeCol" : "freezeCol",
        icon: isPin ? "iconUnpin" : "iconPin",
        label: isPin ? siyuanI18n.unfreezeCol : siyuanI18n.freezeCol,
        /** 切换列固定状态并同步表头动画，用户点击固定/取消固定菜单项时触发 */
        click() {
            transaction(protyle, [{
                action: "setAttrViewColPin",
                id: colId, avID, data: !isPin, blockID
            }], [{
                action: "setAttrViewColPin",
                id: colId, avID, data: isPin, blockID
            }]);
            const headerCell = blockElement.querySelector(`.av__row--header .av__cell[data-col-id="${colId}"]`);
            // 表头单元格存在时同步固定状态动画
            if (headerCell instanceof HTMLElement) {
                updateAttrViewCellAnimation(headerCell, undefined, {pin: !isPin});
            }
        }
    });
    // block 类型列是主键列，不允许隐藏
    if (type !== "block") {
        menu.addItem({
            id: "hide",
            icon: "iconEyeoff",
            label: siyuanI18n.hide,
            action: "iconEdit",
            /** 隐藏当前列，用户点击隐藏菜单项时触发 */
            click() {
                transaction(protyle, [{
                    action: "setAttrViewColHidden",
                    id: colId, avID, data: true, blockID
                }], [{
                    action: "setAttrViewColHidden",
                    id: colId, avID, data: false, blockID
                }]);
            },
            /** 绑定字段可见性快捷入口（openFieldVisibility），菜单项 DOM 渲染后执行 */
            bind(element) {
                const actionElement = element.querySelector(".b3-menu__action") as HTMLElement;
                actionElement.classList.add("ariaLabel");
                actionElement.setAttribute("data-position", "4west");
                actionElement.setAttribute("aria-label", window.siyuan.languages.fieldVisibility);
                actionElement.addEventListener("click", (event) => {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    openFieldVisibility({
                        protyle,
                        blockElement,
                        colId,
                        fieldType: type,
                    });
                });
            }
        });
    }
};

/** 添加同步列宽/换行开关菜单项，由 showColMenu 调用 @同步豁免: UI构建 */
export const addSyncAndWrapItems = (menu: Menu, ctx: IShowColMenuContext): void => {
    const {protyle, colId, avID, blockID, viewID, cellElement} = ctx;
    menu.addItem({
        icon: "iconRefresh",
        label: siyuanI18n.syncColWidth,
        /** 将当前列宽同步到同数据库的其他视图，用户点击同步列宽菜单项时触发 */
        click() {
            transaction(protyle, [{
                action: "syncAttrViewTableColWidth",
                keyID: colId, avID, id: viewID,
            }]);
        }
    });
    menu.addItem({
        icon: "iconSoftWrap",
        label: `<label class="fn__flex fn__pointer"><span>${siyuanI18n.wrap}</span><span class="fn__space fn__flex-1"></span>
<input type="checkbox" class="b3-switch b3-switch--menu"${cellElement.dataset.wrap === "true" ? " checked" : ""}></label>`,
        /** 绑定换行开关的 change 事件，Menu 渲染菜单项 DOM 后调用 */
        bind(element) {
            const wrapElement = element.querySelector(".b3-switch");
            if (!isHTMLInputElement(wrapElement)) {
                return;
            }
            // @内联回调 — 换行开关状态变更时提交事务并关闭菜单
            wrapElement.addEventListener("change", () => {
                cellElement.dataset.wrap = wrapElement.checked.toString();
                transaction(protyle, [{
                    action: "setAttrViewColWrap",
                    id: colId, avID, data: wrapElement.checked, blockID, viewID
                }], [{
                    action: "setAttrViewColWrap",
                    id: colId, avID, data: !wrapElement.checked, blockID, viewID
                }]);
                menu.close();
            });
        }
    });
};

/** 菜单关闭后 cellElement 可能被移除，需从 blockElement 重新查找并返回有效引用 */
const refreshCellElement = (cellElement: HTMLElement, blockElement: Element, colId: string): HTMLElement => {
    // 当前 cellElement 仍在 DOM 树中，直接返回
    if (blockElement.contains(cellElement)) {
        return cellElement;
    }
    const found = blockElement.querySelector(`.av__row--header .av__cell--header[data-col-id="${colId}"]`);
    // 查找到新的表头单元格时返回，否则回退到原引用
    return found instanceof HTMLElement ? found : cellElement;
};

/** 添加左侧/右侧插入列菜单项，由 showColMenu 调用 @同步豁免: UI构建 */
export const addInsertColumnItems = (menu: Menu, ctx: IShowColMenuContext): void => {
    const {protyle, blockElement, colId} = ctx;
    let {cellElement} = ctx;
    menu.addItem({
        id: "insertColumnLeft",
        icon: "iconInsertLeft",
        label: siyuanI18n.insertColumnLeft,
        /** 在当前列左侧插入新列，用户点击后弹出列类型选择菜单 */
        click() {
            const addMenu = addCol({
                protyle,
                blockElement,
                panel: avMenuPanel,
                previousID: cellElement.previousElementSibling?.getAttribute("data-col-id") || "",
            });
            cellElement = refreshCellElement(cellElement, blockElement, colId);
            const addRect = cellElement.getBoundingClientRect();
            addMenu.open({x: addRect.left, y: addRect.bottom, h: addRect.height});
        }
    });
    menu.addItem({
        id: "insertColumnRight",
        icon: "iconInsertRight",
        label: siyuanI18n.insertColumnRight,
        /** 在当前列右侧插入新列，用户点击后弹出列类型选择菜单 */
        click() {
            const addMenu = addCol({protyle, blockElement, panel: avMenuPanel, previousID: colId});
            cellElement = refreshCellElement(cellElement, blockElement, colId);
            const addRect = cellElement.getBoundingClientRect();
            addMenu.open({x: addRect.left, y: addRect.bottom, h: addRect.height});
        }
    });
};

/** 添加复制列/删除列菜单项（block 类型排除），由 showColMenu 调用 @同步豁免: UI构建 */
export const addDuplicateDeleteItems = (menu: Menu, ctx: IShowColMenuContext): void => {
    const {type, avID, blockElement, viewID, protyle, colId} = ctx;
    // block 类型是主键列，不允许复制或删除
    if (type === "block") {
        return;
    }
    // relation 类型不支持复制（关联关系不可简单复制）
    if (type !== "relation") {
        menu.addItem({
            id: "duplicate",
            icon: "iconCopy",
            label: siyuanI18n.duplicate,
            /** 复制当前列：获取最新 AV 数据后执行 duplicateCol，用户点击复制菜单项时触发 */
            click() {
                // @内联回调 — 获取最新 AV 数据后执行列复制
                fetchPost("/api/av/renderAttributeView", {
                    id: avID,
                }, (response) => {
                    duplicateCol({
                        blockElement, viewID, protyle, colId,
                        data: response.data,
                        panel: avMenuPanel,
                    });
                });
            }
        });
    }
    menu.addItem({
        id: "delete",
        icon: "iconTrashcan",
        label: siyuanI18n.delete,
        /** 删除当前列：关联列弹出确认对话框，其他列直接删除，用户点击删除菜单项时触发 */
        async click() {
            await handleDeleteColClick(ctx);
        }
    });
};
