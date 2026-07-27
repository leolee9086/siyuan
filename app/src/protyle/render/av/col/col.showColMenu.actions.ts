import {Menu} from "../../../../plugin/Menu";
import {transaction} from "../../../wysiwyg/transaction/submit";
import {fetchPost} from "../../../../util/network/fetch";
import {updateAttrViewCellAnimation} from "../action/animation";
import {handleFilterClick, handleSortClick, handleDeleteColClick} from "./col.showColMenu";
import {addCol} from "./add/menu.factory";
import {avMenuPanel} from "./imports";
import {duplicateCol} from "./col.operations";
import {siyuanI18n} from "../../../../util/siyuanEnvironments/i18n.getI18n.environment";
import type {IShowColMenuContext} from "./col.showColMenu.types";

/**
 * 为列菜单添加所有动作菜单项（筛选/排序/固定/隐藏/同步宽度/换行/插入列/复制/删除）。
 *
 * 作用：将 showColMenu 中 separator_1 之后的所有菜单项构建逻辑集中管理
 * 意图：从 showColMenu 提取辅助逻辑，降低主文件行数
 * 调用时机：showColMenu 构建菜单时，在添加表头项和编辑项之后调用
 */
/** @同步豁免: UI构建 — 同步构建菜单项，无异步数据源 */
export const addShowColMenuActionItems = (
    menu: Menu,
    ctx: IShowColMenuContext,
    cellElement: HTMLElement,
): void => {
    const {type} = ctx;
    // 行号类型不参与筛选和排序
    if (type !== "lineNumber") {
        addFilterSortItems(menu, ctx);
    }
    addPinAndVisibilityItems(menu, ctx, cellElement);
    addSyncAndWrapItems(menu, ctx, cellElement);
    menu.addSeparator({ id: "separator_2" });
    addInsertColumnItems(menu, ctx, cellElement);
    // block 类型列不支持复制和删除（block 列是必须存在的主键列）
    if (type !== "block") {
        addDuplicateAndDeleteItems(menu, ctx);
    }
};

/**
 * 添加筛选和排序菜单项（筛选/升序/降序）。
 *
 * 作用：为列菜单添加筛选和排序相关的三个菜单项
 * 意图：从 addShowColMenuActionItems 提取，避免主函数过长
 * 调用时机：showColMenu 构建菜单时，行号类型以外的列调用
 */
/** @同步豁免: UI构建 — 同步构建菜单项 */
const addFilterSortItems = (menu: Menu, ctx: IShowColMenuContext): void => {
    menu.addItem({
        id: "filter",
        icon: "iconFilter",
        label: siyuanI18n.filter,
        /** 点击打开筛选面板 */
        click() {
            handleFilterClick(ctx);
        }
    });
    menu.addItem({
        id: "asc",
        icon: "iconUp",
        label: siyuanI18n.asc,
        /** 点击设置升序排序 */
        click() {
            handleSortClick(ctx, "ASC");
        }
    });
    menu.addItem({
        id: "desc",
        icon: "iconDown",
        label: siyuanI18n.desc,
        /** 点击设置降序排序 */
        click() {
            handleSortClick(ctx, "DESC");
        }
    });
};

/**
 * 添加固定列和隐藏列菜单项。
 *
 * 作用：为列菜单添加固定/取消固定和隐藏列的菜单项
 * 意图：从 showColMenu 提取列可见性相关的菜单项构建逻辑
 * 调用时机：addShowColMenuActionItems 中调用
 */
/** @同步豁免: UI构建 — 同步构建菜单项 */
const addPinAndVisibilityItems = (
    menu: Menu, ctx: IShowColMenuContext, cellElement: HTMLElement,
): void => {
    const {protyle, blockElement, type, colId, avID, blockID} = ctx;
    const isPin = cellElement.dataset.pin === "true";
    menu.addItem({
        id: isPin ? "unfreezeCol" : "freezeCol",
        icon: isPin ? "iconUnpin" : "iconPin",
        label: isPin ? siyuanI18n.unfreezeCol : siyuanI18n.freezeCol,
        /** 点击切换列的固定/取消固定状态 */
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
                updateAttrViewCellAnimation(headerCell, undefined, { pin: !isPin });
            }
        }
    });
    // block 类型列不支持隐藏（block 列是必须显示的主键列）
    if (type !== "block") {
        menu.addItem({
            id: "hide",
            icon: "iconEyeoff",
            label: siyuanI18n.hide,
            /** 点击隐藏当前列 */
            click() {
                transaction(protyle, [{
                    action: "setAttrViewColHidden",
                    id: colId, avID, data: true, blockID
                }], [{
                    action: "setAttrViewColHidden",
                    id: colId, avID, data: false, blockID
                }]);
            }
        });
    }
};

/**
 * 添加同步列宽和换行开关菜单项。
 *
 * 作用：为列菜单添加同步列宽度和换行开关两个菜单项
 * 意图：从 showColMenu 提取列显示属性相关的菜单项构建逻辑
 * 调用时机：addShowColMenuActionItems 中调用
 */
/** @同步豁免: UI构建 — 同步构建菜单项 */
const addSyncAndWrapItems = (
    menu: Menu, ctx: IShowColMenuContext, cellElement: HTMLElement,
): void => {
    const {protyle, colId, avID, blockID, viewID} = ctx;
    menu.addItem({
        icon: "iconRefresh",
        label: siyuanI18n.syncColWidth,
        /** 点击同步当前列宽度到所有视图 */
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
        /** 绑定换行开关的 change 事件 */
        bind(element) {
            const switchEl = element.querySelector(".b3-switch");
            // 开关元素必须存在且为 input（由 label HTML 生成）
            if (!(switchEl instanceof HTMLInputElement)) {
                return;
            }
            // @内联回调
            switchEl.addEventListener("change", () => {
                cellElement.dataset.wrap = switchEl.checked.toString();
                transaction(protyle, [{
                    action: "setAttrViewColWrap",
                    id: colId, avID,
                    data: switchEl.checked,
                    blockID, viewID
                }], [{
                    action: "setAttrViewColWrap",
                    id: colId, avID,
                    data: !switchEl.checked,
                    blockID, viewID
                }]);
                menu.close();
            });
        }
    });
};

/**
 * 添加左右插入列菜单项。
 *
 * 作用：为列菜单添加在当前列左侧/右侧插入新列的菜单项
 * 意图：从 showColMenu 提取插入列相关的菜单项构建逻辑
 * 调用时机：addShowColMenuActionItems 中调用
 */
/** @同步豁免: UI构建 — 同步构建菜单项 */
const addInsertColumnItems = (
    menu: Menu, ctx: IShowColMenuContext, cellElement: HTMLElement,
): void => {
    const {protyle, blockElement, colId} = ctx;
    menu.addItem({
        id: "insertColumnLeft",
        icon: "iconInsertLeft",
        label: siyuanI18n.insertColumnLeft,
        /** 点击在当前列左侧插入新列 */
        click() {
            const addMenu = addCol({
                protyle,
                blockElement,
                panel: avMenuPanel,
                previousID: cellElement.previousElementSibling?.getAttribute("data-col-id") || "",
            });
            // 插入列操作可能触发 DOM 重建，原 cellElement 可能已脱离文档树
            const targetCell = blockElement.contains(cellElement)
                ? cellElement
                : blockElement.querySelector(`.av__row--header .av__cell--header[data-col-id="${colId}"]`) ?? cellElement;
            const addRect = targetCell.getBoundingClientRect();
            addMenu.open({ x: addRect.left, y: addRect.bottom, h: addRect.height });
        }
    });
    menu.addItem({
        id: "insertColumnRight",
        icon: "iconInsertRight",
        label: siyuanI18n.insertColumnRight,
        /** 点击在当前列右侧插入新列 */
        click() {
            const addMenu = addCol({protyle, blockElement, panel: avMenuPanel, previousID: colId});
            // 插入列操作可能触发 DOM 重建，原 cellElement 可能已脱离文档树
            const targetCell = blockElement.contains(cellElement)
                ? cellElement
                : blockElement.querySelector(`.av__row--header .av__cell--header[data-col-id="${colId}"]`) ?? cellElement;
            const addRect = targetCell.getBoundingClientRect();
            addMenu.open({ x: addRect.left, y: addRect.bottom, h: addRect.height });
        }
    });
};

/**
 * 添加复制列和删除列菜单项。
 *
 * 作用：为列菜单添加复制和删除列的菜单项
 * 意图：从 showColMenu 提取列操作相关的菜单项构建逻辑
 * 调用时机：addShowColMenuActionItems 中，非 block 类型列调用
 */
/** @同步豁免: UI构建 — 同步构建菜单项 */
const addDuplicateAndDeleteItems = (
    menu: Menu, ctx: IShowColMenuContext,
): void => {
    const {protyle, blockElement, type, colId, avID, viewID} = ctx;
    // relation 类型列不支持复制（关联关系不可简单复制）
    if (type !== "relation") {
        menu.addItem({
            id: "duplicate",
            icon: "iconCopy",
            label: siyuanI18n.duplicate,
            /** 点击复制当前列 */
            click() {
                // @内联回调
                fetchPost("/api/av/renderAttributeView", {
                    id: avID,
                }, (response) => {
                    duplicateCol({
                        blockElement,
                        viewID,
                        protyle,
                        colId,
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
        /** 点击删除当前列（关联列会弹出确认对话框） */
        async click() {
            await handleDeleteColClick(ctx);
        }
    });
};
