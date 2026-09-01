/** 用途：引入活动标签获取工具。使用范围：拆分、移动、取消拆分等桌面命令。解耦评估：当前标签状态由布局工具同步读取。 */
import { getActiveTab } from "./imports";
/** 用途：引入全部窗口获取工具。使用范围：取消拆分命令。解耦评估：命令依赖布局树遍历，复用既有工具。 */
import { getAllWnds } from "./imports";
/** 用途：引入标签复制工具。使用范围：splitLR/splitTB 命令。解耦评估：复制细节继续由布局标签工具封装。 */
import { copyTab } from "./imports";
/** 用途：引入标签尺寸重排工具。使用范围：移动拆分和取消拆分后刷新布局。解耦评估：布局尺寸更新由既有工具处理。 */
import { resizeTabs } from "./imports";
/** 用途：引入新窗口打开入口。使用范围：tabToWindow 命令。解耦评估：窗口创建逻辑由窗口模块封装。 */
import { openNewWindow } from "./imports";
/** 用途：引入取消拆分工具。使用范围：unsplit/unsplitAll 命令。解耦评估：布局重组仍由菜单层既有工具执行。 */
import { unsplitWnd, unsplitCurrentWnd } from "./imports";
/** 用途：引入布局访问器。使用范围：取消拆分命令读取 centerLayout。解耦评估：通过环境访问器替代新增直接 window 访问。 */
import { getSiyuanLayout } from "./imports";
/** 用途：引入 Wnd 类型和值。使用范围：取消拆分时标注窗口数组。解耦评估：布局核心类型由网关集中转发。 */
import { Wnd } from "./imports";
/** 用途：引入 Layout 类型和值。使用范围：取消拆分时标注布局变量。解耦评估：布局核心类型由网关集中转发。 */
import { Layout } from "./imports";
/** 用途：引入路由构建器。使用范围：声明桌面拆分命令路由。解耦评估：命令匹配集中在 CaliburRouter。 */
import { calibur } from "./imports";
/** 用途：引入 arktype 类型声明器。使用范围：声明拆分命令 split 条件。解耦评估：路由 schema 与执行逻辑分离。 */
import { type } from "./imports";
/** 用途：引入桌面命令常量。使用范围：避免拆分命令字符串散落。解耦评估：命令契约集中定义。 */
import { DESKTOP_GLOBAL_COMMANDS } from "./imports";
/** 用途：引入全局命令上下文类型。使用范围：标注拆分执行器参数。解耦评估：复用全局命令边界。 */
import type { GlobalCommandContext } from "./imports";
/** 用途：主应用宿主身份；使用范围：桌面拆分命令上下文绑定；解耦评估：具体类型只在实现模块使用。 */
import type { AppFacade } from "./imports";

/** 执行取消所有拆分命令。 */
const executeUnsplitAllDesktopGlobalCommand = () => {
    const centerLayout = getSiyuanLayout().centerLayout;
    // centerLayout 存在时才调用取消拆分，避免在布局尚未初始化时传入 undefined。
    if (centerLayout) {
        unsplitWnd(centerLayout, centerLayout);
    }
    return true;
};

/** 执行取消当前拆分命令。 */
const executeUnsplitDesktopGlobalCommand = () => {
    const tab = getActiveTab(false);
    if (!tab) {
        return true;
    }
    unsplitCurrentWnd(tab.parent);
    resizeTabs();
    return true;
};

/** 执行复制标签到左右拆分命令。 */
const executeSplitCopyDesktopGlobalCommand = ({ app, command }: GlobalCommandContext<AppFacade>) => {
    const tab = getActiveTab(false);
    // 存在活动标签时才能复制到新拆分窗口。
    if (tab) {
        tab.parent.split(command === DESKTOP_GLOBAL_COMMANDS.SPLIT_LR ? "lr" : "tb").addTab(copyTab(app, tab));
    }
    return true;
};

/** 执行移动标签到新拆分命令。 */
const executeSplitMoveDesktopGlobalCommand = ({ command }: GlobalCommandContext<AppFacade>) => {
    const tab = getActiveTab(false);
    // 只有同一窗口内至少两个标签时，移动当前标签到新拆分才有意义。
    if (tab && tab.parent.children.length > 1) {
        const newWnd = tab.parent.split(command === DESKTOP_GLOBAL_COMMANDS.SPLIT_MOVE_B ? "tb" : "lr");
        newWnd.headersElement.append(tab.headElement);
        newWnd.headersElement.parentElement.classList.remove("fn__none");
        newWnd.moveTab(tab);
        resizeTabs();
    }
    return true;
};

/** 执行标签移到新窗口命令。 */
const executeTabToWindowDesktopGlobalCommand = () => {
    const tab = getActiveTab(false);
    // 存在活动标签时才能迁移到新窗口。
    if (tab) {
        openNewWindow(tab);
    }
    return true;
};

/** 桌面拆分命令路由。 */
const desktopSplitCommandRouter = calibur
    .universe(type({ command: "string" }))
    .split(type({ command: `'${DESKTOP_GLOBAL_COMMANDS.UNSPLIT_ALL}'` }), () => executeUnsplitAllDesktopGlobalCommand)
    .split(type({ command: `'${DESKTOP_GLOBAL_COMMANDS.UNSPLIT}'` }), () => executeUnsplitDesktopGlobalCommand)
    .split(type({ command: `'${DESKTOP_GLOBAL_COMMANDS.SPLIT_LR}' | '${DESKTOP_GLOBAL_COMMANDS.SPLIT_TB}'` }), () => executeSplitCopyDesktopGlobalCommand)
    .split(type({ command: `'${DESKTOP_GLOBAL_COMMANDS.SPLIT_MOVE_B}' | '${DESKTOP_GLOBAL_COMMANDS.SPLIT_MOVE_R}'` }), () => executeSplitMoveDesktopGlobalCommand)
    .remain(() => executeTabToWindowDesktopGlobalCommand)
    .build();

/**
 * 执行桌面拆分命令。
 * @同步豁免: UI构建 - 拆分和取消拆分是同步布局操作，命令入口需要立即返回处理状态。
 */
export const executeDesktopSplitGlobalCommand = (context: GlobalCommandContext<AppFacade>) => {
    const executor = desktopSplitCommandRouter({ command: context.command });
    return executor(context);
};
