import { hasClosestByTag } from "../../protyle/util/hasClosest";
import { getSiyuanGlobalMenus } from "../../util/siyuanEnvironments/getMenu.environment";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { tableMenu } from "../protyle";
import { MenuItem } from "../Menu.Item";
import { isHTMLTableCellElement } from "../../util/DOM/element.guard";

/**
 * 添加表格相关菜单项
 *
 * 作用：当右键点击表格时，向上下文菜单中追加插入行列、删除行列以及更多操作等表格专属菜单项。
 * 意图：将表格菜单构建逻辑与内容菜单主流程分离，便于独立维护和测试。
 * 调用时机：用户对可编辑表格块右键时，由 `contentMenu` 在末尾调用。
 */
export const 添加表格菜单 = (detail: {
    protyle: IProtyle,
    range: Range,
    element: Element
}): void => {
    const { protyle, range, element: nodeElement } = detail;
    const tdElement = hasClosestByTag(range.startContainer, "TD");
    const thElement = hasClosestByTag(range.startContainer, "TH");
    const cellElement = tdElement || thElement;
    if (!isHTMLTableCellElement(cellElement)) {
        return;
    }
    const tableMenus = tableMenu(protyle, nodeElement, cellElement, range);
    // 有插入菜单项时，先加分隔符再追加
    if (tableMenus.insertMenus.length > 0) {
        getSiyuanGlobalMenus().menu.append(new MenuItem({
            id: "separator_1",
            type: "separator",
        }).element);
        for (const menuItem of tableMenus.insertMenus) {
            getSiyuanGlobalMenus().menu.append(new MenuItem(menuItem).element);
        }
    }
    // 有删除菜单项时，先加分隔符再追加
    if (tableMenus.removeMenus.length > 0) {
        getSiyuanGlobalMenus().menu.append(new MenuItem({
            id: "separator_2",
            type: "separator",
        }).element);
        for (const menuItem of tableMenus.removeMenus) {
            getSiyuanGlobalMenus().menu.append(new MenuItem(menuItem).element);
        }
    }
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "separator_3",
        type: "separator",
    }).element);
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "more",
        type: "submenu",
        icon: "iconMore",
        label: siyuanI18n.more,
        submenu: tableMenus.otherMenus.concat(tableMenus.other2Menus)
    }).element);
};
