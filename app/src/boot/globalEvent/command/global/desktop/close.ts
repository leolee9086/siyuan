/** 用途：引入编辑器模型类型。使用范围：关闭未修改标签页时检查 protyle.updated。解耦评估：通过本目录网关集中依赖编辑器模型。 */
import { Editor } from "./imports";
/** 用途：引入活动标签获取工具。使用范围：关闭类桌面命令。解耦评估：当前标签状态由布局工具同步读取。 */
import { getActiveTab } from "./imports";
/** 用途：引入 Dock 获取工具。使用范围：关闭当前 Dock 页签。解耦评估：Dock 状态操作通过布局层公开工具完成。 */
import { getDockByType } from "./imports";
/** 用途：引入标签关闭工具。使用范围：closeAll/closeOthers/closeLeft/closeRight/closeUnmodified。解耦评估：关闭策略继续由布局工具处理。 */
import { closeTabByType } from "./imports";
/** 用途：引入块面板访问器。使用范围：closeTab 无标签时关闭块浮窗。解耦评估：通过环境访问器替代新增直接 window 访问。 */
import { getSiyuanBlockPanels } from "./imports";
/** 用途：引入 Dock 类型守卫。使用范围：从 DOM 类名恢复 Dock 类型。解耦评估：复用布局层现有运行时校验。 */
import { isTDock } from "./imports";
/** 用途：引入 Tab 类型和值。使用范围：标注待关闭标签集合。解耦评估：布局核心类型由网关集中转发。 */
import { Tab } from "./imports";
/** 用途：引入路由构建器。使用范围：声明桌面关闭命令路由。解耦评估：命令匹配集中在 CaliburRouter。 */
import { calibur } from "./imports";
/** 用途：引入 arktype 类型声明器。使用范围：声明关闭命令 split 条件。解耦评估：路由 schema 与执行逻辑分离。 */
import { type } from "./imports";
/** 用途：引入桌面命令常量。使用范围：避免关闭命令字符串散落。解耦评估：命令契约集中定义。 */
import { DESKTOP_GLOBAL_COMMANDS } from "./imports";
/** 用途：引入全局命令上下文类型。使用范围：标注关闭执行器参数。解耦评估：复用全局命令边界。 */
import type { GlobalCommandContext } from "./imports";
/** 用途：主应用宿主身份；使用范围：桌面关闭命令上下文绑定；解耦评估：具体类型只在实现模块使用。 */
import type { AppFacade } from "./imports";

/** 判断标签是否属于关闭未修改命令的目标集合。 */
const isUnmodifiedTab = (tab: Tab) => {
    const editor = tab.model;
    return !(editor instanceof Editor) || (editor.editor?.protyle && !editor.editor.protyle.updated);
};

/** 执行关闭未修改标签命令。 */
const executeCloseUnmodifiedDesktopGlobalCommand = () => {
    const tab = getActiveTab(false);
    // 仅当存在活动标签时才能基于同窗口 children 计算未修改标签集合。
    if (!tab) {
        return true;
    }
    const unmodifiedTabs = tab.parent.children.filter(isUnmodifiedTab);
    // 没有未修改标签时保持命令已处理但不触发关闭。
    if (unmodifiedTabs.length > 0) {
        closeTabByType(tab, "other", unmodifiedTabs);
    }
    return true;
};

/** 从当前活动 Dock 面板的 CSS 类名中解析 Dock 类型。 */
const getActiveDockType = (activeTabElement: Element) => {
    const dockClass = Array.from(activeTabElement.classList).find((item) => item.startsWith("sy__"));
    const dockType = dockClass?.replace("sy__", "");
    // DOM 类名可能来自插件或旧布局数据，必须经守卫确认后才能作为 TDock 使用。
    if (isTDock(dockType)) {
        return dockType;
    }
    return undefined;
};

/** 尝试关闭当前聚焦的 Dock 面板。 */
const closeActiveDockPanel = () => {
    const activeTabElement = document.querySelector(".layout__tab--active");
    // 当前聚焦的不是可见 Dock 页签时，交由普通标签关闭流程处理。
    if (!activeTabElement || activeTabElement.getBoundingClientRect().width <= 0) {
        return false;
    }
    const dockType = getActiveDockType(activeTabElement);
    // 活动 Dock 页签没有可识别类型时，也视为 Dock 关闭流程已处理。
    if (dockType) {
        getDockByType(dockType)?.toggleModel(dockType, false, true);
    }
    return true;
};

/** 执行关闭当前标签或面板命令。 */
const executeCloseTabDesktopGlobalCommand = () => {
    // Dock 面板拥有独立关闭语义，优先于编辑标签关闭。
    if (closeActiveDockPanel()) {
        return true;
    }
    const tab = getActiveTab();
    // 有聚焦标签时直接关闭聚焦标签。
    if (tab) {
        tab.parent.removeTab(tab.id);
        return true;
    }
    const blockPanel = getSiyuanBlockPanels().at(-1);
    // 没有聚焦标签时，优先关闭最后一个块浮窗，保留原 issue #14729 的兜底语义。
    if (blockPanel) {
        blockPanel.destroy();
        return true;
    }
    const noFocusTab = getActiveTab(false);
    // 最后尝试关闭无焦点但仍处于活动上下文的标签。
    if (noFocusTab) {
        noFocusTab.parent.removeTab(noFocusTab.id);
    }
    return true;
};

/** 执行关闭其它或全部标签命令。 */
const executeCloseGroupDesktopGlobalCommand = ({ command }: GlobalCommandContext<AppFacade>) => {
    const tab = getActiveTab(false);
    // 只有存在活动标签时，closeOthers/closeAll 才有目标窗口。
    if (tab) {
        closeTabByType(tab, command);
    }
    return true;
};

/** 基于当前标签将同窗口标签拆分为左侧和右侧集合。 */
const splitSideTabs = (tab: Tab) => {
    const currentIndex = tab.parent.children.findIndex((item) => item.id === tab.id);
    return {
        leftTabs: tab.parent.children.slice(0, currentIndex),
        rightTabs: tab.parent.children.slice(currentIndex + 1),
    };
};

/** 执行关闭左侧或右侧标签命令。 */
const executeCloseSideDesktopGlobalCommand = ({ command }: GlobalCommandContext<AppFacade>) => {
    const tab = getActiveTab(false);
    // 没有活动标签时命令保持已处理，不进行任何关闭。
    if (!tab) {
        return true;
    }
    const { leftTabs, rightTabs } = splitSideTabs(tab);
    const tabs = command === DESKTOP_GLOBAL_COMMANDS.CLOSE_LEFT ? leftTabs : rightTabs;
    // 目标侧没有标签时保持命令已处理但不触发关闭。
    if (tabs.length > 0) {
        closeTabByType(tab, "other", tabs);
    }
    return true;
};

/** 桌面关闭命令路由。 */
const desktopCloseCommandRouter = calibur
    .universe(type({ command: "string" }))
    .split(type({ command: `'${DESKTOP_GLOBAL_COMMANDS.CLOSE_UNMODIFIED}'` }), () => executeCloseUnmodifiedDesktopGlobalCommand)
    .split(type({ command: `'${DESKTOP_GLOBAL_COMMANDS.CLOSE_TAB}'` }), () => executeCloseTabDesktopGlobalCommand)
    .split(type({ command: `'${DESKTOP_GLOBAL_COMMANDS.CLOSE_OTHERS}' | '${DESKTOP_GLOBAL_COMMANDS.CLOSE_ALL}'` }), () => executeCloseGroupDesktopGlobalCommand)
    .remain(() => executeCloseSideDesktopGlobalCommand)
    .build();

/**
 * 执行桌面关闭命令。
 * @同步豁免: UI构建 - 关闭标签、Dock 和浮窗是同步布局操作，命令入口需要立即返回处理状态。
 */
export const executeDesktopCloseGlobalCommand = (context: GlobalCommandContext<AppFacade>) => {
    const executor = desktopCloseCommandRouter({ command: context.command });
    return executor(context);
};
