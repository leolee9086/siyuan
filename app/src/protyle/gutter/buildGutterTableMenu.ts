import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getEditorRange } from "../util/selection";
import { hasClosestByTag } from "../util/hasClosest";
import { tableMenu } from "../../menus/protyle";
import { IMenu } from "../../menus/Menu";
import { IProtyle } from "../protyle";


export const buildGutterTableMenu = (protyle: IProtyle, nodeElement: Element): IMenu[] => {
    let range = getEditorRange(nodeElement);
    const tableElement = nodeElement.querySelector("table");
    if (!tableElement.contains(range.startContainer)) {
        range = getEditorRange(tableElement.querySelector("th"));
    }
    const cellElement = hasClosestByTag(range.startContainer, "TD") || hasClosestByTag(range.startContainer, "TH");
    if (cellElement) {
        return [
            { id: "separator_table", type: "separator" },
            {
                id: "table",
                type: "submenu",
                icon: "iconTable",
                label: siyuanI18n.table,
                submenu: tableMenu(protyle, nodeElement, cellElement as HTMLTableCellElement, range).menus as IMenu[]
            }
        ];
    }
    return [];
};
