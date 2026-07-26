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

/** 用途：HTMLInputElement 类型守卫。使用范围：菜单键盘导航识别输入框/开关。解耦评估：DOM 守卫为基础能力，经 imports 转发避免业务文件直连 util。 */
import { isHTMLInputElement } from "../util/DOM/element.guard";
/** 导出 isHTMLInputElement，供 menus 模块类型收窄 */
export { isHTMLInputElement };

/** 用途：获取兼容的点击事件名。使用范围：菜单回车激活菜单项时派发点击。解耦评估：兼容层封装平台差异，经 imports 转发统一入口。 */
import { getEventName } from "../util/platform/functions";
/** 导出 getEventName，供 menus 模块派发点击事件 */
export { getEventName };

/** 用途：Electron 输入框撤销/重做。使用范围：带菜单键盘映射的输入控件。解耦评估：编辑器平台能力经 imports 转发。 */
import { electronUndo } from "../protyle/undo";
/** 导出 electronUndo，供菜单键盘模块处理输入框快捷键。 */
export { electronUndo };

/** 用途：按 class 向上查找祖先。使用范围：菜单左键返回父级菜单项。解耦评估：DOM 查找工具职责清晰，经 imports 转发避免业务直连 protyle。 */
import { hasClosestByClassName } from "../protyle/util/hasClosest";
/** 导出 hasClosestByClassName，供 menus 模块祖先查找 */
export { hasClosestByClassName };

/** 用途：页签浮窗能力请求。使用范围：Dock 菜单把 Agent Tab 委托给宿主；解耦评估：菜单只发 Port 请求，不直接依赖 Dialog 或副本实现。 */
import { requestOpenTabAsDialog } from "../layout/tabFloat.port";
/** 导出 requestOpenTabAsDialog 供 Dock 菜单调用。 */
export { requestOpenTabAsDialog };
/** 用途：请求宿主将页签作为普通 Tab 打开。使用范围：Dock 菜单的 Agent Tab 动作；解耦评估：现有宿主 Port 是该行为的正式边界，菜单网关直接引用其唯一实现。 */
import { requestOpenTabAsTab } from "../layout/tabOpen.port";
/** 导出 requestOpenTabAsTab 供 Dock 菜单调用。 */
export { requestOpenTabAsTab };

/** 用途：页签运行时类型。使用范围：从 Dock 模型句柄确认可浮窗的 Tab；解耦评估：仅作句柄校验，不引入具体 Dock 模型。 */
import { Tab } from "../layout/Tab";
/** 导出 Tab 供 Dock 菜单进行句柄校验。 */
export { Tab };

/** 用途：在 Dock 布局树中按 ID 找回页签。使用范围：Dock 图标缺少模型缓存时的浮窗入口兜底。解耦评估：只提供布局查询，不把 Dialog 或副本工厂引入菜单。 */
import { getInstanceById } from "../layout/query/layoutInstance";
/** 导出 getInstanceById 供 Dock 菜单解析页签。 */
export { getInstanceById };

/** 用途：标签删除请求；使用范围：标签菜单；解耦评估：网络基础设施经菜单网关显式暴露。 */
import {fetchPost} from "../util/network/fetch";
/** 导出标签菜单使用的网络请求。 */
export {fetchPost};
/** 用途：标签删除确认；使用范围：标签菜单；解耦评估：Dialog 交互边界经菜单网关显式暴露。 */
import {confirmDialog} from "../dialog/confirmDialog";
/** 导出标签菜单使用的确认对话框。 */
export {confirmDialog};
/** 用途：标签名 HTML 转义；使用范围：标签删除文案；解耦评估：纯 DOM 安全工具。 */
import {escapeHtml} from "../util/DOM/escape";
/** 导出标签菜单使用的 HTML 转义。 */
export {escapeHtml};
/** 用途：统一标签重命名；使用范围：标签菜单；解耦评估：业务操作唯一实现经菜单网关暴露。 */
import {renameTag} from "../util/platform/noRelyPCFunction";
/** 导出标签菜单使用的重命名行为。 */
export {renameTag};
