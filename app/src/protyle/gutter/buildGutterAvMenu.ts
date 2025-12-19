/**
 * Gutter 块菜单 - 数据库视窗 菜单构建模块
 * 从 renderMenu 提取的菜单构建逻辑
 */

import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { fetchPost } from "../../util/fetch";
import { openByMobile } from "../util/compatibility";
import { useShell } from "../../util/pathName";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import * as path from "path";

/**
 * 构建 AV (Attribute View) 相关菜单
 */
export const buildGutterAvMenu = (protyle: IProtyle, nodeElement: Element, id: string): IMenu[] => {
    const menus: IMenu[] = [];

    menus.push({ id: "separator_exportCSV", type: "separator" });
    menus.push({
        id: "exportCSV",
        icon: "iconDatabase",
        label: siyuanI18n.export + " CSV",
        click() {
            fetchPost("/api/export/exportAttributeView", {
                id: nodeElement.getAttribute("data-av-id"),
                blockID: id,
            }, response => {
                openByMobile(response.data.zip);
            });
        }
    });

    menus.push({
        id: "showDatabaseInFolder",
        icon: "iconFolder",
        label: siyuanI18n.showInFolder,
        click() {
            const config = getSiyuanConfig();
            useShell("showItemInFolder", path.join(config.system.dataDir, "storage", "av", nodeElement.getAttribute("data-av-id") || "") + ".json");
        }
    });

    return menus;
};
