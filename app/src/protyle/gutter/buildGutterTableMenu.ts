import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getEditorRange } from "../util/selection";
import { hasClosestByTag } from "../util/hasClosest";
import {tableMenu} from "../../menus/protyleMenus/tableMenu/tableMenu";
import { IMenu } from "../../menus/Menu";


/**
 * 构建表格块的Gutter右键菜单项
 *
 * 作用：为表格类型的块生成包含表格操作子菜单的菜单项数组
 * 意图：将表格菜单构建逻辑从主Gutter菜单中拆分出来，保持单一职责
 * 调用时机：在buildGutterMenu中检测到当前块为表格块时调用
 *
 * @param protyle 编辑器实例
 * @param nodeElement 表格块的DOM元素
 * @returns 表格相关的菜单项数组，如果无法定位单元格则返回空数组
 */
/** @同步豁免: UI构建 - 同步构建菜单DOM结构，无异步依赖 */
export const buildGutterTableMenu = (protyle: IProtyle, nodeElement: Element): IMenu[] => {
    let range = getEditorRange(nodeElement);
    const tableElement = nodeElement.querySelector("table");
    // 当前选区不在表格内时（如用户点击了表格外的gutter按钮），将选区重置到表头
    if (!tableElement.contains(range.startContainer)) {
        range = getEditorRange(tableElement.querySelector("th"));
    }
    const cellElement = hasClosestByTag(range.startContainer, "TD") ||
        hasClosestByTag(range.startContainer, "TH") || nodeElement.querySelector("th, td");
    // 成功定位到表格单元格时，构建表格操作子菜单
    if (cellElement && cellElement instanceof HTMLTableCellElement) {
        const tableMenuResult = tableMenu(protyle, nodeElement, cellElement, range);
        return [
            { id: "separator_table", type: "separator" },
            {
                id: "table",
                type: "submenu",
                icon: "iconTable",
                label: siyuanI18n.table,
                submenu: tableMenuResult.menus
            }
        ];
    }
    return [];
};
