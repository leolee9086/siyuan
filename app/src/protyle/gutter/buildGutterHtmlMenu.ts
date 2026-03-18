/**
 * Gutter 块菜单 - HTML/音视频/嵌入 菜单构建模块
 * 从 renderMenu 提取的菜单构建逻辑
 */

import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { videoMenu } from "../../menus/protyleMenus/protyle.videoMenu";
import { iframeMenu } from "../../menus/protyleMenus/iframeMenu/iframeMenu";

/**
 * 构建 HTML/Media 相关菜单
 */
export const buildGutterMediaMenu = (protyle: IProtyle, nodeElement: Element, type: string): IMenu[] => {
    const menus: IMenu[] = [];

    if ((type === "NodeVideo" || type === "NodeAudio") && !protyle.disabled) {
        menus.push({ id: "separator_VideoOrAudio", type: "separator" });
        menus.push({
            id: type === "NodeVideo" ? "assetVideo" : "assetAudio",
            type: "submenu",
            icon: type === "NodeVideo" ? "iconVideo" : "iconRecord",
            label: siyuanI18n.assets,
            submenu: videoMenu(protyle, nodeElement, type)
        });
    } else if (type === "NodeIFrame" && !protyle.disabled) {
        menus.push({ id: "separator_IFrame", type: "separator" });
        menus.push({
            id: "assetIFrame",
            type: "submenu",
            icon: "iconLanguage",
            label: siyuanI18n.assets,
            submenu: iframeMenu(protyle, nodeElement)
        });
    } else if (type === "NodeHTMLBlock" && !protyle.disabled) {
        menus.push({ id: "separator_html", type: "separator" });
        menus.push({
            id: "html",
            icon: "iconHTML5",
            label: "HTML",
            click() {
                protyle.toolbar.showRender(protyle, nodeElement);
            }
        });
    }

    return menus;
};
