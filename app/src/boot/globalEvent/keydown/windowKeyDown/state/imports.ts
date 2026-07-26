/**
 * 用途：集中转发窗口级键盘事件"状态收集阶段"所需的依赖与类型契约。
 * 使用范围：仅供 `windowKeyDown/state` 目录中的统一状态收集器复用。
 * 解耦评估：状态收集阶段现在收敛到单一目录，继续通过本文件集中导入环境、DOM 与类型依赖，能避免收集器文件直接散落父级路径。
 */

/** 用途：引入 AppFacade 类型用于 findPluginCommand 的 plugin 遍历类型约束。使用范围：仅 state/index.ts 中 findPluginCommand 参数标注。解耦评估：纯类型直接指向完整应用领域根。 */
import type {AppFacade} from "../../../../../app/AppFacade.types";
/** 用途：引入 Dialog 类型用于对话框查找返回值类型标注。使用范围：state/index.ts 中 findRecentDocsDialog 与 findSpecialDialog 的返回值类型标注。解耦评估：直接指向 Dialog class 创建/身份边界。 */
import {Dialog} from "../../../../../dialog";
/** 用途：引入 Constants 用于对话框 data-key 匹配（DIALOG_RECENTDOCS/DIALOG_VIEWCARDS/DIALOG_HISTORYCOMPARE）。使用范围：state/index.ts 中 findRecentDocsDialog 与 findSpecialDialog 的 key 比较。解耦评估：Constants 在 config 层集中定义，已在多处使用；无运行时状态依赖，继续经 barrel 转发。 */
import { Constants } from "../../../../../constants";
/** 用途：引入 getAllDocks 用于在状态收集阶段检测 dock 快捷键命中。使用范围：state/index.ts 中 findDockHotkeyType。解耦评估：getAllDocks 已在 layout 层定义为纯查询函数，不持有可变状态；继续经 barrel 转发即可，无需依赖注入。 */
import { getAllDocks } from "../../../../../layout/getAll";
/** 用途：引入 isElectron 用于在系统域事实收集中标识当前运行环境是否为桌面端。使用范围：state/index.ts 中 collectSystemFacts 的 isElectron 字段。解耦评估：isElectron 是 platform 模块的导出常量，在启动时确定且不会变化；继续经 barrel 转发即可。 */
import { isElectron } from "../../../../../platform";
/** 用途：引入 hasClosestByClassName 用于 DOM 树向上遍历检测目标元素是否在 PDF/搜索区域内。使用范围：state/index.ts 中 collectSystemFacts 的 targetInPdf 计算与 collectNavigationFacts 的 searchHotkey 计算。解耦评估：工具函数，不持有状态，继续经 barrel 转发即可。 */
import { hasClosestByClassName } from "../../../../../protyle/util/hasClosest";
/** 用途：引入 isNotCtrl 用于判断键盘事件是否未按下 Ctrl/Meta 修饰键。使用范围：state/index.ts 中 collectDialogFacts 的 isArrowOrEnterWithoutModifiers 计算。解耦评估：纯事件属性检查函数，不持有状态，继续经 barrel 转发即可。 */
import { isNotCtrl } from "../../../../../protyle/util/compatibility";
/** 用途：引入 matchAuxiliaryHotKey 用于对话框快捷键的辅助匹配（区分主/辅热键）。使用范围：state/index.ts 中 findPressedDialogHotkey 的 aux 分支。解耦评估：纯匹配函数，不持有状态，继续经 barrel 转发即可。 */
import { matchAuxiliaryHotKey } from "../../../../../protyle/util/hotKey";
/** 用途：引入 matchHotKey 用于快捷键事件匹配（热键配置 → KeyboardEvent）。使用范围：state/index.ts 中 findDockHotkeyType、findPressedDialogHotkey、findPressedNavigationHotkey、collectSystemFacts 等多处。解耦评估：纯事件匹配函数，不持有状态；已在多处使用，继续经 barrel 转发。 */
import { matchHotKey } from "../../../../../protyle/util/hotKey";
/** 用途：引入 getSafeSiyuanConfig 用于安全读取 SiYuan 配置（含 keymap.general）。使用范围：state/index.ts 中 collectWindowKeyDownState 读取 generalKeymap 与 readonly 标志。解耦评估：getSafeSiyuanConfig 返回冻结快照，不持有可变引用；继续经 barrel 转发即可。 */
import { getSafeSiyuanConfig } from "../../../../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 用途：引入 getSiyuanDialogs 用于获取当前所有打开的对话框列表。使用范围：state/index.ts 中 findRecentDocsDialog 遍历对话框查找 recentDocs。解耦评估：环境查询函数，返回当前对话框快照，不持有可变状态；继续经 barrel 转发即可。 */
import { getSiyuanDialogs } from "../../../../../util/siyuanEnvironments/siyuanDialogs.environment";
/** 用途：引入 getSiyuanMenus 用于获取当前菜单实例以检测菜单可见性。使用范围：state/index.ts 中 collectUIFacts 的 menuVisible/menuHandledKey/targetInMenuTextInput 计算。解耦评估：环境查询函数，返回当前菜单快照，不持有可变状态；继续经 barrel 转发即可。 */
import { getSiyuanMenus } from "../../../../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 用途：引入 isWindow 用于判断当前编辑器是否处于独立窗口模式（通过检测 #toolbar 元素是否存在）。使用范围：仅在 state/index.ts 中 collectWindowKeyDownState 的 isTabWindow 字段计算。解耦评估：isWindow 通过 DOM 检测判断，属于运行时快照查询，无法通过依赖注入替代；当前调用点唯一，继续经 barrel 转发。 */
import { isWindow } from "../../../../../util/platform/functions";
/** 用途：引入 switchDialog 用于跨对话框切换逻辑的共享实例引用。使用范围：state/index.ts 中 collectDialogFacts 的 hasSwitchDialog/switchDialogMounted 计算以及 collectWindowKeyDownState 的 baseState。解耦评估：switchDialog 是 switchDialog.global 模块的模块级单例引用，切换逻辑集中在该模块；继续经 barrel 转发即可。 */
import { switchDialog } from "../switchDialog.global";
/** 用途：引入 PluginCommandMatch 类型用于插件命令匹配的返回类型标注。使用范围：仅 state/index.ts 中 findPluginCommand 的 satisfies 标注。解耦评估：纯类型依赖，不形成运行时耦合。 */
import type { PluginCommandMatch } from "../types";
/** 用途：引入 SpecialDialogType 类型用于特殊对话框类型的辨识联合标注。使用范围：仅 state/index.ts 中 resolveSpecialDialogType 的返回值类型标注。解耦评估：纯类型依赖，不形成运行时耦合。 */
import type { SpecialDialogType } from "../types";
/** 用途：引入 WindowKeyDownState 类型用于整个状态收集阶段的类型契约。使用范围：state/index.ts 中 collect/resolve 系列函数的 satisfies 类型标注。解耦评估：纯类型依赖，不形成运行时耦合。 */
import type { WindowKeyDownState as WindowKeyDownStateContract } from "../types";

/** 状态收集阶段绑定主应用与统一 Dialog 的具体身份。 */
type WindowKeyDownState = WindowKeyDownStateContract<AppFacade, Dialog>;

// 导出：Dialog 类型
export { Dialog };
// 导出：Constants 常量
export { Constants };
// 导出：getAllDocks
export { getAllDocks };
// 导出：getSafeSiyuanConfig
export { getSafeSiyuanConfig };
// 导出：getSiyuanDialogs
export { getSiyuanDialogs };
// 导出：getSiyuanMenus
export { getSiyuanMenus };
// 导出：hasClosestByClassName
export { hasClosestByClassName };
// 导出：isElectron
export { isElectron };
// 导出：isNotCtrl
export { isNotCtrl };
// 导出：isWindow
export { isWindow };
// 导出：matchAuxiliaryHotKey
export { matchAuxiliaryHotKey };
// 导出：matchHotKey
export { matchHotKey };
// 导出：switchDialog
export { switchDialog };
// 导出：PluginCommandMatch 类型
export type { PluginCommandMatch };
// 导出：SpecialDialogType 类型
export type { SpecialDialogType };
// 导出：WindowKeyDownState 类型
export type { WindowKeyDownState };
