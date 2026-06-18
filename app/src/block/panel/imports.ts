/** 用途：Protyle 编辑器类。使用范围：panel 模块编辑器管理。解耦评估：通过父级 imports.ts 转发。 */
import { Protyle } from "../imports";
/** 导出 Protyle，供 panel 模块使用 */
export { Protyle };

/** 用途：生成唯一 ID。使用范围：panel 模块实例标识。解耦评估：通过父级 imports.ts 转发。 */
import { genUUID } from "../imports";
/** 导出 genUUID，供 panel 模块使用 */
export { genUUID };

/** 用途：隐藏编辑器工具栏元素。使用范围：panel 模块销毁清理。解耦评估：通过父级 imports.ts 转发。 */
import { hideElements } from "../imports";
/** 导出 hideElements，供 panel 模块使用 */
export { hideElements };

/** 用途：启用拖拽和调整大小。使用范围：panel 模块窗口交互。解耦评估：通过父级 imports.ts 转发。 */
import { moveResize } from "../imports";
/** 导出 moveResize，供 panel 模块使用 */
export { moveResize };

/** 用途：移动端判断。使用范围：panel 模块交互适配。解耦评估：通过父级 imports.ts 转发。 */
import { isMobile } from "../imports";
/** 导出 isMobile，供 panel 模块使用 */
export { isMobile };

/** 用途：App 应用实例类型。使用范围：panel 模块上下文。解耦评估：通过父级 imports.ts 转发。 */
import type { App } from "../imports";
/** 导出 App 类型，供 panel 模块使用 */
export type { App };

/** 用途：获取全局浮窗面板列表。使用范围：panel 模块层级管理。解耦评估：通过父级 imports.ts 转发。 */
import { getSiyuanBlockPanels } from "../imports";
/** 导出 getSiyuanBlockPanels，供 panel 模块使用 */
export { getSiyuanBlockPanels };

/** 用途：获取全局菜单实例。使用范围：panel 模块销毁清理。解耦评估：通过父级 imports.ts 转发。 */
import { getSiyuanMenus } from "../imports";
/** 导出 getSiyuanMenus，供 panel 模块使用 */
export { getSiyuanMenus };

/** 用途：递增并获取全局 z-index。使用范围：panel 模块层级提升。解耦评估：通过父级 imports.ts 转发。 */
import { incrementSiyuanZIndex } from "../imports";
/** 导出 incrementSiyuanZIndex，供 panel 模块使用 */
export { incrementSiyuanZIndex };

/** 用途：查找最近指定类名的祖先元素。使用范围：panel 模块 DOM 定位。解耦评估：通过父级 imports.ts 转发。 */
import { hasClosestByClassName } from "../imports";
/** 导出 hasClosestByClassName，供 panel 模块使用 */
export { hasClosestByClassName };

/** 用途：设置元素位置。使用范围：panel 模块浮窗定位。解耦评估：直接导入工具。 */
import { setPosition } from "../../util/DOM/setPosition";
/** 导出 setPosition，供 panel 模块使用 */
export { setPosition };

/** 用途：系统常量。使用范围：panel 模块配置。解耦评估：通过父级 imports.ts 转发。 */
import { Constants } from "../imports";
/** 导出 Constants，供 panel 模块使用 */
export { Constants };

/** 用途：更新快捷键提示。使用范围：panel 模块按钮提示。解耦评估：直接导入工具。 */
import { updateHotkeyAfterTip } from "../../protyle/util/compatibility";
/** 导出 updateHotkeyAfterTip，供 panel 模块使用 */
export { updateHotkeyAfterTip };

/** 用途：国际化文案。使用范围：panel 模块按钮文案。解耦评估：通过父级 imports.ts 转发。 */
import { siyuanI18n } from "../imports";
/** 导出 siyuanI18n，供 panel 模块使用 */
export { siyuanI18n };

/** 用途：获取 SiYuan 配置。使用范围：panel 模块配置读取。解耦评估：通过父级 imports.ts 转发。 */
import { getSiyuanConfig } from "../imports";
/** 导出 getSiyuanConfig，供 panel 模块使用 */
export { getSiyuanConfig };

/** 用途：获取窗口内高度。使用范围：panel 模块位置计算。解耦评估：直接导入环境工具。 */
import { getWindowInnerHeight } from "../../util/siyuanEnvironments/getWindowInnerHeight.environment";
/** 导出 getWindowInnerHeight，供 panel 模块使用 */
export { getWindowInnerHeight };

/** 用途：检查类名包含。使用范围：panel 模块 DOM 判断。解耦评估：直接导入工具。 */
import { checkClassListContain } from "../../util/DOM/helpers/fnClasses";
/** 导出 checkClassListContain，供 panel 模块使用 */
export { checkClassListContain };

/** 用途：Electron 环境判断。使用范围：panel 模块平台适配。解耦评估：通过父级 imports.ts 转发。 */
import { isElectron } from "../imports";
/** 导出 isElectron，供 panel 模块使用 */
export { isElectron };

/** 用途：在新窗口中打开块。使用范围：panel 模块新窗口操作。解耦评估：通过父级 imports.ts 转发。 */
import { openNewWindowById } from "../imports";
/** 导出 openNewWindowById，供 panel 模块使用 */
export { openNewWindowById };

/** 用途：通过 ID 打开文件。使用范围：panel 模块页签操作。解耦评估：通过父级 imports.ts 转发。 */
import { openFileById } from "../imports";
/** 导出 openFileById，供 panel 模块使用 */
export { openFileById };

/** 用途：检查折叠状态并执行回调。使用范围：panel 模块折叠判断。解耦评估：通过父级 imports.ts 转发。 */
import { checkFold } from "../imports";
/** 导出 checkFold，供 panel 模块使用 */
export { checkFold };

/** 用途：编辑器大小调整。使用范围：panel 模块内容区域重绘。解耦评估：直接导入工具。 */
import { resize } from "../../protyle/util/resize";
/** 导出 resize，供 panel 模块使用 */
export { resize };

/** 用途：HTMLElement 类型守卫。使用范围：panel 模块 DOM 类型安全。解耦评估：直接导入守卫。 */
import { isHTMLElement } from "../../util/DOM/element.guard";
/** 导出 isHTMLElement，供 panel 模块使用 */
export { isHTMLElement };

/** 用途：安全 setTimeout 和 clearTimeout。使用范围：panel 模块延迟操作。解耦评估：直接导入环境工具。 */
import { setTimeout, clearTimeout } from "../../util/siyuanEnvironments/windowTimer.environment";
/** 导出 setTimeout，供 panel 模块使用 */
export { setTimeout };
/** 导出 clearTimeout，供 panel 模块使用 */
export { clearTimeout };

/** 用途：网络请求（POST）。使用范围：panel 模块数据获取。解耦评估：直接导入工具。 */
import { fetchPost } from "../../util/network/fetch";
/** 导出 fetchPost，供 panel 模块使用 */
export { fetchPost };

/** 用途：提示消息。使用范围：panel 模块错误提示。解耦评估：直接导入工具。 */
import { showMessage } from "../../dialog/message";
/** 导出 showMessage，供 panel 模块使用 */
export { showMessage };
