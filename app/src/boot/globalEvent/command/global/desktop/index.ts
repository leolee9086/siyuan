/** 用途：引入桌面 Dock 命令执行器。使用范围：桌面主路由的 Dock 分支。解耦评估：Dock 逻辑由 dock.ts 独立承接。 */
import { executeDesktopDockGlobalCommand } from "./dock";
/** 用途：引入桌面导航命令执行器。使用范围：桌面主路由的导航分支。解耦评估：搜索、菜单、历史和窗口命令由 navigation.ts 独立承接。 */
import { executeDesktopNavigationGlobalCommand } from "./navigation";
/** 用途：引入桌面标签命令执行器。使用范围：桌面主路由的标签切换分支。解耦评估：标签序号与最近编辑切换由 tabs.ts 独立承接。 */
import { executeDesktopTabGlobalCommand } from "./tabs";
/** 用途：引入桌面关闭命令执行器。使用范围：桌面主路由的关闭分支。解耦评估：关闭标签、Dock 和浮窗的兜底逻辑由 close.ts 独立承接。 */
import { executeDesktopCloseGlobalCommand } from "./close";
/** 用途：引入桌面拆分命令执行器。使用范围：桌面主路由的拆分分支。解耦评估：拆分、取消拆分和迁移窗口由 split.ts 独立承接。 */
import { executeDesktopSplitGlobalCommand } from "./split";
/** 用途：引入路由构建器。使用范围：声明桌面全局命令主路由。解耦评估：命令匹配集中在 CaliburRouter。 */
import { calibur } from "./imports";
/** 用途：引入 arktype 类型声明器。使用范围：声明桌面命令 split 条件。解耦评估：路由 schema 与执行逻辑分离。 */
import { type } from "./imports";
/** 用途：引入桌面命令常量。使用范围：桌面主路由 split 条件。解耦评估：集中命令契约。 */
import { DESKTOP_GLOBAL_COMMANDS } from "./imports";
/** 用途：引入全局命令上下文类型。使用范围：桌面主执行器签名。解耦评估：复用 global/types.ts 契约。 */
import type { GlobalCommandContext } from "./imports";
/** 用途：主应用宿主身份；使用范围：桌面命令根上下文绑定；解耦评估：具体类型只在实现模块使用。 */
import type { AppFacade } from "./imports";

/** 桌面命令主路由，将命令分派给职责子路由。 */
const desktopGlobalCommandRouter = calibur
    .universe(type({ command: "string" }))
    .split(type({ command: `'${DESKTOP_GLOBAL_COMMANDS.FILE_TREE}' | '${DESKTOP_GLOBAL_COMMANDS.OUTLINE}' | '${DESKTOP_GLOBAL_COMMANDS.BOOKMARK}' | '${DESKTOP_GLOBAL_COMMANDS.TAG}' | '${DESKTOP_GLOBAL_COMMANDS.INBOX}' | '${DESKTOP_GLOBAL_COMMANDS.BACKLINKS}' | '${DESKTOP_GLOBAL_COMMANDS.GRAPH_VIEW}' | '${DESKTOP_GLOBAL_COMMANDS.GLOBAL_GRAPH}'` }), () => executeDesktopDockGlobalCommand)
    .split(type({ command: `'${DESKTOP_GLOBAL_COMMANDS.CONFIG}' | '${DESKTOP_GLOBAL_COMMANDS.GLOBAL_SEARCH}' | '${DESKTOP_GLOBAL_COMMANDS.STICK_SEARCH}' | '${DESKTOP_GLOBAL_COMMANDS.GO_BACK}' | '${DESKTOP_GLOBAL_COMMANDS.GO_FORWARD}' | '${DESKTOP_GLOBAL_COMMANDS.MAIN_MENU}' | '${DESKTOP_GLOBAL_COMMANDS.RECENT_DOCS}' | '${DESKTOP_GLOBAL_COMMANDS.RECENT_CLOSED}' | '${DESKTOP_GLOBAL_COMMANDS.TOGGLE_DOCK}' | '${DESKTOP_GLOBAL_COMMANDS.SWITCH_LEFT_DOCK}' | '${DESKTOP_GLOBAL_COMMANDS.SWITCH_RIGHT_DOCK}' | '${DESKTOP_GLOBAL_COMMANDS.SWITCH_BOTTOM_DOCK}' | '${DESKTOP_GLOBAL_COMMANDS.TOGGLE_WIN}'` }), () => executeDesktopNavigationGlobalCommand)
    .split(type({ command: `'${DESKTOP_GLOBAL_COMMANDS.GO_TO_TAB_1}' | '${DESKTOP_GLOBAL_COMMANDS.GO_TO_TAB_2}' | '${DESKTOP_GLOBAL_COMMANDS.GO_TO_TAB_3}' | '${DESKTOP_GLOBAL_COMMANDS.GO_TO_TAB_4}' | '${DESKTOP_GLOBAL_COMMANDS.GO_TO_TAB_5}' | '${DESKTOP_GLOBAL_COMMANDS.GO_TO_TAB_6}' | '${DESKTOP_GLOBAL_COMMANDS.GO_TO_TAB_7}' | '${DESKTOP_GLOBAL_COMMANDS.GO_TO_TAB_8}' | '${DESKTOP_GLOBAL_COMMANDS.GO_TO_TAB_9}' | '${DESKTOP_GLOBAL_COMMANDS.GO_TO_TAB_NEXT}' | '${DESKTOP_GLOBAL_COMMANDS.GO_TO_TAB_PREV}' | '${DESKTOP_GLOBAL_COMMANDS.GO_TO_EDIT_TAB_NEXT}' | '${DESKTOP_GLOBAL_COMMANDS.GO_TO_EDIT_TAB_PREV}'` }), () => executeDesktopTabGlobalCommand)
    .split(type({ command: `'${DESKTOP_GLOBAL_COMMANDS.CLOSE_UNMODIFIED}' | '${DESKTOP_GLOBAL_COMMANDS.CLOSE_TAB}' | '${DESKTOP_GLOBAL_COMMANDS.CLOSE_OTHERS}' | '${DESKTOP_GLOBAL_COMMANDS.CLOSE_ALL}' | '${DESKTOP_GLOBAL_COMMANDS.CLOSE_LEFT}' | '${DESKTOP_GLOBAL_COMMANDS.CLOSE_RIGHT}'` }), () => executeDesktopCloseGlobalCommand)
    .remain(() => executeDesktopSplitGlobalCommand)
    .build();

/**
 * 执行桌面端全局命令。
 * @同步豁免: UI构建 - globalCommand 是同步入口，桌面命令需要立即操作布局、Dock 或发起既有回调式流程。
 */
export const executeDesktopGlobalCommand = (context: GlobalCommandContext<AppFacade>) => {
    const executor = desktopGlobalCommandRouter({ command: context.command });
    return executor(context);
};
