/** 用途：创建列头 Menu；使用范围：showColMenu；解耦评估：经本域网关直达 Menu class 创建边界。 */
import {Menu} from "./imports";
/** 用途：读取 AV 菜单协议常量；使用范围：菜单身份与 view 属性；解耦评估：经本域网关直达常量所有者。 */
import {Constants} from "./imports";
/** 用途：读取列菜单文案；使用范围：编辑、筛选和排序项；解耦评估：经本域网关直达 i18n 环境。 */
import {siyuanI18n} from "./imports";
/** 用途：打开列编辑 Panel；使用范围：编辑项导航；解耦评估：经本域网关直达 Panel 唯一实现。 */
import {openMenuPanel} from "./imports";
/** 用途：绑定列头事件；使用范围：菜单表头项；解耦评估：经本域网关直达既有唯一实现。 */
import {bindColHeaderEvents} from "./imports";
/** 用途：构建列头标签；使用范围：菜单表头项；解耦评估：经本域网关直达既有唯一实现。 */
import {buildColHeaderLabel} from "./imports";
/** 用途：打开筛选值菜单；使用范围：筛选项；解耦评估：经本域网关直达既有唯一实现。 */
import {handleFilterClick} from "./imports";
/** 用途：提交排序；使用范围：升降序项；解耦评估：经本域网关直达既有唯一实现。 */
import {handleSortClick} from "./imports";
/** 用途：约束列菜单完整上下文；使用范围：所有内部构建步骤；解耦评估：纯类型依赖同一列菜单领域声明。 */
import type {IShowColMenuContext} from "./imports";
/** 用途：添加复制删除项；使用范围：列操作区；解耦评估：经本域网关直达唯一实现。 */
import {addDuplicateDeleteItems} from "./imports";
/** 用途：添加插入项；使用范围：列操作区；解耦评估：经本域网关直达唯一实现。 */
import {addInsertColumnItems} from "./imports";
/** 用途：添加固定隐藏项；使用范围：列属性区；解耦评估：经本域网关直达唯一实现。 */
import {addPinAndHideItems} from "./imports";
/** 用途：添加同步换行项；使用范围：列属性区；解耦评估：经本域网关直达唯一实现。 */
import {addSyncAndWrapItems} from "./imports";
/** 用途：保存菜单关闭时的名称描述；使用范围：Menu closeCB；解耦评估：经本域网关直达唯一实现。 */
import {buildMenuCloseCallback} from "./imports";
/** 用途：收窄列类型协议；使用范围：上下文构造；解耦评估：经本域网关直达列类型守卫。 */
import {toTAVCol} from "./imports";

/** 从列头 DOM 构造菜单协作者共用的完整上下文。 */
const createShowColMenuContext = (protyle: IProtyle, blockElement: Element, cellElement: HTMLElement) => {
    const type = toTAVCol(cellElement.getAttribute("data-dtype"));
    const colId = cellElement.getAttribute("data-col-id");
    const avID = blockElement.getAttribute("data-av-id");
    const blockID = blockElement.getAttribute("data-node-id");
    const viewID = blockElement.getAttribute(Constants.CUSTOM_SY_AV_VIEW);
    const cellTextElement = cellElement.querySelector(".av__celltext");
    if (!cellTextElement) {
        throw new Error("AV column menu expected the header text element");
    }
    const oldValue = cellTextElement.textContent.trim();
    const oldDesc = cellElement.dataset.desc;
    return {protyle, blockElement, cellElement, type, colId, avID, blockID, viewID, oldValue, oldDesc} satisfies IShowColMenuContext;
};

/** 添加列身份和编辑导航菜单项。 */
const addColumnHeaderItems = (menu: Menu, ctx: IShowColMenuContext) => {
    // @内联回调 — 菜单关闭时保存名称和描述变更（forward reference 安全：回调仅存储不在构造期调用）
    menu.addItem({
        iconHTML: "",
        type: "empty",
        label: buildColHeaderLabel(ctx),
        /** 菜单项挂载时绑定列图标、名称和描述事件；行为继续由既有辅助实现唯一拥有。 */
        bind(element) {
            bindColHeaderEvents(element, menu, ctx);
        }
    });
    menu.addItem({
        id: "edit",
        icon: "iconEdit",
        label: siyuanI18n.edit,
        /** 点击编辑时保留当前名称并导航到同一 Panel 编辑入口。 */
        click() {
            const currentNameElement = menu.element.querySelector(".b3-text-field");
            if (!(currentNameElement instanceof HTMLInputElement)) {
                throw new Error("AV column menu expected the current name input");
            }
            const colName = currentNameElement.value;
            openMenuPanel({
                protyle: ctx.protyle,
                blockElement: ctx.blockElement,
                type: "edit",
                colId: ctx.colId,
                /** Panel 挂载完成后恢复菜单中的当前名称并聚焦输入框。 */
                cb(avElement) {
                    const editNameElement = avElement.querySelector('.b3-text-field[data-type="name"]');
                    if (!(editNameElement instanceof HTMLInputElement)) {
                        throw new Error("AV column edit panel expected the name input");
                    }
                    editNameElement.value = colName;
                    editNameElement.select();
                }
            });
        }
    });
    menu.addSeparator({id: "separator_1"});
};

/** 添加当前列的筛选和排序入口。 */
const addFilterAndSortItems = (menu: Menu, ctx: IShowColMenuContext) => {
    // 行号是派生只读列，不参与筛选或排序协议。
    if (ctx.type !== "lineNumber") {
        menu.addItem({
            id: "filter",
            icon: "iconFilter",
            label: siyuanI18n.filter,
            /** 打开当前列的筛选值菜单。 */
            click() {
                handleFilterClick(ctx);
            }
        });
        menu.addItem({
            id: "asc",
            icon: "iconUp",
            label: siyuanI18n.asc,
            /** 将当前列设置为升序排序。 */
            click() {
                handleSortClick(ctx, "ASC");
            }
        });
        menu.addItem({
            id: "desc",
            icon: "iconDown",
            label: siyuanI18n.desc,
            /** 将当前列设置为降序排序。 */
            click() {
                handleSortClick(ctx, "DESC");
            }
        });
    }
};

/** 添加列属性、插入和删除操作。 */
const addColumnOperationItems = (menu: Menu, ctx: IShowColMenuContext) => {
    addPinAndHideItems(menu, ctx);
    addSyncAndWrapItems(menu, ctx);
    menu.addSeparator({id: "separator_2"});
    addInsertColumnItems(menu, ctx);
    addDuplicateDeleteItems(menu, ctx);
};

/** 定位列菜单并聚焦名称输入框。 */
const openAndFocusColumnMenu = (menu: Menu, cellElement: HTMLElement) => {
    const cellRect = cellElement.getBoundingClientRect();
    menu.open({
        x: cellRect.left,
        y: cellRect.bottom,
        h: cellRect.height,
    });
    const inputElement = window.siyuan.menus.menu.element.querySelector(".b3-text-field");
    // 列头菜单包含名称输入框时立即选择并聚焦，保留原键盘编辑体验。
    if (inputElement instanceof HTMLInputElement) {
        inputElement.select();
        inputElement.focus();
    }
};

/** 构建并打开列头菜单，列编辑导航由该菜单组合根交给 Panel。 */
/** @同步豁免: UI构建 — Menu 必须在当前点击事件栈内完成创建、定位和聚焦。 */
export const showColMenu = (protyle: IProtyle, blockElement: Element, cellElement: HTMLElement) => {
    const ctx = createShowColMenuContext(protyle, blockElement, cellElement);
    const menu = new Menu(Constants.MENU_AV_HEADER_CELL, () => {
        buildMenuCloseCallback(ctx, menu)();
    });
    addColumnHeaderItems(menu, ctx);
    addFilterAndSortItems(menu, ctx);
    addColumnOperationItems(menu, ctx);
    openAndFocusColumnMenu(menu, cellElement);
};
