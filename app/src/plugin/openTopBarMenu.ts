/**
 * @导入用途: 应用实例类型，用于打开插件菜单
 * @使用范围: openTopBarMenu 函数参数
 * @解耦评估: 通过参数传递，已解耦
 */
import type {AppFacade} from "../app/AppFacade.types";

/**
 * @导入用途: 菜单类，用于创建和操作菜单
 * @使用范围: openTopBarMenu 函数中创建菜单实例
 * @解耦评估: 核心依赖，无法解耦
 */
import {Menu} from "./Menu";

/**
 * @导入用途: 全局常量，用于菜单类型标识
 * @使用范围: 创建菜单时指定类型
 * @解耦评估: 常量依赖，无法解耦
 */
import {Constants} from "../constants";

/**
 * @导入用途: 移动端检测，用于判断是否显示管理入口
 * @使用范围: openTopBarMenu 函数中判断平台
 * @解耦评估: 通过 imports 转发
 */
import {isMobile} from "../util/platform/functions";

/**
 * @导入用途: 获取思源配置，用于读取只读模式等配置
 * @使用范围: openTopBarMenu 函数中判断配置
 * @解耦评估: 通过 imports 转发
 */
import {getSiyuanConfig} from "../util/siyuanEnvironments/getSiyuanConfig.environment";

/**
 * @导入用途: 获取思源语言包，用于多语言文本显示
 * @使用范围: openTopBarMenu 函数中获取文本
 * @解耦评估: 通过 imports 转发
 */
import {getSiyuanLanguages} from "../util/siyuanEnvironments/getSiyuanConfig.environment";

/**
 * @导入用途: 获取思源存储数据，用于读取用户偏好
 * @使用范围: openTopBarMenu 函数中读取固定状态
 * @解耦评估: 通过 imports 转发
 */
import {getSiyuanStorage} from "../util/siyuanEnvironments/getSiyuanConfig.environment";

/**
 * @导入用途: 辅助函数 - 添加管理菜单项
 * @使用范围: openTopBarMenu 函数中添加管理入口
 * @解耦评估: 已拆分为独立函数
 */
import {addManageMenuItem} from "./openTopBarMenu.helpers";

/**
 * @导入用途: 辅助函数 - 处理无插件情况
 * @使用范围: openTopBarMenu 函数中显示空状态
 * @解耦评估: 已拆分为独立函数
 */
import {handleEmptyPlugin} from "./openTopBarMenu.helpers";

/**
 * @导入用途: 辅助函数 - 在目标位置打开菜单
 * @使用范围: openTopBarMenu 函数中定位菜单
 * @解耦评估: 已拆分为独立函数
 */
import {openMenuAtTarget} from "./openTopBarMenu.helpers";

/**
 * @导入用途: 辅助函数 - 处理插件顶部栏图标
 * @使用范围: openTopBarMenu 函数中处理插件图标
 * @解耦评估: 已拆分为独立函数
 */
import {processPluginTopBarIcons} from "./openTopBarMenu.helpers";

/**
 * 打开顶部栏插件菜单
 *
 * 作用：显示所有插件的顶部栏图标和设置入口的菜单
 * 意图：提供统一的插件访问入口，特别是在移动端或图标被隐藏时
 * 调用时机：用户点击顶部栏的插件菜单按钮时
 */
/** @同步豁免: UI构建 */
/** @内联回调 */
export const openTopBarMenu = (app: AppFacade, target?: Element) => {
    const menu = new Menu(Constants.MENU_BAR_PLUGIN);
    const config = getSiyuanConfig();
    const languages = getSiyuanLanguages();
    const storage = getSiyuanStorage();
    
    if (!config || !languages || !storage) {
        return;
    }
    
    // 桌面端添加插件管理入口和分隔线
    if (!isMobile()) {
        addManageMenuItem(menu, app, languages, config);
    }
    
    let hasPlugin = false;
    // @内联回调
    for (const plugin of app.plugins) {
        // @ts-ignore
        const hasSetting = !!(plugin.setting || plugin.__proto__.hasOwnProperty("openSetting"));
        const hasTopBar = processPluginTopBarIcons(plugin, menu, target, languages, storage, hasSetting);
        
        // 插件没有顶部栏图标但有设置功能
        if (!hasTopBar && hasSetting) {
            hasPlugin = true;
            menu.addItem({
                id: plugin.name,
                icon: "iconSettings",
                label: plugin.displayName,
                /** @同步豁免: UI构建 */
                click() {
                    plugin.openSetting();
                }
            });
        }
        
        if (hasTopBar) {
            hasPlugin = true;
        }
    }
    
    if (!hasPlugin) {
        handleEmptyPlugin(menu, target, languages);
    }
    
    if (target) {
        openMenuAtTarget(menu, target);
        return;
    }
    
    menu.fullscreen();
};
