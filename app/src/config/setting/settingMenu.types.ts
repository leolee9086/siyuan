import type {SettingTabId} from "./setting.types";

/** 设置菜单项的稳定 DOM 标识映射；不加载设置注册表，供菜单和插件组合根复用。 */
export const settingTabToMenuId = (tabId: SettingTabId | string) =>
    "menuConfig" + tabId[0].toUpperCase() + tabId.slice(1);
