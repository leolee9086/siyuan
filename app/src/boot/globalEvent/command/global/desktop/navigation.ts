/** 用途：引入全局常量。使用范围：搜索热键和 Electron IPC 命令。解耦评估：避免重复硬编码协议字段。 */
import { Constants } from "./imports";
/** 用途：引入桌面搜索入口。使用范围：全局搜索命令。解耦评估：搜索对话框构造由搜索模块封装。 */
import { openSearch } from "./imports";
/** 用途：引入钉住搜索入口。使用范围：stickSearch 命令。解耦评估：命令层只传入选中文本和钉住标记。 */
import { openGlobalSearch } from "./imports";
/** 用途：引入历史后退入口。使用范围：goBack 命令。解耦评估：平台导航由既有工具封装。 */
import { goBack } from "./imports";
/** 用途：引入历史前进入口。使用范围：goForward 命令。解耦评估：平台导航由既有工具封装。 */
import { goForward } from "./imports";
/** 用途：引入设置面板入口。使用范围：config 命令。解耦评估：命令层只触发设置 UI。 */
import { openSetting } from "./imports";
/** 用途：引入工作空间菜单入口。使用范围：mainMenu 命令。解耦评估：菜单构造仍由菜单模块负责。 */
import { workspaceMenu } from "./imports";
/** 用途：引入独立窗口判断。使用范围：mainMenu 命令。解耦评估：平台状态通过既有工具同步读取。 */
import { isWindow } from "./imports";
/** 用途：引入最近文档入口。使用范围：recentDocs 命令。解耦评估：最近文档业务由业务模块封装。 */
import { openRecentDocs } from "./imports";
/** 用途：引入最近关闭恢复入口。使用范围：recentClosed 命令。解耦评估：复杂恢复流程已沉到独立模块。 */
import { executeRecentClosedGlobalCommand } from "./imports";
/** 用途：引入 Dock 栏切换工具。使用范围：toggleDock 命令。解耦评估：布局 Dock 层负责具体显示状态。 */
import { toggleDockBar } from "./imports";
/** 用途：引入 Electron 环境判断。使用范围：toggleWin 命令。解耦评估：桌面专属命令需要同步环境分支。 */
import { isElectron } from "./imports";
/** 用途：引入 Electron IPC 发送入口。使用范围：toggleWin 命令。解耦评估：命令层通过 IPC 协议触发主进程行为。 */
import { ipcSend } from "./imports";
/** 用途：引入路由构建器。使用范围：声明桌面导航命令路由。解耦评估：命令匹配集中在 CaliburRouter。 */
import { calibur } from "./imports";
/** 用途：引入 arktype 类型声明器。使用范围：声明导航命令 split 条件。解耦评估：路由 schema 与执行逻辑分离。 */
import { type } from "./imports";
/** 用途：引入桌面命令常量。使用范围：避免导航命令字符串散落。解耦评估：命令契约集中定义。 */
import { DESKTOP_GLOBAL_COMMANDS } from "./imports";
/** 用途：引入全局命令上下文类型。使用范围：导航执行器签名。解耦评估：复用全局命令边界。 */
import type { GlobalCommandContext } from "./imports";

/** 获取当前选中文本，供搜索命令带入默认关键词。 */
const getSelectedText = () => (getSelection().rangeCount > 0 ? getSelection().getRangeAt(0) : document.createRange()).toString();

/** 执行设置命令。 */
const executeConfigDesktopGlobalCommand = ({ app }: GlobalCommandContext) => {
    openSetting(app);
    return true;
};

/** 执行桌面全局搜索命令。 */
const executeGlobalSearchDesktopGlobalCommand = ({ app }: GlobalCommandContext) => {
    openSearch({
        app,
        hotkey: Constants.DIALOG_GLOBALSEARCH,
        key: getSelectedText(),
    });
    return true;
};

/** 执行钉住搜索命令。 */
const executeStickSearchDesktopGlobalCommand = ({ app }: GlobalCommandContext) => {
    openGlobalSearch(app, getSelectedText(), true);
    return true;
};

/** 执行后退命令。 */
const executeGoBackDesktopGlobalCommand = ({ app }: GlobalCommandContext) => {
    goBack(app);
    return true;
};

/** 执行前进命令。 */
const executeGoForwardDesktopGlobalCommand = ({ app }: GlobalCommandContext) => {
    goForward(app);
    return true;
};

/** 执行桌面主菜单命令。 */
const executeMainMenuDesktopGlobalCommand = ({ app }: GlobalCommandContext) => {
    const workspaceButton = document.querySelector("#barWorkspace");
    // 独立窗口中不展示工作空间主菜单；主窗口需存在按钮才能计算菜单位置。
    if (!isWindow() && workspaceButton instanceof HTMLElement) {
        workspaceMenu(app, workspaceButton.getBoundingClientRect());
    }
    return true;
};

/** 执行最近文档命令。 */
const executeRecentDocsDesktopGlobalCommand = () => {
    openRecentDocs();
    return true;
};

/** 执行 Dock 栏显隐切换。 */
const executeToggleDockDesktopGlobalCommand = () => {
    toggleDockBar(document.querySelector("#barDock use"));
    return true;
};

/** 执行窗口隐藏与最小化命令。 */
const executeToggleWinDesktopGlobalCommand = () => {
    // toggleWin 只在 Electron 桌面端生效，非 Electron 环境保持已处理但不发送 IPC。
    if (isElectron) {
        ipcSend(Constants.SIYUAN_CMD, "hide");
        ipcSend(Constants.SIYUAN_CMD, "minimize");
    }
    return true;
};

/** 桌面导航命令路由。 */
const desktopNavigationCommandRouter = calibur
    .universe(type({ command: "string" }))
    .split(type({ command: `'${DESKTOP_GLOBAL_COMMANDS.CONFIG}'` }), () => executeConfigDesktopGlobalCommand)
    .split(type({ command: `'${DESKTOP_GLOBAL_COMMANDS.GLOBAL_SEARCH}'` }), () => executeGlobalSearchDesktopGlobalCommand)
    .split(type({ command: `'${DESKTOP_GLOBAL_COMMANDS.STICK_SEARCH}'` }), () => executeStickSearchDesktopGlobalCommand)
    .split(type({ command: `'${DESKTOP_GLOBAL_COMMANDS.GO_BACK}'` }), () => executeGoBackDesktopGlobalCommand)
    .split(type({ command: `'${DESKTOP_GLOBAL_COMMANDS.GO_FORWARD}'` }), () => executeGoForwardDesktopGlobalCommand)
    .split(type({ command: `'${DESKTOP_GLOBAL_COMMANDS.MAIN_MENU}'` }), () => executeMainMenuDesktopGlobalCommand)
    .split(type({ command: `'${DESKTOP_GLOBAL_COMMANDS.RECENT_DOCS}'` }), () => executeRecentDocsDesktopGlobalCommand)
    .split(type({ command: `'${DESKTOP_GLOBAL_COMMANDS.RECENT_CLOSED}'` }), () => executeRecentClosedGlobalCommand)
    .split(type({ command: `'${DESKTOP_GLOBAL_COMMANDS.TOGGLE_DOCK}'` }), () => executeToggleDockDesktopGlobalCommand)
    .remain(() => executeToggleWinDesktopGlobalCommand)
    .build();

/**
 * 执行桌面导航命令。
 * @同步豁免: UI构建 - 桌面导航命令需要立即操作对话框、菜单、Dock 或发送既有 IPC。
 */
export const executeDesktopNavigationGlobalCommand = (context: GlobalCommandContext) => {
    const executor = desktopNavigationCommandRouter({ command: context.command });
    return executor(context);
};
