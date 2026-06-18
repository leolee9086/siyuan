// 跨目录依赖转发
/** 用途：全局菜单实例。使用范围：menus 模块管理菜单。解耦评估：通过 imports.ts 转发。 */
import { getSiyuanGlobalMenusMenu } from "../util/siyuanEnvironments/getMenu.environment";
/** 导出 getSiyuanGlobalMenusMenu，供 menus 模块使用 */
export { getSiyuanGlobalMenusMenu };

/** 用途：应用常量。使用范围：menus 模块菜单标识。解耦评估：通过 imports.ts 转发。 */
import { Constants } from "../constants";
/** 导出 Constants，供 menus 模块使用 */
export { Constants };

/** 用途：插件菜单类型。使用范围：menus 模块菜单构建。解耦评估：通过 imports.ts 转发。 */
import { Menu } from "../plugin/Menu";
/** 导出 Menu，供 menus 模块使用 */
export { Menu };

/** 用途：国际化文本。使用范围：menus 模块菜单文案。解耦评估：通过 imports.ts 转发。 */
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
/** 导出 siyuanI18n，供 menus 模块使用 */
export { siyuanI18n };

/** 用途：全局菜单容器。使用范围：menus 模块追加菜单项。解耦评估：通过 imports.ts 转发。 */
import { getSiyuanGlobalMenus } from "../util/siyuanEnvironments/getMenu.environment";
/** 导出 getSiyuanGlobalMenus，供 menus 模块使用 */
export { getSiyuanGlobalMenus };

/** 用途：打开块引用转移对话框。使用范围：menus 模块块操作。解耦评估：通过 imports.ts 转发。 */
import { openTransferBlockRefDialog } from "../dialog/openTransferBlockRefDialog";
/** 导出 openTransferBlockRefDialog，供 menus 模块使用 */
export { openTransferBlockRefDialog };
