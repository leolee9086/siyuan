/** 用途：引入标签切换工具。使用范围：goToTab* 命令。解耦评估：标签切换逻辑继续复用布局工具。 */
import { switchTabByIndex } from "./imports";
/** 用途：引入全部标签获取工具。使用范围：编辑标签顺序切换命令。解耦评估：命令依赖即时布局状态，复用布局遍历工具。 */
import { getAllTabs } from "./imports";
/** 用途：引入布局实例查询工具。使用范围：编辑标签顺序切换命令。解耦评估：保持原布局索引查询方式。 */
import { getInstanceById } from "./imports";
/** 用途：引入 Tab 类型和值。使用范围：校验按 ID 查询到的实例。解耦评估：布局核心类型由网关集中转发。 */
import { Tab } from "./imports";
/** 用途：引入路由构建器。使用范围：声明桌面标签命令路由。解耦评估：命令匹配集中在 CaliburRouter。 */
import { calibur } from "./imports";
/** 用途：引入 arktype 类型声明器。使用范围：声明标签命令 split 条件。解耦评估：路由 schema 与执行逻辑分离。 */
import { type } from "./imports";
/** 用途：引入桌面命令常量。使用范围：避免标签命令字符串散落。解耦评估：命令契约集中定义。 */
import { DESKTOP_GLOBAL_COMMANDS } from "./imports";
/** 用途：引入全局命令上下文类型。使用范围：标注标签执行器参数。解耦评估：复用全局命令边界。 */
import type { GlobalCommandContext } from "./imports";
/** 用途：主应用宿主身份；使用范围：桌面标签命令上下文绑定；解耦评估：具体类型只在实现模块使用。 */
import type {App} from "./imports";

/** 桌面标签序号路由，将命令字符串映射为 switchTabByIndex 参数。 */
const desktopTabIndexRouter = calibur
    .universe(type({ command: "string" }))
    .split(type({ command: `'${DESKTOP_GLOBAL_COMMANDS.GO_TO_TAB_1}'` }), () => 0)
    .split(type({ command: `'${DESKTOP_GLOBAL_COMMANDS.GO_TO_TAB_2}'` }), () => 1)
    .split(type({ command: `'${DESKTOP_GLOBAL_COMMANDS.GO_TO_TAB_3}'` }), () => 2)
    .split(type({ command: `'${DESKTOP_GLOBAL_COMMANDS.GO_TO_TAB_4}'` }), () => 3)
    .split(type({ command: `'${DESKTOP_GLOBAL_COMMANDS.GO_TO_TAB_5}'` }), () => 4)
    .split(type({ command: `'${DESKTOP_GLOBAL_COMMANDS.GO_TO_TAB_6}'` }), () => 5)
    .split(type({ command: `'${DESKTOP_GLOBAL_COMMANDS.GO_TO_TAB_7}'` }), () => 6)
    .split(type({ command: `'${DESKTOP_GLOBAL_COMMANDS.GO_TO_TAB_8}'` }), () => 7)
    .split(type({ command: `'${DESKTOP_GLOBAL_COMMANDS.GO_TO_TAB_9}'` }), () => -1)
    .split(type({ command: `'${DESKTOP_GLOBAL_COMMANDS.GO_TO_TAB_NEXT}'` }), () => -3)
    .remain(() => -2)
    .build();

/** 执行标签序号切换命令。 */
const executeTabIndexDesktopGlobalCommand = ({ command }: GlobalCommandContext<App>) => {
    switchTabByIndex(desktopTabIndexRouter({ command }));
    return true;
};

/** 计算最近编辑标签切换目标。 */
const getEditTabTarget = (command: string, tabs: Tab[], index: number) => {
    if (command === DESKTOP_GLOBAL_COMMANDS.GO_TO_EDIT_TAB_PREV) {
        return index === 0 ? tabs.at(-1) : tabs.at(index - 1);
    }
    return index === tabs.length - 1 ? tabs.at(0) : tabs.at(index + 1);
};

/** 切换到指定的最近编辑标签。 */
const switchToEditTab = (command: string, tabs: Tab[], index: number) => {
    const newItem = getEditTabTarget(command, tabs, index);
    // 最近编辑列表为空或目标不存在时，沿用命令已处理但不切换的语义。
    if (!newItem) {
        return true;
    }
    const tab = getInstanceById(newItem.id);
    // getAllTabs 返回 Tab，按 id 查询仍需确认实例类型后再调用标签方法。
    if (tab instanceof Tab) {
        tab.parent.switchTab(newItem.headElement);
        tab.parent.showHeading();
    }
    return true;
};

/** 执行按最近编辑顺序切换标签命令。 */
const executeGoToEditTabDesktopGlobalCommand = ({ command }: GlobalCommandContext<App>) => {
    let currentTabElement = document.querySelector(".layout__wnd--active ul.layout-tab-bar > .item--focus");
    // 没有活动窗口时退回查找任意聚焦标签，保持原有兜底行为。
    if (!currentTabElement) {
        currentTabElement = document.querySelector("ul.layout-tab-bar > .item--focus");
    }
    // 没有可切换的当前标签时命令仍视为已处理。
    if (!currentTabElement) {
        return true;
    }
    const currentId = currentTabElement.getAttribute("data-id");
    const tabs = getAllTabs().sort((itemA, itemB) => {
        return itemA.headElement.getAttribute("data-activetime") > itemB.headElement.getAttribute("data-activetime") ? -1 : 1;
    });
    const currentIndex = tabs.findIndex((item) => currentId === item.id);
    // 当前标签不在布局索引中时保持已处理但不切换。
    if (currentIndex < 0) {
        return true;
    }
    return switchToEditTab(command, tabs, currentIndex);
};

/** 桌面标签命令路由。 */
const desktopTabCommandRouter = calibur
    .universe(type({ command: "string" }))
    .split(type({ command: `'${DESKTOP_GLOBAL_COMMANDS.GO_TO_EDIT_TAB_NEXT}' | '${DESKTOP_GLOBAL_COMMANDS.GO_TO_EDIT_TAB_PREV}'` }), () => executeGoToEditTabDesktopGlobalCommand)
    .remain(() => executeTabIndexDesktopGlobalCommand)
    .build();

/**
 * 执行桌面标签命令。
 * @同步豁免: UI构建 - 标签切换是同步布局操作，命令入口需要立即返回处理状态。
 */
export const executeDesktopTabGlobalCommand = (context: GlobalCommandContext<App>) => {
    const executor = desktopTabCommandRouter({ command: context.command });
    return executor(context);
};
