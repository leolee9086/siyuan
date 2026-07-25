/**
 * 用途：集中转发窗口级键盘事件“子集处理阶段”所需的执行器依赖、命令契约与 DSL。
 * 使用范围：仅供 `windowKeyDown/subset` 目录中的命令执行器与叶子辅助模块复用。
 * 解耦评估：子集处理阶段现在统一落在同一目录，本文件把跨领域执行依赖收敛到单点，避免执行文件重新散落父级路径。
 */

import { calibur } from "calibur-router";
import { type } from "arktype";
import { bindAVPanelKeydown } from "../imports";
import { bindMenuKeydown } from "../imports";
import { Dialog } from "../imports";
import { Constants } from "../../../../../constants";
import { openCard } from "../../../../../card/openCard";
import { openSetting } from "../../../../../config";
import { setReadOnly } from "../../../../../config/util/setReadOnly";
import { lockScreen } from "../../../../../dialog/processSystem/lockScreen";
import { Editor } from "../../../../../editor";
import type { Tab } from "../../../../../layout/Tab";
import { getAllDocks } from "../../../../../layout/getAll";
import { getAllModels } from "../../../../../layout/getAll";
import { getAllTabs } from "../../../../../layout/getAll";
import { toggleDockBar } from "../../../../../layout/dock/util";
import { getDockByType } from "../../../../../layout/tabUtil";
import { switchTabByIndex } from "../../../../../layout/tabUtil";
import { setZoom } from "../../../../../layout/topBar";
import { workspaceMenu } from "../../../../../menus/workspace";
import { unicode2Emoji } from "../../../../../emoji";
import { fullscreen } from "../../../../../protyle/breadcrumb/action";
import { hideElements } from "../../../../../protyle/ui/hideElements";
import { isMac } from "../../../../../protyle/util/compatibility";
import { updateHotkeyTip } from "../../../../../protyle/util/compatibility";
import { hasClosestBlock } from "../../../../../protyle/util/hasClosest";
import { hasClosestByClassName } from "../../../../../protyle/util/hasClosest";
import { focusBlock } from "../../../../../protyle/util/selection";
import { focusByRange } from "../../../../../protyle/util/selection";
import { goBack } from "../../../../../util/platform/backForward";
import { goForward } from "../../../../../util/platform/backForward";
import { escapeHtml } from "../../../../../util/DOM/escape";
import { newDailyNote } from "../../../../../util/file/mount";
import { newFile } from "../../../../../util/file/newFile";
import { getSiyuanBackStack } from "../../../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { getSiyuanBlockPanels } from "../../../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { getSiyuanConfig } from "../../../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { getSiyuanMenus } from "../../../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { getSiyuanStorage } from "../../../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { siyuanI18n } from "../../../../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanDialogs } from "../../../../../util/siyuanEnvironments/siyuanDialogs.environment";
import { openRecentDocs } from "../../../../../business/openRecentDocs";
import { historyKeydown } from "../../../../../history/keydown";
import { openHistory } from "../../../../../history/history";
import { syncGuide } from "../../../../../sync/syncGuide";
import { dialogArrow } from "../../dialogArrow";
import { execByCommand } from "../../../command/panel";
import { globalCommand } from "../../../command/global";
import { commandPanel } from "../../../command/panel";
import { cancelDrag } from "../../../dragover";
import { editKeydown } from "../../editKeydown";
import { fileTreeKeydown } from "../../fileTreeKeydown";
import { panelTreeKeydown } from "../../panelTreeKeydown";
import { switchDialogEvent } from "../../switchDialogEvent";
import { setSwitchDialog } from "../switchDialog.global";

/**
 * 用途：引入对话框、导航、系统、UI 四个子域的命令常量与衍生类型，用于在子集处理阶段根据路由结果选择对应执行器。
 * 使用范围：subset/ 目录下所有子集执行器共享使用。
 * 解耦评估：命令常量是执行器与路由层之间的共享契约，通过 type-only 和 value import 保持类型安全，
 * 未重复硬编码字符串值。当前子集处理阶段通过 calibur-router 的 command → executor 路由完成分发，
 * 不直接读写路由阶段的内部结构。
 */
import { DIALOG_WINDOW_KEY_COMMANDS, NAVIGATION_WINDOW_KEY_COMMANDS, SYSTEM_WINDOW_KEY_COMMANDS, UI_WINDOW_KEY_COMMANDS } from "../commands.types";
import type { DialogWindowKeyCommand, NavigationWindowKeyCommand, SystemWindowKeyCommand, UIWindowKeyCommand, WindowKeyDownExecutor as WindowKeyDownExecutorContract, WindowKeyDownResolvedCommands, WindowKeyDownRouteDomain } from "../commands.types";

/**
 * 用途：引入统一状态类型 [`WindowKeyDownState`]，供所有子集执行器签名使用。
 * 使用范围：subset/ 目录下所有执行器共享使用。
 * 解耦评估：纯类型依赖，仅用于执行器回调签名标注，不形成运行时耦合。
 */
import type {WindowKeyDownState as WindowKeyDownStateContract} from "../types";
import type { AppFacade } from "../imports";

/** 子集执行阶段绑定真实应用与 Dialog，并据此固定执行器签名。 */
type WindowKeyDownState = WindowKeyDownStateContract<AppFacade, Dialog>;
type WindowKeyDownExecutor = WindowKeyDownExecutorContract<WindowKeyDownState>;

export { bindAVPanelKeydown };
export { bindMenuKeydown };
export { calibur };
export { cancelDrag };
export { commandPanel };
export { Constants };
export { Dialog };
export { dialogArrow };
export { editKeydown };
export { Editor };
export { escapeHtml };
export { execByCommand };
export { fileTreeKeydown };
export { focusBlock };
export { focusByRange };
export { fullscreen };
export { getAllDocks };
export { getAllModels };
export { getAllTabs };
export { getDockByType };
export { getSiyuanBackStack };
export { getSiyuanBlockPanels };
export { getSiyuanConfig };
export { getSiyuanDialogs };
export { getSiyuanMenus };
export { getSiyuanStorage };
export { globalCommand };
export { goBack };
export { goForward };
export { hasClosestBlock };
export { hasClosestByClassName };
export { hideElements };
export { historyKeydown };
export { isMac };
export { lockScreen };
export { newDailyNote };
export { newFile };
export { openCard };
export { openHistory };
export { openRecentDocs };
export { openSetting };
export { panelTreeKeydown };
export { setReadOnly };
export { setSwitchDialog };
export { setZoom };
export { siyuanI18n };
export { switchDialogEvent };
export { switchTabByIndex };
export { syncGuide };
export { toggleDockBar };
export { type };
export { UI_WINDOW_KEY_COMMANDS };
export { unicode2Emoji };
export { updateHotkeyTip };
export { workspaceMenu };
export { DIALOG_WINDOW_KEY_COMMANDS };
export { NAVIGATION_WINDOW_KEY_COMMANDS };
export { SYSTEM_WINDOW_KEY_COMMANDS };
export type { DialogWindowKeyCommand };
export type { NavigationWindowKeyCommand };
export type { SystemWindowKeyCommand };
export type { Tab };
export type { UIWindowKeyCommand };
export type { WindowKeyDownExecutor };
export type { WindowKeyDownResolvedCommands };
export type { WindowKeyDownRouteDomain };
export type { WindowKeyDownState };
