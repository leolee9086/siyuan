/** 用途：全局菜单容器。使用范围：search 模块追加菜单项。解耦评估：通过 imports.ts 转发。 */
import { getSiyuanGlobalMenus } from "./imports";
/** 用途：国际化文本。使用范围：search 模块菜单文案。解耦评估：通过 imports.ts 转发。 */
import { siyuanI18n } from "./imports";
/** 用途：菜单项构造器。使用范围：search 模块构建菜单项。解耦评估：同目录组件，直接同层导入。 */
import { MenuItem } from "./Menu.Item";
/** 用途：复制子菜单。使用范围：search 模块菜单构建。解耦评估：同目录模块，直接同层导入。 */
import {copySubMenu} from "./commonMenuItem/copy/copySubMenu.factory";

/**
 * 初始化搜索菜单
 * @作用 为搜索结果条目添加复制子菜单
 * @调用时机 用户右键点击搜索结果时
 * @同步豁免: UI构建 — 菜单在同步调用栈中构建
 */
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
