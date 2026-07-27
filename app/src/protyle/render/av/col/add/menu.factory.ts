/** 用途：提交封闭的添加列事务；使用范围：列类型菜单点击；解耦评估：经本子域网关直达严格命令，不加载通用事务主图。 */
import {submitAVColumnStructureTransaction} from "./imports";
/** 用途：生成块更新时间；使用范围：列类型菜单点击；解耦评估：纯时间依赖由子域网关显式登记，无需参数化。 */
import {dayjs} from "./imports";
/** 用途：读取列类型名称；使用范围：菜单标签与新列名称；解耦评估：运行时语言必须在点击前读取，经只读环境唯一实现提供。 */
import {siyuanI18n} from "./imports";
/** 用途：创建添加列菜单；使用范围：公开 addCol 工厂；解耦评估：具体 Menu 只存在于 UI 装配工厂，不向呈现域泄漏。 */
import {Menu} from "./imports";
/** 用途：提供添加列菜单的稳定身份；使用范围：公开 addCol 工厂；解耦评估：常量是不可变协议身份，应直达唯一所有者。 */
import {Constants} from "./imports";
/** 用途：执行添加列后的唯一 DOM 呈现流程；使用范围：列类型菜单点击；解耦评估：菜单工厂只调用呈现领域公开函数，不复制其 DOM 与导航逻辑。 */
import {addAttrViewColAnimation} from "./presentation";
/** 用途：约束菜单构建所需的完整上下文；使用范围：添加列菜单项内部；解耦评估：数据契约与实现分离，避免加载具体 Panel 实现。 */
import type {AddColumnMenuContext} from "./types";
/** 用途：约束添加列工厂的公开参数；使用范围：所有添加列入口；解耦评估：其中 Panel 使用完整领域外观并由调用方参数化传入。 */
import type {AddColumnMenuOptions} from "./types";

/** 按既有菜单顺序逐项产生列类型元数据，不保存跨实例状态。 */
const iterateColumnTypeDefinitions = function* () {
    yield {menuId: "text", icon: "iconAlignLeft", i18nKey: "text", colType: "text"} as const;
    yield {menuId: "number", icon: "iconNumber", i18nKey: "number", colType: "number"} as const;
    yield {menuId: "select", icon: "iconListItem", i18nKey: "select", colType: "select"} as const;
    yield {menuId: "multiSelect", icon: "iconList", i18nKey: "multiSelect", colType: "mSelect"} as const;
    yield {menuId: "date", icon: "iconCalendar", i18nKey: "date", colType: "date"} as const;
    yield {menuId: "assets", icon: "iconImage", i18nKey: "assets", colType: "mAsset"} as const;
    yield {menuId: "checkbox", icon: "iconCheck", i18nKey: "checkbox", colType: "checkbox"} as const;
    yield {menuId: "link", icon: "iconLink", i18nKey: "link", colType: "url"} as const;
    yield {menuId: "email", icon: "iconEmail", i18nKey: "email", colType: "email"} as const;
    yield {menuId: "phone", icon: "iconPhone", i18nKey: "phone", colType: "phone"} as const;
    yield {menuId: "template", icon: "iconMath", i18nKey: "template", colType: "template"} as const;
    yield {menuId: "relation", icon: "iconOpen", i18nKey: "relation", colType: "relation"} as const;
    yield {menuId: "rollup", icon: "iconSearch", i18nKey: "rollup", colType: "rollup"} as const;
    yield {menuId: "lineNumber", icon: "iconOrderedList", i18nKey: "lineNumber", colType: "lineNumber"} as const;
    yield {menuId: "createdTime", icon: "iconClock", i18nKey: "createdTime", colType: "created"} as const;
    yield {menuId: "updatedTime", icon: "iconClock", i18nKey: "updatedTime", colType: "updated"} as const;
};

/** 读取添加列协议要求的 DOM 身份；缺失时显式终止，避免向内核提交无身份事务。 */
const getRequiredAttribute = (element: Element, name: string) => {
    const value = element.getAttribute(name);
    if (value === null) {
        throw new Error(`Cannot add AV column without ${name}`);
    }
    return value;
};

/**
 * 为添加列菜单填充所有列类型选项。
 *
 * 作用：将15种列类型以数据驱动方式添加到菜单中，消除原始 addCol 中的重复代码。
 * 意图：每种列类型的 menu.addItem 结构完全一致（transaction + animation），
 *       仅 menuId/icon/label/colType 不同，因此提取为数据驱动的循环。
 * 调用时机：由 col.ts 中的 addCol 函数调用，在创建 Menu 实例后立即使用。
 *
 * @param menu - Menu 实例，用于添加菜单项
 * @param ctx - 添加列所需的上下文信息（protyle、blockElement、avID 等）
 */
/** @同步豁免: UI构建 */
export const addColMenuItems = (menu: Menu, ctx: AddColumnMenuContext) => {
    for (const {menuId, icon, i18nKey, colType} of iterateColumnTypeDefinitions()) {
        const label = String(siyuanI18n[i18nKey]);
        menu.addItem({
            id: menuId,
            icon,
            label,
            /** 点击菜单项时执行：创建新列并播放添加动画 */
            click() {
                const id = Lute.NewNodeID();
                const newUpdated = dayjs().format("YYYYMMDDHHmmss");
                submitAVColumnStructureTransaction(ctx.protyle, [{
                    action: "addAttrViewCol",
                    name: label,
                    avID: ctx.avID,
                    type: colType,
                    id,
                    previousID: ctx.previousID
                }, {
                    action: "doUpdateUpdated",
                    id: ctx.blockId,
                    data: newUpdated,
                }], [{
                    action: "removeAttrViewCol",
                    id,
                    avID: ctx.avID,
                }, {
                    action: "doUpdateUpdated",
                    id: ctx.blockId,
                    data: ctx.blockElement.getAttribute("updated")
                }]);
                addAttrViewColAnimation({
                    blockElement: ctx.blockElement,
                    protyle: ctx.protyle,
                    panel: ctx.panel,
                    type: colType,
                    name: label,
                    id,
                    previousID: ctx.previousID
                });
                ctx.blockElement.setAttribute("updated", newUpdated);
            }
        });
    }
};

/**
 * 创建"添加列"菜单并填充所有列类型选项。
 *
 * 作用：构建包含所有可用列类型的 Menu 实例
 * 意图：将菜单创建与菜单项填充集中在同一模块，避免 col.ts 膨胀
 * 调用时机：表头右键菜单"插入列"、属性面板"添加列"按钮等场景
 *
 * @param protyle - 编辑器实例
 * @param blockElement - 数据视图所在的块元素
 * @param previousID - 新列插入位置的前一列 ID（undefined 时插入到末尾）
 * @returns 已填充菜单项的 Menu 实例
 */
/** @同步豁免: UI构建 — 同步构建菜单实例供调用方立即 open */
export const addCol = ({protyle, blockElement, previousID, panel}: AddColumnMenuOptions) => {
    const avID = getRequiredAttribute(blockElement, "data-av-id");
    const blockId = getRequiredAttribute(blockElement, "data-node-id");
    const menu = new Menu(Constants.MENU_AV_HEADER_ADD);
    // table 视图未指定 previousID 时默认插入到最后一列之后
    if (typeof previousID === "undefined" && blockElement.getAttribute("data-av-type") === "table") {
        previousID = Array.from(blockElement.querySelectorAll(".av__row--header .av__cell")).pop()?.getAttribute("data-col-id") ?? undefined;
    }
    addColMenuItems(menu, {protyle, blockElement, panel, avID, previousID, blockId});
    return menu;
};
