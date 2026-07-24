/** 用途：全局菜单访问。使用范围：挂载插件子菜单。解耦评估：通过插件领域网关连接 App UI。 */
import {getSiyuanGlobalMenus} from "./imports";
/** 用途：菜单项构造器。使用范围：创建插件入口与分隔符。解耦评估：通过插件领域网关连接菜单实现。 */
import {MenuItem} from "./imports";
/** 用途：插件菜单文案。使用范围：显示插件入口。解耦评估：通过插件领域网关读取宿主语言。 */
import {siyuanI18n} from "./imports";
/** 用途：插件子菜单容器。使用范围：收集插件注册的菜单项。解耦评估：通过插件领域网关连接菜单实现。 */
import {subMenu} from "./imports";
/** 用途：插件运行时身份。使用范围：组合边界向当前插件集合广播菜单事件。解耦评估：菜单工厂依赖完整 Plugin 实现。 */
import type {Plugin} from "./imports";

/**
 * 触发插件菜单打开事件并构建插件子菜单
 *
 * 作用：向所有插件广播菜单打开事件，收集插件注册的菜单项，并将其添加到全局菜单中
 * 意图：为插件提供统一的菜单扩展机制，允许插件在各种上下文菜单中注入自定义菜单项
 * 调用时机：在需要显示可扩展菜单时调用（如编辑器右键菜单、块图标菜单等）
 *
 * @同步豁免: UI构建 - 菜单构建是同步的DOM操作，必须立即完成以保证用户交互响应
 */
export const emitOpenMenu = (options: {
    plugins: Plugin[],
    type: TEventBus,
    detail: {menu?: subMenu} & Record<string, unknown>,
    separatorPosition?: "top" | "bottom",
}) => {
    const pluginSubMenu = new subMenu();
    options.detail.menu = pluginSubMenu;

    for (const plugin of options.plugins) {
        plugin.eventBus.emit(options.type, options.detail);
    }

    // 有插件条目且调用方要求顶部分隔时，先隔开宿主原有菜单组。
    if (pluginSubMenu.menus.length > 0 && options.separatorPosition === "top") {
        getSiyuanGlobalMenus().menu.append(new MenuItem({id: "separator_pluginTop", type: "separator"}).element);
    }

    // 只有插件实际注册了条目时才挂载插件子菜单，避免出现空入口。
    if (pluginSubMenu.menus.length > 0) {
        getSiyuanGlobalMenus().menu.append(new MenuItem({
            id: "plugin",
            label: siyuanI18n.plugin,
            icon: "iconPlugin",
            type: "submenu",
            submenu: pluginSubMenu.menus,
        }).element);
    }

    // 有插件条目且调用方要求底部分隔时，隔开后续宿主营菜单组。
    if (pluginSubMenu.menus.length > 0 && options.separatorPosition === "bottom") {
        getSiyuanGlobalMenus().menu.append(new MenuItem({id: "separator_pluginBottom", type: "separator"}).element);
    }
};
