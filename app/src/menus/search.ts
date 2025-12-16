import { getSiyuanGlobalMenus } from "../util/siyuanEnvironments/getMenu.environment";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import { MenuItem } from "./Menu.Item";
import { copySubMenu } from "./commonMenuItem";

export const initSearchMenu = (id: string) => {
    getSiyuanGlobalMenus().menu.remove();
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "copy",
        icon: "iconCopy",
        label: siyuanI18n.copy,
        type: "submenu",
        submenu: copySubMenu([id])
    }).element);
    return getSiyuanGlobalMenus().menu;
};
