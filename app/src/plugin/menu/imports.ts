/** 用途：菜单项构造。使用范围：插件菜单工厂创建入口和分隔符。解耦评估：连接菜单运行时实现。 */
import {MenuItem} from "../../menus/Menu.Item";
/** 用途：子菜单容器。使用范围：收集插件注册的菜单项。解耦评估：连接菜单运行时实现。 */
import {subMenu} from "../../menus/Menu.subMenu";
/** 用途：宿主菜单状态。使用范围：把插件菜单挂载到当前菜单。解耦评估：读取稳定环境入口。 */
import {getSiyuanGlobalMenus} from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 用途：插件菜单国际化。使用范围：显示插件入口文案。解耦评估：读取稳定环境入口。 */
import {siyuanI18n} from "../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 用途：插件运行时身份。使用范围：菜单工厂向当前插件实例广播扩展事件。解耦评估：组合边界依赖完整 Plugin 实现。 */
import type {Plugin} from "../index";

/** 插件菜单项构造器。 */
export {MenuItem};
/** 插件子菜单容器。 */
export {subMenu};
/** 当前宿主菜单访问器。 */
export {getSiyuanGlobalMenus};
/** 插件菜单语言资源。 */
export {siyuanI18n};
/** 当前插件运行时身份。 */
export type {Plugin};
