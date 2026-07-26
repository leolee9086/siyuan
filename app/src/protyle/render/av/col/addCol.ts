import {transaction} from "../../../wysiwyg/transaction/submit";
import * as dayjs from "dayjs";
import { addAttrViewColAnimation } from "./col.addAttrViewColAnimation";
import { siyuanI18n } from "../../../../util/siyuanEnvironments/i18n.getI18n.environment";
import { Menu } from "../../../../plugin/Menu";
import { Constants } from "../../../../constants";
import type { IAddColContext } from "./col.addCol.types";

/**
 * Column type definitions: [menuId, icon, i18nKey, colType]
 * Order matches the original addCol menu item order.
 */
const COL_TYPE_DEFINITIONS: ReadonlyArray<readonly [string, string, keyof typeof siyuanI18n, TAVCol]> = [
    ["text", "iconAlignLeft", "text", "text"],
    ["number", "iconNumber", "number", "number"],
    ["select", "iconListItem", "select", "select"],
    ["multiSelect", "iconList", "multiSelect", "mSelect"],
    ["date", "iconCalendar", "date", "date"],
    ["assets", "iconImage", "assets", "mAsset"],
    ["checkbox", "iconCheck", "checkbox", "checkbox"],
    ["link", "iconLink", "link", "url"],
    ["email", "iconEmail", "email", "email"],
    ["phone", "iconPhone", "phone", "phone"],
    ["template", "iconMath", "template", "template"],
    ["relation", "iconOpen", "relation", "relation"],
    ["rollup", "iconSearch", "rollup", "rollup"],
    ["lineNumber", "iconOrderedList", "lineNumber", "lineNumber"],
    ["createdTime", "iconClock", "createdTime", "created"],
    ["updatedTime", "iconClock", "updatedTime", "updated"],
] as const;

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
export const addColMenuItems = (menu: Menu, ctx: IAddColContext) => {
    for (const [menuId, icon, i18nKey, colType] of COL_TYPE_DEFINITIONS) {
        const label = String(siyuanI18n[i18nKey]);
        menu.addItem({
            id: menuId,
            icon,
            label,
            /** 点击菜单项时执行：创建新列并播放添加动画 */
            click() {
                const id = Lute.NewNodeID();
                const newUpdated = dayjs().format("YYYYMMDDHHmmss");
                transaction(ctx.protyle, [{
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
export const addCol = (protyle: IProtyle, blockElement: Element, previousID?: string) => {
    const menu = new Menu(Constants.MENU_AV_HEADER_ADD);
    const avID = blockElement.getAttribute("data-av-id");
    // table 视图未指定 previousID 时默认插入到最后一列之后
    if (typeof previousID === "undefined" && blockElement.getAttribute("data-av-type") === "table") {
        previousID = Array.from(blockElement.querySelectorAll(".av__row--header .av__cell")).pop()?.getAttribute("data-col-id") ?? undefined;
    }
    const blockId = blockElement.getAttribute("data-node-id");
    addColMenuItems(menu, { protyle, blockElement, avID, previousID, blockId });
    return menu;
};
